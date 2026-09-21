/*
 * Google OAuth 2.0（インストール済みアプリ / PKCE）。
 *
 * このプラグインは OAuth クライアントを同梱しない——同梱するとリリースされた
 * main.js に生きたシークレットが埋まり、ビルドの再現性も失われる。利用者が自分の
 * クライアントを設定画面に入れる前提なので、シークレットは「あれば送る」である。
 */
import { describe, expect, it } from "vitest";
import { HttpResponse, HttpSend } from "../../../src/providers/RemoteProvider";
import { buildAuthUrl, exchangeCode, refreshAccessToken } from "../../../src/providers/google/oauth";

const NOW = 1_700_000_000_000;

const reply = (body: string, status = 200): HttpResponse => ({
  status,
  headers: {},
  arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
  text: async () => body,
});

/** 応答を固定し、送ったフォームを読める形で記録する。 */
function recorder(body: string, status = 200) {
  const sent: { url: string; headers: Record<string, string>; form: URLSearchParams }[] = [];
  const http: HttpSend = async (_m, url, headers, b) => {
    sent.push({ url, headers, form: new URLSearchParams(new TextDecoder().decode(b as ArrayBuffer)) });
    return reply(body, status);
  };
  return { http, sent };
}

const TOKENS = JSON.stringify({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600 });

describe("buildAuthUrl", () => {
  const url = (): URL =>
    new URL(
      buildAuthUrl({
        clientId: "cid",
        redirectUri: "http://127.0.0.1:1234/",
        scope: "https://www.googleapis.com/auth/drive",
        codeChallenge: "chal",
        state: "st-1",
      })
    );

  it("Google の認可エンドポイントを指す", () => {
    expect(url().origin + url().pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  });

  it("PKCE の S256 チャレンジを載せる", () => {
    expect(url().searchParams.get("code_challenge")).toBe("chal");
    expect(url().searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("リフレッシュトークンが返るよう offline + consent を頼む", () => {
    // これが無いと refresh_token が返らず、起動のたびにブラウザが開くことになる。
    expect(url().searchParams.get("access_type")).toBe("offline");
    expect(url().searchParams.get("prompt")).toBe("consent");
  });

  it("要求するスコープと戻り先をそのまま載せる", () => {
    expect(url().searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive");
    expect(url().searchParams.get("redirect_uri")).toBe("http://127.0.0.1:1234/");
    expect(url().searchParams.get("response_type")).toBe("code");
  });

  it("クライアントシークレットは認可 URL に載せない", () => {
    expect(url().searchParams.has("client_secret")).toBe(false);
  });

  it("state を載せる（戻りが本物かを突き合わせる手がかり）", () => {
    expect(url().searchParams.get("state")).toBe("st-1");
  });
});

describe("exchangeCode", () => {
  it("認可コードと verifier を form-urlencoded で送る", async () => {
    const { http, sent } = recorder(TOKENS);
    await exchangeCode(
      http,
      { clientId: "cid", code: "code-1", codeVerifier: "ver-1", redirectUri: "http://127.0.0.1:1234/" },
      NOW
    );

    expect(sent[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(sent[0].headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(sent[0].form.get("grant_type")).toBe("authorization_code");
    expect(sent[0].form.get("code")).toBe("code-1");
    expect(sent[0].form.get("code_verifier")).toBe("ver-1");
  });

  it("シークレットが無ければ client_secret を送らない", async () => {
    const { http, sent } = recorder(TOKENS);
    await exchangeCode(http, { clientId: "cid", code: "c", codeVerifier: "v", redirectUri: "r" }, NOW);

    expect(sent[0].form.has("client_secret")).toBe(false);
  });

  it("シークレットがあれば送る（Google の Desktop クライアントが要求する）", async () => {
    const { http, sent } = recorder(TOKENS);
    await exchangeCode(
      http,
      { clientId: "cid", clientSecret: "sec", code: "c", codeVerifier: "v", redirectUri: "r" },
      NOW
    );

    expect(sent[0].form.get("client_secret")).toBe("sec");
  });

  it("期限を epoch ms に直して返す", async () => {
    const { http } = recorder(TOKENS);
    const tokens = await exchangeCode(http, { clientId: "cid", code: "c", codeVerifier: "v", redirectUri: "r" }, NOW);

    expect(tokens.accessToken).toBe("at-1");
    expect(tokens.refreshToken).toBe("rt-1");
    expect(tokens.expiresAt).toBe(NOW + 3600 * 1000);
  });

  it("expires_in が無ければ 1 時間とみなす", async () => {
    const { http } = recorder(JSON.stringify({ access_token: "at" }));
    const tokens = await exchangeCode(http, { clientId: "cid", code: "c", codeVerifier: "v", redirectUri: "r" }, NOW);

    expect(tokens.expiresAt).toBe(NOW + 3600 * 1000);
  });

  it("失敗は例外にする", async () => {
    const { http } = recorder("invalid_grant", 400);
    await expect(
      exchangeCode(http, { clientId: "cid", code: "c", codeVerifier: "v", redirectUri: "r" }, NOW)
    ).rejects.toThrow(/400/);
  });
});

describe("refreshAccessToken", () => {
  it("refresh_token グラントで送る", async () => {
    const { http, sent } = recorder(JSON.stringify({ access_token: "at-2", expires_in: 3599 }));
    await refreshAccessToken(http, { clientId: "cid", refreshToken: "rt-1" }, NOW);

    expect(sent[0].form.get("grant_type")).toBe("refresh_token");
    expect(sent[0].form.get("refresh_token")).toBe("rt-1");
  });

  it("Google が返さないリフレッシュトークンは手元のものを保つ", async () => {
    // ここを取り違えると、更新のたびに接続が切れて再ログインを迫ることになる。
    const { http } = recorder(JSON.stringify({ access_token: "at-2", expires_in: 3599 }));
    const tokens = await refreshAccessToken(http, { clientId: "cid", refreshToken: "rt-1" }, NOW);

    expect(tokens.refreshToken).toBe("rt-1");
    expect(tokens.accessToken).toBe("at-2");
  });

  it("新しいリフレッシュトークンが返ればそちらを使う", async () => {
    const { http } = recorder(JSON.stringify({ access_token: "at-2", refresh_token: "rt-2" }));
    const tokens = await refreshAccessToken(http, { clientId: "cid", refreshToken: "rt-1" }, NOW);

    expect(tokens.refreshToken).toBe("rt-2");
  });

  it("シークレットが無ければ client_secret を送らない", async () => {
    const { http, sent } = recorder(JSON.stringify({ access_token: "at-2" }));
    await refreshAccessToken(http, { clientId: "cid", refreshToken: "rt-1" }, NOW);

    expect(sent[0].form.has("client_secret")).toBe(false);
  });

  it("シークレットがあれば送る（Desktop クライアントは更新でも要求する）", async () => {
    const { http, sent } = recorder(JSON.stringify({ access_token: "at-2" }));
    await refreshAccessToken(http, { clientId: "cid", clientSecret: "sec", refreshToken: "rt-1" }, NOW);

    expect(sent[0].form.get("client_secret")).toBe("sec");
  });

  it("失効・取り消し済みのトークンは例外にする", async () => {
    // トークンエンドポイントは invalid_grant を 400 で返す（RFC 6749 §5.2）。
    const { http } = recorder(JSON.stringify({ error: "invalid_grant" }), 400);
    await expect(refreshAccessToken(http, { clientId: "cid", refreshToken: "rt-1" }, NOW)).rejects.toThrow(/400/);
  });
});
