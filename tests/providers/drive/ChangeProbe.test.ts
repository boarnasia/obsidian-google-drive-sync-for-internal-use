/*
 * 変更プローブ。同期ルートを含むドライブに変更があったかどうかだけを一度の
 * 問い合わせで確かめる。差分の適用には使わない（ADR-0002）。
 */
import { describe, expect, it } from "vitest";
import { HttpResponse, HttpSend } from "../../../src/providers/RemoteProvider";
import { getStartToken, hasChanges } from "../../../src/providers/drive/ChangeProbe";

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

describe("hasChanges", () => {
  it("保存したトークンが無ければ問い合わせずに「変更あり」とみなす", async () => {
    let called = 0;
    const http: HttpSend = async () => {
      called++;
      return reply(JSON.stringify({ changes: [] }));
    };

    expect(await hasChanges(http, token, "", "")).toBe(true);
    expect(called).toBe(0);
  });

  it("変更が無ければ false", async () => {
    const { http } = recorder(JSON.stringify({ changes: [] }));
    expect(await hasChanges(http, token, "", "tok-1")).toBe(false);
  });

  it("変更があれば true", async () => {
    const { http } = recorder(JSON.stringify({ changes: [{ fileId: "x" }] }));
    expect(await hasChanges(http, token, "", "tok-1")).toBe(true);
  });

  it("changes が欠けていても落ちない", async () => {
    const { http } = recorder("{}");
    expect(await hasChanges(http, token, "", "tok-1")).toBe(false);
  });

  it("1 件だけ要求する（知りたいのは有無だけ）", async () => {
    const { http, urls } = recorder(JSON.stringify({ changes: [] }));
    await hasChanges(http, token, DRIVE_ID, "tok-1");

    expect(urls[0]).toContain("pageSize=1");
    expect(urls[0]).toContain("pageToken=tok-1");
  });

  it("共有ドライブの変更も取りこぼさない", async () => {
    const { http, urls } = recorder(JSON.stringify({ changes: [] }));
    await hasChanges(http, token, DRIVE_ID, "tok-1");

    expect(urls[0]).toContain(`driveId=${DRIVE_ID}`);
    expect(urls[0]).toContain("includeItemsFromAllDrives=true");
  });

  it("API が失敗したら例外にする", async () => {
    const { http } = recorder("boom", 503);
    await expect(hasChanges(http, token, "", "tok-1")).rejects.toThrow(/503/);
  });
});
