import { PutResult, RemoteObject, RemoteProvider } from "../providers/RemoteProvider";
import { conflictPath, safeVaultPath } from "../util/paths";
import { sha256Hex } from "../util/hash";
import { LocalStore } from "./LocalStore";
import { FileState, LocalFile, LocalStamp, LocalStat, SyncPlan, SyncReport, SyncStateData, emptyReport } from "./types";
import { runPool } from "../util/pool";

/**
 * 削除の安全上限。1 回の同期で片側あたり max(10, 追跡数の 20%) まで。
 * 超えた分は実行せずに持ち越す。
 */
export const defaultDeleteGuard = (trackedCount: number): number => Math.max(10, Math.ceil(trackedCount * 0.2));

/**
 * 同時に進めるファイル数。1 件ずつ待つと所要時間は「ファイル数 × 往復時間」になり、
 * 数百件で分の単位になる。上げすぎると Drive に 429 を返されるので、待ち時間だけが
 * 重なって消える程度に留める。
 */
export const DEFAULT_CONCURRENCY = 8;

/**
 * clone のときだけ上げる同時実行数。取得しかしない（アップロードの帯域を食わない）ので、
 * 往復待ちをもう少し重ねられる。646 件で 3 分かかった実測がこの値の理由である。
 */
export const CLONE_CONCURRENCY = 16;

/**
 * ローカル・リモート・ベースラインの三方向マージによる双方向同期。
 *
 * 競合の方針は「決してデータを失わない」:
 *  - 両方が変更（新しい端末で既存 Vault を初めて同期した場合を含む）: 内容が同一なら
 *    競合ではなくベースラインを黙って採用する。異なる場合は新しい側（mtime）を正とし、
 *    古い側を `<名前>.conflict-<UTC>` として残す。リモートの mtime が不明なときは
 *    ローカルを正とする（リモートの mtime はアップロード時刻で、実際の編集時刻より
 *    遅れることがあるため）。
 *  - ローカル削除 × リモート変更: 復元（ダウンロード）。
 *  - ローカル変更 × リモート削除: 再アップロード。
 *
 * 削除はベースライン経由で伝播する（ベースラインにあって片側から消えていれば、
 * そこで削除されたということ）。
 *
 * ベースラインが現実と合っていない疑いがあるときは、アップロードだけを止める。
 * 止まったまま抜けられなくならないよう、clone と保留削除の承認を用意する（ADR-0005）。
 */

/** ベースラインから、前回ハッシュしたときの姿を取り出す。姿が無い項目は読み直す。 */
function stampsOf(prev: SyncStateData): Map<string, LocalStamp> {
  const out = new Map<string, LocalStamp>();
  for (const [path, s] of Object.entries(prev)) {
    if (s.localMtime !== undefined && s.localSize !== undefined) {
      out.set(path, { hash: s.localHash, mtime: s.localMtime, size: s.localSize });
    }
  }
  return out;
}

/** ローカル側の姿もベースラインに残す。次の同期はこのファイルを読まずに済む。 */
function stateOf(L: LocalFile, remoteVersion: string): FileState {
  return { localHash: L.hash, remoteVersion, localMtime: L.mtime, localSize: L.size };
}

/** 書き込んだファイルのベースライン。書いた直後の姿を持たせ、次の一覧で読み直させない。 */
function writtenState(hash: string, remoteVersion: string, stat: LocalStat): FileState {
  return { localHash: hash, remoteVersion, localMtime: stat.mtime, localSize: stat.size };
}

/** 両側の現在の姿。plan と sync が同じ読み取りを共有する。 */
interface Sides {
  localMap: Map<string, LocalFile>;
  remoteMap: Map<string, RemoteObject>;
  /** 除外を除いたベースライン上のパス。上限の計算にも走査にも同じものを使う。 */
  tracked: string[];
}

/** 何件消すことになるか、そのうち上限を超えて持ち越す側はどちらか。 */
interface Deletions {
  deferLocal: boolean;
  deferRemote: boolean;
  localDeletes: number;
  remoteDeletes: number;
  limit: number;
}

