/*
 * PKCE (RFC 7636)。横取りされた認可コードを、verifier 無しではトークンに
 * 交換できなくする仕組みなので、ここが壊れるとサインインの安全性がそのまま落ちる。
 */
import { describe, expect, it } from "vitest";
import { codeChallengeS256, generateCodeVerifier } from "../../../src/providers/google/pkce";

const BASE64URL = /^[A-Za-z0-9_-]+$/;

describe("generateCodeVerifier", () => {
  // 43 文字は RFC が許す長さ（43〜128）の下限。BASE64URL は + / = を含まないことも兼ねる。
  it("32 バイト = 43 文字の base64url を返す", () => {
    const v = generateCodeVerifier();
    expect(v).toHaveLength(43);
    expect(v).toMatch(BASE64URL);
  });

  it("毎回違う値になる", () => {
    const seen = new Set(Array.from({ length: 64 }, () => generateCodeVerifier()));
    expect(seen.size).toBe(64);
  });
});

describe("codeChallengeS256", () => {
  // 一方向であることの根拠もここにある。SHA-256 を使っていなければ一致しない。
  it("RFC 7636 付録 B のベクタと一致する", async () => {
    expect(await codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
  });

  it("SHA-256 の 32 バイト = 43 文字の base64url（パディング無し）", async () => {
    const c = await codeChallengeS256(generateCodeVerifier());
    expect(c).toHaveLength(43);
    expect(c).toMatch(BASE64URL);
  });

  it("同じ verifier からは同じ challenge（認可と交換で一致する）", async () => {
    const v = generateCodeVerifier();
    expect(await codeChallengeS256(v)).toBe(await codeChallengeS256(v));
  });

  it("verifier が違えば challenge も違う", async () => {
    expect(await codeChallengeS256("a")).not.toBe(await codeChallengeS256("b"));
  });
});
