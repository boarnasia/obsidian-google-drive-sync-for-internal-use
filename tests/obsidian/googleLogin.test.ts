/*
 * 127.0.0.1 ループバックによるインストール済みアプリの OAuth（PKCE、第三者の
 * サーバーを介さない）。Node の `http` と Electron の `shell` は Obsidian の
 * renderer の `require` から来るので、ここではそれを差し替えて流れだけを動かす。
 *
 * モバイルで動かないのはこの経路が原因である（ループバックが開けない）。
 */
import { requestUrl } from "obsidian";
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { googleLoginLoopback } from "../../src/obsidian/googleLogin";
import { codeChallengeS256 } from "../../src/providers/google/pkce";

vi.mock("obsidian", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../tests/helpers/obsidian-mock")>()),
  requestUrl: vi.fn(),
}));

const PORT = 54321;
const OPTS = { clientId: "cid", scope: "https://www.googleapis.com/auth/drive", label: "Google Drive" };

interface Res {
  writeHead: Mock;
  end: Mock;
}

/** 偽の Node http サーバー。ハンドラを握り、開閉を記録する。 */
function fakeHttp() {
  const state = {
    handler: null as ((req: { url?: string }, res: Res) => void) | null,
    onError: null as ((e: Error) => void) | null,
    listening: false,
    closed: 0,
  };
  const server = {
    listen(_port: number, _host: string, cb: () => void) {
      state.listening = true;
      cb();
    },
    close() {
      state.closed++;
    },
    address: () => (state.listening ? { port: PORT } : null),
    on(_e: "error", l: (err: Error) => void) {
      state.onError = l;
    },
  };
  return {
    state,
    module: {
      createServer(handler: (req: { url?: string }, res: Res) => void) {
        state.handler = handler;
        return server;
      },
    },
  };
}

const res = (): Res => ({ writeHead: vi.fn(), end: vi.fn() });

let opened: string[];
let http: ReturnType<typeof fakeHttp>;
let fireTimeout: (() => void) | null;
let realSetTimeout: typeof window.setTimeout;
let realRequire: unknown;
let realOpen: typeof window.open;

beforeEach(() => {
  opened = [];
  http = fakeHttp();
  fireTimeout = null;

  (requestUrl as unknown as Mock).mockReset();
  (requestUrl as unknown as Mock).mockResolvedValue({
    status: 200,
    headers: {},
    arrayBuffer: new ArrayBuffer(0),
    text: JSON.stringify({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600 }),
  });

  const w = window as unknown as { require?: unknown; open: unknown; setTimeout: unknown };
  realRequire = w.require;
  realOpen = window.open;
  realSetTimeout = window.setTimeout;

  w.require = (mod: string) => {
    if (mod === "http") return http.module;
    throw new Error("no such module: " + mod); // electron 不在 → window.open へ落ちる
  };
  w.open = (url: string) => {
    opened.push(url);
    return null;
  };
  w.setTimeout = (fn: () => void) => {
    fireTimeout = fn;
    return 1;
  };
});

afterEach(() => {
  const w = window as unknown as { require?: unknown; open: unknown; setTimeout: unknown };
  w.require = realRequire;
  w.open = realOpen;
  w.setTimeout = realSetTimeout;
});

/** 認可 URL に載った state。本物の戻りはこれを持って返ってくる。 */
let authState = "";

/** ブラウザを開くところまで進める（チャレンジの計算は Web Crypto の非同期処理）。 */
async function untilBrowserOpens(): Promise<URL> {
  for (let i = 0; i < 50 && opened.length === 0; i++) {
    await new Promise((r) => realSetTimeout(r, 0));
  }
  const url = new URL(opened[0]);
  authState = url.searchParams.get("state") ?? "";
  return url;
}

/** 認可サーバーからの戻りを模す。state を書いていなければ本物のものを足す。 */
function redirect(query: string, r: Res = res()): Res {
  const url = query.includes("state=") ? query : `${query}&state=${encodeURIComponent(authState)}`;
  (http.state.handler as (req: { url?: string }, x: Res) => void)({ url }, r);
  return r;
}

describe("ブラウザを開くところまで", () => {
  it("戻り先は実際に開いた 127.0.0.1 のポート", async () => {
    const p = googleLoginLoopback(OPTS);
    const url = await untilBrowserOpens();

    expect(url.searchParams.get("redirect_uri")).toBe(`http://127.0.0.1:${PORT}`);

    redirect("/?code=abc");
    await p;
  });

  it("送るチャレンジは、後で送る verifier の SHA-256 である", async () => {
    const p = googleLoginLoopback(OPTS);
    const url = await untilBrowserOpens();

    redirect("/?code=abc");
    await p;

    const form = new URLSearchParams(
      new TextDecoder().decode((requestUrl as unknown as Mock).mock.calls[0][0].body as ArrayBuffer)
    );
    const verifier = form.get("code_verifier") as string;
    expect(await codeChallengeS256(verifier)).toBe(url.searchParams.get("code_challenge"));
  });

  it("要求したスコープを載せる", async () => {
    const p = googleLoginLoopback(OPTS);
    const url = await untilBrowserOpens();

    expect(url.searchParams.get("scope")).toBe(OPTS.scope);

    redirect("/?code=abc");
    await p;
  });
});

