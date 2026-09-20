/*
 * インメモリの Vault。ObsidianLocalStore が使う Vault API の面だけを実装する。
 * アダプタ（ファイルシステム直叩き）ではなく Vault API を持つのは、実装がそちらを
 * 通すからで、開いているファイルを壊さないことがこのモデルの要件だからである。
 * 出荷物ではない。
 */
import { TAbstractFile, TFile, TFolder } from "./obsidian-mock";

export class FakeVault {
  configDir = ".obsidian";

  private readonly files = new Map<string, TFile>();
  private readonly folders = new Map<string, TFolder>();
  private readonly bytes = new Map<string, ArrayBuffer>();

  /** テストが覗くための記録。 */
  getFilesCalls = 0;
  readPaths: string[] = [];
  trashed: { path: string; system: boolean }[] = [];
  /** true の間、OS ゴミ箱への移動は失敗する（フォールバックの検証用）。 */
  systemTrashBroken = false;

  constructor() {
    this.folders.set("", new TFolder(""));
  }

  // ------------------------------------------------------------ 準備用

  seed(path: string, content: string, mtime = 1): TFile {
    const file = new TFile(path, mtime);
    this.files.set(path, file);
    this.bytes.set(path, new TextEncoder().encode(content).buffer);
    this.link(path, file);
    return file;
  }

  contentOf(path: string): string | undefined {
    const b = this.bytes.get(path);
    return b === undefined ? undefined : new TextDecoder().decode(b);
  }

  /** 祖先フォルダを作りながら、親の children に繋ぐ。 */
  private link(path: string, entry: TAbstractFile): void {
    const slash = path.lastIndexOf("/");
    const dir = slash < 0 ? "" : path.slice(0, slash);
    if (dir) this.ensureFolder(dir);
    const parent = this.folders.get(dir);
    if (parent && !parent.children.includes(entry)) parent.children.push(entry);
  }

  private ensureFolder(dir: string): TFolder {
    const existing = this.folders.get(dir);
    if (existing) return existing;
    const folder = new TFolder(dir);
    this.folders.set(dir, folder);
    this.link(dir, folder);
    return folder;
  }

  // -------------------------------------------------------- Vault API

  getFiles(): TFile[] {
    this.getFilesCalls++;
    return [...this.files.values()];
  }

  getFileByPath(path: string): TFile | null {
    return this.files.get(path) ?? null;
  }

  getFolderByPath(path: string): TFolder | null {
    return this.folders.get(path) ?? null;
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this.files.get(path) ?? this.folders.get(path) ?? null;
  }

  async read(file: TFile): Promise<string> {
    return new TextDecoder().decode(await this.readBinary(file));
  }

  async readBinary(file: TFile): Promise<ArrayBuffer> {
    this.readPaths.push(file.path);
    const b = this.bytes.get(file.path);
    if (!b) throw new Error("not found: " + file.path);
    return b;
  }

  async createBinary(path: string, data: ArrayBuffer): Promise<TFile> {
    if (this.files.has(path)) throw new Error("already exists: " + path);
    const file = new TFile(path, 1);
    this.files.set(path, file);
    this.bytes.set(path, data);
    this.link(path, file);
    return file;
  }

  async modifyBinary(file: TFile, data: ArrayBuffer): Promise<void> {
    if (!this.files.has(file.path)) throw new Error("not found: " + file.path);
    this.bytes.set(file.path, data);
  }

  async createFolder(path: string): Promise<TFolder> {
    if (this.folders.has(path)) throw new Error("already exists: " + path);
    return this.ensureFolder(path);
  }

  async trash(file: TAbstractFile, system: boolean): Promise<void> {
    if (system && this.systemTrashBroken) throw new Error("system trash unavailable");
    this.trashed.push({ path: file.path, system });
    this.files.delete(file.path);
    this.bytes.delete(file.path);
    this.folders.delete(file.path);
    for (const folder of this.folders.values()) {
      const i = folder.children.indexOf(file);
      if (i >= 0) folder.children.splice(i, 1);
    }
  }
}

/** ObsidianLocalStore が受け取る App の形。 */
export function appWith(vault: FakeVault): { vault: FakeVault } {
  return { vault };
}
