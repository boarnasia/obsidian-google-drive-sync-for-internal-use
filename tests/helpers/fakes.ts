/*
 * 同期エンジンの両側（ローカル / リモート）のインメモリ実装。
 * ネットワークにも Obsidian にも触れない。出荷物ではない。
 */
import { PutResult, RemoteObject, RemoteProvider } from "../../src/providers/RemoteProvider";
import { LocalStore } from "../../src/sync/LocalStore";
import { LocalFile, LocalStamp } from "../../src/sync/types";
import { sha256Hex } from "../../src/util/hash";

export const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;
export const dec = (b: ArrayBuffer): string => new TextDecoder().decode(b);

/**
 * リモートの版は *内容* から決まる。Drive の `md5Checksum` がそうであり、
 * 移動の検出はこの性質に乗っている——同じ内容が別のパスに現れたなら移動である。
 */
export function versionOf(data: ArrayBuffer): string {
  return "md5:" + dec(data);
}

export class FakeRemote implements RemoteProvider {
  readonly id = "fake";
  store = new Map<string, { data: ArrayBuffer; mtime?: number }>();
  private clock = 0;

  async put(path: string, data: ArrayBuffer): Promise<PutResult> {
    this.store.set(path, { data, mtime: ++this.clock });
    return { version: versionOf(data) };
  }
  async get(path: string): Promise<ArrayBuffer | null> {
    return this.store.get(path)?.data ?? null;
  }
  async head(path: string): Promise<RemoteObject | null> {
    const e = this.store.get(path);
    return e ? { path, version: versionOf(e.data), size: e.data.byteLength, mtime: e.mtime } : null;
  }
  async delete(path: string): Promise<void> {
    this.store.delete(path);
  }
  async list(): Promise<RemoteObject[]> {
    return [...this.store.entries()].map(([path, e]) => ({
      path,
      version: versionOf(e.data),
      size: e.data.byteLength,
      mtime: e.mtime,
    }));
  }
  /** 誰かがリモートでファイルを移した。内容も版も変わらない。 */
  move(from: string, to: string): void {
    const e = this.store.get(from);
    if (!e) throw new Error("no such remote file: " + from);
    this.store.delete(from);
    this.store.set(to, e);
  }
  setMtime(path: string, mtime: number | undefined): void {
    const e = this.store.get(path);
    if (e) e.mtime = mtime;
  }
  text(path: string): string | undefined {
    const e = this.store.get(path);
    return e && dec(e.data);
  }
}

export class FakeLocal implements LocalStore {
  store = new Map<string, ArrayBuffer>();
  private mt = new Map<string, number>();
  private clock = 0;
  /** ハッシュを取り直したパス。キャッシュが効いているかをテストが見る。 */
  hashedPaths: string[] = [];

  async list(known?: ReadonlyMap<string, LocalStamp>): Promise<LocalFile[]> {
    return Promise.all(
      [...this.store.entries()].map(async ([path, data]) => {
        const mtime = this.mt.get(path) ?? 0;
        const size = data.byteLength;
        const cached = known?.get(path);
        if (cached && cached.mtime === mtime && cached.size === size) {
          return { path, hash: cached.hash, mtime, size };
        }
        this.hashedPaths.push(path);
        return { path, hash: await sha256Hex(data), mtime, size };
      })
    );
  }
  async read(path: string): Promise<ArrayBuffer> {
    const d = this.store.get(path);
    if (!d) throw new Error("not found: " + path);
    return d;
  }
  async write(path: string, data: ArrayBuffer): Promise<void> {
    if (path.split("/").includes("..")) throw new Error("unsafe path: " + path);
    this.store.set(path, data);
    this.mt.set(path, ++this.clock);
  }
  async delete(path: string): Promise<void> {
    this.store.delete(path);
    this.mt.delete(path);
  }
  /** 利用者がローカルでファイルを移した。内容は変わらない。 */
  move(from: string, to: string): void {
    const d = this.store.get(from);
    if (!d) throw new Error("no such local file: " + from);
    this.store.delete(from);
    this.store.set(to, d);
    this.mt.set(to, this.mt.get(from) ?? 0);
    this.mt.delete(from);
  }
  setMtime(path: string, mtime: number): void {
    this.mt.set(path, mtime);
  }
  text(path: string): string | undefined {
    const d = this.store.get(path);
    return d && dec(d);
  }
}
