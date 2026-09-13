import {
  App,
  Notice,
  Plugin,
  PluginSettingTab,
  SettingDefinitionItem,
  SettingDefinitionRender,
  debounce,
  getLanguage,
} from "obsidian";
import { DEFAULT_SETTINGS, Settings } from "./settings";
import { SyncController } from "./SyncController";
import { SyncReport } from "./sync/types";
import { relativeTime } from "./util/time";
import { setLanguage, t } from "./i18n";

export default class GoogleDriveSyncPlugin extends Plugin {
  settings: Settings = DEFAULT_SETTINGS;
  controller!: SyncController;

  private pollId: number | null = null;
  private syncing = false;
  /** 同期中に届いたローカル変更。終わったらもう一度だけ走らせる。 */
  private pendingLocal = false;
  /** 変更が届いたパス。デバウンス後にまとめて判断する。 */
  private readonly touched = new Set<string>();
  /**
   * 直前の同期で自分が書いた Vault 相対パス。
   *
   * Vault API 経由で書く以上、自分の書き込みも modify / create / delete を発火する。
   * これを数えると、ダウンロードが次の同期を呼び、それがまた…と無駄な往復が続く。
   * 書いたパスを控えておき、戻ってきた分だけ消し込む。
   */
  private readonly selfWritten = new Set<string>();

