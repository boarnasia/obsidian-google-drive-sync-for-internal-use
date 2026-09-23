/*
 * 失敗の種類分け。ここが表示と自動の再試行の両方を決めるので、直らないものを
 * 「直る」と読み違えると、無効なトークンで何分も叩き続けることになる。
 */
import { describe, expect, it } from "vitest";
import { classifyFailure, isTransient } from "../../src/sync/errors";
import { RequestTimeoutError } from "../../src/providers/RemoteProvider";

const kind = (message: string) => classifyFailure(new Error(message));

describe("自然に直るもの", () => {
  it("Electron のネットワークの失敗は network", () => {
    expect(kind("net::ERR_INTERNET_DISCONNECTED")).toBe("network");
    expect(kind("net::ERR_NETWORK_IO_SUSPENDED")).toBe("network"); // スリープ中
    expect(kind("Error: net::ERR_NAME_NOT_RESOLVED")).toBe("network");
    expect(kind("net::ERR_CONNECTION_RESET")).toBe("network");
  });

  it("応答待ちの時間切れは server", () => {
    expect(classifyFailure(new RequestTimeoutError("GET www.googleapis.com timed out after 120s"))).toBe("server");
  });

  it("Drive の一時障害と流量制限は server", () => {
    expect(kind("Drive list 503: backend error")).toBe("server");
    expect(kind("Drive list 429: too many requests")).toBe("server");
    expect(kind('Drive put 403: {"reason": "userRateLimitExceeded"}')).toBe("server");
  });

  it("network と server だけを自分で拾い直す", () => {
    expect(isTransient("network")).toBe(true);
    expect(isTransient("server")).toBe(true);
    for (const k of ["auth", "target", "quota", "other"] as const) expect(isTransient(k)).toBe(false);
  });
});

describe("直らないもの", () => {
  it("トークンの発行の失敗は auth", () => {
    expect(kind("OAuth token 400: invalid_grant")).toBe("auth");
    expect(kind("OAuth token 401: invalid_client")).toBe("auth");
  });

  it("同期先を開けないのは target", () => {
    expect(kind("Drive get 404")).toBe("target");
    expect(kind('Drive list 403: {"reason": "insufficientPermissions"}')).toBe("target");
  });

  it("容量とファイル数の上限は quota", () => {
    expect(kind('Drive put 403: {"reason": "storageQuotaExceeded"}')).toBe("quota");
    expect(kind('Drive put 403: {"reason": "teamDriveFileLimitExceeded"}')).toBe("quota");
  });

  it("見分けの付かないものは other（原文をそのまま出す）", () => {
    expect(kind("ローカルのファイルが見つかりません: a.md")).toBe("other");
    expect(classifyFailure("文字列でも落ちない")).toBe("other");
  });
});
