import { App } from "obsidian";
import { DriveProvider } from "./providers/drive/DriveProvider";
import { getStartToken, hasChanges } from "./providers/drive/ChangeProbe";
import { resolveDriveTarget } from "./providers/drive/DriveTarget";
import { TokenSet, refreshAccessToken } from "./providers/google/oauth";
import { googleLoginLoopback } from "./obsidian/googleLogin";
import { HttpSend } from "./providers/RemoteProvider";
import { SyncEngine } from "./sync/SyncEngine";
import { SyncPlan, SyncReport, SyncStateData } from "./sync/types";
import { ObsidianLocalStore } from "./obsidian/ObsidianLocalStore";
import { requestUrlHttp } from "./obsidian/requestUrlHttp";
import { withRetry } from "./util/retry";
import { DriveTarget, Settings } from "./settings";
import { ignoreMatcher } from "./sync/ignore";
import {
  LOCAL_IGNORE_PATH,
  LOCAL_ONLY_PATH,
  TEAM_IGNORE_PATH,
  TEAM_IGNORE_TEMPLATE,
  TEAM_README_PATH,
  TEAM_README_TEMPLATE,
  localIgnoreTemplate,
} from "./sync/configFiles";
import { LocalOnlyLabels, parseLocalOnly, reconcileLocalOnly, renderLocalOnly } from "./sync/localOnly";
import { t } from "./i18n";

/**
 * 全 Drive 権限。共有ドライブ上の他人のノートを見るにはこれが要る。`drive.file` は
 * 「そのユーザーに対してこのアプリが作成したファイル」しか見せないため、同じ
 * フォルダにあっても他人のファイルは存在しないものとして扱われる（ADR-0004）。
 */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

/** 台帳と設定ファイルの見出しは、各自の UI 言語で書く（配られないため）。 */
function localOnlyLabels(): LocalOnlyLabels {
  return {
    heading: { unsorted: t.sectionUnsorted, shared: t.sectionShared, trash: t.sectionTrash },
    intro: t.localOnlyIntro,
  };
}

function writeText(local: ObsidianLocalStore, path: string, body: string): Promise<void> {
  return local.write(path, new TextEncoder().encode(body).buffer);
}

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
  async sync(opts: { approvedDeletes?: ReadonlySet<string> } = {}): Promise<SyncReport> {
    const target = this.requireTarget();

    // 起点は走査の *前* に取る。後から取ると、走査中に入った変更を見落とす。
    const freshToken = await getStartToken(this.http, () => this.getToken(), target.driveId);

    const key = target.folderId;
    const { state, report } = await (await this.engineFor(target)).sync(this.settings.syncState[key] ?? {}, opts);
    await this.commit(key, state, freshToken);
    return report;
  }

  /**
   * リモートをローカルに再現する（ADR-0005）。ベースラインは結果で作り直す。
   *
   * 初回接続と、状態が壊れたときの復旧の両方がここを通る。ローカルにしか無い
   * ファイルは消さず、報告に載せて呼び出し側が分類できるようにする。
   */
  async clone(): Promise<SyncReport> {
    const target = this.requireTarget();
    const freshToken = await getStartToken(this.http, () => this.getToken(), target.driveId);

    const key = target.folderId;
    const { state, report } = await (await this.engineFor(target)).clone(this.settings.syncState[key] ?? {});
    await this.commit(key, state, freshToken);
    await this.writeLocalLedger(report.localOnly);
    return report;
  }

  /**
   * clone の結果をローカル側の台帳に反映する（ADR-0006）。
   *
   * 設定ファイルは clone の後に、無いものだけ作る。有効化しただけの Vault には
   * 何も書かない。clone の前に作ると、自分で作ったファイルが自分のローカル固有
   * ファイルとして並ぶ。
   */
  private async writeLocalLedger(localOnly: readonly string[]): Promise<void> {
    const local = this.store();
    await this.ensureConfigFiles(local);

    const previous = await local.readText(LOCAL_ONLY_PATH);
    const doc = reconcileLocalOnly(parseLocalOnly(previous ?? ""), localOnly);
    await writeText(local, LOCAL_ONLY_PATH, renderLocalOnly(doc, localOnlyLabels(), previous ?? undefined));
  }

  private async ensureConfigFiles(local: ObsidianLocalStore): Promise<void> {
    const files: [string, string][] = [
      [TEAM_IGNORE_PATH, TEAM_IGNORE_TEMPLATE],
      [TEAM_README_PATH, TEAM_README_TEMPLATE],
      [LOCAL_IGNORE_PATH, localIgnoreTemplate({ title: t.localIgnoreTitle, body: t.localIgnoreBody })],
    ];
    for (const [path, body] of files) {
      if ((await local.readText(path)) === null) await writeText(local, path, body);
    }
  }

  /**
   * 分類の実行（ADR-0006）。「共有」はアップロードし、「削除」はローカルのゴミ箱へ送る。
   * 「未整理」は何もしない。実行した行は台帳から消える。
   */
  async organizeLocalFiles(): Promise<{ shared: string[]; trashed: string[]; errors: string[] }> {
    this.requireTarget(); // 同期先が無いうちは整理もできない（共有先が決まらない）
    const local = this.store();
    const previous = (await local.readText(LOCAL_ONLY_PATH)) ?? "";
    const doc = parseLocalOnly(previous);
    const result = { shared: [] as string[], trashed: [] as string[], errors: [] as string[] };

    for (const path of doc.entries.trash) {
      try {
        await local.delete(path);
        result.trashed.push(path);
      } catch (e) {
        result.errors.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    // 「共有」はここでは消し込むだけ。台帳から外れれば、次の同期で普通に上がる。
    result.shared.push(...doc.entries.shared);

    const remaining = reconcileLocalOnly(doc, doc.entries.unsorted);
    await writeText(local, LOCAL_ONLY_PATH, renderLocalOnly(remaining, localOnlyLabels(), previous));

    // 台帳から外れた「共有」は、この同期で普通の新規ファイルとして上がる。
    if (result.shared.length > 0) await this.sync();
    return result;
  }

  /** 適用せずに、今の同期が何をするかを数える。サイドバーの表示に使う。 */
  async plan(): Promise<SyncPlan> {
    const target = this.requireTarget();
    return (await this.engineFor(target)).plan(this.settings.syncState[target.folderId] ?? {});
  }

  private store(): ObsidianLocalStore {
    return new ObsidianLocalStore(this.app, this.settings.mountFolder);
  }

  private async engineFor(target: DriveTarget): Promise<SyncEngine> {
    const local = this.store();
    const [team, mine, localOnly] = await Promise.all([
      local.readText(TEAM_IGNORE_PATH),
      local.readText(LOCAL_IGNORE_PATH),
      local.readText(LOCAL_ONLY_PATH),
    ]);
    // 未整理のものだけを止める。分類済み（共有・削除）は整理の対象で、止めない。
    const held = new Set(localOnly ? parseLocalOnly(localOnly).entries.unsorted : []);
    return new SyncEngine(
      local,
      new DriveProvider({ folderId: target.folderId, driveId: target.driveId }, () => this.getToken(), this.http),
      () => new Date(),
      undefined,
      undefined,
      ignoreMatcher(team, mine),
      held
    );
  }

  private async commit(key: string, state: SyncStateData, freshToken: string): Promise<void> {
    this.settings.syncState[key] = state;
    this.settings.changeToken[key] = freshToken;
    this.settings.lastSyncAt = Date.now();
    await this.persist();
  }
}
