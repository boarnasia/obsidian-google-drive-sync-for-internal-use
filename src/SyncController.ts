import { App } from "obsidian";
import { DriveProvider } from "./providers/drive/DriveProvider";
import { getStartToken, probeChanges } from "./providers/drive/ChangeProbe";
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
  TEAM_IGNORE_PATH,
  TEAM_IGNORE_TEMPLATE,
  TEAM_README_PATH,
  TEAM_README_TEMPLATE,
  localIgnoreTemplate,
} from "./sync/configFiles";
import { t } from "./i18n";

/**
 * 全 Drive 権限。共有ドライブ上の他人のノートを見るにはこれが要る。`drive.file` は
 * 「そのユーザーに対してこのアプリが作成したファイル」しか見せないため、同じ
 * フォルダにあっても他人のファイルは存在しないものとして扱われる（ADR-0004）。
 */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

async function writeText(local: ObsidianLocalStore, path: string, body: string): Promise<void> {
  await local.write(path, new TextEncoder().encode(body).buffer);
}

/**
 * 検証済みのコアをプラグインに繋ぐ層。資格情報はこのプラグイン自身の data.json に
 * 置かれ、そこは同期対象から常に外れる（ADR-0003）。
 */
export class SyncController {
  private access: { token: string; expiresAt: number } | null = null;
  private readonly http: HttpSend;
  /**
   * ベースラインを書き換える操作が同時に走っていないか。
   *
   * sync・clone・分類はどれも最後に同じ `syncState[folderId]` を上書きする。二つが
   * 重なると、後から終わった方が先の結果を丸ごと捨て、ベースラインが実際の両側と
   * 食い違う——次の同期はそれを大量削除として読む。呼び出し元はサイドバー・
   * ポーリング・ファイル監視と複数あるので、入口ではなくここで一本化する。
   */
  private running = false;
  /**
   * 実行中の操作が書こうとしている Vault 相対パス。
   *
   * Vault API 経由で書く以上、自分の書き込みも modify / create / delete を発火する。
   * これを変更として数えると、ダウンロードが次の同期を呼ぶ。Obsidian はイベントを
   * 書き込みの完了前に発火するので、書く直前に控える。操作が終わった時点で残って
   * いるものはもうイベントが来ないので捨てる——残すと、利用者の次の編集を吸い込む。
   */
  private readonly ownWrites = new Set<string>();
  /** 直近の同期が止まったか。止まっている間は、ローカルの差分だけでは同期し直さない。 */
  private lastBlocked = false;
  /**
   * 同期ルートごとの、直前の走査で分かった中の ID。変更プローブがルートの外の変更を
   * 読み飛ばすのに使う。保存はしない——起動後の最初の確認は判断できずに同期するが、
   * その走査でまた分かる。
   */
  private readonly insideIds = new Map<string, Set<string>>();

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

  /** ベースラインを書き換える操作はここを通す。重なったら待たせずに断る。 */
  private async exclusive<T>(run: () => Promise<T>): Promise<T> {
    if (this.running) throw new Error(t.syncAlreadyRunning);
    this.running = true;
    try {
      return await run();
    } finally {
      this.running = false;
      this.ownWrites.clear();
    }
  }

  /** ベースラインを書き換える操作が走っているか。 */
  get busy(): boolean {
    return this.running;
  }