  async onload(): Promise<void> {
    await this.loadSettings();
    // 利用者に見えるものを登録する前に。コマンド名とリボンの名称は登録時に
    // Obsidian が確定させ、以後読み直さない。
    setLanguage(this.settings.language, getLanguage());

    this.controller = new SyncController(this.app, this.settings, () => this.saveData(this.settings));

    this.addRibbonIcon("refresh-cw", t.ribbonSyncNow, () => void this.runSync());
    this.addCommand({ id: "sync-now", name: t.cmdSyncNow, callback: () => void this.runSync() });
    this.addSettingTab(new SettingTab(this.app, this));

    // `on` はイベント名ごとにオーバーロードされているため、まとめて回せない。
    this.registerEvent(this.app.vault.on("modify", (file) => this.noteChange(file.path)));
    this.registerEvent(this.app.vault.on("create", (file) => this.noteChange(file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.noteChange(file.path)));
    // リネームは移動であり、消えた側と現れた側の両方が同期の対象になる。
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.noteChange(oldPath);
        this.noteChange(file.path);
      })
    );

    this.applyPolling();
  }

  onunload(): void {
    this.stopPolling();
  }

  // ------------------------------------------------------ ローカル変更の検知

  private noteChange(path: string): void {
    if (this.selfWritten.delete(path)) return; // 自分が書いた分
    this.touched.add(path);
    this.onLocalChange();
  }

  /**
   * 編集が落ち着いてから走らせる（末尾側で発火）。打鍵のたびに同期しても、
   * 他の人に届く速さは変わらず、API を叩く回数だけが増える。
   */
  private readonly onLocalChange = debounce(
    () => {
      if (!this.settings.autoSync || this.touched.size === 0) return;
      this.touched.clear();
      if (this.syncing) {
        this.pendingLocal = true;
        return;
      }
      void this.runSync({ quiet: true });
    },
    3000,
    false
  );

  // ---------------------------------------------------------------- 同期

  /**
   * @param opts.probeFirst ポーリング由来。リモートに変更が無ければ何もしない。
   * @param opts.quiet 何も起きなかったときに通知を出さない（自動同期用）。
   */
  async runSync(opts: { probeFirst?: boolean; quiet?: boolean } = {}): Promise<void> {
    if (this.syncing) {
      if (!opts.quiet) new Notice(t.notice(t.syncAlreadyRunning));
      return;
    }
    if (opts.quiet && !this.controller.ready) return; // 未設定なら黙って見送る

    this.syncing = true;
    try {
      const report = opts.probeFirst
        ? await this.controller.syncIfRemoteChanged()
        : await this.controller.sync();
      if (report) {
        this.rememberOwnWrites(report);
        if (!opts.quiet || this.didSomething(report)) new Notice(t.notice(this.summarise(report)));
      }
    } catch (e) {
      if (!opts.quiet) new Notice(t.notice((e as Error).message));
    } finally {
      this.syncing = false;
      if (this.pendingLocal) {
        this.pendingLocal = false;
        void this.runSync({ quiet: true });
      }
    }
  }

  /** 自分が書いたパスを控える。戻ってくるイベントを数えないため。 */
  private rememberOwnWrites(report: SyncReport): void {
    const mount = this.settings.mountFolder.replace(/^\/+|\/+$/g, "");
    const toVaultPath = (p: string): string => (mount ? `${mount}/${p}` : p);
    for (const p of report.downloaded) this.selfWritten.add(toVaultPath(p));
    for (const p of report.deletedLocal) this.selfWritten.add(toVaultPath(p));
    for (const c of report.conflicts) this.selfWritten.add(toVaultPath(c.conflictPath));
  }

  private didSomething(r: SyncReport): boolean {
    return (
      r.uploaded.length + r.downloaded.length + r.deletedLocal.length + r.deletedRemote.length > 0 ||
      r.conflicts.length + r.errors.length + r.deferredDeletes.length > 0
    );
  }

  private summarise(r: SyncReport): string {
    const deletes = r.deletedLocal.length + r.deletedRemote.length;
    return (
      t.syncSummary(r.uploaded.length, r.downloaded.length, deletes, r.conflicts.length) +
      (r.deferredDeletes.length ? t.syncDeferred(r.deferredDeletes.length) : "") +
      (r.errors.length ? t.syncErrorCount(r.errors.length) : "")
    );
  }

  // -------------------------------------------------------------- ポーリング

  applyPolling(): void {
    this.stopPolling();
    if (!this.settings.autoSync) return;
    const ms = Math.max(1, this.settings.pollMinutes) * 60_000;
    this.pollId = window.setInterval(() => void this.runSync({ probeFirst: true, quiet: true }), ms);
    this.registerInterval(this.pollId);
  }

  private stopPolling(): void {
    if (this.pollId !== null) {
      window.clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  // ---------------------------------------------------------------- 設定

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<Settings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    // 既定のオブジェクトを共有しないよう作り直す。
    this.settings.syncState = { ...(this.settings.syncState || {}) };
    this.settings.changeToken = { ...(this.settings.changeToken || {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

/** 名前で読み書きされる、宣言的コントロールに紐づく設定キー。 */
type ControlKey = "language" | "oauthClientId" | "targetUrl" | "mountFolder" | "autoSync" | "pollMinutes";

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asBoolean = (v: unknown): boolean => v === true;

/**
 * 宣言的設定（Obsidian 1.13+）。`containerEl` を自分で描かずに定義を返すことで、
 * すべての行が Obsidian の設定検索に載る。描画は framework の持ち物なので
 * `display()` は実装しない。
 */
class SettingTab extends PluginSettingTab {
  /** 入力中のシークレット。保存するまで settings には入れない。 */
  private secretDraft: string | null = null;

  constructor(app: App, private readonly plugin: GoogleDriveSyncPlugin) {
    super(app, plugin);
  }

  private notify(msg: string): void {
    new Notice(t.notice(msg));
  }

  // ------------------------------------------------------------ バインディング

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as ControlKey];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.settings;
    switch (key as ControlKey) {
      case "language":
        s.language = value === "ja" ? "ja" : value === "en" ? "en" : "auto";
        setLanguage(s.language, getLanguage());
        break;
      case "oauthClientId":
        s.oauthClientId = asString(value).trim();
        break;
      case "targetUrl":
        s.targetUrl = asString(value).trim();
        break;
      case "mountFolder":
        s.mountFolder = asString(value).trim();
        break;
      case "autoSync":
        s.autoSync = asBoolean(value);
        break;
      case "pollMinutes":
        s.pollMinutes = typeof value === "number" && value > 0 ? Math.floor(value) : s.pollMinutes;
        break;
    }
    await this.plugin.saveSettings();

    if (key === "autoSync" || key === "pollMinutes") this.plugin.applyPolling();
    if (key === "language" || key === "autoSync" || key === "mountFolder") this.update();
  }

  // -------------------------------------------------------------- 行の部品

  /** CTA / destructive の見た目を自分で決めたい行。 */
  private buttonRow(
    name: string,
    desc: string,
    buttons: { label: string; cta?: boolean; destructive?: boolean; onClick: () => void }[]
  ): SettingDefinitionRender {
    return {
      name,
      desc,
      render: (setting) => {
        for (const spec of buttons) {
          setting.addButton((b) => {
            b.setButtonText(spec.label).onClick(spec.onClick);
            if (spec.cta) b.setCta();
            if (spec.destructive) b.setDestructive();
          });
        }
      },
    };
  }

  // ---------------------------------------------------------------- 定義

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [this.generalGroup(), this.oauthGroup(), this.targetGroup(), this.syncGroup()];
  }

  /** 言語が先頭。他の行がすべて読めない状態でも辿り着けるように。 */
  private generalGroup(): SettingDefinitionItem {
    return {
      type: "group",
      heading: t.generalHeading,
      items: [
        {
          name: t.languageName,
          desc: t.languageDesc,
          aliases: t.languageAliases,
          control: {
            type: "dropdown",
            key: "language",
            options: { auto: t.languageAuto, en: t.languageEn, ja: t.languageJa },
          },
        },
      ],
    };
  }

  private oauthGroup(): SettingDefinitionItem {
    const s = this.plugin.settings;
    const configured = this.plugin.controller.hasOAuthClient;
    return {
      type: "group",
      heading: t.oauthHeading,
      items: [
        {
          name: configured ? t.oauthConfigured : t.oauthSetupRequired,
          desc: createFragment((f) => {
            f.appendText(configured ? t.oauthConfiguredDesc : t.oauthSetupDesc);
            if (!configured) {
              const ol = f.createEl("ol");
              for (const step of [t.oauthStep1, t.oauthStep2, t.oauthStep3, t.oauthStep4]) {
                ol.createEl("li", { text: step });
              }
              f.createEl("a", {
                text: "console.cloud.google.com/apis/credentials",
                href: "https://console.cloud.google.com/apis/credentials",
              });
            }
          }),
        },
        {
          name: t.oauthClientIdName,
          desc: t.oauthClientIdDesc,
          aliases: t.oauthClientIdAliases,
          control: { type: "text", key: "oauthClientId", placeholder: "…apps.googleusercontent.com" },
        },
        {
          // マスク入力に対応するコントロール型が無いので render を使う。
          // それでも name と desc は設定検索に載る。
          name: t.oauthClientSecretName,
          desc: t.oauthClientSecretDesc,
          render: (setting) => {
            setting.addText((text) => {
              text.inputEl.type = "password";
              text.setValue(s.oauthClientSecret).onChange((v) => {
                s.oauthClientSecret = v.trim();
                void this.plugin.saveSettings();
              });
            });
          },
        },
      ],
    };
  }

  private targetGroup(): SettingDefinitionItem {
    const s = this.plugin.settings;
    const c = this.plugin.controller;

    const buttons: { label: string; cta?: boolean; destructive?: boolean; onClick: () => void }[] = [
      { label: c.connected ? t.btnReconnect : t.btnConnect, cta: true, onClick: () => this.connect() },
    ];
    if (c.connected) {
      buttons.push({
        label: t.btnDisconnect,
        destructive: true,
        onClick: () => {
          void c.disconnect().then(() => {
            this.notify(t.disconnectedNotice);
            this.update();
          });
        },
      });
    }

    return {
      type: "group",
      heading: t.targetHeading,
      items: [
        this.buttonRow(t.rowConnection, c.connected ? t.connected : t.notConnected, buttons),
        {
          name: t.targetUrlName,
          desc: t.targetUrlDesc,
          control: { type: "text", key: "targetUrl", placeholder: t.targetUrlPlaceholder },
        },
        {
          ...this.buttonRow(t.targetVerifyName, t.targetVerifyDesc, [
            { label: t.btnVerify, onClick: () => this.verify() },
          ]),
          visible: () => c.connected,
        },
        { name: t.targetStatusName, desc: this.targetStatus() },
        {
          name: t.mountName,
          desc: t.mountDesc,
          control: { type: "text", key: "mountFolder", placeholder: t.mountPlaceholder },
        },
        {
          name: "",
          desc: s.mountFolder ? t.mountMapping(s.mountFolder) : t.mountMappingWholeVault,
        },
      ],
    };
  }

  /**
   * 同期先が実際に何なのかを、そのまま書く。共有ドライブのつもりでマイドライブの
   * フォルダを貼った場合、本人だけが同期できて他の誰にも届かず、しかも正常に
   * 動いているように見える。その取り違えはここでしか捕まえられない（ADR-0004）。
   */
  private targetStatus(): string {
    const target = this.plugin.settings.target;
    if (!target) return t.targetNotSet;
    return target.driveId
      ? t.targetOnSharedDrive(target.folderName, target.driveName)
      : t.targetOnMyDrive(target.folderName);
  }

  private connect(): void {
    this.plugin.controller.connect().then(
      () => {
        this.notify(t.connectedNotice);
        this.update();
      },
      (e: unknown) => this.notify(e instanceof Error ? e.message : String(e))
    );
  }

  private verify(): void {
    this.plugin.controller.verifyTarget(this.plugin.settings.targetUrl).then(
      () => {
        this.notify(t.targetVerifiedNotice);
        this.update();
      },
      (e: unknown) => this.notify(e instanceof Error ? e.message : String(e))
    );
  }

  private syncGroup(): SettingDefinitionItem {
    const s = this.plugin.settings;
    return {
      type: "group",
      heading: t.syncHeading,
      items: [
        this.buttonRow(
          t.syncNowName,
          s.lastSyncAt
            ? t.syncNowDesc(relativeTime(s.lastSyncAt, Date.now(), t.relWords), new Date(s.lastSyncAt).toLocaleString())
            : t.syncNowDescNever,
          [
            {
              label: t.syncNowName,
              cta: true,
              onClick: () => {
                void this.plugin.runSync().then(() => this.update());
              },
            },
          ]
        ),
        {
          name: t.autoSyncName,
          desc: t.autoSyncDesc,
          control: { type: "toggle", key: "autoSync" },
        },
        {
          name: t.pollName,
          desc: t.pollDesc,
          visible: () => s.autoSync,
          control: {
            type: "number",
            key: "pollMinutes",
            min: 1,
            step: 1,
            validate: (v) => (Number.isFinite(v) && v >= 1 ? undefined : t.pollInvalid),
          },
        },
      ],
    };
  }
}
