import { HttpResponse, HttpSend, RequestTimeoutError } from "../providers/RemoteProvider";

const SERVER_ERRORS = new Set([500, 502, 503, 504]);
/** 403 のうち、権限ではなく流量の制限を表すもの。Drive は 429 と同じ意味でこれも返す。 */
const RATE_LIMIT_REASON = /"reason"\s*:\s*"(?:userRateLimitExceeded|rateLimitExceeded)"/;
/** 相手の指定でも、これ以上は待たない。同期全体が止まって見える。 */
const MAX_RETRY_AFTER_MS = 60_000;
/** `window.setTimeout`, not the bare global — the bare one breaks in popout windows. */
const delay = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/** 相手が処理せずに断ったことが確かな応答。作成（POST）でも送り直してよい。 */
async function refusedUnprocessed(res: HttpResponse): Promise<boolean> {
  if (res.status === 429) return true;
  return res.status === 403 && RATE_LIMIT_REASON.test(await res.text());
}

async function shouldRetry(method: string, res: HttpResponse): Promise<boolean> {
  if (await refusedUnprocessed(res)) return true;
  // 5xx は処理の途中で落ちたのかもしれない。POST は作成なので、送り直すと同じものが二つできうる。
  return method !== "POST" && SERVER_ERRORS.has(res.status);
}

function backoff(baseMs: number, attempt: number): number {
  return baseMs * 2 ** attempt + Math.floor(Math.random() * 200);
}

/** `Retry-After`（秒数か HTTP 日付）が求める待ち時間。無ければ 0。 */
function retryAfterMs(res: HttpResponse): number {
  const key = Object.keys(res.headers).find((k) => k.toLowerCase() === "retry-after");
  const value = key ? res.headers[key].trim() : "";
  if (!value) return 0;
  const ms = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS) : 0;
}

/**
 * Wrap an HttpSend with exponential backoff + jitter.
 *
 * Retries only what is safe to send again: rate limits (429, and Drive's 403
 * `rateLimitExceeded`) for any method, and 5xx or a failed connection for every
 * method except POST, which creates files and folders on Drive.
 */
export function withRetry(http: HttpSend, retries = 3, baseMs = 600): HttpSend {
  return async (method, url, headers, body) => {
    for (let attempt = 0; ; attempt++) {
      let res: HttpResponse;
      try {
        res = await http(method, url, headers, body);
      } catch (e) {
        // 時間切れは一回で上限まで待っている。繰り返すと同期が何分も止まる。
        if (attempt >= retries || method === "POST" || e instanceof RequestTimeoutError) throw e;
        await delay(backoff(baseMs, attempt));
        continue;
      }
      if (attempt >= retries || !(await shouldRetry(method, res))) return res;
      await delay(Math.max(backoff(baseMs, attempt), retryAfterMs(res)));
    }
  };
}