  /** このパスの変更イベントが、実行中の操作自身の書き込みによるものなら true（一度きり）。 */
  consumeOwnWrite(path: string): boolean {
    return this.ownWrites.delete(path);
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
   * ポーリング用。ローカルにもリモートにも変更が無ければ何もせず null を返す。
   *
   * ローカルを先に見る。変更イベントを取りこぼしたローカルの編集は、ここで拾わないと
   * リモートに変更が来るまで上がらない。直近の同期が止まっているなら、同期し直しても
   * また止まるだけなので、リモートの変更だけを待つ（抜け道はサイドバーにある）。
   */
  async syncIfChanged(): Promise<SyncReport | null> {
    const target = this.requireTarget();
    if (!this.lastBlocked && (await this.hasLocalChanges(target))) return this.sync();
    const key = target.folderId;
    const saved = this.settings.changeToken[key] ?? "";
    const probe = await probeChanges(this.http, () => this.getToken(), target.driveId, saved, this.insideIds.get(key) ?? null);
    if (probe.changed) return this.sync();
    // ルートの外の変更だけなら起点を進める。進めないと、同じ変更を毎回読み直す。
    // 同期が走っているなら、その同期が起点を書くので触らない。
    if (probe.nextToken && probe.nextToken !== saved && !this.running) {
      this.settings.changeToken[key] = probe.nextToken;
      await this.persist();
    }
    return null;
  }

  /** 手動、およびローカルの変更を起点とする同期。必ず走る。 */
  sync(opts: { approvedDeletes?: ReadonlySet<string> } = {}): Promise<SyncReport> {
    return this.exclusive(() => this.syncNow(opts));
  }

  private async syncNow(opts: { approvedDeletes?: ReadonlySet<string> }): Promise<SyncReport> {
    const target = this.requireTarget();

    // 起点は走査の *前* に取る。後から取ると、走査中に入った変更を見落とす。
    const freshToken = await getStartToken(this.http, () => this.getToken(), target.driveId);

    const key = target.folderId;
    const remote = this.remoteFor(target);
    const { state, report } = await (await this.engineFor(target, remote)).sync(this.settings.syncState[key] ?? {}, opts);
    this.insideIds.set(key, remote.insideIds());
    this.lastBlocked = report.blocked.length > 0;
    // 上がった、あるいは消えたファイルは、もう分類の対象ではない。
    const stillLocalOnly = new Set(report.localOnly);
    this.settings.unsorted[key] = this.unsortedOf(key).filter((path) => stillLocalOnly.has(path));
    await this.commit(key, state, freshToken);
    return report;
  }

  /**
   * リモートをローカルに再現する（ADR-0005）。ベースラインは結果で作り直す。
   *
   * 初回接続と、状態が壊れたときの復旧の両方がここを通る。ローカルにしか無い
   * ファイルは消さず、報告に載せて呼び出し側が分類できるようにする。
   */
  clone(): Promise<SyncReport> {
    return this.exclusive(() => this.cloneNow());
  }

  private async cloneNow(): Promise<SyncReport> {
    const target = this.requireTarget();
    const freshToken = await getStartToken(this.http, () => this.getToken(), target.driveId);

    const key = target.folderId;
    const remote = this.remoteFor(target);
    const { state, report } = await (await this.engineFor(target, remote)).clone(this.settings.syncState[key] ?? {});
    this.insideIds.set(key, remote.insideIds());
    this.lastBlocked = false;
    // 取り込みは両側を数え直すので、未整理も持ち越さずに作り直す。
    this.settings.unsorted[key] = [...report.localOnly];
    await this.commit(key, state, freshToken);
    // 設定ファイルは clone の後に、無いものだけ作る。前に作ると、自分で作ったファイルが
    // 自分のローカル固有ファイルとして並ぶ。
    await this.ensureConfigFiles(this.store());
    return report;
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

  // -------------------------------------------------- ローカル固有ファイルの分類

  /** 未整理として保留中のパス。同期先ごとに持つ。 */
  unsortedFor(): string[] {
    const target = this.settings.target;
    return target ? this.unsortedOf(target.folderId) : [];
  }

  private unsortedOf(key: string): string[] {
    return this.settings.unsorted[key] ?? [];
  }

  private async dropUnsorted(key: string, paths: readonly string[]): Promise<void> {
    const gone = new Set(paths);
    this.settings.unsorted[key] = this.unsortedOf(key).filter((path) => !gone.has(path));
    await this.persist();
  }

  /**
   * 「共有」（ADR-0006）。保留を外して同期する。外れたファイルは、この同期で
   * 普通の新規ファイルとして上がる。
   */
  shareLocalFiles(paths: readonly string[]): Promise<SyncReport> {
    return this.exclusive(async () => {
      const target = this.requireTarget();
      await this.dropUnsorted(target.folderId, paths);
      return this.syncNow({});
    });
  }

  /**
   * 「削除」（ADR-0006）。ローカルのゴミ箱へ送る。リモートには触らない——そもそも
   * リモートに無いファイルだけがここに来る。
   */
  trashLocalFiles(paths: readonly string[]): Promise<{ trashed: string[]; errors: string[] }> {
    return this.exclusive(async () => {
      const target = this.requireTarget();
      const local = this.store();
      const result = { trashed: [] as string[], errors: [] as string[] };

      for (const path of paths) {
        try {
          await local.delete(path);
          result.trashed.push(path);
        } catch (e) {
          result.errors.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await this.dropUnsorted(target.folderId, result.trashed);
      return result;
    });
  }

  /** 適用せずに、今の同期が何をするかを数える。サイドバーの表示に使う。 */
  async plan(): Promise<SyncPlan> {
    const target = this.requireTarget();
    return (await this.engineFor(target)).plan(this.settings.syncState[target.folderId] ?? {});
  }

  private async hasLocalChanges(target: DriveTarget): Promise<boolean> {
    return (await this.engineFor(target)).hasLocalChanges(this.settings.syncState[target.folderId] ?? {});
  }

  private store(): ObsidianLocalStore {
    return new ObsidianLocalStore(this.app, (path) => this.ownWrites.add(path));
  }

  private remoteFor(target: DriveTarget): DriveProvider {
    return new DriveProvider({ folderId: target.folderId, driveId: target.driveId }, () => this.getToken(), this.http);
  }

  private async engineFor(target: DriveTarget, remote: DriveProvider = this.remoteFor(target)): Promise<SyncEngine> {
    const local = this.store();
    const [team, mine] = await Promise.all([local.readText(TEAM_IGNORE_PATH), local.readText(LOCAL_IGNORE_PATH)]);
    // 未整理のものだけを止める。分類し終えたファイルは、もうこの集合に居ない。
    const held = new Set(this.unsortedOf(target.folderId));
    return new SyncEngine(
      local,
      remote,
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
