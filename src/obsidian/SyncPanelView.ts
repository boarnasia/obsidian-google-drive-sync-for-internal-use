import { ButtonComponent, ItemView, Notice, Setting, WorkspaceLeaf } from "obsidian";
import type GoogleDriveSyncPlugin from "../main";
import { BlockReason, CloneProgress, SyncPlan } from "../sync/types";
import { FailureKind, isTransient } from "../sync/errors";
import { relativeTime } from "../util/time";
import { formatBytes, percentOf } from "../util/progress";
import { ConfirmModal } from "./ConfirmModal";
import { fullPathOf, openInTextEditor } from "./openExternal";
import { TEAM_IGNORE_PATH } from "../sync/configFiles";
import { t } from "../i18n";

export const SYNC_PANEL_VIEW = "google-drive-sync-panel";

/** BRAT の「更新を確認して更新」。BRAT の自動更新は起動時だけなので、開いたままの人はここで追いつく。 */
const BRAT_UPDATE_COMMAND = "obsidian42-brat:checkForUpdatesAndUpdate";

/** 公開 API に無い、コマンドの実行とプラグインの有効状態。 */
interface AppInternals {
  commands?: { executeCommandById(id: string): boolean };
  plugins?: { enabledPlugins?: Set<string> };
  setting?: { open(): void; openTabById(id: string): void };
}

/**
 * 同期管理のサイドバー。
 *
 * 見えないまま自動で進む同期に、目と手を付けるための画面である。何が起きるのかを
 * 適用前に見せ、止まっているならその理由と抜け道を出す（ADR-0005）。ローカル固有
 * ファイルの分類もここで完結させる（ADR-0006）。
 */
