/*
 * SyncEngine のオフラインテスト。LocalStore / RemoteProvider はインメモリの偽物で、
 * ネットワークも資格情報も使わない。
 * 実行: sh scripts/run-pilot.sh scripts/sync-test.ts
 */
import { SyncEngine, defaultDeleteGuard } from "../src/sync/SyncEngine";
import { LocalStore } from "../src/sync/LocalStore";
import { LocalFile, SyncStateData } from "../src/sync/types";
import { PutResult, RemoteObject, RemoteProvider } from "../src/providers/RemoteProvider";
import { sha256Hex } from "../src/util/hash";

const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer;
const dec = (b: ArrayBuffer): string => new TextDecoder().decode(b);
const FIXED = (): Date => new Date("2026-02-03T04:05:06Z");

/**
 * リモートの版は *内容* から決まる。Drive の `md5Checksum` がそうであり、
 * 移動の検出はこの性質に乗っている——同じ内容が別のパスに現れたなら移動である。
 */
function versionOf(data: ArrayBuffer): string {
  return "md5:" + dec(data);
}

class FakeRemote implements RemoteProvider {
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
}

class FakeLocal implements LocalStore {
  store = new Map<string, ArrayBuffer>();
  private mt = new Map<string, number>();
  private clock = 0;

  async list(): Promise<LocalFile[]> {
    return Promise.all(
      [...this.store.entries()].map(async ([path, data]) => ({
        path,
        hash: await sha256Hex(data),
        mtime: this.mt.get(path) ?? 0,
      }))
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
}

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
  }
}

const engine = (L: FakeLocal, R: FakeRemote): SyncEngine => new SyncEngine(L, R, FIXED);

