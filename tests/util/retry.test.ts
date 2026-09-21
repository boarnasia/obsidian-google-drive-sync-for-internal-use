/*
 * withRetry — 送り直しても安全な失敗だけを指数バックオフで再試行する HTTP のラッパ。
 *
 * 待ち時間は `window.setTimeout` 経由なので、テストではそれを差し替えて即時に
 * 進め、要求された遅延だけを記録する。実時間を待たずにバックオフを観察できる。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HttpResponse, HttpSend, RequestTimeoutError } from "../../src/providers/RemoteProvider";
import { withRetry } from "../../src/util/retry";

/** 応答の中身。数だけなら status、本文やヘッダが要るならオブジェクト、通信の失敗なら Error。 */
type Step = number | { status: number; body?: string; headers?: Record<string, string> } | Error;

const res = (step: Exclude<Step, Error>): HttpResponse => {
  const s = typeof step === "number" ? { status: step } : step;
  return {
    status: s.status,
    headers: s.headers ?? {},
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => s.body ?? "",
  };
};

/** 指定の順に応答し（最後の一つは繰り返す）、呼ばれた回数と引数を記録する HttpSend。 */
function sender(steps: Step[]): HttpSend & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const fn = (async (method, url, headers, body) => {
    calls.push([method, url, headers, body]);
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return res(step);
  }) as HttpSend & { calls: unknown[][] };
  fn.calls = calls;
  return fn;
}

/** Drive がレート制限で返す 403 の本文。 */
const rateLimited403 = (reason: string) => ({
  status: 403,
  body: JSON.stringify({ error: { errors: [{ domain: "usageLimits", reason }], code: 403 } }),
});

let delays: number[] = [];
let realSetTimeout: typeof window.setTimeout;

beforeEach(() => {
  delays = [];
  realSetTimeout = window.setTimeout;
  // 待たずに次へ進める。遅延は記録だけする。
  (window as { setTimeout: unknown }).setTimeout = (fn: () => void, ms?: number) => {
    delays.push(ms ?? 0);
    return realSetTimeout(fn, 0);
  };
});

afterEach(() => {
  (window as { setTimeout: unknown }).setTimeout = realSetTimeout;
});

describe("withRetry — 応答のステータス", () => {
  it("成功したら再試行しない", async () => {
    const http = sender([200]);
    expect((await withRetry(http)("GET", "https://x/y", {})).status).toBe(200);
    expect(http.calls).toHaveLength(1);
    expect(delays).toHaveLength(0);
  });

  it.each([429, 500, 502, 503, 504])("一時的な %i は再試行する", async (status) => {
    const http = sender([status, 200]);
    expect((await withRetry(http)("GET", "https://x/y", {})).status).toBe(200);
    expect(http.calls).toHaveLength(2);
  });

  it.each([400, 401, 403, 404, 409, 412])("恒久的な %i は再試行しない", async (status) => {
    const http = sender([status]);
    expect((await withRetry(http)("GET", "https://x/y", {})).status).toBe(status);
    expect(http.calls).toHaveLength(1);
  });

  it.each(["userRateLimitExceeded", "rateLimitExceeded"])("レート制限の 403（%s）は再試行する", async (reason) => {
    const http = sender([rateLimited403(reason), 200]);
    expect((await withRetry(http)("GET", "https://x/y", {})).status).toBe(200);
    expect(http.calls).toHaveLength(2);
  });

  it("権限が無い 403 は再試行しない", async () => {
    const http = sender([rateLimited403("insufficientFilePermissions")]);
    expect((await withRetry(http)("GET", "https://x/y", {})).status).toBe(403);
    expect(http.calls).toHaveLength(1);
  });

  it("回数を使い切ったら最後の応答をそのまま返す（例外にしない）", async () => {
    const http = sender([503]);
    // 呼び出し側（プロバイダ）が status を見て判断できるよう、諦め方は静かである。
    expect((await withRetry(http, 3)("PUT", "https://x/y", {})).status).toBe(503);
    expect(http.calls).toHaveLength(4); // 初回 + 3 回の再試行
  });

  it("再試行の回数は指定できる", async () => {
    const http = sender([500]);
    await withRetry(http, 1)("GET", "https://x/y", {});
    expect(http.calls).toHaveLength(2);
  });
});

/*
 * POST は Drive ではファイルやフォルダの作成である。5xx はサーバーが作り終えてから
 * 落ちたのかもしれず、送り直すと同じ名前のものが二つできうる。
 */
