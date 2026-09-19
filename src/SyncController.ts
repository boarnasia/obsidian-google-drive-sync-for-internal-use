import { App } from "obsidian";
import { DriveProvider } from "./providers/drive/DriveProvider";
import { getStartToken, hasChanges } from "./providers/drive/ChangeProbe";
import { resolveDriveTarget } from "./providers/drive/DriveTarget";
import { TokenSet, refreshAccessToken } from "./providers/google/oauth";
import { googleLoginLoopback } from "./obsidian/googleLogin";
import { HttpSend } from "./providers/RemoteProvider";
import { SyncEngine } from "./sync/SyncEngine";
import { SyncReport } from "./sync/types";
import { ObsidianLocalStore } from "./obsidian/ObsidianLocalStore";
import { requestUrlHttp } from "./obsidian/requestUrlHttp";
import { withRetry } from "./util/retry";
import { DriveTarget, Settings } from "./settings";
import { t } from "./i18n";

/**
 * 全 Drive 権限。共有ドライブ上の他人のノートを見るにはこれが要る。`drive.file` は
 * 「そのユーザーに対してこのアプリが作成したファイル」しか見せないため、同じ
 * フォルダにあっても他人のファイルは存在しないものとして扱われる（ADR-0004）。
 */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

/**
 * 検証済みのコアをプラグインに繋ぐ層。資格情報はこのプラグイン自身の data.json に
 * 置かれ、そこは同期対象から常に外れる（ADR-0003）。
 */
export class SyncController {
  private access: { token: string; expiresAt: number } | null = null;
  private readonly http: HttpSend;

  constructor(
    private readonly app: App,
    private readonly settings: Settings,
    private readonly persist: () => Promise<void>,
    http?: HttpSend
  ) {
    this.http = http ?? withRetry(requestUrlHttp);
  }

  // ------------------------------------------------------------------ 状態

  get hasOAuthClient(): boolean {
    return this.settings.oauthClientId.trim() !== "";
  }

  get connected(): boolean {
    return this.settings.driveToken !== null;
  }

  /** 同期できる状態か。接続済みで、同期先が確認済み。 */
  get ready(): boolean {
    return this.connected && this.settings.target !== null;
  }

  private requireOAuthClient(): void {
    if (!this.hasOAuthClient) throw new Error(t.errNoOauthClient);
  }

  private requireTarget(): DriveTarget {
    if (!this.connected) throw new Error(t.errNotConnected);
    const target = this.settings.target;
    if (!target) throw new Error(t.errNoTarget);
    return target;
  }

  // ---------------------------------------------------------------- 認証

  /** 有効なアクセストークン。期限が近ければ黙って更新する。 */
  private async getToken(): Promise<string> {
    if (this.access && this.access.expiresAt > Date.now() + 60_000) return this.access.token;
    if (!this.settings.driveToken) throw new Error(t.errNotConnected);
    this.requireOAuthClient();
    const tokens = await refreshAccessToken(
      this.http,
      {
        clientId: this.settings.oauthClientId.trim(),
        clientSecret: this.settings.oauthClientSecret.trim(),
        refreshToken: this.settings.driveToken,
      },
      Date.now()
    );
    this.access = { token: tokens.accessToken, expiresAt: tokens.expiresAt };
    return tokens.accessToken;
  }

  async connect(): Promise<void> {
    this.requireOAuthClient();
    const tokens: TokenSet = await googleLoginLoopback({
      clientId: this.settings.oauthClientId.trim(),
      clientSecret: this.settings.oauthClientSecret.trim(),
      scope: DRIVE_SCOPE,
      label: "Google Drive",
    });
    if (!tokens.refreshToken) throw new Error(t.errNoRefreshToken);
    this.settings.driveToken = tokens.refreshToken;
    this.access = { token: tokens.accessToken, expiresAt: tokens.expiresAt };
    await this.persist();
  }

  async disconnect(): Promise<void> {
    this.settings.driveToken = null;
    this.access = null;
    await this.persist();
  }

  // ---------------------------------------------------------------- 同期先

  /**
   * 貼られた URL を Drive に問い合わせる。保存はしない。入力中に問い合わせが
   * 重なるので、どの結果を採るかは呼び出し側が最新の入力と突き合わせて決める。
   */
  async lookupTarget(url: string): Promise<DriveTarget> {
    if (!this.connected) throw new Error(t.errNotConnected);
    return resolveDriveTarget(this.http, () => this.getToken(), url);
  }

  // ------------------------------------------------------------------ 同期

  /**
   * ポーリング用。リモートに変更が無ければ何もせず null を返す。
   *
   * プローブが見ているのはリモートだけなので、ローカルの変更を起点とする同期は
   * この経路を通してはいけない（ADR-0002）。
   */
  async syncIfRemoteChanged(): Promise<SyncReport | null> {
    const target = this.requireTarget();
    const saved = this.settings.changeToken[target.folderId] ?? "";
    if (saved && !(await hasChanges(this.http, () => this.getToken(), target.driveId, saved))) return null;
    return this.sync();
  }

  /** 手動、およびローカルの変更を起点とする同期。必ず走る。 */
  async sync(): Promise<SyncReport> {
    const target = this.requireTarget();

    // 起点は走査の *前* に取る。後から取ると、走査中に入った変更を見落とす。
    const freshToken = await getStartToken(this.http, () => this.getToken(), target.driveId);

    const engine = new SyncEngine(
      new ObsidianLocalStore(this.app, this.settings.mountFolder),
      new DriveProvider({ folderId: target.folderId, driveId: target.driveId }, () => this.getToken(), this.http),
      () => new Date()
    );

    const key = target.folderId;
    const { state, report } = await engine.sync(this.settings.syncState[key] ?? {});
    this.settings.syncState[key] = state;
    this.settings.changeToken[key] = freshToken;
    this.settings.lastSyncAt = Date.now();
    await this.persist();
    return report;
  }
}
