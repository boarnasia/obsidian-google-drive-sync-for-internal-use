/*
 * 変更プローブ。同期ルートの中で変更があったかどうかだけを確かめる。差分の
 * 適用には使わない（ADR-0002）。
 */
import { describe, expect, it } from "vitest";
import { HttpResponse, HttpSend } from "../../../src/providers/RemoteProvider";
import { getStartToken, probeChanges } from "../../../src/providers/drive/ChangeProbe";

const DRIVE_ID = "0AInotARealSharedDrive";

const reply = (body: string, status = 200): HttpResponse => ({
  status,
  headers: {},
  arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
  text: async () => body,
});

/** 応答を固定し、URL を記録する。 */
function recorder(body: string, status = 200): { http: HttpSend; urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    http: async (m, url) => {
      urls.push(url);
      return reply(body, status);
    },
  };
}

const token = async (): Promise<string> => "tok";

describe("getStartToken", () => {
  it("起点トークンを取り出す", async () => {
    const { http } = recorder(JSON.stringify({ startPageToken: "12345" }));
    expect(await getStartToken(http, token, "")).toBe("12345");
  });

  it("共有ドライブは driveId 付きで取る（独立した変更ログを持つため）", async () => {
    const { http, urls } = recorder(JSON.stringify({ startPageToken: "1" }));
    await getStartToken(http, token, DRIVE_ID);

    expect(urls[0]).toContain("startPageToken");
    expect(urls[0]).toContain(`driveId=${DRIVE_ID}`);
    expect(urls[0]).toContain("includeItemsFromAllDrives=true");
  });

  it("マイドライブなら driveId を付けない", async () => {
    const { http, urls } = recorder(JSON.stringify({ startPageToken: "1" }));
    await getStartToken(http, token, "");

    expect(urls[0]).toContain("startPageToken");
    expect(urls[0]).not.toContain("driveId=");
  });

  it("トークンが返らなければ空（＝次回は必ず同期する側に倒れる）", async () => {
    const { http } = recorder("{}");
    expect(await getStartToken(http, token, "")).toBe("");
  });

  it("API が失敗したら例外にする（黙って空を返さない）", async () => {
    const { http } = recorder("boom", 500);
    await expect(getStartToken(http, token, "")).rejects.toThrow(/500/);
  });
});

/** 応答を順に返し、URL を記録する。ページを跨ぐ確認に使う。 */
function pages(...bodies: object[]): { http: HttpSend; urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    http: async (_m, url) => {
      urls.push(url);
      return reply(JSON.stringify(bodies[urls.length - 1] ?? {}));
    },
  };
}

const ROOT = "root-folder";
/** 直前の走査で分かった、同期ルートの中の ID。 */
const INSIDE = new Set([ROOT, "sub-folder", "a-file"]);
const probe = (http: HttpSend, saved = "tok-1", inside: ReadonlySet<string> | null = INSIDE, driveId = "") =>
  probeChanges(http, token, driveId, saved, inside);

describe("probeChanges — 判断できないときは同期する側に倒す", () => {
  it("保存したトークンが無ければ問い合わせずに「変更あり」", async () => {
    const { http, urls } = pages({ changes: [], newStartPageToken: "t" });
    expect(await probe(http, "")).toEqual({ changed: true });
    expect(urls).toEqual([]);
  });

  it("ルートの中の ID が分からなければ（起動直後）問い合わせずに「変更あり」", async () => {
    const { http, urls } = pages({ changes: [], newStartPageToken: "t" });
    expect(await probe(http, "tok-1", null)).toEqual({ changed: true });
    expect(urls).toEqual([]);
  });

  it.each([400, 404, 410])("トークンが使えない（%i）なら例外にせず「変更あり」", async (status) => {
    const { http } = recorder("invalid page token", status);
    expect(await probe(http)).toEqual({ changed: true });
  });

  it("応答に次の起点が無ければ「変更あり」", async () => {
    const { http } = recorder("{}");
    expect(await probe(http)).toEqual({ changed: true });
  });

  it("親が読めない変更は、中か外か分からないので「変更あり」", async () => {
    const { http } = pages({ changes: [{ fileId: "unknown" }], newStartPageToken: "t" });
    expect((await probe(http)).changed).toBe(true);
  });
});

