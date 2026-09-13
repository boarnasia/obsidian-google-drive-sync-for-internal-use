/*
 * SyncEngine の三方向マージ。LocalStore / RemoteProvider はインメモリの偽物で、
 * ネットワークも資格情報も使わない。
 *
 * ここで守っているのは一つの約束である——決してデータを失わない。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SyncEngine, defaultDeleteGuard } from "../../src/sync/SyncEngine";
import { SyncStateData } from "../../src/sync/types";
import { FakeLocal, FakeRemote, enc } from "../helpers/fakes";

/** 競合コピーの名前が決まるよう、時計は止めておく。 */
const FIXED = (): Date => new Date("2026-02-03T04:05:06Z");
const STAMP = "20260203T040506Z";

let L: FakeLocal;
let R: FakeRemote;

beforeEach(() => {
  L = new FakeLocal();
  R = new FakeRemote();
});

const sync = (prev: SyncStateData = {}) => new SyncEngine(L, R, FIXED).sync(prev);

/** 一度同期して、以後の「ベースライン」を作る。 */
const baseline = async (): Promise<SyncStateData> => (await sync()).state;

describe("片側だけが変わったとき", () => {
  it("新しいローカルファイルはアップロードされ、ベースラインに載る", async () => {
    await L.write("a.md", enc("hello"));
    const { report, state } = await sync();

    expect(report.uploaded).toContain("a.md");
    expect(R.text("a.md")).toBe("hello");
    expect(state["a.md"]).toBeDefined();
  });

  it("新しいリモートファイルはダウンロードされる", async () => {
    await R.put("b.md", enc("remote"));
    const { report } = await sync();

    expect(report.downloaded).toContain("b.md");
    expect(L.text("b.md")).toBe("remote");
  });

  it("変化が無ければ何もしない", async () => {
    await L.write("a.md", enc("x"));
    const s1 = await baseline();

    const { report } = await sync(s1);
    expect(report.uploaded).toHaveLength(0);
    expect(report.downloaded).toHaveLength(0);
  });

  it("ローカルの更新はリモートへ上がる", async () => {
    await L.write("a.md", enc("v1"));
    const s1 = await baseline();

    await L.write("a.md", enc("v2"));
    const { report } = await sync(s1);

    expect(report.uploaded).toContain("a.md");
    expect(R.text("a.md")).toBe("v2");
  });

  it("リモートの更新はローカルへ降りる", async () => {
    await L.write("a.md", enc("v1"));
    const s1 = await baseline();

    await R.put("a.md", enc("v2"));
    const { report } = await sync(s1);

    expect(report.downloaded).toContain("a.md");
    expect(L.text("a.md")).toBe("v2");
  });
});

describe("削除の伝播", () => {
  it("ローカルで消したらリモートでも消え、ベースラインからも消える", async () => {
    await L.write("a.md", enc("x"));
    const s1 = await baseline();

    await L.delete("a.md");
    const { report, state } = await sync(s1);

    expect(report.deletedRemote).toContain("a.md");
    expect(R.store.has("a.md")).toBe(false);
    expect(state["a.md"]).toBeUndefined();
  });

  it("リモートで消えたらローカルでも消える", async () => {
    await L.write("a.md", enc("x"));
    const s1 = await baseline();

    await R.delete("a.md");
    const { report } = await sync(s1);

    expect(report.deletedLocal).toContain("a.md");
    expect(L.store.has("a.md")).toBe(false);
  });
});

describe("競合", () => {
  it("両側にあっても内容が同じなら競合ではない（既存 Vault の初回同期）", async () => {
    await L.write("a.md", enc("same"));
    await R.put("a.md", enc("same"));

    const { report, state } = await sync();
    expect(report.conflicts).toHaveLength(0);
    expect(state["a.md"]).toBeDefined(); // 黙ってベースラインに採用される
  });

  it("リモートが新しければリモートを正とし、古いローカル版を競合コピーに残す", async () => {
    await L.write("a.md", enc("local"));
    L.setMtime("a.md", 100);
    await R.put("a.md", enc("remote"));
    R.setMtime("a.md", 200);

    const { report } = await sync();

    expect(L.text("a.md")).toBe("remote");
    expect(L.text(`a.conflict-${STAMP}.md`)).toBe("local");
    expect(report.conflicts).toEqual([{ path: "a.md", conflictPath: `a.conflict-${STAMP}.md` }]);
    expect(report.downloaded).toContain("a.md");
  });

  it("ローカルが新しければローカルを正とし、古いリモート版を競合コピーに残す", async () => {
    await L.write("a.md", enc("local"));
    L.setMtime("a.md", 300);
    await R.put("a.md", enc("remote"));
    R.setMtime("a.md", 200);

    const { report } = await sync();

    expect(L.text("a.md")).toBe("local");
    expect(L.text(`a.conflict-${STAMP}.md`)).toBe("remote");
    expect(R.text("a.md")).toBe("local");
    expect(report.conflicts).toHaveLength(1);
  });

  it("リモートの mtime が不明ならローカルを正とする（安全側）", async () => {
    // リモートの mtime はアップロード時刻であり、実際の編集時刻より遅れうる。
    await L.write("a.md", enc("local"));
    L.setMtime("a.md", 100);
    await R.put("a.md", enc("remote"));
    R.setMtime("a.md", undefined);

    await sync();

    expect(L.text("a.md")).toBe("local");
    expect(L.text(`a.conflict-${STAMP}.md`)).toBe("remote");
  });

  it("どちらに転んでも両方の内容が Vault に残る", async () => {
    await L.write("a.md", enc("local"));
    await R.put("a.md", enc("remote"));

    await sync();
    const bodies = [...L.store.keys()].map((p) => L.text(p)).sort();
    expect(bodies).toEqual(["local", "remote"]);
  });
});

