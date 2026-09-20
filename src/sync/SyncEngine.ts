import { PutResult, RemoteObject, RemoteProvider } from "../providers/RemoteProvider";
import { conflictPath, safeVaultPath } from "../util/paths";
import { sha256Hex } from "../util/hash";
import { LocalStore } from "./LocalStore";
import { FileState, LocalFile, LocalStamp, SyncReport, SyncStateData, emptyReport } from "./types";
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

export class SyncEngine {
  constructor(
    private readonly local: LocalStore,
    private readonly remote: RemoteProvider,
    private readonly now: () => Date,
    private readonly deleteGuard: (trackedCount: number) => number = defaultDeleteGuard,
    private readonly concurrency: number = DEFAULT_CONCURRENCY
  ) {}

  async sync(prev: SyncStateData): Promise<{ state: SyncStateData; report: SyncReport }> {
    const [localList, remoteList] = await Promise.all([this.local.list(stampsOf(prev)), this.remote.list()]);
    const localMap = new Map<string, LocalFile>(localList.map((f) => [f.path, f]));
    const remoteMap = new Map<string, RemoteObject>(remoteList.map((o) => [o.path, o]));

    const { deferLocal, deferRemote } = this.planDeletions(prev, localMap, remoteMap);

    const state: SyncStateData = { ...prev };
    const report = emptyReport();

    const paths = new Set<string>([...localMap.keys(), ...remoteMap.keys(), ...Object.keys(prev)]);
    // パスごとの判断は互いに独立している（触るのは自分の state[path] と report の配列だけ）。
    await runPool(paths, this.concurrency, async (path) => {
      try {
        await this.reconcile(path, localMap.get(path), remoteMap.get(path), prev[path], state, report, deferLocal, deferRemote);
      } catch (e) {
        report.errors.push({ path, error: (e as Error).message });
      }
    });
    return { state, report };
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
  private planDeletions(
    prev: SyncStateData,
    localMap: Map<string, LocalFile>,
    remoteMap: Map<string, RemoteObject>
  ): { deferLocal: boolean; deferRemote: boolean } {
    // ベースラインに無いパス = 今回現れたもの。移動先の候補。
    const newLocalHashes = new Set<string>();
    for (const [path, f] of localMap) if (!prev[path]) newLocalHashes.add(f.hash);
    const newRemoteVersions = new Set<string>();
    for (const [path, o] of remoteMap) if (!prev[path] && o.version) newRemoteVersions.add(o.version);

    let localDeletes = 0;
    let remoteDeletes = 0;
    for (const path of Object.keys(prev)) {
      const S = prev[path];
      const L = localMap.get(path);
      const R = remoteMap.get(path);
      // リモートから消えた → ローカルを消すことになる。同じ内容が別のリモートパスに
      // 現れているなら移動なので数えない。
      if (L && L.hash === S.localHash && !R && !newRemoteVersions.has(S.remoteVersion)) localDeletes++;
      // ローカルから消えた → リモートを消すことになる。同上。
      if (!L && R && R.version === S.remoteVersion && !newLocalHashes.has(S.localHash)) remoteDeletes++;
    }

    const limit = this.deleteGuard(Object.keys(prev).length);
    return { deferLocal: localDeletes > limit, deferRemote: remoteDeletes > limit };
  }

  private async reconcile(
    path: string,
    L: LocalFile | undefined,
    R: RemoteObject | undefined,
    S: FileState | undefined,
    state: SyncStateData,
    report: SyncReport,
    deferLocal: boolean,
    deferRemote: boolean
  ): Promise<void> {
    const localChanged = L ? !S || L.hash !== S.localHash : !!S;
    const remoteChanged = R ? !S || R.version !== S.remoteVersion : !!S;

    if (!localChanged && !remoteChanged) {
      if (!L && !R) delete state[path];
      return;
    }

    // 両方が変更（新しい端末で既存 Vault を初めて同期した場合を含む）。
    if (L && R && localChanged && remoteChanged) {
      await this.resolveConflict(path, L, R, state, report);
      return;
    }

    if (localChanged && !remoteChanged) {
      if (L) await this.upload(path, L, state, report);
      else if (deferRemote) report.deferredDeletes.push(path);
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
      await this.upload(path, L, state, report);
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
      await this.local.write(safeVaultPath(path), remoteBytes);
      state[path] = { localHash: remoteHash, remoteVersion: R.version };
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
    await this.local.write(safeVaultPath(path), data);
    state[path] = { localHash: await sha256Hex(data), remoteVersion: R.version };
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
