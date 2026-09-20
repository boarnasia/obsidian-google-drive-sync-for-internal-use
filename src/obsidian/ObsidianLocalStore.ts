import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { LocalStore } from "../sync/LocalStore";
import { LocalFile } from "../sync/types";
import { sha256Hex } from "../util/hash";
import { safeVaultPath } from "../util/paths";
import { t } from "../i18n";

/**
 * 共有Vault のローカル側。
 *
 * `mountFolder` は「同期する範囲の絞り込み」ではなく **マウントポイント** である。
 * その直下が同期ルートの直下に対応し、フォルダ名自体はリモートに現れない。この
 * 変換をここで閉じ込めているので、同期エンジンより上はマウント相対のパスだけを
 * 扱えばよく、各自がローカルのどこを繋いでいるかを意識しなくて済む（ADR-0004）。
 *
 * 書き込みは Vault API を通す。ファイルシステムを直接叩くと、利用者が開いている
 * ファイルをエディタの裏で書き換えることになる（ADR-0001）。
 */
export class ObsidianLocalStore implements LocalStore {
  private readonly mount: string;

  constructor(private readonly app: App, mountFolder: string) {
    this.mount = mountFolder.replace(/^\/+|\/+$/g, "");
  }

  // ------------------------------------------------------------ パスの変換

  /** マウント相対 → Vault 相対。範囲外に出る入力はここで弾く。 */
  private resolve(path: string): string {
    const rel = safeVaultPath(path);
    if (!rel) throw new Error(t.errEmptyPath);
    const full = normalizePath(this.mount ? `${this.mount}/${rel}` : rel);
    // 読み取り側の境界と書き込み側の境界を同じ関数で決める。片方だけが緩いと、
    // リモートが返したパスで Vault の外——とりわけ設定ディレクトリ——に書ける。
    if (!this.inMount(full)) throw new Error(t.errOutsideMount(full));
    return full;
  }

  /** Vault 相対 → マウント相対。 */
  private toMountRelative(full: string): string {
    return this.mount ? full.slice(this.mount.length + 1) : full;
  }

  private inMount(full: string): boolean {
    const cfg = this.app.vault.configDir;
    // 設定ディレクトリは無条件で対象外。ここには data.json があり、Google の
    // リフレッシュトークンが入っている（ADR-0003）。
    if (full === cfg || full.startsWith(cfg + "/")) return false;
    if (!this.mount) return true;
    return full.startsWith(this.mount + "/");
  }

  // ---------------------------------------------------------------- 読み取り

  /**
   * 共有Vault に属するファイル。
   *
   * マウントポイントが指定されていれば、その部分木だけを歩く。Vault の他の場所は
   * 列挙すらしないので、このプラグインはそこに何があるかを知らない。マウントが
   * 空のときだけ、利用者が Vault 全体を共有すると決めたということなので、
   * `getFiles()` を明示的に呼ぶ。
   */
  private filesInMount(): TFile[] {
    if (!this.mount) return this.app.vault.getFiles().filter((f) => this.inMount(f.path));

    const root = this.app.vault.getFolderByPath(this.mount);
    // 存在しないマウントポイントは「同期対象ゼロ」。決して Vault 全体に広げない。
    // 広げれば全パスが漏れ、Vault 丸ごとがアップロードされる。
    if (!root) return [];

    const found: TFile[] = [];
    const visit = (entry: TAbstractFile): void => {
      if (entry instanceof TFolder) {
        for (const child of entry.children) visit(child);
      } else if (entry instanceof TFile && this.inMount(entry.path)) {
        found.push(entry);
      }
    };
    visit(root);
    return found;
  }

  async list(): Promise<LocalFile[]> {
    return Promise.all(
      this.filesInMount().map(async (f) => ({
        path: this.toMountRelative(f.path),
        hash: await sha256Hex(await this.app.vault.readBinary(f)),
        mtime: f.stat.mtime,
      }))
    );
  }

  async read(path: string): Promise<ArrayBuffer> {
    const full = this.resolve(path);
    const file = this.app.vault.getFileByPath(full);
    if (!file) throw new Error(t.errLocalMissing(full));
    return this.app.vault.readBinary(file);
  }

  // ---------------------------------------------------------------- 書き込み

  /**
   * Vault API 経由で書く。既存ファイルは `modifyBinary` で置き換えるので、その
   * ファイルが開かれていればエディタが正しくリロードされ、他の人の更新がその場で
   * 見える。これがこのモデルの目的そのものである（ADR-0001）。
   */
  async write(path: string, data: ArrayBuffer): Promise<void> {
    const full = this.resolve(path);
    const existing = this.app.vault.getFileByPath(full);
    if (existing) {
      await this.app.vault.modifyBinary(existing, data);
      return;
    }
    const slash = full.lastIndexOf("/");
    if (slash > 0) await this.ensureFolder(full.slice(0, slash));
    await this.app.vault.createBinary(full, data);
  }

  /** 祖先フォルダを順に作る（createFolder は再帰的ではない）。 */
  private async ensureFolder(dir: string): Promise<void> {
    let cur = "";
    for (const part of dir.split("/")) {
      if (!part) continue;
      cur = cur ? `${cur}/${part}` : part;
      if (this.app.vault.getFolderByPath(cur)) continue;
      // 直前の存在確認をすり抜けて既にある場合（別の同期や利用者の操作）は無視する。
      await this.app.vault.createFolder(cur).catch(() => undefined);
    }
  }

  async delete(path: string): Promise<void> {
    const full = this.resolve(path);
    const file = this.app.vault.getAbstractFileByPath(full);
    if (!file) return;
    // 完全削除はしない。「リモートで消えた」という判断が誤っていても、必ず戻せる
    // ようにしておく。OS のゴミ箱を優先し、使えなければ Vault 内の .trash に落とす。
    // FileManager.trashFile は利用者の「完全に削除」設定にも従ってしまうので使わない
    // （lint の prefer-file-manager-trash-file 警告は承知の上で残す）。
    await this.app.vault.trash(file, true).catch(() => this.app.vault.trash(file, false));
  }
}