export class SyncEngine {
  constructor(
    private readonly local: LocalStore,
    private readonly remote: RemoteProvider,
    private readonly now: () => Date,
    private readonly deleteGuard: (trackedCount: number) => number = defaultDeleteGuard,
    private readonly concurrency: number = DEFAULT_CONCURRENCY,
    /**
     * 同期の対象外にするパス（ADR-0006）。除外は削除ではないので、当たったパスは
     * 両側とも触らず、ベースラインからも外すだけにする。
     */
    private readonly ignored: (path: string) => boolean = () => false,
    /**
     * 分類が終わるまでアップロードを止めるパス。未整理のローカル固有ファイルが入る。
     * 既存ファイルへの編集は止めないので、ここに入るのはリモートに無いものだけである。
     */
    private readonly held: ReadonlySet<string> = new Set()
  ) {}

  /** 両側を読む。ここだけがネットワークとファイルを触る入口。 */
  private async snapshot(prev: SyncStateData): Promise<Sides> {
    const [localList, remoteList] = await Promise.all([this.local.list(stampsOf(prev)), this.remote.list()]);
    return {
      localMap: new Map(localList.filter((f) => !this.ignored(f.path)).map((f) => [f.path, f])),
      remoteMap: new Map(remoteList.filter((o) => !this.ignored(o.path)).map((o) => [o.path, o])),
      // 除外されたパスはベースラインからも外す。残すと、次の同期で削除と読まれる。
      tracked: Object.keys(prev).filter((path) => !this.ignored(path)),
    };
  }

  /**
   * ローカルがベースラインから変わったか。ポーリングがリモートの問い合わせより先に見る。
   *
   * 同期はファイルの変更イベントを起点に走るが、イベントは取りこぼしうる（Obsidian を
   * 閉じている間の編集、失敗した同期など）。ここで拾い直さないと、リモートに変更が
   * 来るまで上がらない。分類待ちのファイルは上げないと決まっているので数えない。
   */
  async hasLocalChanges(prev: SyncStateData): Promise<boolean> {
    const seen = new Set<string>();
    for (const f of await this.local.list(stampsOf(prev))) {
      if (this.ignored(f.path) || this.held.has(f.path)) continue;
      seen.add(f.path);
      if (prev[f.path]?.localHash !== f.hash) return true;
    }
    return Object.keys(prev).some((path) => !this.ignored(path) && !this.held.has(path) && !seen.has(path));
  }

  /**
   * 適用せずに、この同期が何をするかを数える。サイドバーの表示と、同期を
   * 止めるかどうかの判断が同じ計算から出るようにしている。
   */
  async plan(prev: SyncStateData): Promise<SyncPlan> {
    const sides = await this.snapshot(prev);
    return this.planFrom(prev, sides, this.planDeletions(prev, sides));
  }

  private planFrom(prev: SyncStateData, { localMap, remoteMap, tracked }: Sides, deletions: Deletions): SyncPlan {
    const plan: SyncPlan = {
      upload: [],
      download: [],
      conflict: [],
      deleteLocal: [],
      deleteRemote: [],
      localOnly: [],
      unsorted: [],
      blocked: [],
      deleteLimit: deletions.limit,
    };

    for (const path of new Set([...localMap.keys(), ...remoteMap.keys(), ...tracked])) {
      const L = localMap.get(path);
      const R = remoteMap.get(path);
      const S = prev[path];
      if (L && !R) {
        plan.localOnly.push(path);
        if (this.held.has(path)) plan.unsorted.push(path);
      }

      const localChanged = L ? !S || L.hash !== S.localHash : !!S;
      const remoteChanged = R ? !S || R.version !== S.remoteVersion : !!S;
      if (!localChanged && !remoteChanged) continue;

      if (L && R && localChanged && remoteChanged) plan.conflict.push(path);
      else if (L && localChanged && !remoteChanged) plan.upload.push(path);
      else if (R && !localChanged && remoteChanged) plan.download.push(path);
      else if (!L && S && R) plan.deleteRemote.push(path);
      else if (!R && S && L) plan.deleteLocal.push(path);
      else if (L) plan.upload.push(path);
      else if (R) plan.download.push(path);
    }

    if (tracked.length === 0 && localMap.size > 0 && remoteMap.size > 0) plan.blocked.push("no-baseline");
    if (tracked.length > 0 && localMap.size === 0) plan.blocked.push("vault-empty");
    if (deletions.deferLocal || deletions.deferRemote) plan.blocked.push("delete-guard");
    return plan;
  }