describe("削除 × 変更 — 生き残った内容を守る", () => {
  it("ローカル変更 × リモート削除 → 再アップロード", async () => {
    await L.write("a.md", enc("v1"));
    const s1 = await baseline();

    await L.write("a.md", enc("v2"));
    await R.delete("a.md");
    const { report } = await sync(s1);

    expect(report.uploaded).toContain("a.md");
    expect(R.text("a.md")).toBe("v2");
  });

  it("ローカル削除 × リモート変更 → 復元", async () => {
    await L.write("a.md", enc("v1"));
    const s1 = await baseline();

    await L.delete("a.md");
    await R.put("a.md", enc("v2"));
    const { report } = await sync(s1);

    expect(report.downloaded).toContain("a.md");
    expect(L.text("a.md")).toBe("v2");
  });

  it("両側で消えていればベースラインから落とすだけ", async () => {
    await L.write("a.md", enc("x"));
    const s1 = await baseline();

    await L.delete("a.md");
    await R.delete("a.md");
    const { report, state } = await sync(s1);

    expect(state["a.md"]).toBeUndefined();
    expect(report.deletedLocal).toHaveLength(0);
    expect(report.deletedRemote).toHaveLength(0);
  });
});

describe("不正なリモートパス", () => {
  it("親への脱出を含むパスは拒否し、エラーとして記録する", async () => {
    await R.put("../../escape.md", enc("x"));
    const { report } = await sync();

    expect(report.errors.some((e) => e.path === "../../escape.md")).toBe(true);
    expect(L.store.has("../../escape.md")).toBe(false);
  });

  it("拒否しても他のファイルの同期は止まらない", async () => {
    await R.put("../../escape.md", enc("x"));
    await R.put("正常.md", enc("ok"));
    const { report } = await sync();

    expect(report.errors).toHaveLength(1);
    expect(report.downloaded).toContain("正常.md");
  });
});

describe("削除の安全上限", () => {
  /** 50 ファイルを両側に行き渡らせた状態のベースラインを作る。 */
  async function seed50(dir = ""): Promise<SyncStateData> {
    for (let i = 0; i < 50; i++) await L.write(`${dir}f${i}.md`, enc("v" + i));
    return baseline();
  }

  it("リモート側の大量移動は削除として数えない", async () => {
    const s1 = await seed50("旧/");
    // 田中さんが 50 ファイルをまとめて移動した。全員から見ると大量削除に見える。
    for (let i = 0; i < 50; i++) R.move(`旧/f${i}.md`, `新/f${i}.md`);

    const { report } = await sync(s1);

    expect(report.deferredDeletes).toHaveLength(0);
    expect(L.store.has("新/f0.md")).toBe(true);
    expect(L.store.has("旧/f0.md")).toBe(false);
    expect(L.text("新/f7.md")).toBe("v7");
  });

  it("ローカル側の大量移動も同じ", async () => {
    const s1 = await seed50("旧/");
    for (let i = 0; i < 50; i++) L.move(`旧/f${i}.md`, `新/f${i}.md`);

    const { report } = await sync(s1);

    expect(report.deferredDeletes).toHaveLength(0);
    expect(R.store.has("新/f0.md")).toBe(true);
    expect(R.store.has("旧/f0.md")).toBe(false);
  });

  it("本当の大量削除は保留し、ベースラインを残して次回また判断する", async () => {
    const s1 = await seed50();
    for (let i = 0; i < 50; i++) await R.delete(`f${i}.md`);

    const { report, state } = await sync(s1);

    expect(report.deferredDeletes).toHaveLength(50);
    expect(report.deletedLocal).toHaveLength(0);
    expect(L.store.has("f0.md")).toBe(true);
    expect(state["f0.md"]).toBeDefined();
  });

  it("保留中でも追加と更新は通常どおり進む", async () => {
    const s1 = await seed50();
    for (let i = 0; i < 50; i++) await R.delete(`f${i}.md`);
    await R.put("新しい.md", enc("added"));

    const { report } = await sync(s1);

    expect(report.downloaded).toContain("新しい.md");
    expect(L.text("新しい.md")).toBe("added");
  });

  it("上限内の削除はそのまま適用する（ガードが効きすぎない）", async () => {
    const s1 = await seed50();
    await R.delete("f0.md");

    const { report } = await sync(s1);

    expect(report.deletedLocal).toContain("f0.md");
    expect(L.store.has("f0.md")).toBe(false);
    expect(report.deferredDeletes).toHaveLength(0);
  });

  it("上限は差し替えられる", async () => {
    for (let i = 0; i < 3; i++) await L.write(`f${i}.md`, enc("v" + i));
    const s1 = await baseline();
    for (let i = 0; i < 3; i++) await R.delete(`f${i}.md`);

    const { report } = await new SyncEngine(L, R, FIXED, () => 2).sync(s1);
    expect(report.deferredDeletes).toHaveLength(3);
  });
});

describe("defaultDeleteGuard", () => {
  it("小さな Vault でも 10 件までは許す", () => {
    expect(defaultDeleteGuard(0)).toBe(10);
    expect(defaultDeleteGuard(20)).toBe(10);
  });

  it("大きな Vault では追跡数の 20%", () => {
    expect(defaultDeleteGuard(100)).toBe(20);
    expect(defaultDeleteGuard(1000)).toBe(200);
  });

  it("端数は切り上げる", () => {
    expect(defaultDeleteGuard(101)).toBe(21);
  });
});