async function main(): Promise<void> {
  // 1. 新しいローカルファイルはアップロードされる
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("hello"));
    const { report, state } = await engine(L, R).sync({});
    check("新規ローカル → アップロード", report.uploaded.includes("a.md") && dec(R.store.get("a.md")!.data) === "hello");
    check("ベースラインに記録される", state["a.md"] !== undefined);
  }

  // 2. 新しいリモートファイルはダウンロードされる
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await R.put("b.md", enc("remote"));
    const { report } = await engine(L, R).sync({});
    check("新規リモート → ダウンロード", report.downloaded.includes("b.md") && dec(L.store.get("b.md")!) === "remote");
  }

  // 3. 変化が無ければ何もしない
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("x"));
    const s1 = (await engine(L, R).sync({})).state;
    const { report } = await engine(L, R).sync(s1);
    check("無変更 → 何もしない", report.uploaded.length + report.downloaded.length === 0);
  }

  // 4/5. 片側だけの変更
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("v1"));
    const s1 = (await engine(L, R).sync({})).state;
    await L.write("a.md", enc("v2"));
    const { report } = await engine(L, R).sync(s1);
    check("ローカル変更 → アップロード", report.uploaded.includes("a.md") && dec(R.store.get("a.md")!.data) === "v2");
  }
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("v1"));
    const s1 = (await engine(L, R).sync({})).state;
    await R.put("a.md", enc("v2"));
    const { report } = await engine(L, R).sync(s1);
    check("リモート変更 → ダウンロード", report.downloaded.includes("a.md") && dec(L.store.get("a.md")!) === "v2");
  }

  // 6/7. 削除の伝播
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("x"));
    const s1 = (await engine(L, R).sync({})).state;
    await L.delete("a.md");
    const { report, state } = await engine(L, R).sync(s1);
    check("ローカル削除 → リモートも削除", report.deletedRemote.includes("a.md") && !R.store.has("a.md"));
    check("ベースラインから消える", state["a.md"] === undefined);
  }
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("x"));
    const s1 = (await engine(L, R).sync({})).state;
    await R.delete("a.md");
    const { report } = await engine(L, R).sync(s1);
    check("リモート削除 → ローカルも削除", report.deletedLocal.includes("a.md") && !L.store.has("a.md"));
  }

  // 8-10. 競合
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("same"));
    await R.put("a.md", enc("same"));
    const { report } = await engine(L, R).sync({});
    check("内容が同一なら競合ではない", report.conflicts.length === 0);
  }
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("local"));
    L.setMtime("a.md", 100);
    await R.put("a.md", enc("remote"));
    R.setMtime("a.md", 200); // リモートの方が新しい
    const { report } = await engine(L, R).sync({});
    check("リモートが新しい → リモートが正", dec(L.store.get("a.md")!) === "remote");
    check("古いローカル版は競合コピーに残る", dec(L.store.get("a.conflict-20260203T040506Z.md")!) === "local");
    check("競合として報告される", report.conflicts.length === 1);
  }
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("local"));
    L.setMtime("a.md", 100);
    await R.put("a.md", enc("remote"));
    R.setMtime("a.md", undefined); // リモートの mtime が不明
    await engine(L, R).sync({});
    check("リモートの mtime が不明 → ローカルが正（安全側）", dec(L.store.get("a.md")!) === "local");
    check("古いリモート版は競合コピーに残る", dec(L.store.get("a.conflict-20260203T040506Z.md")!) === "remote");
  }

  // 11/12. 削除 × 変更 — 生き残った内容を守る
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("v1"));
    const s1 = (await engine(L, R).sync({})).state;
    await L.write("a.md", enc("v2"));
    await R.delete("a.md");
    const { report } = await engine(L, R).sync(s1);
    check("ローカル変更 × リモート削除 → 再アップロード", report.uploaded.includes("a.md"));
  }
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await L.write("a.md", enc("v1"));
    const s1 = (await engine(L, R).sync({})).state;
    await L.delete("a.md");
    await R.put("a.md", enc("v2"));
    const { report } = await engine(L, R).sync(s1);
    check("ローカル削除 × リモート変更 → 復元", report.downloaded.includes("a.md"));
  }

  // 13. パストラバーサル
  {
    const L = new FakeLocal(), R = new FakeRemote();
    await R.put("../../escape.md", enc("x"));
    const { report } = await engine(L, R).sync({});
    check("親への脱出を含むリモートパスは拒否される", report.errors.some((e) => e.path === "../../escape.md"));
    check("拒否しても他は止まらない（エラーとして記録）", !L.store.has("../../escape.md"));
  }

  // 14. リモート側の移動は削除として数えない（共有Vault の本命）
  {
    const L = new FakeLocal(), R = new FakeRemote();
    for (let i = 0; i < 50; i++) await L.write(`旧/f${i}.md`, enc("v" + i));
    const s1 = (await engine(L, R).sync({})).state;
    // 田中さんが 50 ファイルをまとめて移動した
    for (let i = 0; i < 50; i++) R.move(`旧/f${i}.md`, `新/f${i}.md`);
    const { report } = await engine(L, R).sync(s1);

    check("上限（10）を大きく超える移動でも保留されない", report.deferredDeletes.length === 0);
    check("ローカルも移動に追従する", L.store.has("新/f0.md") && !L.store.has("旧/f0.md"));
    check("内容は保たれる", dec(L.store.get("新/f7.md")!) === "v7");
  }

  // 15. ローカル側の移動も同じ
  {
    const L = new FakeLocal(), R = new FakeRemote();
    for (let i = 0; i < 50; i++) await L.write(`旧/f${i}.md`, enc("v" + i));
    const s1 = (await engine(L, R).sync({})).state;
    for (let i = 0; i < 50; i++) L.move(`旧/f${i}.md`, `新/f${i}.md`);
    const { report } = await engine(L, R).sync(s1);

    check("ローカルの大量移動も保留されない", report.deferredDeletes.length === 0);
    check("リモートも移動に追従する", R.store.has("新/f0.md") && !R.store.has("旧/f0.md"));
  }

  // 16. 本当の大量削除は保留する。ただし追加・更新は通す
  {
    const L = new FakeLocal(), R = new FakeRemote();
    for (let i = 0; i < 50; i++) await L.write(`f${i}.md`, enc("v" + i));
    const s1 = (await engine(L, R).sync({})).state;
    for (let i = 0; i < 50; i++) R.delete(`f${i}.md`);
    await R.put("新しい.md", enc("added"));
    const { report, state } = await engine(L, R).sync(s1);

    check("上限を超える削除は保留される", report.deferredDeletes.length === 50);
    check("ローカルのファイルは消えていない", L.store.has("f0.md"));
    check("保留中でも追加は同期される", report.downloaded.includes("新しい.md") && L.store.has("新しい.md"));
    check("保留した分のベースラインは残す（次回また判断する）", state["f0.md"] !== undefined);
  }

  // 17. 上限内の削除は普通に適用する（ガードが効きすぎない）
  {
    const L = new FakeLocal(), R = new FakeRemote();
    for (let i = 0; i < 50; i++) await L.write(`f${i}.md`, enc("v" + i));
    const s1 = (await engine(L, R).sync({})).state;
    await R.delete("f0.md");
    const { report } = await engine(L, R).sync(s1);
    check("上限内の削除はそのまま適用される", report.deletedLocal.includes("f0.md") && !L.store.has("f0.md"));
  }

  check("既定の上限は max(10, 20%)", defaultDeleteGuard(0) === 10 && defaultDeleteGuard(100) === 20);

  console.log(`\n=== sync engine: ${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed) ===`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error("sync-test crashed:", (e as Error).message);
  process.exitCode = 1;
});
