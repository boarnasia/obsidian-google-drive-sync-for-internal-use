/*
 * ObsidianLocalStore — 共有Vault のローカル側。ネットワークも Obsidian 本体も使わない。
 *
 * 見ているのは二つ。マウントポイントの変換が正しいことと、書き込みの境界が
 * 読み取りの境界と一致していること（片方だけ緩いと、リモートが返したパスで
 * 設定ディレクトリに書ける）。
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

const store = (mount: string): ObsidianLocalStore =>
  new ObsidianLocalStore(appWith(v) as unknown as App, mount);

const pathsOf = async (mount: string): Promise<string[]> =>
  (await store(mount).list()).map((f) => f.path).sort();

describe("マウント = Vault 全体", () => {
  beforeEach(() => {
    v.seed("顧客/A社.md", "a");
    v.seed("日報/2026-09-12.md", "b");
    v.seed(".obsidian/plugins/x/data.json", "secret");
  });

  it("全ファイルが Vault 相対のまま出る", async () => {
    expect(await pathsOf("")).toEqual(["日報/2026-09-12.md", "顧客/A社.md"]);
  });

  it("設定ディレクトリは同期対象に入らない（リフレッシュトークンが入っている）", async () => {
    expect((await pathsOf("")).some((p) => p.startsWith(".obsidian"))).toBe(false);
  });

  it("Vault 全体のときだけ getFiles を呼ぶ", async () => {
    await store("").list();
    expect(v.getFilesCalls).toBe(1);
  });

  it("内容のハッシュが取れている", async () => {
    expect((await store("").list()).every((f) => /^[0-9a-f]{64}$/.test(f.hash))).toBe(true);
  });

  it("mtime を持ち回る（競合の新旧判定に使う）", async () => {
    v.seed("新しい.md", "x", 12345);
    expect((await store("").list()).find((f) => f.path === "新しい.md")?.mtime).toBe(12345);
  });
});

describe("マウント = 部分木", () => {
  beforeEach(() => {
    v.seed("個人メモ/日記.md", "private");
    v.seed("仕事/顧客/A社.md", "a");
    v.seed("仕事/日報/2026-09-12.md", "b");
  });

  it("マウント配下だけが、マウント相対のパスで出る", async () => {
    expect(await pathsOf("仕事")).toEqual(["日報/2026-09-12.md", "顧客/A社.md"]);
  });

  it("マウントのフォルダ名はパスに現れない（各自が別名を付けられる）", async () => {
    expect((await pathsOf("仕事")).some((p) => p.startsWith("仕事"))).toBe(false);
  });

  it("Vault 全体を列挙しない", async () => {
    await store("仕事").list();
    expect(v.getFilesCalls).toBe(0);
  });

  it("マウント外のファイルは読みにすら行かない", async () => {
    await store("仕事").list();
    expect(v.readPaths.some((p) => p.startsWith("個人メモ"))).toBe(false);
  });

  it("読み取りはマウント相対のパスで通る", async () => {
    expect(new TextDecoder().decode(await store("仕事").read("顧客/A社.md"))).toBe("a");
  });

  it("前後のスラッシュが付いたマウント指定も同じに扱う", async () => {
    expect(await pathsOf("/仕事/")).toEqual(["日報/2026-09-12.md", "顧客/A社.md"]);
  });

  it("存在しないファイルの読み取りは失敗する", async () => {
    await expect(store("仕事").read("無い.md")).rejects.toThrow();
  });
});

describe("存在しないマウント", () => {
  it("同期対象ゼロとして扱う（Vault 全体に広がらない）", async () => {
    v.seed("顧客/A社.md", "a");
    expect(await pathsOf("存在しない")).toEqual([]);
    expect(v.getFilesCalls).toBe(0);
  });
});

describe("書き込み", () => {
  beforeEach(() => {
    v.seed("仕事/顧客/A社.md", "old");
  });

  it("既存ファイルは modifyBinary で置き換える（開いているエディタが追従する経路）", async () => {
    await store("仕事").write("顧客/A社.md", enc("new"));
    expect(v.contentOf("仕事/顧客/A社.md")).toBe("new");
  });

  it("新規ファイルは祖先フォルダごと作る", async () => {
    await store("仕事").write("議事録/2026/09/12.md", enc("x"));

    expect(v.contentOf("仕事/議事録/2026/09/12.md")).toBe("x");
    expect(v.getFolderByPath("仕事/議事録")).not.toBeNull();
    expect(v.getFolderByPath("仕事/議事録/2026")).not.toBeNull();
  });

  it("書き込み先もマウント配下に落ちる", async () => {
    await store("仕事").write("議事録/12.md", enc("x"));
    expect(v.getFileByPath("議事録/12.md")).toBeNull();
  });
});

describe("書き込みの境界", () => {
  beforeEach(() => {
    v.seed("仕事/a.md", "a");
    v.seed(".obsidian/plugins/x/data.json", "secret");
  });

  it("マウントの外へは書けない（親への脱出）", async () => {
    await expect(store("仕事").write("../個人メモ/盗んだ.md", enc("x"))).rejects.toThrow(/unsafe path/);
    expect(v.getFileByPath("個人メモ/盗んだ.md")).toBeNull();
  });

  it("Vault 全体でも設定ディレクトリには書けない", async () => {
    await expect(store("").write(".obsidian/plugins/evil/main.js", enc("x"))).rejects.toThrow();
    expect(v.getFileByPath(".obsidian/plugins/evil/main.js")).toBeNull();
  });

  it("設定ディレクトリは削除もできない", async () => {
    await expect(store("").delete(".obsidian/plugins/x/data.json")).rejects.toThrow();
    expect(v.getFileByPath(".obsidian/plugins/x/data.json")).not.toBeNull();
  });

  it("読み取りも同じ境界で止まる", async () => {
    await expect(store("").read(".obsidian/plugins/x/data.json")).rejects.toThrow();
  });

  it("空のパスは受け付けない", async () => {
    await expect(store("仕事").write("", enc("x"))).rejects.toThrow();
  });
});

describe("削除", () => {
  beforeEach(() => {
    v.seed("仕事/消す.md", "x");
  });

  it("OS のゴミ箱へ送る（完全削除しない）", async () => {
    await store("仕事").delete("消す.md");

    expect(v.trashed).toEqual([{ path: "仕事/消す.md", system: true }]);
    expect(v.getFileByPath("仕事/消す.md")).toBeNull();
  });

  it("OS のゴミ箱が使えなければ Vault 内の .trash に落とす", async () => {
    v.systemTrashBroken = true;
    await store("仕事").delete("消す.md");

    expect(v.trashed).toEqual([{ path: "仕事/消す.md", system: false }]);
  });

  it("存在しないファイルの削除は何もしない", async () => {
    await store("仕事").delete("もう無い.md");
    expect(v.trashed).toEqual([]);
  });
});