describe("withRetry — 作成（POST）", () => {
  it.each([500, 502, 503, 504])("POST の %i は再試行しない", async (status) => {
    const http = sender([status, 200]);
    expect((await withRetry(http)("POST", "https://x/files", {})).status).toBe(status);
    expect(http.calls).toHaveLength(1);
  });

  it("POST でも 429 は再試行する（処理せずに断られている）", async () => {
    const http = sender([429, 200]);
    expect((await withRetry(http)("POST", "https://x/files", {})).status).toBe(200);
    expect(http.calls).toHaveLength(2);
  });

  it("POST でもレート制限の 403 は再試行する", async () => {
    const http = sender([rateLimited403("userRateLimitExceeded"), 200]);
    expect((await withRetry(http)("POST", "https://x/files", {})).status).toBe(200);
  });

  it("POST の通信の失敗は再試行しない（届いていたかもしれない）", async () => {
    const http = sender([new Error("net::ERR_CONNECTION_RESET"), 200]);
    await expect(withRetry(http)("POST", "https://x/files", {})).rejects.toThrow(/CONNECTION_RESET/);
    expect(http.calls).toHaveLength(1);
  });
});

describe("withRetry — 通信の失敗", () => {
  it("接続が切れたら再試行する", async () => {
    const http = sender([new Error("net::ERR_INTERNET_DISCONNECTED"), 200]);
    expect((await withRetry(http)("GET", "https://x/y", {})).status).toBe(200);
    expect(http.calls).toHaveLength(2);
  });

  it("回数を使い切ったら最後の例外を投げる", async () => {
    const http = sender([new Error("net::ERR_INTERNET_DISCONNECTED")]);
    await expect(withRetry(http, 2)("GET", "https://x/y", {})).rejects.toThrow(/DISCONNECTED/);
    expect(http.calls).toHaveLength(3);
  });

  it("時間切れは再試行しない（一回で上限まで待っている）", async () => {
    const http = sender([new RequestTimeoutError("GET x timed out"), 200]);
    await expect(withRetry(http)("GET", "https://x/y", {})).rejects.toBeInstanceOf(RequestTimeoutError);
    expect(http.calls).toHaveLength(1);
  });
});

describe("withRetry — 待ち時間", () => {
  it("待ち時間が指数的に伸びる", async () => {
    const http = sender([503]);
    await withRetry(http, 3, 600)("GET", "https://x/y", {});

    expect(delays).toHaveLength(3);
    // 600 * 2^n にジッタ（0〜199ms）が乗る。重なりを避けるために増えていくこと。
    expect(delays[0]).toBeGreaterThanOrEqual(600);
    expect(delays[0]).toBeLessThan(800);
    expect(delays[1]).toBeGreaterThanOrEqual(1200);
    expect(delays[1]).toBeLessThan(1400);
    expect(delays[2]).toBeGreaterThanOrEqual(2400);
    expect(delays[2]).toBeLessThan(2600);
  });

  it("Retry-After（秒）が長ければそれに従う", async () => {
    const http = sender([{ status: 429, headers: { "retry-after": "5" } }, 200]);
    await withRetry(http)("GET", "https://x/y", {});
    expect(delays).toEqual([5000]);
  });

  it("Retry-After（HTTP 日付）にも従う", async () => {
    const at = new Date(Date.now() + 10_000).toUTCString();
    const http = sender([{ status: 503, headers: { "Retry-After": at } }, 200]);
    await withRetry(http)("GET", "https://x/y", {});
    // 日付は秒単位なので、今からの差は 9〜10 秒になる。
    expect(delays[0]).toBeGreaterThan(8000);
    expect(delays[0]).toBeLessThanOrEqual(10_000);
  });

  it("Retry-After が短ければ、計算した待ち時間を使う", async () => {
    const http = sender([{ status: 429, headers: { "retry-after": "0" } }, 200]);
    await withRetry(http, 3, 600)("GET", "https://x/y", {});
    expect(delays[0]).toBeGreaterThanOrEqual(600);
  });

  it("Retry-After が長すぎても 60 秒で打ち切る", async () => {
    const http = sender([{ status: 429, headers: { "retry-after": "3600" } }, 200]);
    await withRetry(http)("GET", "https://x/y", {});
    expect(delays).toEqual([60_000]);
  });

  it("読めない Retry-After は無視する", async () => {
    const http = sender([{ status: 429, headers: { "retry-after": "そのうち" } }, 200]);
    await withRetry(http, 3, 600)("GET", "https://x/y", {});
    expect(delays[0]).toBeLessThan(800);
  });
});

describe("withRetry — 送る内容", () => {
  it("メソッド・URL・ヘッダ・本文をそのまま渡す（再試行後も同じ）", async () => {
    const http = sender([503, 200]);
    const body = new TextEncoder().encode("payload").buffer as ArrayBuffer;
    await withRetry(http)("PUT", "https://x/y", { Authorization: "Bearer t" }, body);

    expect(http.calls).toHaveLength(2);
    expect(http.calls[0]).toEqual(["PUT", "https://x/y", { Authorization: "Bearer t" }, body]);
    expect(http.calls[1]).toEqual(http.calls[0]);
  });
});
