/*
 * インメモリの Vault。ObsidianLocalStore が使う Vault API の面だけを実装する。
 * アダプタ（ファイルシステム直叩き）ではなく Vault API を持つのは、実装がそちらを
 * 通すからで、開いているファイルを壊さないことがこのモデルの要件だからである。
 * 出荷物ではない。
 */
import { TAbstractFile, TFile, TFolder } from "./obsidian-mock";

/**
 * Vault の索引に載らないドットファイルを置く場所。本物のアダプタと同じく、書いても
 * 変更イベントは飛ばない。
 */
export class FakeAdapter {
  readonly files = new Map<string, { data: ArrayBuffer; mtime: number }>();
  trashed: { path: string; system: boolean }[] = [];
  private clock = 5000;

  seed(path: string, content: string, mtime = 1): void {
    this.files.set(path, { data: new TextEncoder().encode(content).buffer as ArrayBuffer, mtime });
  }

  contentOf(path: string): string | undefined {
    const f = this.files.get(path);
    return f === undefined ? undefined : new TextDecoder().decode(f.data);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async stat(path: string): Promise<{ type: "file"; mtime: number; size: number; ctime: number } | null> {
    const f = this.files.get(path);
    return f ? { type: "file", mtime: f.mtime, size: f.data.byteLength, ctime: f.mtime } : null;
  }

  async read(path: string): Promise<string> {
    return new TextDecoder().decode(await this.readBinary(path));
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const f = this.files.get(path);
    if (!f) throw new Error("not found: " + path);
    return f.data;
  }

  async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    this.files.set(path, { data, mtime: ++this.clock });
  }

  async trashSystem(path: string): Promise<boolean> {
    this.trashed.push({ path, system: true });
    return this.files.delete(path);
  }

  async trashLocal(path: string): Promise<void> {
    this.trashed.push({ path, system: false });
    this.files.delete(path);
  }
}

export class FakeVault {
  configDir = ".obsidian";
  readonly adapter = new FakeAdapter();

  private readonly files = new Map<string, TFile>();
  private readonly folders = new Map<string, TFolder>();
  private readonly bytes = new Map<string, ArrayBuffer>();

  /** テストが覗くための記録。 */
  getFilesCalls = 0;
  readPaths: string[] = [];
  trashed: { path: string; system: boolean }[] = [];
  /** true の間、OS ゴミ箱への移動は失敗する（フォールバックの検証用）。 */
  systemTrashBroken = false;
  /**
   * 変更イベントの受け手。本物と同じく、書き込みの Promise が解決する *前* に呼ぶ
   * （Obsidian はアダプタの書き込みの中で modify / create / delete を発火する）。
   */
  onChange: (type: "create" | "modify" | "delete", path: string) => void = () => undefined;
  private clock = 1000;

  constructor() {
    this.folders.set("", new TFolder(""));
  }

  // ------------------------------------------------------------ 準備用

  seed(path: string, content: string, mtime = 1): TFile {
    const file = new TFile(path, mtime);
    const data = new TextEncoder().encode(content).buffer;
    file.stat.size = data.byteLength;
    this.files.set(path, file);
    this.bytes.set(path, data);
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
    const file = new TFile(path, ++this.clock);
    file.stat.size = data.byteLength;
    this.files.set(path, file);
    this.bytes.set(path, data);
    this.link(path, file);
    this.onChange("create", path);
    return file;
  }

  async modifyBinary(file: TFile, data: ArrayBuffer): Promise<void> {
    if (!this.files.has(file.path)) throw new Error("not found: " + file.path);
    this.bytes.set(file.path, data);
    file.stat.mtime = ++this.clock;
    file.stat.size = data.byteLength;
    this.onChange("modify", file.path);
  }

  async createFolder(path: string): Promise<TFolder> {
    if (this.folders.has(path)) throw new Error("already exists: " + path);
    const folder = this.ensureFolder(path);
    this.onChange("create", path);
    return folder;
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
    this.onChange("delete", file.path);
  }
}

/** ObsidianLocalStore が受け取る App の形。 */
export function appWith(vault: FakeVault): { vault: FakeVault } {
  return { vault };
}
