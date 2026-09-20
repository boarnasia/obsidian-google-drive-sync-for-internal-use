import { ButtonComponent, ItemView, Notice, Setting, WorkspaceLeaf } from "obsidian";
import type GoogleDriveSyncPlugin from "../main";
import { BlockReason, SyncPlan } from "../sync/types";
import { relativeTime } from "../util/time";
import { t } from "../i18n";

export const SYNC_PANEL_VIEW = "google-drive-sync-panel";

/**
 * 同期管理のサイドバー。
 *
 * 見えないまま自動で進む同期に、目と手を付けるための画面である。何が起きるのかを
 * 適用前に見せ、止まっているならその理由と抜け道を出す（ADR-0005）。
 */
export class SyncPanelView extends ItemView {
  private plan: SyncPlan | null = null;
  private computedAt = 0;
  private busy = false;
  private error: string | null = null;
  /** 承認する削除。利用者が選ぶまで空で、既定では何も消さない。 */
  private readonly approved = new Set<string>();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: GoogleDriveSyncPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return SYNC_PANEL_VIEW;
  }

  getDisplayText(): string {
    return t.panelTitle;
  }

  getIcon(): string {
    return "refresh-cw";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  /** 差分を数え直す。数えるだけで、何も動かさない。 */
  async refresh(): Promise<void> {
    if (!this.plugin.controller.ready) {
      this.plan = null;
      this.render();
      return;
    }
    this.busy = true;
    this.render();
    try {
      this.plan = await this.plugin.controller.plan();
      this.computedAt = Date.now();
      this.error = null;
      // 対象でなくなった削除の選択は残さない。
      for (const path of [...this.approved]) {
        if (!this.plan.deleteRemote.includes(path) && !this.plan.deleteLocal.includes(path)) this.approved.delete(path);
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.busy = false;
      this.render();
    }
  }

  // ------------------------------------------------------------------ 描画

  private render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("gds-panel");

    root.createEl("h3", { text: t.panelTitle });

    if (!this.plugin.controller.connected) {
      root.createDiv({ cls: "gds-panel-note", text: t.panelNeedsConnection });
      return;
    }
    if (!this.plugin.controller.ready) {
      root.createDiv({ cls: "gds-panel-note", text: t.panelNeedsTarget });
      return;
    }

    this.renderStatus(root);
    this.renderActions(root);
    if (this.plan) {
      this.renderHeldDeletes(root, this.plan);
      this.renderCounts(root, this.plan);
    }
  }

  private renderStatus(root: HTMLElement): void {
    const box = root.createDiv({ cls: "gds-panel-status" });
    if (this.error) {
      box.createDiv({ cls: "gds-panel-blocked", text: `✗ ${this.error}` });
      return;
    }
    if (this.busy && !this.plan) {
      box.createDiv({ text: t.panelChecking });
      return;
    }
    if (!this.plan) return;

    if (this.plan.blocked.length === 0) {
      box.createDiv({ text: t.panelReady });
    } else {
      box.createDiv({ cls: "gds-panel-blocked", text: t.panelBlocked });
      for (const reason of this.plan.blocked) box.createDiv({ cls: "gds-panel-note", text: reasonText(reason) });
    }

    const last = this.plugin.settings.lastSyncAt;
    box.createDiv({
      cls: "gds-panel-note",
      text: last
        ? t.panelLastSynced(relativeTime(last, Date.now(), t.relWords))
        : t.syncNowDescNever,
    });
    if (this.computedAt) {
      box.createDiv({
        cls: "gds-panel-note",
        text: t.panelCheckedAt(relativeTime(this.computedAt, Date.now(), t.relWords)),
      });
    }
  }

  private renderActions(root: HTMLElement): void {
    const canSync = !!this.plan && this.plan.blocked.length === 0;
    new Setting(root)
      .setName(t.panelActions)
      .addButton((b) => this.action(b, t.syncNowName, canSync && !this.busy, () => this.runSync()))
      .addButton((b) => this.action(b, t.btnClone, !this.busy, () => this.runClone()))
      .addButton((b) => this.action(b, t.btnRefresh, !this.busy, () => void this.refresh()));
  }

  private action(b: ButtonComponent, label: string, enabled: boolean, onClick: () => void): void {
    b.setButtonText(label).setDisabled(!enabled).onClick(onClick);
    if (label === t.syncNowName && enabled) b.setCta();
  }

  /**
   * 保留された削除。ここだけがチームのデータを実際に消すので、既定では何も
   * 選ばれておらず、件数を示してから実行する。
   */
  private renderHeldDeletes(root: HTMLElement, plan: SyncPlan): void {
    const held = [...plan.deleteRemote, ...plan.deleteLocal];
    if (held.length === 0) return;

    root.createEl("h4", { text: t.panelHeldDeletes(held.length) });
    root.createDiv({ cls: "gds-panel-note", text: t.panelHeldDeletesDesc });

    const list = root.createDiv({ cls: "gds-panel-list" });
    for (const path of held.slice(0, MAX_ROWS)) {
      const row = list.createDiv({ cls: "gds-panel-row" });
      const box = row.createEl("input", { type: "checkbox" });
      box.checked = this.approved.has(path);
      box.addEventListener("change", () => {
        if (box.checked) this.approved.add(path);
        else this.approved.delete(path);
        this.render();
      });
      row.createSpan({ text: path, cls: plan.deleteRemote.includes(path) ? "gds-panel-remote" : "gds-panel-local" });
    }
    if (held.length > MAX_ROWS) list.createDiv({ cls: "gds-panel-note", text: t.panelMore(held.length - MAX_ROWS) });

    new Setting(root)
      .addButton((b) =>
        b
          .setButtonText(t.btnSelectAll)
          .setDisabled(this.busy)
          .onClick(() => {
            for (const path of held) this.approved.add(path);
            this.render();
          })
      )
      .addButton((b) =>
        b
          .setButtonText(t.btnApproveDeletes(this.approved.size))
          .setDisabled(this.busy || this.approved.size === 0)
          .onClick(() => this.approveDeletes())
      );
  }

  private renderCounts(root: HTMLElement, plan: SyncPlan): void {
    const rows: [string, string[]][] = [
      [t.panelUpload, plan.upload],
      [t.panelDownload, plan.download],
      [t.panelConflict, plan.conflict],
      [t.panelLocalOnly, plan.localOnly],
    ];
    if (rows.every(([, paths]) => paths.length === 0)) {
      root.createDiv({ cls: "gds-panel-note", text: t.panelNoChanges });
      return;
    }
    root.createEl("h4", { text: t.panelChanges });
    const list = root.createDiv({ cls: "gds-panel-list" });
    for (const [label, paths] of rows) {
      if (paths.length === 0) continue;
      list.createDiv({ cls: "gds-panel-row", text: `${label}: ${paths.length}` });
      for (const path of paths.slice(0, MAX_ROWS)) list.createDiv({ cls: "gds-panel-note", text: path });
      if (paths.length > MAX_ROWS) list.createDiv({ cls: "gds-panel-note", text: t.panelMore(paths.length - MAX_ROWS) });
    }
  }

  // ---------------------------------------------------------------- 操作

  private async withBusy(run: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      await run();
    } catch (e) {
      new Notice(t.notice(e instanceof Error ? e.message : String(e)));
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  private runSync(): void {
    void this.withBusy(() => this.plugin.runSync());
  }

  private runClone(): void {
    void this.withBusy(async () => {
      const report = await this.plugin.controller.clone();
      new Notice(
        t.notice(t.cloneDone(report.downloaded.length, report.conflicts.length, report.localOnly.length)),
        NOTICE_MS
      );
    });
  }

  private approveDeletes(): void {
    const approved = new Set(this.approved);
    void this.withBusy(async () => {
      await this.plugin.runSync({ approvedDeletes: approved });
      this.approved.clear();
    });
  }
}

/** 一覧に出す最大行数。数百件をそのまま描くと画面が固まる。 */
const MAX_ROWS = 50;
const NOTICE_MS = 10_000;

function reasonText(reason: BlockReason): string {
  switch (reason) {
    case "no-baseline":
      return t.reasonNoBaseline;
    case "vault-empty":
      return t.reasonVaultEmpty;
    case "delete-guard":
      return t.reasonDeleteGuard;
  }
}
