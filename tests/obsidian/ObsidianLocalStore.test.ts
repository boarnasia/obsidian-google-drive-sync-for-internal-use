/*
 * ObsidianLocalStore — 共有Vault のローカル側。ネットワークも Obsidian 本体も使わない。
 *
 * 見ているのは、書き込みの境界が読み取りの境界と一致していること（片方だけ
 * 緩いと、リモートが返したパスで設定ディレクトリに書ける）。
 */
import { App } from "obsidian";
import { beforeEach, describe, expect, it } from "vitest";
import { ObsidianLocalStore } from "../../src/obsidian/ObsidianLocalStore";
import { FakeVault, appWith } from "../helpers/fake-vault";

const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;

let v: FakeVault;

beforeEach(() => {
  v = new FakeVault();
});

const store = (): ObsidianLocalStore => new ObsidianLocalStore(appWith(v) as unknown as App);

const pathsOf = async (): Promise<string[]> => (await store().list()).map((f) => f.path).sort();

describe("一覧", () => {
  beforeEach(() => {
    v.seed("顧客/A社.md", "a");
    v.seed("日報/2026-09-12.md", "b");
    v.seed(".obsidian/plugins/x/data.json", "secret");
  });

  it("全ファイルが Vault 相対のまま出る", async () => {
    expect(await pathsOf()).toEqual(["日報/2026-09-12.md", "顧客/A社.md"]);
  });

  it("設定ディレクトリは同期対象に入らない（リフレッシュトークンが入っている）", async () => {
    expect((await pathsOf()).some((p) => p.startsWith(".obsidian"))).toBe(false);
  });

  it("内容のハッシュが取れている", async () => {
    expect((await store().list()).every((f) => /^[0-9a-f]{64}$/.test(f.hash))).toBe(true);
  });

  it("mtime を持ち回る（競合の新旧判定に使う）", async () => {
    v.seed("新しい.md", "x", 12345);
    expect((await store().list()).find((f) => f.path === "新しい.md")?.mtime).toBe(12345);
  });
});

describe("読み取り", () => {
  it("Vault 相対のパスで通る", async () => {
    v.seed("顧客/A社.md", "a");
    expect(new TextDecoder().decode(await store().read("顧客/A社.md"))).toBe("a");
  });

  it("存在しないファイルの読み取りは失敗する", async () => {
    await expect(store().read("無い.md")).rejects.toThrow();
  });
});

describe("書き込み", () => {
  beforeEach(() => {
    v.seed("顧客/A社.md", "old");
  });

  it("既存ファイルは modifyBinary で置き換える（開いているエディタが追従する経路）", async () => {
    await store().write("顧客/A社.md", enc("new"));
    expect(v.contentOf("顧客/A社.md")).toBe("new");
  });

  it("新規ファイルは祖先フォルダごと作る", async () => {
    await store().write("議事録/2026/09/12.md", enc("x"));

    expect(v.contentOf("議事録/2026/09/12.md")).toBe("x");
    expect(v.getFolderByPath("議事録")).not.toBeNull();
    expect(v.getFolderByPath("議事録/2026")).not.toBeNull();
  });

});

describe("書き込みの境界", () => {
  beforeEach(() => {
    v.seed("a.md", "a");
    v.seed(".obsidian/plugins/x/data.json", "secret");
  });

  it("Vault の外へは書けない（親への脱出）", async () => {
    await expect(store().write("../盗んだ.md", enc("x"))).rejects.toThrow(/unsafe path/);
    expect(v.getFileByPath("盗んだ.md")).toBeNull();
  });

  it("設定ディレクトリには書けない", async () => {
    await expect(store().write(".obsidian/plugins/evil/main.js", enc("x"))).rejects.toThrow();
    expect(v.getFileByPath(".obsidian/plugins/evil/main.js")).toBeNull();
  });

  it("設定ディレクトリは削除もできない", async () => {
    await expect(store().delete(".obsidian/plugins/x/data.json")).rejects.toThrow();
    expect(v.getFileByPath(".obsidian/plugins/x/data.json")).not.toBeNull();
  });

  it("読み取りも同じ境界で止まる", async () => {
    await expect(store().read(".obsidian/plugins/x/data.json")).rejects.toThrow();
  });

  it("空のパスは受け付けない", async () => {
    await expect(store().write("", enc("x"))).rejects.toThrow();
  });
});

describe("削除", () => {
  beforeEach(() => {
    v.seed("消す.md", "x");
  });

  it("OS のゴミ箱へ送る（完全削除しない）", async () => {
    await store().delete("消す.md");

    expect(v.trashed).toEqual([{ path: "消す.md", system: true }]);
    expect(v.getFileByPath("消す.md")).toBeNull();
  });

  it("OS のゴミ箱が使えなければ Vault 内の .trash に落とす", async () => {
    v.systemTrashBroken = true;
    await store().delete("消す.md");

    expect(v.trashed).toEqual([{ path: "消す.md", system: false }]);
  });

  it("存在しないファイルの削除は何もしない", async () => {
    await store().delete("もう無い.md");
    expect(v.trashed).toEqual([]);
  });
});

/*
 * 一覧はハッシュのために中身を読む。全件を一度に読むと、初回同期で Vault が
 * まるごと同時にメモリに載る（数百件の添付を抱えた Vault で効く）。
 */
describe("一覧の読み方", () => {
  /** 読み取りを握って離さない偽物。同時に何件走っているかを数える。 */
  function gatedReads() {
    const release: (() => void)[] = [];
    let live = 0;
    let peak = 0;
    const original = v.readBinary.bind(v);
    v.readBinary = async (file) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise<void>((r) => release.push(r));
      live--;
      return original(file);
    };
    return {
      peak: () => peak,
      /** 一覧が終わるまで、待っている読み取りを繰り返し進める。 */
      async drive(listing: Promise<unknown>): Promise<void> {
        let done = false;
        void listing.then(() => (done = true));
        for (let i = 0; i < 500 && !done; i++) {
          release.splice(0).forEach((r) => r());
          await new Promise((r) => setTimeout(r, 0));
        }
      },
    };
  }

  it("同時に読む件数に上限がある", async () => {
    for (let i = 0; i < 50; i++) v.seed(`n${i}.md`, String(i));
    const gate = gatedReads();

    const listing = store().list();
    await gate.drive(listing);
    await listing;

    expect(gate.peak()).toBeLessThanOrEqual(8);
    expect(gate.peak()).toBeGreaterThan(1); // 1 件ずつ待つのも遅すぎる
  });

  it("姿が変わっていないファイルは読まない", async () => {
    v.seed("a.md", "x");
    v.seed("b.md", "y");
    const first = await store().list();
    v.readPaths.length = 0;

    const known = new Map(first.map((f) => [f.path, { hash: f.hash, mtime: f.mtime, size: f.size }]));
    const again = await store().list(known);

    expect(v.readPaths).toEqual([]);
    expect(again.map((f) => f.path)).toEqual(["a.md", "b.md"]);
  });

  it("読み終わった順ではなくパス順で返す", async () => {
    for (const name of ["c.md", "a.md", "b.md"]) v.seed(name, name);
    expect((await store().list()).map((f) => f.path)).toEqual(["a.md", "b.md", "c.md"]);
  });
});
