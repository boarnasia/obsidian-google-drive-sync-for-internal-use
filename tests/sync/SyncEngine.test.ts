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

const engine = (): SyncEngine => new SyncEngine(L, R, FIXED);
const sync = (prev: SyncStateData = {}, opts?: { approvedDeletes?: ReadonlySet<string> }) =>
  engine().sync(prev, opts);
const clone = (prev: SyncStateData = {}) => engine().clone(prev);

/**
 * 「前回は同期できていたが、その後どちらも変わった」状態のベースライン。
 * ベースラインが無いまま同期しようとすると、今は clone を求めて止まる（ADR-0005）ので、
 * 競合そのものを見たいテストはこれで足場を作る。
 */
const stale = (...paths: string[]): SyncStateData =>
  Object.fromEntries(paths.map((p) => [p, { localHash: "古いハッシュ", remoteVersion: "古い版" }]));

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
    await L.write("b.md", enc("y"));
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
  it("両側にあっても内容が同じなら競合ではない", async () => {
    await L.write("a.md", enc("same"));
    await R.put("a.md", enc("same"));

    const { report, state } = await sync(stale("a.md"));
    expect(report.conflicts).toHaveLength(0);
    expect(state["a.md"]).toBeDefined(); // 黙ってベースラインに採用される
  });

  it("リモートが新しければリモートを正とし、古いローカル版を競合コピーに残す", async () => {
    await L.write("a.md", enc("local"));
    L.setMtime("a.md", 100);
    await R.put("a.md", enc("remote"));
    R.setMtime("a.md", 200);

    const { report } = await sync(stale("a.md"));

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

    const { report } = await sync(stale("a.md"));

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

    await sync(stale("a.md"));

    expect(L.text("a.md")).toBe("local");
    expect(L.text(`a.conflict-${STAMP}.md`)).toBe("remote");
  });

  it("どちらに転んでも両方の内容が Vault に残る", async () => {
    await L.write("a.md", enc("local"));
    await R.put("a.md", enc("remote"));

    await sync(stale("a.md"));
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

describe("clone — リモートをローカルに再現する（非破壊）", () => {
  it("リモートのファイルを取得し、ベースラインを作り直す", async () => {
    await R.put("a.md", enc("x"));
    await R.put("メモ/b.md", enc("y"));

    const { state, report } = await clone();

    expect(L.text("a.md")).toBe("x");
    expect(L.text("メモ/b.md")).toBe("y");
    expect(report.downloaded.sort()).toEqual(["a.md", "メモ/b.md"]);
    expect(Object.keys(state).sort()).toEqual(["a.md", "メモ/b.md"]);
  });

  it("ローカルにしか無いファイルは消さず、分類待ちとして返す", async () => {
    await R.put("a.md", enc("x"));
    await L.write("個人メモ.md", enc("私的"));

    const { report, state } = await clone();

    expect(L.text("個人メモ.md")).toBe("私的"); // 消えない
    expect(report.localOnly).toEqual(["個人メモ.md"]);
    expect(state["個人メモ.md"]).toBeUndefined(); // ベースラインには載せない
  });

  it("同名で内容が違えば、ローカル版を競合コピーに退避してからリモート版を置く", async () => {
    await L.write("a.md", enc("私の版"));
    await R.put("a.md", enc("チームの版"));

    const { report } = await clone();

    expect(L.text("a.md")).toBe("チームの版");
    expect(L.text(`a.conflict-${STAMP}.md`)).toBe("私の版");
    expect(report.conflicts).toEqual([{ path: "a.md", conflictPath: `a.conflict-${STAMP}.md` }]);
    expect(report.localOnly).toContain(`a.conflict-${STAMP}.md`); // 退避した版も分類の対象
  });

  it("同じ秒に複数を退避しても名前がぶつからない", async () => {
    await L.write("a.md", enc("私の版"));
    await L.write(`a.conflict-${STAMP}.md`, enc("前回の退避"));
    await R.put("a.md", enc("チームの版"));

    await clone();

    expect(L.text(`a.conflict-${STAMP}.md`)).toBe("前回の退避"); // 上書きしない
    expect(L.text(`a.conflict-${STAMP}-2.md`)).toBe("私の版");
  });

  it("内容が同じファイルはダウンロードし直さない", async () => {
    await L.write("a.md", enc("同じ"));
    await R.put("a.md", enc("同じ"));

    const { report, state } = await clone();

    expect(report.downloaded).toEqual([]);
    expect(report.conflicts).toEqual([]);
    expect(state["a.md"]).toBeDefined();
  });

  it("空の Vault に対しては、ただの取得になる（今回の復旧経路）", async () => {
    await R.put("a.md", enc("x"));
    await R.put("b.md", enc("y"));
    const broken = { "a.md": { localHash: "古い", remoteVersion: "古い" }, "b.md": { localHash: "古い", remoteVersion: "古い" } };

    const { report, state } = await clone(broken);

    expect(report.conflicts).toEqual([]);
    expect(report.localOnly).toEqual([]);
    expect(Object.keys(state).sort()).toEqual(["a.md", "b.md"]);
  });
});

describe("疑わしい状態では、アップロードだけを止める", () => {
  it("ベースラインが無く両側に中身があれば止まる（clone を通っていない）", async () => {
    await L.write("a.md", enc("私の"));
    await R.put("b.md", enc("チームの"));

    const { report } = await sync();

    expect(report.blocked).toContain("no-baseline");
    expect(report.heldUploads).toContain("a.md");
    expect(R.store.has("a.md")).toBe(false);
  });

  it("止まっていてもダウンロードは進む", async () => {
    await L.write("a.md", enc("私の"));
    await R.put("b.md", enc("チームの"));

    const { report } = await sync();

    expect(report.downloaded).toContain("b.md");
    expect(L.text("b.md")).toBe("チームの");
  });

  it("ローカルが空でベースラインが残っていれば止まる（Vault を消した直後）", async () => {
    for (let i = 0; i < 3; i++) await L.write(`n${i}.md`, enc(String(i)));
    const s1 = await baseline();
    for (let i = 0; i < 3; i++) await L.delete(`n${i}.md`);

    const { report } = await sync(s1);

    expect(report.blocked).toContain("vault-empty");
    expect(report.deferredDeletes.sort()).toEqual(["n0.md", "n1.md", "n2.md"]);
    expect(R.store.size).toBe(3); // リモートは無傷
  });

  it("承認したパスだけは、止まっていても削除する", async () => {
    for (let i = 0; i < 3; i++) await L.write(`n${i}.md`, enc(String(i)));
    const s1 = await baseline();
    for (let i = 0; i < 3; i++) await L.delete(`n${i}.md`);

    const { report, state } = await sync(s1, { approvedDeletes: new Set(["n1.md"]) });

    expect(report.deletedRemote).toEqual(["n1.md"]);
    expect(R.store.has("n1.md")).toBe(false);
    expect(R.store.has("n0.md")).toBe(true);
    expect(state["n1.md"]).toBeUndefined();
    expect(state["n0.md"]).toBeDefined(); // 承認していない分は持ち越す
  });

  it("clone の後は普通に同期できる", async () => {
    await R.put("a.md", enc("チームの"));
    await L.write("私のメモ.md", enc("私の"));
    const { state } = await clone();

    const { report } = await sync(state);

    expect(report.blocked).toEqual([]);
    expect(report.uploaded).toContain("私のメモ.md");
  });
});

describe("plan — 適用せずに数える", () => {
  it("アップロード、ダウンロード、ローカル固有を数える", async () => {
    await L.write("私の.md", enc("x"));
    await R.put("チームの.md", enc("y"));

    const plan = await engine().plan({});

    expect(plan.upload).toEqual(["私の.md"]);
    expect(plan.download).toEqual(["チームの.md"]);
    expect(plan.localOnly).toEqual(["私の.md"]);
    expect(plan.blocked).toEqual(["no-baseline"]);
  });

  it("数えるだけで、何も動かさない", async () => {
    await L.write("a.md", enc("x"));
    await engine().plan({});

    expect(R.store.size).toBe(0);
  });

  it("問題が無ければ blocked は空", async () => {
    await L.write("a.md", enc("x"));
    const s1 = await baseline();
    await L.write("a.md", enc("x2"));

    const plan = await engine().plan(s1);

    expect(plan.blocked).toEqual([]);
    expect(plan.upload).toEqual(["a.md"]);
  });
});

describe("速さのための約束", () => {
  it("変わっていないファイルは二度とハッシュしない", async () => {
    L.store.set("a.md", enc("x"));
    L.store.set("b.md", enc("y"));
    const s1 = await baseline();

    L.hashedPaths = [];
    await sync(s1);

    expect(L.hashedPaths).toEqual([]);
  });

  it("中身が変わったファイルだけハッシュし直す", async () => {
    L.store.set("a.md", enc("x"));
    L.store.set("b.md", enc("y"));
    const s1 = await baseline();

    L.hashedPaths = [];
    await L.write("b.md", enc("y2")); // mtime も size も変わる
    await sync(s1);

    expect(L.hashedPaths).toEqual(["b.md"]);
  });

  it("ベースラインに姿が無ければ読み直す（古い保存データ）", async () => {
    L.store.set("a.md", enc("x"));
    const s1 = await baseline();
    delete s1["a.md"].localMtime;
    delete s1["a.md"].localSize;

    L.hashedPaths = [];
    await sync(s1);

    expect(L.hashedPaths).toEqual(["a.md"]);
  });

  it("ファイルを並列に処理する（1 件ずつ待たない）", async () => {
    for (let i = 0; i < 16; i++) L.store.set(`n${i}.md`, enc(String(i)));

    let inFlight = 0;
    let peak = 0;
    const put = R.put.bind(R);
    R.put = async (path, data) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return put(path, data);
    };
    await sync();

    expect(peak).toBeGreaterThan(1);
  });

  it("同時実行数の上限を超えない", async () => {
    for (let i = 0; i < 16; i++) L.store.set(`n${i}.md`, enc(String(i)));

    let inFlight = 0;
    let peak = 0;
    const put = R.put.bind(R);
    R.put = async (path, data) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return put(path, data);
    };
    await new SyncEngine(L, R, FIXED, defaultDeleteGuard, 3).sync({});

    expect(peak).toBe(3);
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
