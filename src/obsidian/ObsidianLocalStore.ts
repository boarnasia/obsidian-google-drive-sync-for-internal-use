import { App, TFile, normalizePath } from "obsidian";
import { LocalStore } from "../sync/LocalStore";
import { LocalFile, LocalStamp, LocalStat } from "../sync/types";
import { sha256Hex } from "../util/hash";
import { safeVaultPath } from "../util/paths";
import { runPool } from "../util/pool";
import { t } from "../i18n";
import { TEAM_IGNORE_PATH } from "../sync/configFiles";

/** 同時に中身を読むファイル数。大きな添付が数百件あっても、載るのはこの数だけ。 */
const HASH_CONCURRENCY = 8;

/**
 * 同期するドットファイル。Obsidian の Vault API はドットで始まるパスを索引に
 * 載せないので、これらだけはアダプタで読み書きする（ADR-0007）。
 */
const HIDDEN_FILES: readonly string[] = [TEAM_IGNORE_PATH];

/**
 * 共有Vault のローカル側。Vault 全体が同期ルートに対応する。
 *
 * 書き込みは Vault API を通す。ファイルシステムを直接叩くと、利用者が開いている
 * ファイルをエディタの裏で書き換えることになる（ADR-0001）。
 */
export class ObsidianLocalStore implements LocalStore {
  /**
   * @param beforeWrite 書き込み・削除・フォルダ作成の直前に Vault 相対パスを受け取る。
   *   Obsidian は modify / create / delete を書き込みの完了 *前* に発火するので、
   *   自分の書き込みを見分けたい側は、ここで先に控えておく必要がある。
   */
  constructor(
    private readonly app: App,
    private readonly beforeWrite: (path: string) => void = () => undefined
  ) {}

  // ------------------------------------------------------------ パスの変換

  /** 範囲外に出る入力はここで弾く。 */
  private resolve(path: string): string {
    const rel = safeVaultPath(path);
    if (!rel) throw new Error(t.errEmptyPath);
    const full = normalizePath(rel);
    // 読み取り側の境界と書き込み側の境界を同じ関数で決める。片方だけが緩いと、
    // リモートが返したパスで Vault の外——とりわけ設定ディレクトリ——に書ける。
    if (!this.inScope(full)) throw new Error(t.errOutsideMount(full));
    return full;
  }

  private inScope(full: string): boolean {
    const cfg = this.app.vault.configDir;
    // 設定ディレクトリは無条件で対象外。ここには data.json があり、Google の
    // リフレッシュトークンが入っている（ADR-0003）。
    return full !== cfg && !full.startsWith(cfg + "/");
  }

  // ---------------------------------------------------------------- 読み取り