export class SyncPanelView extends ItemView {
  private plan: SyncPlan | null = null;
  private computedAt = 0;
  private busy = false;
  /** 承認する削除。利用者が選ぶまで空で、既定では何も消さない。 */
  private readonly approved = new Set<string>();
  /** 取り込みの進み具合を描く場所。進み具合が変わったら、ここだけを描き直す。 */
  private progressEl: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

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
    // 全体を描き直すと、分類の一覧のスクロール位置が戻る。進み具合の欄だけを書き換える。
    this.unsubscribe = this.plugin.onCloneProgress(() => {
      if (this.plugin.cloneProgress && this.progressEl) this.renderProgress(this.progressEl, this.plugin.cloneProgress);
      else this.render();
    });
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
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
      this.plugin.clearFailure();
      // 承認を待っていないものの選択は残さない。一覧から消えた行の承認が残ると、
      // 次に上限に当たったときに、選んだ憶えの無い削除が選ばれた状態で現れる。
      const held = new Set(this.heldDeletes(this.plan));
      for (const path of [...this.approved]) if (!held.has(path)) this.approved.delete(path);
    } catch (e) {
      // 失敗の控えと自動の再試行はプラグインが一手に持つ。数え直しの失敗も同じ扱いにする。
      this.plugin.noteFailure(e);
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
      this.renderUnsorted(root, this.plan);
      this.renderCounts(root, this.plan);
    }
    this.renderConfigFiles(root);
  }

  /**
   * 版が古い。同期は止まっているので、止まっている理由と更新の手段だけを出す
   * （ADR-0007）。
   */
  private renderVersionGap(box: HTMLElement): boolean {
    const gap = this.plugin.controller.versionGap;
    if (!gap) return false;
    box.createDiv({ cls: "gds-panel-blocked", text: t.panelVersionBehind(gap.mine, gap.team) });
    box.createDiv({ cls: "gds-panel-note", text: t.panelVersionBehindDesc });
    const app = this.app as unknown as AppInternals;
    const brat = app.plugins?.enabledPlugins?.has("obsidian42-brat") ?? false;
    if (brat) {
      const row = box.createDiv({ cls: "gds-panel-actions" });
      this.action(row, t.btnUpdateViaBrat, t.tipUpdateViaBrat, true, () => {
        app.commands?.executeCommandById(BRAT_UPDATE_COMMAND);
      }).setCta();
    }
    return true;
  }

  /**
   * 失敗の知らせ方。自然に直るものは落ち着いた色で、待てば直ることと、すぐ試す
   * 手段を出す。直らないものは赤で、必要な操作（再接続など）を添える。
   */
  private renderFailure(box: HTMLElement, failure: { kind: FailureKind; message: string; retryAt: number | null }): void {
    const transient = isTransient(failure.kind);
    box.createDiv({ cls: transient ? "gds-panel-warning" : "gds-panel-blocked", text: failureText(failure.kind, failure.message) });
    // 原文も残す。種類分けを外していたとき、これが唯一の手がかりになる。
    if (failure.kind !== "other") box.createDiv({ cls: "gds-panel-note", text: t.failDetail(failure.message) });
    if (failure.retryAt !== null) {
      const left = failure.retryAt - Date.now();
      if (left > 0) box.createDiv({ cls: "gds-panel-note", text: t.failRetryIn(formatDuration(left)) });
    }
    if (failure.kind === "auth") {
      const row = box.createDiv({ cls: "gds-panel-actions" });
      this.action(row, t.btnOpenSettings, t.tipOpenSettings, true, () => {
        const app = this.app as unknown as AppInternals;
        app.setting?.open();
        app.setting?.openTabById(this.plugin.manifest.id);
      }).setCta();
    }
    const row = box.createDiv({ cls: "gds-panel-actions" });
    this.action(row, t.btnRefresh, t.tipRefresh, !this.busy, () => void this.refresh());
  }

  /**
   * 取り込みの進み具合。一覧の段階は総数が分からないので、バーを不確定にして
   * 見つけた件数だけを増やす。ダウンロードの割合はバイト数で出す。
   */
  private renderProgress(el: HTMLElement, p: CloneProgress): void {
    el.empty();
    el.createDiv({ cls: "gds-progress-title", text: t.progressTitle });
    const bar = el.createEl("progress", { cls: "gds-progress-bar" });
    bar.max = 100;

    if (p.phase === "scan") {
      // value を持たない progress は、ブラウザが不確定（流れる）表示にする。
      const parts = [t.progressScan(p.remoteFound)];
      if (p.localTotal > 0) parts.push(t.progressScanLocal(p.localDone, p.localTotal));
      el.createDiv({ cls: "gds-panel-note", text: parts.join(" · ") });
    } else if (p.phase === "download") {
      bar.value = percentOf(p);
      el.createDiv({
        cls: "gds-panel-note",
        text: `${percentOf(p)}% · ${t.progressFiles(p.done, p.total)} · ${formatBytes(p.bytesDone)} / ${formatBytes(p.bytesTotal)}`,
      });
      const facts: string[] = [];
      const remaining = this.plugin.cloneRemainingMs();
      if (remaining !== null) facts.push(t.progressRemaining(formatDuration(remaining)));
      if (p.failed > 0) facts.push(t.progressFailed(p.failed));
      if (facts.length) el.createDiv({ cls: p.failed > 0 ? "gds-panel-blocked" : "gds-panel-note", text: facts.join(" · ") });
      if (p.current) el.createDiv({ cls: "gds-panel-note gds-progress-current", text: p.current });
    } else {
      bar.value = 100;
      el.createDiv({ cls: "gds-panel-note", text: t.progressFinishing });
    }

    if (p.phase !== "finish") {
      const row = el.createDiv({ cls: "gds-panel-actions" });
      const cancel = this.action(row, t.btnCancelClone, t.tipCancelClone, true, () => {
        cancel.setDisabled(true);
        this.plugin.cancelClone();
      });
    }
  }

  /** `.tds-ignore` はドットで始まり Obsidian に表示されないので、ここから開く（ADR-0007）。 */
  private renderConfigFiles(root: HTMLElement): void {
    root.createEl("h4", { text: t.panelConfigFiles });
    root.createDiv({ cls: "gds-panel-note", text: t.panelIgnoreDesc });
    const row = root.createDiv({ cls: "gds-panel-row" });
    row.createSpan({ text: TEAM_IGNORE_PATH, cls: "gds-panel-path" });
    const buttons = row.createDiv({ cls: "gds-panel-rowactions" });
    this.action(buttons, t.btnOpenFile, t.tipOpenFile, true, () => void this.openIgnoreFile());
    this.action(buttons, t.btnCopyPath, t.tipCopyPath, true, () => void this.copyIgnorePath());
  }

  private async openIgnoreFile(): Promise<void> {
    const full = fullPathOf(this.app, TEAM_IGNORE_PATH);
    if (!full) return;
    try {
      // clone 前でも規則は書ける。無ければ雛形を置いてから開く。
      await this.plugin.controller.ensureIgnoreFile();
      await openInTextEditor(full);
    } catch (e) {
      new Notice(t.notice(t.errOpenFailed(e instanceof Error ? e.message : String(e))));
    }
  }

  private async copyIgnorePath(): Promise<void> {
    const full = fullPathOf(this.app, TEAM_IGNORE_PATH);
    if (!full) return;
    await navigator.clipboard.writeText(full);
    new Notice(t.notice(t.pathCopied(full)));
  }

  private renderStatus(root: HTMLElement): void {
    const box = root.createDiv({ cls: "gds-panel-status" });
    this.progressEl = null;
    const progress = this.plugin.cloneProgress;
    if (progress) {
      this.progressEl = box.createDiv({ cls: "gds-progress" });
      this.renderProgress(this.progressEl, progress);
      return;
    }
    if (this.renderVersionGap(box)) return;
    if (this.plugin.syncFailure) {
      this.renderFailure(box, this.plugin.syncFailure);
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
      text: last ? t.panelLastSynced(relativeTime(last, Date.now(), t.relWords)) : t.syncNowDescNever,
    });
    if (this.computedAt) {
      box.createDiv({
        cls: "gds-panel-note",
        text: t.panelCheckedAt(relativeTime(this.computedAt, Date.now(), t.relWords)),
      });
    }
  }

  /**
   * ボタンは幅に合わせて折り返す。サイドバーは利用者が好きな幅にするもので、
   * 狭いときに横一列を押し通すと、端のボタンが読めないまま切れる。
   */
  private renderActions(root: HTMLElement): void {
    const canSync = !!this.plan && this.plan.blocked.length === 0 && !this.plugin.controller.versionGap;
    root.createEl("h4", { text: t.panelActions });

    const row = root.createDiv({ cls: "gds-panel-actions" });
    this.action(row, t.syncNowName, t.tipSyncNow, canSync && !this.busy, () => this.runSync()).setCta();
    this.action(row, t.btnClone, t.tipClone, !this.busy && !this.plugin.controller.versionGap, () => this.runClone());
    this.action(row, t.btnRefresh, t.tipRefresh, !this.busy, () => void this.refresh());

    this.renderSyncSettings(root);
  }

  /**
   * 同期の設定。設定画面には置かない（同じものが二か所にあると、どちらが効くのか
   * 分からなくなる）。止めていても「今すぐ同期」は押せる。
   */
  private renderSyncSettings(root: HTMLElement): void {
    const s = this.plugin.settings;
    new Setting(root)
      .setName(t.autoSyncName)
      .setDesc(t.autoSyncDesc)
      .addToggle((toggle) =>
        toggle.setValue(s.autoSync).onChange((v) => {
          void this.plugin.setAutoSync(v);
        })
      );

    if (!s.autoSync) return;
    new Setting(root)
      .setName(t.pollName)
      .setDesc(t.pollDesc)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setValue(String(s.pollMinutes)).onChange((v) => {
          void this.plugin.setPollMinutes(Number(v));
        });
      });
  }

  private action(
    parent: HTMLElement,
    label: string,
    tooltip: string,
    enabled: boolean,
    onClick: () => void
  ): ButtonComponent {
    return new ButtonComponent(parent).setButtonText(label).setTooltip(tooltip).setDisabled(!enabled).onClick(onClick);
  }

  /**
   * 保留された削除。ここだけがチームのデータを実際に消すので、既定では何も
   * 選ばれておらず、件数を示してから実行する。
   */
  /**
   * 承認を待っている削除。上限に当たっていなければ空である——そのときの削除は
   * 保留されておらず、次の同期でそのまま消える。承認の一覧に並べると、止まって
   * いないものを止まっていると読ませ、押す必要の無いボタンを押させる。
   */
  private heldDeletes(plan: SyncPlan): string[] {
    if (!plan.blocked.includes("delete-guard")) return [];
    return [...plan.deleteRemote, ...plan.deleteLocal];
  }

  private renderHeldDeletes(root: HTMLElement, plan: SyncPlan): void {
    const held = this.heldDeletes(plan);
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

    const actions = root.createDiv({ cls: "gds-panel-actions" });
    this.action(actions, t.btnSelectAll, t.tipSelectAll, !this.busy, () => {
      for (const path of held) this.approved.add(path);
      this.render();
    });
    this.action(
      actions,
      t.btnApproveDeletes(this.approved.size),
      t.tipApproveDeletes,
      !this.busy && this.approved.size > 0,
      () => this.approveDeletes()
    );
  }

  /**
   * 未整理のローカル固有ファイル。これが、そのファイルのアップロードが止まって
   * いる理由そのものなので、行ごとにその場で決められるようにする（ADR-0006）。
   */
  private renderUnsorted(root: HTMLElement, plan: SyncPlan): void {
    if (plan.unsorted.length === 0) return;
    root.createEl("h4", { text: t.panelUnsorted(plan.unsorted.length) });
    root.createDiv({ cls: "gds-panel-note", text: t.panelLocalOnlyDesc });

    const list = root.createDiv({ cls: "gds-panel-list" });
    for (const path of plan.unsorted.slice(0, MAX_ROWS)) {
      const row = list.createDiv({ cls: "gds-panel-row" });
      row.createSpan({ text: path, cls: "gds-panel-path" });
      const buttons = row.createDiv({ cls: "gds-panel-rowactions" });
      this.action(buttons, t.btnShare, t.tipShare, !this.busy, () => this.share([path]));
      this.action(buttons, t.btnTrash, t.tipTrash, !this.busy, () => this.trash([path]));
    }
    if (plan.unsorted.length > MAX_ROWS) {
      list.createDiv({ cls: "gds-panel-note", text: t.panelMore(plan.unsorted.length - MAX_ROWS) });
    }

    const all = [...plan.unsorted];
    const actions = root.createDiv({ cls: "gds-panel-actions" });
    this.action(actions, t.btnShareAll(all.length), t.tipShareAll, !this.busy, () => this.share(all));
    this.action(actions, t.btnTrashAll(all.length), t.tipTrashAll, !this.busy, () => this.confirmTrashAll(all));
  }

  private renderCounts(root: HTMLElement, plan: SyncPlan): void {
    const rows: [string, string[]][] = [
      [t.panelUpload, plan.upload],
      [t.panelDownload, plan.download],
      [t.panelConflict, plan.conflict],
      [t.panelDeleteLocal, plan.deleteLocal],
      [t.panelDeleteRemote, plan.deleteRemote],
      [t.panelLocalOnly, plan.localOnly],
    ];
    if (rows.every(([, paths]) => paths.length === 0)) {
      root.createDiv({ cls: "gds-panel-note", text: t.panelNoChanges });
      return;
    }
    root.createEl("h4", { text: t.panelChanges });
    // 数百件を全部開いたままにすると、肝心の件数まで辿り着けない。
    for (const [label, paths] of rows) {
      if (paths.length === 0) continue;
      const box = root.createEl("details", { cls: "gds-panel-group" });
      box.createEl("summary", { text: `${label}: ${paths.length}` });
      const list = box.createDiv({ cls: "gds-panel-list" });
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
      const report = await this.plugin.runClone();
      new Notice(
        t.notice(t.cloneDone(report.downloaded.length, report.conflicts.length, report.localOnly.length)),
        NOTICE_MS
      );
    });
  }

  private share(paths: string[]): void {
    void this.withBusy(async () => {
      await this.plugin.controller.shareLocalFiles(paths);
      new Notice(t.notice(t.sharedDone(paths.length)), NOTICE_MS);
    });
  }

  private trash(paths: string[]): void {
    void this.withBusy(async () => {
      const result = await this.plugin.controller.trashLocalFiles(paths);
      new Notice(t.notice(t.trashedDone(result.trashed.length)), NOTICE_MS);
      for (const error of result.errors) new Notice(t.notice(error), NOTICE_MS);
    });
  }

  /** 一括削除だけは、件数を読ませてから実行する。 */
  private confirmTrashAll(paths: string[]): void {
    new ConfirmModal(this.app, {
      title: t.confirmTrashTitle,
      body: t.confirmTrashBody(paths.length),
      confirm: t.btnTrashAll(paths.length),
      onConfirm: () => this.trash(paths),
    }).open();
  }

  private approveDeletes(): void {
    const approved = new Set(this.approved);
    void this.withBusy(async () => {
      await this.plugin.runSync({ approvedDeletes: approved });
      this.approved.clear();
    });
  }
}

/** 残り時間。1 分未満は 5 秒刻み、それ以上は分に切り上げる。細かく出すと数字が揺れて読めない。 */
function formatDuration(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  return s < 60 ? t.durationSeconds(Math.ceil(s / 5) * 5) : t.durationMinutes(Math.ceil(s / 60));
}

/** 一覧に出す最大行数。数百件をそのまま描くと画面が固まる。 */
const MAX_ROWS = 50;
const NOTICE_MS = 10_000;

function failureText(kind: FailureKind, message: string): string {
  switch (kind) {
    case "network":
      return t.failNetwork;
    case "server":
      return t.failServer;
    case "auth":
      return t.failAuth;
    case "target":
      return t.failTarget;
    case "quota":
      return t.failQuota;
    case "other":
      return t.panelSyncFailed(message);
  }
}

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