  /**
   * 通常の同期。
   *
   * `approvedDeletes` は、保留された削除のうち利用者が承認したパス。安全上限を
   * 超えていても、ここに挙がったものだけは実行する（ADR-0005）。
   */
  async sync(
    prev: SyncStateData,
    opts: { approvedDeletes?: ReadonlySet<string> } = {}
  ): Promise<{ state: SyncStateData; report: SyncReport }> {
    const sides = await this.snapshot(prev);
    const { localMap, remoteMap, tracked } = sides;
    const deletions = this.planDeletions(prev, sides);
    const { deferLocal, deferRemote } = deletions;
    const plan = this.planFrom(prev, sides, deletions);
    const approved = opts.approvedDeletes ?? new Set<string>();

    const holdUploads = plan.blocked.length > 0;

    const state: SyncStateData = { ...prev };
    // 除外されたパスは、ベースラインからも落とす（ADR-0006）。
    for (const path of Object.keys(state)) if (this.ignored(path)) delete state[path];
    const report = emptyReport();
    report.blocked = plan.blocked;
    report.localOnly = plan.localOnly;

    const paths = new Set<string>([...localMap.keys(), ...remoteMap.keys(), ...tracked]);
    // パスごとの判断は互いに独立している（触るのは自分の state[path] と report の配列だけ）。
    await runPool(paths, this.concurrency, async (path) => {
      try {
        await this.reconcile(path, localMap.get(path), remoteMap.get(path), prev[path], state, report, {
          deferLocal: deferLocal && !approved.has(path),
          deferRemote: deferRemote && !approved.has(path),
          holdUploads: (holdUploads || this.held.has(path)) && !approved.has(path),
        });
      } catch (e) {
        report.errors.push({ path, error: (e as Error).message });
      }
    });
    return { state, report };
  }

  /**
   * リモートをローカルに再現する（非破壊）。初回接続も復旧もここを通る（ADR-0005）。
   *
   * ローカルにしか無いファイルは消さない。同名で内容が違うファイルは、ローカル版を
   * 競合コピーに退避してからリモート版を置く。ベースラインはこの結果で作り直す。
   */
  async clone(prev: SyncStateData = {}): Promise<{ state: SyncStateData; report: SyncReport }> {
    const { localMap, remoteMap } = await this.snapshot(prev);
    const state: SyncStateData = {};
    const report = emptyReport();
    // 退避先が同じ秒に衝突しないよう、既存のパスと今回作った分を憶えておく。
    const taken = new Set<string>(localMap.keys());

    await runPool(remoteMap, Math.max(this.concurrency, CLONE_CONCURRENCY), async ([path, R]) => {
      try {
        const L = localMap.get(path);
        const data = await this.remote.get(path);
        if (data === null) return; // 実行中に消えた。次の同期で整合する
        const hash = await sha256Hex(data);

        if (L && L.hash === hash) {
          state[path] = stateOf(L, R.version); // 同じ内容。触らない
          return;
        }
        if (L) {
          const cp = this.freshConflictPath(path, taken);
          await this.local.write(cp, await this.local.read(path));
          report.conflicts.push({ path, conflictPath: cp });
        }
        state[path] = writtenState(hash, R.version, await this.local.write(safeVaultPath(path), data));
        report.downloaded.push(path);
      } catch (e) {
        report.errors.push({ path, error: (e as Error).message });
      }
    });

    // リモートに無いローカルのファイル。退避した競合コピーもここに入る。
    report.localOnly = [...taken].filter((p) => !remoteMap.has(p)).sort();
    return { state, report };
  }

