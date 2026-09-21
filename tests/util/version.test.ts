/*
 * compareVersions() — `.tds-version` と自分の版の大小。ここを誤ると、新しい版の人の
 * 同期が止まるか、古い版の人の同期が止まらない（ADR-0007）。
 */
import { describe, expect, it } from "vitest";
import { compareVersions } from "../../src/util/version";

describe("compareVersions", () => {
  it("桁ごとに数として比べる（文字列の順ではない）", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBe(1);
    expect(compareVersions("0.9.9", "0.10.0")).toBe(-1);
  });

  it("同じ版は 0", () => {
    expect(compareVersions("0.5.2", "0.5.2")).toBe(0);
  });

  it("足りない桁は 0 とみなす", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.0")).toBe(1);
  });

  it("前後の空白とプレリリースは見ない", () => {
    expect(compareVersions(" 0.6.0\n", "0.6.0-beta.1")).toBe(0);
  });

  it("読めない版は null", () => {
    expect(compareVersions("abc", "0.6.0")).toBeNull();
    expect(compareVersions("0.6.0", "")).toBeNull();
  });
});
