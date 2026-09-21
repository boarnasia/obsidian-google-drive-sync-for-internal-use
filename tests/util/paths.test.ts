/*
 * パスの取り扱い。リモートが返した文字列がそのまま書き込み先になる以上、
 * ここが `..` による Vault の外への脱出を止める。設定ディレクトリへの書き込みは
 * 通すので、それは ObsidianLocalStore がもう一段で止める。
 */
import { describe, expect, it } from "vitest";
import { conflictPath, safeVaultPath } from "../../src/util/paths";

describe("safeVaultPath", () => {
  it("素の POSIX パスはそのまま通す", () => {
    expect(safeVaultPath("顧客/A社.md")).toBe("顧客/A社.md");
  });

  it("Windows の区切りを POSIX に揃える", () => {
    expect(safeVaultPath("顧客\\A社.md")).toBe("顧客/A社.md");
  });

  it("先頭のスラッシュを落として Vault 相対にする", () => {
    expect(safeVaultPath("/顧客/A社.md")).toBe("顧客/A社.md");
    expect(safeVaultPath("///顧客/A社.md")).toBe("顧客/A社.md");
  });

  it("空のセグメントと `.` を畳む", () => {
    expect(safeVaultPath("顧客//./A社.md")).toBe("顧客/A社.md");
  });

  it.each([
    "../escape.md",
    "顧客/../../escape.md",
    "..\\escape.md",
    "/../escape.md",
    "顧客/..",
  ])("親への脱出を含むパスは例外にする: %s", (path) => {
    expect(() => safeVaultPath(path)).toThrow(/unsafe path/);
  });

  it("名前の一部としての `..` は拒否しない（セグメント全体だけが脱出）", () => {
    expect(safeVaultPath("顧客/..隠し.md")).toBe("顧客/..隠し.md");
    expect(safeVaultPath("顧客/a..b.md")).toBe("顧客/a..b.md");
  });
});

describe("conflictPath", () => {
  const STAMP = "20260203T040506Z";

  it("拡張子の手前に印を入れる", () => {
    expect(conflictPath("a/b.md", STAMP)).toBe(`a/b.conflict-${STAMP}.md`);
  });

  it("フォルダの無いファイルでも同じ", () => {
    expect(conflictPath("b.md", STAMP)).toBe(`b.conflict-${STAMP}.md`);
  });

  it("拡張子が無ければ末尾に付ける", () => {
    expect(conflictPath("a/README", STAMP)).toBe(`a/README.conflict-${STAMP}`);
  });

  it("最後の拡張子だけを拡張子と見る", () => {
    expect(conflictPath("a/b.tar.gz", STAMP)).toBe(`a/b.tar.conflict-${STAMP}.gz`);
  });

  it("ドットで始まる名前は拡張子ではなく名前として扱う", () => {
    expect(conflictPath("a/.gitignore", STAMP)).toBe(`a/.gitignore.conflict-${STAMP}`);
  });

  it("生成したパスは Vault の中に留まる", () => {
    expect(safeVaultPath(conflictPath("顧客/A社.md", STAMP))).toBe(`顧客/A社.conflict-${STAMP}.md`);
  });
});
