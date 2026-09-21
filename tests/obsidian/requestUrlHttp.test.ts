/*
 * Obsidian の `requestUrl` を HttpSend に合わせる層。
 *
 * 肝は時間制限である。`requestUrl` には制限が無く、開いたまま応答しない接続
 * （死んだ回線、キャプティブポータル、止まったエンドポイント）は待ち続ける。
 * 同期が終わらなければ「同期中」の錠も外れず、Obsidian を再読み込みするまで
 * 誰も同期できなくなる。
 */
import { requestUrl } from "obsidian";
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REQUEST_TIMEOUT_MS, requestUrlHttp } from "../../src/obsidian/requestUrlHttp";
import { RequestTimeoutError } from "../../src/providers/RemoteProvider";

vi.mock("obsidian", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../tests/helpers/obsidian-mock")>()),
  requestUrl: vi.fn(),
}));

const mocked = requestUrl as unknown as Mock;

/** 予定された時間制限を握り、テストが好きなときに発火させる。 */
let fire: (() => void) | null;
let scheduledMs: number | null;
let cleared: number;
/** 時間切れの文面に出る秒数。上限を変えてもテストを書き換えずに済むよう、定数から出す。 */
const SECONDS = `${Math.round(REQUEST_TIMEOUT_MS / 1000)}s`;
let realSetTimeout: typeof window.setTimeout;
let realClearTimeout: typeof window.clearTimeout;

beforeEach(() => {
  mocked.mockReset();
  fire = null;
  scheduledMs = null;
  cleared = 0;
  realSetTimeout = window.setTimeout;
  realClearTimeout = window.clearTimeout;
  (window as { setTimeout: unknown }).setTimeout = (fn: () => void, ms: number) => {
    fire = fn;
    scheduledMs = ms;
    return 1;
  };
  (window as { clearTimeout: unknown }).clearTimeout = () => {
    cleared++;
  };
});

afterEach(() => {
  (window as { setTimeout: unknown }).setTimeout = realSetTimeout;
  (window as { clearTimeout: unknown }).clearTimeout = realClearTimeout;
});

describe("requestUrlHttp", () => {
  it("Obsidian に非 2xx でも例外を投げないよう頼む（status は呼び出し側が読む）", async () => {
    mocked.mockResolvedValue({ status: 404, headers: {}, arrayBuffer: new ArrayBuffer(0), text: "" });
    const body = new TextEncoder().encode("x").buffer as ArrayBuffer;

    const res = await requestUrlHttp("PUT", "https://example.test/a", { authorization: "Bearer t" }, body);

    expect(mocked).toHaveBeenCalledWith({
      url: "https://example.test/a",
      method: "PUT",
      headers: { authorization: "Bearer t" },
      body,
      throw: false,
    });
    expect(res.status).toBe(404);
  });

  it("ヘッダのキーを小文字に揃える（呼び出し側が名前で引ける）", async () => {
    mocked.mockResolvedValue({
      status: 200,
      headers: { "Content-Type": "application/json", ETag: "v1" },
      arrayBuffer: new ArrayBuffer(0),
      text: "",
    });

    const res = await requestUrlHttp("GET", "https://example.test/a", {});
    expect(res.headers).toEqual({ "content-type": "application/json", etag: "v1" });
  });

  it("ヘッダが無くても落ちない", async () => {
    mocked.mockResolvedValue({ status: 200, arrayBuffer: new ArrayBuffer(0), text: "" });
    expect((await requestUrlHttp("GET", "https://example.test/a", {})).headers).toEqual({});
  });

  it("本文は byte と文字列の両方で取り出せる", async () => {
    const bytes = new TextEncoder().encode("本文").buffer as ArrayBuffer;
    mocked.mockResolvedValue({ status: 200, headers: {}, arrayBuffer: bytes, text: "本文" });

    const res = await requestUrlHttp("GET", "https://example.test/a", {});
    expect(await res.arrayBuffer()).toBe(bytes);
    expect(await res.text()).toBe("本文");
  });

  it("応答しない接続は時間切れで失敗する（同期は必ず決着する）", async () => {
    mocked.mockReturnValue(new Promise(() => undefined)); // 永遠に応答しない
    const p = requestUrlHttp("GET", "https://drive.googleapis.com/a?token=secret", {});

    (fire as () => void)();

    expect(scheduledMs).toBe(REQUEST_TIMEOUT_MS);
    await expect(p).rejects.toThrow(`timed out after ${SECONDS}`);
    // 再試行のラッパは、これを見て送り直さない。
    await expect(p).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it("時間切れの文面にホストだけを出す（クエリを漏らさない）", async () => {
    mocked.mockReturnValue(new Promise(() => undefined));
    const p = requestUrlHttp("GET", "https://drive.googleapis.com/a?token=secret", {});

    (fire as () => void)();

    await expect(p).rejects.toThrow(/drive\.googleapis\.com/);
    await expect(p).rejects.not.toThrow(/secret/);
  });

  it("URL として読めない入力でも文面を作れる", async () => {
    mocked.mockReturnValue(new Promise(() => undefined));
    const p = requestUrlHttp("GET", "not a url", {});

    (fire as () => void)();

    await expect(p).rejects.toThrow(/request timed out/);
  });

  it("成功したらタイマーを片付ける（残ると後から誤って発火する）", async () => {
    mocked.mockResolvedValue({ status: 200, headers: {}, arrayBuffer: new ArrayBuffer(0), text: "" });
    await requestUrlHttp("GET", "https://example.test/a", {});

    expect(cleared).toBe(1);
  });

  it("時間切れのときもタイマーを片付ける", async () => {
    mocked.mockReturnValue(new Promise(() => undefined));
    const p = requestUrlHttp("GET", "https://example.test/a", {});

    (fire as () => void)();
    await expect(p).rejects.toThrow();

    expect(cleared).toBe(1);
  });

  it("通信そのものが失敗したときもタイマーを片付ける", async () => {
    mocked.mockRejectedValue(new Error("net::ERR_INTERNET_DISCONNECTED"));

    await expect(requestUrlHttp("GET", "https://example.test/a", {})).rejects.toThrow(/ERR_INTERNET_DISCONNECTED/);

    expect(cleared).toBe(1);
  });
});
