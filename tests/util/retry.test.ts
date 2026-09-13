/*
 * withRetry — 一時的な失敗だけを指数バックオフで再試行する HTTP のラッパ。
 *
 * 待ち時間は `window.setTimeout` 経由なので、テストではそれを差し替えて即時に
 * 進め、要求された遅延だけを記録する。実時間を待たずにバックオフを観察できる。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HttpResponse, HttpSend } from "../../src/providers/RemoteProvider";
import { withRetry } from "../../src/util/retry";

const res = (status: number): HttpResponse => ({
  status,
  headers: {},
  arrayBuffer: async () => new ArrayBuffer(0),
  text: async () => "",
});

/** 指定の順に status を返し、呼ばれた回数と引数を記録する HttpSend。 */
function sender(statuses: number[]): HttpSend & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const fn = (async (method, url, headers, body) => {
    calls.push([method, url, headers, body]);
    return res(statuses[Math.min(calls.length - 1, statuses.length - 1)]);
  }) as HttpSend & { calls: unknown[][] };
  fn.calls = calls;
  return fn;
}

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

describe("withRetry", () => {
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

  it("メソッド・URL・ヘッダ・本文をそのまま渡す（再試行後も同じ）", async () => {
    const http = sender([503, 200]);
    const body = new TextEncoder().encode("payload").buffer as ArrayBuffer;
    await withRetry(http)("PUT", "https://x/y", { Authorization: "Bearer t" }, body);

    expect(http.calls).toHaveLength(2);
    expect(http.calls[0]).toEqual(["PUT", "https://x/y", { Authorization: "Bearer t" }, body]);
    expect(http.calls[1]).toEqual(http.calls[0]);
  });
});