  /** 同じ秒に複数のファイルを退避しても名前がぶつからないようにする。 */
  private freshConflictPath(path: string, taken: Set<string>): string {
    const base = safeVaultPath(conflictPath(path, this.stamp()));
    let candidate = base;
    for (let n = 2; taken.has(candidate); n++) {
      const dot = base.lastIndexOf(".");
      candidate = dot > 0 ? `${base.slice(0, dot)}-${n}${base.slice(dot)}` : `${base}-${n}`;
    }
    taken.add(candidate);
    return candidate;
  }

  /**
   * 適用前に、この同期が何件消すことになるかを数える。
   *
   * 共有Vault では、誰か一人の正当なリネームやフォルダ移動が、他の全員からは大量削除に
   * 見える。そこで移動は削除として数えない。ベースライン上のパスから消え、同じ内容が
   * 別のパスに現れているなら、それは移動である。ローカル側は内容ハッシュ、リモート側は
   * バージョン（Drive では内容の MD5）で突き合わせる——両者を跨いで比較はできないが、
   * その必要も無い（ADR-0001）。
   *
   * それでも上限を超えた場合は、削除だけを持ち越す。同期全体を止めると、消した本人
   * ではない全員の作業が、原因も分からないまま止まる。
   */
  private planDeletions(prev: SyncStateData, { localMap, remoteMap, tracked }: Sides): Deletions {
    // ベースラインに無いパス = 今回現れたもの。移動先の候補。
    const newLocalHashes = new Set<string>();
    for (const [path, f] of localMap) if (!prev[path]) newLocalHashes.add(f.hash);
    const newRemoteVersions = new Set<string>();
    for (const [path, o] of remoteMap) if (!prev[path] && o.version) newRemoteVersions.add(o.version);

    let localDeletes = 0;
    let remoteDeletes = 0;
    for (const path of tracked) {
      const S = prev[path];
      const L = localMap.get(path);
      const R = remoteMap.get(path);
      // リモートから消えた → ローカルを消すことになる。同じ内容が別のリモートパスに
      // 現れているなら移動なので数えない。
      if (L && L.hash === S.localHash && !R && !newRemoteVersions.has(S.remoteVersion)) localDeletes++;
      // ローカルから消えた → リモートを消すことになる。同上。
      if (!L && R && R.version === S.remoteVersion && !newLocalHashes.has(S.localHash)) remoteDeletes++;
    }

    // 上限も数え上げも同じ tracked から出す。ここがずれると、plan が「止まる」と
    // 言いながら sync は消す、という食い違いが起きる。
    const limit = this.deleteGuard(tracked.length);
    return {
      deferLocal: localDeletes > limit,
      deferRemote: remoteDeletes > limit,
      localDeletes,
      remoteDeletes,
      limit,
    };
  }

  private async reconcile(
    path: string,
    L: LocalFile | undefined,
    R: RemoteObject | undefined,
    S: FileState | undefined,
    state: SyncStateData,
    report: SyncReport,
    guard: { deferLocal: boolean; deferRemote: boolean; holdUploads: boolean }
  ): Promise<void> {
    const { deferLocal, deferRemote, holdUploads } = guard;
    const localChanged = L ? !S || L.hash !== S.localHash : !!S;
    const remoteChanged = R ? !S || R.version !== S.remoteVersion : !!S;

    if (!localChanged && !remoteChanged) {
      if (!L && !R) delete state[path];
      // 姿の無い古い項目や、中身を変えずに触られたファイルの姿を今の姿に揃える。
      // 揃えないと、変わっていないのに毎回読み直すことになる。
      else if (L && S && (S.localMtime !== L.mtime || S.localSize !== L.size)) state[path] = stateOf(L, S.remoteVersion);
      return;
    }

    // 両方が変更（新しい端末で既存 Vault を初めて同期した場合を含む）。
    if (L && R && localChanged && remoteChanged) {
      if (holdUploads) {
        // 競合の解決はどちらかを書く。止まっている間は触らない。
        report.heldUploads.push(path);
        return;
      }
      await this.resolveConflict(path, L, R, state, report);
      return;
    }

    if (localChanged && !remoteChanged) {
      if (L) {
        if (holdUploads) report.heldUploads.push(path);
        else await this.upload(path, L, state, report);
      } else if (deferRemote || holdUploads) report.deferredDeletes.push(path);
      else await this.deleteRemote(path, state, report);
      return;
    }

    if (!localChanged && remoteChanged) {
      if (R) await this.download(path, R, state, report);
      else if (deferLocal) report.deferredDeletes.push(path);
      else await this.deleteLocal(path, state, report);
      return;
    }

    // 削除 × 変更。生き残っている方の内容を守る。
    if (L && !R) {
      if (holdUploads) report.heldUploads.push(path);
      else await this.upload(path, L, state, report);
      return;
    }
    if (!L && R) {
      await this.download(path, R, state, report);
      return;
    }
    delete state[path]; // 両側で削除済み
  }

