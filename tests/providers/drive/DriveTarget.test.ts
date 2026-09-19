/*
 * 貼られた文字列の解釈と、同期先の確認。
 *
 * 共有ドライブのつもりでマイドライブのフォルダを貼ると、本人だけが同期できて
 * 他の誰にも届かないのに、正常に動いているように見える。その取り違えを、同期を
 * 始める前に目で捕まえられるようにするのがここの役目である（ADR-0004）。
 */
import { describe, expect, it } from "vitest";
import { HttpResponse, HttpSend } from "../../../src/providers/RemoteProvider";
import { parseFolderId, resolveDriveTarget } from "../../../src/providers/drive/DriveTarget";
import { FOLDER_MIME } from "../../helpers/fake-drive";
import { t } from "../../../src/i18n";

const FOLDER_ID = "15hqTj0tUn3tpfWeSYca0xcuNlEGDJrvW";
const DRIVE_ID = "0AInotARealSharedDrive";

const reply = (body: string, status = 200): HttpResponse => ({
  status,
  headers: {},
  arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
  text: async () => body,
});

const resolve = (http: HttpSend, input = FOLDER_ID) => resolveDriveTarget(http, async () => "tok", input);

describe("parseFolderId", () => {
  it.each([
    ["フォルダの URL", `https://drive.google.com/drive/folders/${FOLDER_ID}`],
    ["共有リンクの ?usp= 付き", `https://drive.google.com/drive/folders/${FOLDER_ID}?usp=drive_link`],
    ["複数アカウント用の /u/0/ 形式", `https://drive.google.com/drive/u/0/folders/${FOLDER_ID}`],
    ["末尾のスラッシュ付き", `https://drive.google.com/drive/folders/${FOLDER_ID}/`],
    ["フラグメント付き", `https://drive.google.com/drive/folders/${FOLDER_ID}#x`],
    ["生の ID", FOLDER_ID],
    ["前後に空白", `  ${FOLDER_ID}  `],
  ])("%s から ID を取り出す", (_label, input) => {
    expect(parseFolderId(input)).toBe(FOLDER_ID);
  });

  it("空の入力は空のまま返す", () => {
    expect(parseFolderId("   ")).toBe("");
    expect(parseFolderId("")).toBe("");
  });
});

describe("resolveDriveTarget", () => {
  /** files.get と drives.get に答える偽の Drive。 */
  const api = (file: Record<string, unknown>, driveName = "営業部"): HttpSend => async (_m, url) =>
    url.includes("/drives/") ? reply(JSON.stringify({ name: driveName })) : reply(JSON.stringify(file));

  it("共有ドライブ内のフォルダを、ドライブ名まで含めて解決する", async () => {
    const target = await resolve(
      api({ id: FOLDER_ID, name: "営業部Vault", mimeType: FOLDER_MIME, driveId: DRIVE_ID }),
      `https://drive.google.com/drive/folders/${FOLDER_ID}?usp=drive_link`
    );

    expect(target).toEqual({
      folderId: FOLDER_ID,
      folderName: "営業部Vault",
      driveId: DRIVE_ID,
      driveName: "営業部",
      path: ["…", "営業部Vault"],
    });
  });

  it("マイドライブのフォルダは driveId 無しとして区別できる", async () => {
    // driveId が欠けている = マイドライブ。表示がここで分かれる。
    const target = await resolve(api({ id: FOLDER_ID, name: "個人メモ", mimeType: FOLDER_MIME }));

    expect(target.driveId).toBe("");
    expect(target.driveName).toBe("");
    expect(target.folderName).toBe("個人メモ");
  });

  it("共有ドライブの問い合わせは supportsAllDrives 付きで行う", async () => {
    const urls: string[] = [];
    const http: HttpSend = async (m, url) => {
      urls.push(url);
      return url.includes("/drives/")
        ? reply(JSON.stringify({ name: "営業部" }))
        : reply(JSON.stringify({ id: FOLDER_ID, name: "V", mimeType: FOLDER_MIME, driveId: DRIVE_ID }));
    };
    await resolve(http);

    expect(urls[0]).toContain("supportsAllDrives=true");
  });

  it("ファイルの URL を貼ったら止める", async () => {
    // 止めないと、その「フォルダ」の子を列挙して常に空が返り、Vault 全体が
    // 削除されたように見える。
    await expect(resolve(api({ id: FOLDER_ID, name: "資料.pdf", mimeType: "application/pdf" }))).rejects.toThrow();
  });

  it("見つからないフォルダ（404）は失敗として扱う", async () => {
    await expect(resolve(async () => reply("not found", 404))).rejects.toThrow();
  });

  it("権限が無い（403）ときも失敗として扱う", async () => {
    await expect(resolve(async () => reply("forbidden", 403))).rejects.toThrow();
  });

  it("空の入力は Drive に問い合わせる前に止める", async () => {
    let called = 0;
    const http: HttpSend = async () => {
      called++;
      return reply("{}");
    };

    await expect(resolve(http, "  ")).rejects.toThrow();
    expect(called).toBe(0);
  });

  describe("Drive 内のパス", () => {
    /** ID ごとにメタデータを返す偽の Drive。載っていない ID は 404。 */
    const tree = (files: Record<string, Record<string, unknown>>, driveName = "営業部"): HttpSend => async (_m, url) => {
      if (url.includes("/drives/")) return reply(JSON.stringify({ name: driveName }));
      const id = decodeURIComponent(url.match(/\/files\/([^?]+)/)![1]);
      const file = files[id];
      return file ? reply(JSON.stringify(file)) : reply("not found", 404);
    };

    it("共有ドライブでは、ドライブ名から同期先フォルダまでを並べる", async () => {
      const target = await resolve(
        tree({
          [FOLDER_ID]: { id: FOLDER_ID, name: "Vault", mimeType: FOLDER_MIME, driveId: DRIVE_ID, parents: ["mid"] },
          mid: { id: "mid", name: "チーム", parents: [DRIVE_ID] },
        })
      );

      expect(target.path).toEqual(["営業部", "チーム", "Vault"]);
    });

    it("共有ドライブのルートそのものならドライブ名だけ", async () => {
      const target = await resolve(
        tree({ [FOLDER_ID]: { id: FOLDER_ID, name: "Drive", mimeType: FOLDER_MIME, driveId: FOLDER_ID } }),
      );

      expect(target.path).toEqual(["営業部"]);
    });

    it("マイドライブでは最上位をマイドライブとして示す", async () => {
      const target = await resolve(
        tree({
          root: { id: "rootId" },
          [FOLDER_ID]: { id: FOLDER_ID, name: "個人メモ", mimeType: FOLDER_MIME, parents: ["rootId"] },
        })
      );

      expect(target.path).toEqual([t.myDriveName, "個人メモ"]);
    });

    it("親が見えなくなったら失敗にせず、辿れたところまでを返す", async () => {
      const target = await resolve(
        tree({
          [FOLDER_ID]: { id: FOLDER_ID, name: "Vault", mimeType: FOLDER_MIME, driveId: DRIVE_ID, parents: ["hidden"] },
        })
      );

      expect(target.path).toEqual(["…", "Vault"]);
    });
  });

  it("名前が返らなくても ID で埋めて進める", async () => {
    const target = await resolve(api({ id: FOLDER_ID, mimeType: FOLDER_MIME }));
    expect(target.folderName).toBe(FOLDER_ID);
  });
});
