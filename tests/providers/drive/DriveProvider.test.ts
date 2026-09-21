/*
 * DriveProvider — Drive API v3 上の同期先。偽の Drive が全リクエストを記録するので、
 * ネットワークにも資格情報にも触れずに往復と送信パラメータを確かめられる。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DriveProvider, escapeDriveQuery } from "../../../src/providers/drive/DriveProvider";
import { FakeDrive } from "../../helpers/fake-drive";

const ROOT = "15hqTj0tUn3tpfWeSYca0xcuNlEGDJrvW";
const DRIVE_ID = "0AInotARealSharedDrive";

const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;
const dec = (b: ArrayBuffer): string => new TextDecoder().decode(b);

let drive: FakeDrive;

beforeEach(() => {
  drive = new FakeDrive(ROOT);
});

const provider = (driveId = DRIVE_ID, d: FakeDrive = drive): DriveProvider =>
  new DriveProvider({ folderId: ROOT, driveId }, async () => "tok", d.http);

describe("共有ドライブ上の同期ルート", () => {
  beforeEach(() => {
    drive.sharedDrive = true; // 名指ししない list には空を返す（本物と同じ振る舞い）
    drive.seed("notes/a.md", "hello");
  });

  it("files.list は共有ドライブを名指しする（corpora=drive&driveId）", async () => {
    await provider().list();
    const lists = drive.listUrls();

    expect(lists.length).toBeGreaterThan(0);
    expect(lists.every((u) => u.includes("corpora=drive") && u.includes(`driveId=${DRIVE_ID}`))).toBe(true);
  });

  it("files.list は includeItemsFromAllDrives と supportsAllDrives を付ける", async () => {
    await provider().list();
    const lists = drive.listUrls();

    expect(lists.every((u) => u.includes("includeItemsFromAllDrives=true"))).toBe(true);
    expect(lists.every((u) => u.includes("supportsAllDrives=true"))).toBe(true);
  });

  it("パラメータを欠くと空が返る——だから名指しが要る（前提の確認）", async () => {
    // 同じ偽ドライブに、共有ドライブを知らない設定で問い合わせる。
    expect(await provider("").list()).toEqual([]);
  });

  it("作成・アップロード・ゴミ箱移動も supportsAllDrives を付ける", async () => {
    const p = provider();
    await p.put("notes/b.md", enc("x"));
    await p.delete("notes/b.md");

    const writes = drive.urls().filter((u) => u.startsWith("POST ") || u.startsWith("PATCH "));
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.every((u) => u.includes("supportsAllDrives=true"))).toBe(true);
  });

  it("本文のダウンロードにも supportsAllDrives を付ける", async () => {
    await provider().get("notes/a.md");
    expect(drive.urls().some((u) => u.includes("alt=media") && u.includes("supportsAllDrives=true"))).toBe(true);
  });

  it("ゴミ箱移動の URL のクエリが壊れていない（'?' が一つ、余分な '&' 無し）", async () => {
    await provider().delete("notes/a.md");
    const trash = drive.urls().find((u) => u.startsWith("PATCH ") && !u.includes("uploadType"));
    expect(trash).toMatch(/\/files\/[^/?]+\?supportsAllDrives=true$/);
  });

  it("走査は指定されたフォルダから始まり、ドライブのルートへ広がらない", async () => {
    await provider().list();
    const lists = drive.listUrls();

    expect(lists.some((u) => u.includes(encodeURIComponent(`'${ROOT}' in parents`)))).toBe(true);
    expect(lists.some((u) => u.includes(encodeURIComponent("'root' in parents")))).toBe(false);
    expect(lists.some((u) => u.includes(encodeURIComponent(`'${DRIVE_ID}' in parents`)))).toBe(false);
  });
});

describe("マイドライブ上の同期ルート", () => {
  it("共有ドライブ用のパラメータを一切送らない", async () => {
    drive.seed("notes/a.md", "hello");
    const p = provider("");
    await p.list();
    await p.put("notes/a.md", enc("x"));
    await p.delete("notes/a.md");

    expect(drive.urls().some((u) => /supportsAllDrives|includeItemsFromAllDrives|corpora|driveId/.test(u))).toBe(false);
  });

  it("それでも走査は指定されたフォルダから始まる", async () => {
    await provider("").list();
    expect(drive.listUrls().some((u) => u.includes(encodeURIComponent(`'${ROOT}' in parents`)))).toBe(true);
  });

  it("ゴミ箱移動の URL は素のまま", async () => {
    drive.seed("a.md", "x");
    await provider("").delete("a.md");
    expect(drive.urls().some((u) => /PATCH .*\/files\/[^/?]+$/.test(u))).toBe(true);
  });
});

describe("認証", () => {
  it("すべてのリクエストに Bearer トークンを付ける", async () => {
    drive.seed("a.md", "x");
    const p = provider();
    await p.list();
    await p.get("a.md");

    expect(drive.requests.every((r) => r.headers.authorization === "Bearer tok")).toBe(true);
  });

  it("トークンはリクエストのたびに取り直す（更新に追従する）", async () => {
    let n = 0;
    const p = new DriveProvider({ folderId: ROOT, driveId: "" }, async () => `tok-${++n}`, drive.http);
    await p.list();
    await p.list();

    const tokens = new Set(drive.requests.map((r) => r.headers.authorization));
    expect(tokens.size).toBeGreaterThan(1);
  });
});

describe("列挙", () => {
  it("フォルダ構造をそのままパスとして組み立てる（平坦化しない）", async () => {
    drive.seed("a.md", "root");
    drive.seed("顧客/A社.md", "a");
    drive.seed("顧客/2026/09/日報.md", "b");

    const objects = await provider("").list();
    expect(objects.map((o) => o.path).sort()).toEqual(["a.md", "顧客/2026/09/日報.md", "顧客/A社.md"]);
  });

  it("フォルダ自体は結果に現れない", async () => {
    drive.seed("顧客/A社.md", "a");
    const objects = await provider("").list();
    expect(objects.map((o) => o.path)).toEqual(["顧客/A社.md"]);
  });

  it("版・サイズ・mtime を持ち回る", async () => {
    drive.seed("a.md", "hello");
    const [o] = await provider("").list();

    expect(o.version).not.toBe("");
    expect(o.size).toBe(5);
    expect(o.mtime).toBeTypeOf("number");
  });

  it("版は内容から決まる（同じ内容なら同じ版 = 移動の検出が成り立つ）", async () => {
    drive.seed("旧/a.md", "same");
    drive.seed("新/a.md", "same");
    const objects = await provider("").list();

    expect(objects[0].version).toBe(objects[1].version);
  });

  it("ページングを最後まで辿る", async () => {
    const paged = new FakeDrive(ROOT, 2); // 1 ページ 2 件
    for (let i = 0; i < 7; i++) paged.seed(`f${i}.md`, "v" + i);

    expect(await provider("", paged).list()).toHaveLength(7);
    expect(paged.listUrls().some((u) => u.includes("pageToken="))).toBe(true);
  });

  it("prefix を渡すとその配下だけに絞る", async () => {
    drive.seed("顧客/A社.md", "a");
    drive.seed("顧客外/B社.md", "b");
    drive.seed("日報/x.md", "c");

    const paths = (await provider("").list("顧客")).map((o) => o.path);
    expect(paths).toEqual(["顧客/A社.md"]); // 「顧客外」は前方一致するが配下ではない
  });

  it("ゴミ箱のファイルは現れない", async () => {
    drive.seed("a.md", "x");
    const p = provider("");
    await p.delete("a.md");

    expect(await p.list()).toEqual([]);
  });
});

describe("読み書き", () => {
  it("新規ファイルはフォルダごと作られる", async () => {
    await provider("").put("議事録/2026/09.md", enc("x"));
    expect(drive.contents()).toHaveProperty("議事録/2026/09.md", "x");
  });

  it("既存ファイルは同じ場所を上書きする（複製を作らない）", async () => {
    drive.seed("a.md", "v1");
    await provider("").put("a.md", enc("v2"));

    expect(Object.keys(drive.contents())).toEqual(["a.md"]);
    expect(drive.contents()["a.md"]).toBe("v2");
  });

  it("同じフォルダへの二度目の書き込みでフォルダを作り直さない", async () => {
    const p = provider("");
    await p.put("議事録/a.md", enc("a"));
    const created = drive.urls().filter((u) => u.startsWith("POST ")).length;
    await p.put("議事録/b.md", enc("b"));

    // 増えるのはファイルの作成 1 件だけ（フォルダは ID を憶えている）。
    expect(drive.urls().filter((u) => u.startsWith("POST ")).length).toBe(created + 1);
  });

  it("put が返す版は、その内容の版である", async () => {
    const p = provider("");
    const { version } = await p.put("a.md", enc("hello"));
    expect((await p.head("a.md"))?.version).toBe(version);
  });

  it("書いたものがそのまま読める", async () => {
    const p = provider("");
    await p.put("顧客/A社.md", enc("本文"));
    expect(dec((await p.get("顧客/A社.md")) as ArrayBuffer)).toBe("本文");
  });

  it("無いファイルの取得は null（例外にしない）", async () => {
    expect(await provider("").get("無い.md")).toBeNull();
  });

  it("無いフォルダの下の取得も null", async () => {
    expect(await provider("").get("無いフォルダ/a.md")).toBeNull();
  });

  it("head は無ければ null", async () => {
    expect(await provider("").head("無い.md")).toBeNull();
  });
});

describe("削除", () => {
  it("完全削除ではなくゴミ箱へ送る（判断を誤っても戻せる）", async () => {
    drive.seed("a.md", "x");
    await provider("").delete("a.md");

    expect(drive.trashedPaths()).toEqual(["a.md"]);
    expect(drive.urls().some((u) => u.startsWith("DELETE "))).toBe(false);
  });

  it("無いファイルの削除は何もしない（冪等）", async () => {
    await provider("").delete("無い.md");
    expect(drive.urls().some((u) => u.startsWith("PATCH "))).toBe(false);
  });
});

describe("速さのための約束", () => {
  it("列挙で分かった ID を使い、操作のたびに引き直さない", async () => {
    drive.seed("notes/a.md", "v1");
    const p = provider("");
    await p.list();

    const before = drive.urls().length;
    await p.get("notes/a.md");
    await p.put("notes/a.md", enc("v2"));
    await p.delete("notes/a.md");

    // 取得 1 + アップロード 1 + ゴミ箱 1。検索の往復は 1 度も挟まない。
    expect(drive.urls().length).toBe(before + 3);
    expect(drive.urls().slice(before).some((u) => u.includes("q="))).toBe(false);
  });

  it("消えていた ID は引き直してやり直す", async () => {
    drive.seed("a.md", "v1");
    const p = provider("");
    await p.list();
    drive.hardDelete("a.md"); // 他の誰かが完全に消した

    await p.put("a.md", enc("v2"));

    expect(drive.contents()).toHaveProperty("a.md", "v2");
  });

  it("同じ新しいフォルダへ同時に書いてもフォルダは一つ", async () => {
    const p = provider("");
    await Promise.all([p.put("議事録/a.md", enc("a")), p.put("議事録/b.md", enc("b"))]);

    expect(drive.folderCount("議事録")).toBe(1);
    expect(Object.keys(drive.contents()).sort()).toEqual(["議事録/a.md", "議事録/b.md"]);
  });

  it("サブフォルダは並列に辿る", async () => {
    for (const dir of ["a", "b", "c", "d"]) drive.seed(`${dir}/x.md`, "x");
    drive.delayMs = 5;

    const started = Date.now();
    await provider("").list();

    // 直列なら 4 フォルダ × 5ms が積み上がる。並列ならルート + 1 段分で済む。
    expect(Date.now() - started).toBeLessThan(4 * 5);
  });
});

describe("escapeDriveQuery", () => {
  it("クエリを閉じてしまう引用符を潰す", () => {
    expect(escapeDriveQuery("O'Brien.md")).toBe("O\\'Brien.md");
  });

  it("バックスラッシュ自体も escape する", () => {
    expect(escapeDriveQuery("a\\b")).toBe("a\\\\b");
  });

  it("引用符を含む名前でも正しいファイルに辿り着く", async () => {
    drive.seed("O'Brien's.md", "x");
    expect(dec((await provider("").get("O'Brien's.md")) as ArrayBuffer)).toBe("x");
  });

  /*
   * 同期ルートの ID は利用者が貼った URL から来る。q を閉じる文字を素のまま
   * 埋めると、`in parents` の縛りが外れて同期ルートの外まで列挙されうる。
   */
  it("同期ルートの ID も escape してから q に入れる", async () => {
    const seen: string[] = [];
    const spy = new FakeDrive(ROOT);
    const rogue = new DriveProvider(
      { folderId: "root' or name!='", driveId: "" },
      async () => "tok",
      async (m, url, h, b) => {
        if (url.includes("/files?q=")) seen.push(decodeURIComponent(new URL(url).searchParams.get("q") as string));
        return spy.http(m, url, h, b);
      }
    );

    await rogue.list();

    expect(seen[0]).toBe("'root\\' or name!=\\'' in parents and trashed=false");
  });
});