  /**
   * ベースライン以降に両側が変わった（あるいはベースラインがまだ無い）。
   * 何も失わずに決着させる:
   *  - 内容が同一なら競合ではない。ベースラインを黙って採用する。既に中身のある
   *    Vault を新しい端末で初めて同期したとき、共存している全ファイルがこれに当たる。
   *  - 異なる場合は新しい側（mtime）を正とし、古い側を復元可能なコピーとして残す。
   *    リモートの mtime はアップロード時刻であり不明なこともあるため、それが
   *    ローカルより厳密に新しいときだけリモートが勝つ。
   */
  private async resolveConflict(
    path: string,
    L: LocalFile,
    R: RemoteObject,
    state: SyncStateData,
    report: SyncReport
  ): Promise<void> {
    const remoteBytes = await this.remote.get(path);
    if (remoteBytes === null) {
      await this.upload(path, L, state, report); // 実行中に消えた。次回の同期で整合する
      return;
    }
    const remoteHash = await sha256Hex(remoteBytes);

    if (remoteHash === L.hash) {
      state[path] = stateOf(L, R.version); // 同一 → 採用、競合ではない
      return;
    }

    const cp = safeVaultPath(conflictPath(path, this.stamp()));
    if (R.mtime !== undefined && R.mtime > L.mtime) {
      // リモートが新しい。正とする前に、古いローカル版を退避しておく。
      await this.local.write(cp, await this.local.read(path));
      state[path] = writtenState(remoteHash, R.version, await this.local.write(safeVaultPath(path), remoteBytes));
      report.downloaded.push(path);
      report.conflicts.push({ path, conflictPath: cp });
    } else {
      // ローカルが新しい（あるいはリモートの mtime が不明）。古いリモート版を退避する。
      await this.local.write(cp, remoteBytes);
      report.conflicts.push({ path, conflictPath: cp });
      await this.upload(path, L, state, report);
    }
  }

  private async upload(path: string, L: LocalFile, state: SyncStateData, report: SyncReport): Promise<void> {
    const data = await this.local.read(path);
    const res: PutResult = await this.remote.put(path, data);
    state[path] = stateOf(L, res.version);
    report.uploaded.push(path);
  }

  private async download(path: string, R: RemoteObject, state: SyncStateData, report: SyncReport): Promise<void> {
    const data = await this.remote.get(path);
    if (data === null) return; // 実行中に消えた。次回の同期で整合する
    const stat = await this.local.write(safeVaultPath(path), data);
    state[path] = writtenState(await sha256Hex(data), R.version, stat);
    report.downloaded.push(path);
  }

  private async deleteRemote(path: string, state: SyncStateData, report: SyncReport): Promise<void> {
    await this.remote.delete(path);
    delete state[path];
    report.deletedRemote.push(path);
  }

  private async deleteLocal(path: string, state: SyncStateData, report: SyncReport): Promise<void> {
    await this.local.delete(safeVaultPath(path));
    delete state[path];
    report.deletedLocal.push(path);
  }

  private stamp(): string {
    const d = this.now();
    const p = (n: number) => n.toString().padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  }
}