  /**
   * 同期範囲のファイル一覧。
   *
   * ハッシュは中身を読まないと出ないので、前回と mtime・size が同じファイルは
   * `known` のハッシュをそのまま使う。これが無いと、何も変わっていない同期でも
   * Vault 全体を読み直すことになる。
   */
  async list(known?: ReadonlyMap<string, LocalStamp>, onHashed?: (done: number, total: number) => void): Promise<LocalFile[]> {
    const out: LocalFile[] = [];
    const toHash: TFile[] = [];

    for (const f of this.app.vault.getFiles()) {
      if (!this.inScope(f.path)) continue;
      const { path, stat: { mtime, size } } = f;
      const cached = known?.get(path);
      if (cached && cached.mtime === mtime && cached.size === size) out.push({ path, hash: cached.hash, mtime, size });
      else toHash.push(f);
    }

    for (const path of HIDDEN_FILES) {
      const stat = await this.app.vault.adapter.stat(path);
      if (stat?.type !== "file") continue;
      const { mtime, size } = stat;
      const cached = known?.get(path);
      const hash =
        cached && cached.mtime === mtime && cached.size === size
          ? cached.hash
          : await sha256Hex(await this.app.vault.adapter.readBinary(path));
      out.push({ path, hash, mtime, size });
    }

    // 読むものだけを、上限を付けて読む。全件を一度に読むと、初回同期で Vault の
    // 中身がまるごと同時にメモリに載る。
    let hashed = 0;
    onHashed?.(0, toHash.length);
    await runPool(toHash, HASH_CONCURRENCY, async (f) => {
      const { mtime, size } = f.stat;
      const hash = await sha256Hex(await this.app.vault.readBinary(f));
      out.push({ path: f.path, hash, mtime, size });
      onHashed?.(++hashed, toHash.length);
    });
    // 読み終わった順ではなくパス順で返す。サイドバーの一覧が更新のたびに並び替わらない。
    return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  async read(path: string): Promise<ArrayBuffer> {
    const full = this.resolve(path);
    if (HIDDEN_FILES.includes(full)) return this.app.vault.adapter.readBinary(full);
    const file = this.app.vault.getFileByPath(full);
    if (!file) throw new Error(t.errLocalMissing(full));
    return this.app.vault.readBinary(file);
  }

  /**
   * 設定ファイル用。無ければ null を返す。
   *
   * 同期の対象かどうかとは無関係に読む必要がある（除外規則は、同期が始まる前に読む）。
   */
  async readText(path: string): Promise<string | null> {
    const full = this.resolve(path);
    if (HIDDEN_FILES.includes(full)) {
      return (await this.app.vault.adapter.exists(full)) ? this.app.vault.adapter.read(full) : null;
    }
    const file = this.app.vault.getFileByPath(full);
    if (!file) return null;
    return this.app.vault.read(file);
  }

  // ---------------------------------------------------------------- 書き込み

  /**
   * Vault API 経由で書く。既存ファイルは `modifyBinary` で置き換えるので、その
   * ファイルが開かれていればエディタが正しくリロードされ、他の人の更新がその場で
   * 見える。これがこのモデルの目的そのものである（ADR-0001）。
   */
  async write(path: string, data: ArrayBuffer): Promise<LocalStat> {
    const full = this.resolve(path);
    if (HIDDEN_FILES.includes(full)) {
      // Vault の索引に載らないので変更イベントも来ない。自分の書き込みとして控える必要は無い。
      await this.app.vault.adapter.writeBinary(full, data);
      const stat = await this.app.vault.adapter.stat(full);
      if (!stat) throw new Error(t.errLocalMissing(full));
      return { mtime: stat.mtime, size: stat.size };
    }
    const existing = this.app.vault.getFileByPath(full);
    if (existing) {
      this.beforeWrite(full);
      await this.app.vault.modifyBinary(existing, data);
      return statOf(existing);
    }
    const slash = full.lastIndexOf("/");
    if (slash > 0) await this.ensureFolder(full.slice(0, slash));
    this.beforeWrite(full);
    return statOf(await this.app.vault.createBinary(full, data));
  }

  /** 祖先フォルダを順に作る（createFolder は再帰的ではない）。 */
  private async ensureFolder(dir: string): Promise<void> {
    let cur = "";
    for (const part of dir.split("/")) {
      if (!part) continue;
      cur = cur ? `${cur}/${part}` : part;
      if (this.app.vault.getFolderByPath(cur)) continue;
      this.beforeWrite(cur);
      // 直前の存在確認をすり抜けて既にある場合（別の同期や利用者の操作）は無視する。
      await this.app.vault.createFolder(cur).catch(() => undefined);
    }
  }

  async delete(path: string): Promise<void> {
    const full = this.resolve(path);
    if (HIDDEN_FILES.includes(full)) {
      if (!(await this.app.vault.adapter.exists(full))) return;
      if (!(await this.app.vault.adapter.trashSystem(full))) await this.app.vault.adapter.trashLocal(full);
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(full);
    if (!file) return;
    this.beforeWrite(full);
    // 完全削除はしない。「リモートで消えた」という判断が誤っていても、必ず戻せる
    // ようにしておく。OS のゴミ箱を優先し、使えなければ Vault 内の .trash に落とす。
    // FileManager.trashFile は利用者の「完全に削除」設定にも従ってしまうので使わない
    // （lint の prefer-file-manager-trash-file 警告は承知の上で残す）。
    await this.app.vault.trash(file, true).catch(() => this.app.vault.trash(file, false));
  }
}

/** 書き込みの完了までに Obsidian が stat を新しい姿に更新している。 */
function statOf(file: TFile): LocalStat {
  return { mtime: file.stat.mtime, size: file.stat.size };
}