describe("probeChanges — 同期ルートの中の変更だけを数える", () => {
  it("変更が無ければ、次の起点を返す", async () => {
    const { http } = pages({ changes: [], newStartPageToken: "tok-2" });
    expect(await probe(http)).toEqual({ changed: false, nextToken: "tok-2" });
  });

  it("ルートの外の変更だけなら「変更なし」で、起点はその先へ進む", async () => {
    const { http } = pages({
      changes: [
        { fileId: "other", file: { parents: ["elsewhere"] } },
        { fileId: "gone-elsewhere", removed: true },
        { changeType: "drive" }, // 共有ドライブ自体の設定変更
      ],
      newStartPageToken: "tok-2",
    });
    expect(await probe(http)).toEqual({ changed: false, nextToken: "tok-2" });
  });

  it.each([
    ["ルート直下での新規作成", { fileId: "new", file: { parents: [ROOT] } }],
    ["サブフォルダでの新規作成", { fileId: "new", file: { parents: ["sub-folder"] } }],
    ["中のファイルの更新", { fileId: "a-file", file: { parents: ["sub-folder"] } }],
    ["中から外への移動", { fileId: "a-file", file: { parents: ["elsewhere"] } }],
    ["外から中への移動", { fileId: "moved-in", file: { parents: ["sub-folder"] } }],
    ["中のファイルの完全削除", { fileId: "a-file", removed: true }],
  ])("%s は「変更あり」", async (_label, change) => {
    const { http } = pages({ changes: [change], newStartPageToken: "tok-2" });
    expect((await probe(http)).changed).toBe(true);
  });

  it("ページを跨いで最後まで読む。起点は最後のページのもの", async () => {
    const { http, urls } = pages(
      { changes: [{ fileId: "x", file: { parents: ["elsewhere"] } }], nextPageToken: "p2" },
      { changes: [{ fileId: "y", file: { parents: ["elsewhere"] } }], newStartPageToken: "tok-9" }
    );
    expect(await probe(http)).toEqual({ changed: false, nextToken: "tok-9" });
    expect(urls[1]).toContain("pageToken=p2");
  });

  it("中の変更が見つかった時点で読むのをやめる", async () => {
    const { http, urls } = pages(
      { changes: [{ fileId: "a-file", file: { parents: [ROOT] } }], nextPageToken: "p2" },
      { changes: [], newStartPageToken: "tok-9" }
    );
    expect((await probe(http)).changed).toBe(true);
    expect(urls).toHaveLength(1);
  });

  it("親まで要求し、1 ページに多く載せる", async () => {
    const { http, urls } = pages({ changes: [], newStartPageToken: "t" });
    await probe(http);

    expect(urls[0]).toContain("pageToken=tok-1");
    expect(urls[0]).toContain("pageSize=1000");
    expect(decodeURIComponent(urls[0])).toContain("file(parents)");
    expect(decodeURIComponent(urls[0])).toContain("newStartPageToken");
  });

  it("共有ドライブの変更も取りこぼさない", async () => {
    const { http, urls } = pages({ changes: [], newStartPageToken: "t" });
    await probe(http, "tok-1", INSIDE, DRIVE_ID);

    expect(urls[0]).toContain(`driveId=${DRIVE_ID}`);
    expect(urls[0]).toContain("includeItemsFromAllDrives=true");
  });

  it.each([401, 403, 503])("それ以外の失敗（%i）は例外にする", async (status) => {
    const { http } = recorder("boom", status);
    await expect(probe(http)).rejects.toThrow(new RegExp(String(status)));
  });
});