describe("戻ってきたとき", () => {
  it("コードをトークンに交換して返す", async () => {
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    redirect("/?code=abc");

    await expect(p).resolves.toMatchObject({ accessToken: "at-1", refreshToken: "rt-1" });
  });

  it("交換に使う戻り先は認可のときと同じ（Google が一致を求める）", async () => {
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    redirect("/?code=abc");
    await p;

    const form = new URLSearchParams(
      new TextDecoder().decode((requestUrl as unknown as Mock).mock.calls[0][0].body as ArrayBuffer)
    );
    expect(form.get("redirect_uri")).toBe(`http://127.0.0.1:${PORT}`);
    expect(form.get("code")).toBe("abc");
  });

  it("使い捨てのサーバーを必ず閉じる", async () => {
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    redirect("/?code=abc");
    await p;

    expect(http.state.closed).toBe(1);
  });

  it("利用者が拒否したら失敗として返す", async () => {
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    redirect("/?error=access_denied");

    await expect(p).rejects.toThrow(/access_denied/);
    expect(http.state.closed).toBe(1);
  });

  it("交換に失敗したら失敗として返す", async () => {
    (requestUrl as unknown as Mock).mockResolvedValue({
      status: 400,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "invalid_grant",
    });
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    redirect("/?code=abc");

    await expect(p).rejects.toThrow(/400/);
  });

  it("関係のないリクエスト（favicon など）は 204 で流し、サーバーを閉じない", async () => {
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    const r = res();
    (http.state.handler as (req: { url?: string }, x: Res) => void)({ url: "/favicon.ico" }, r);

    expect(r.writeHead).toHaveBeenCalledWith(204);
    expect(http.state.closed).toBe(0);

    redirect("/?code=abc"); // 本命は後から来る
    await p;
  });

  /*
   * ループバックのポートは同じ端末のどのプロセスからも、踏まされたページからも
   * 叩ける。state が合わない戻りを受け入れると、攻撃者のアカウントの認可コードを
   * 押し込まれ、利用者の Vault が攻撃者の Drive に繋がる（RFC 6749 §10.12）。
   */
  it("state が合わない戻りは受け付けず、サーバーも閉じない", async () => {
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    const r = redirect("/?code=attacker&state=wrong");

    expect(r.writeHead).toHaveBeenCalledWith(400);
    expect(http.state.closed).toBe(0);
    expect(requestUrl as unknown as Mock).not.toHaveBeenCalled();

    redirect("/?code=abc"); // 本物は後から届く
    await expect(p).resolves.toMatchObject({ accessToken: "at-1" });
  });

  it("state の無い戻りも受け付けない", async () => {
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    const r = redirect("/?code=abc&state=");

    expect(r.writeHead).toHaveBeenCalledWith(400);
    expect(http.state.closed).toBe(0);

    redirect("/?code=abc");
    await p;
  });

  it("毎回違う state を使う（前回の戻りを使い回せない）", async () => {
    const first = googleLoginLoopback(OPTS);
    const a = (await untilBrowserOpens()).searchParams.get("state");
    redirect("/?code=abc");
    await first;

    opened = [];
    const second = googleLoginLoopback(OPTS);
    const b = (await untilBrowserOpens()).searchParams.get("state");
    redirect("/?code=abc");
    await second;

    expect(a).toBeTruthy();
    expect(b).not.toBe(a);
  });
});

describe("うまくいかないとき", () => {
  it("ポートが開けなければ失敗として返す", async () => {
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    (http.state.onError as (e: Error) => void)(new Error("EADDRINUSE"));

    await expect(p).rejects.toThrow(/EADDRINUSE/);
  });

  it("同意が返ってこなければ時間切れにする", async () => {
    const p = googleLoginLoopback(OPTS);
    await untilBrowserOpens();

    (fireTimeout as () => void)();

    await expect(p).rejects.toThrow(/timed out/);
    expect(http.state.closed).toBe(1);
  });

  it("Node の require が無ければ、その場で断る（モバイル）", () => {
    (window as unknown as { require?: unknown }).require = undefined;
    expect(() => googleLoginLoopback(OPTS)).toThrow(/desktop-only/);
  });
});
