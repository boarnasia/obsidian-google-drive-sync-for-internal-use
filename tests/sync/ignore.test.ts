/*
 * 除外規則。`.gitignore` の部分集合を `.tds-ignore` から読む（ADR-0006, ADR-0007）。
 *
 * ここで守るのは二つ。書いた人の意図どおりに一致すること、そして「除外できない
 * もの」と「常に除外するもの」が規則より強いことである。
 */
import { describe, expect, it } from "vitest";
import { ignoreMatcher, parseIgnore } from "../../src/sync/ignore";
import { TEAM_IGNORE_TEMPLATE } from "../../src/sync/configFiles";

const match = (rules: string) => ignoreMatcher(rules);

describe("書式", () => {
  it("コメントと空行は規則にならない", () => {
    expect(parseIgnore("# これは説明\n\n   \n")).toEqual([]);
  });

  it("規則は書いたとおりに読む（Markdown の記法は解釈しない）", () => {
    // 箇条書きの記号も規則の一部。`- *.tmp` は `a.tmp` に一致しない。
    expect(match("- *.tmp")("a.tmp")).toBe(false);
  });
});

describe("一致", () => {
  it("グロブは / を跨がない", () => {
    const ignored = match("*.png");
    expect(ignored("図.png")).toBe(true);
    expect(ignored("資料/図.png")).toBe(true); // 階層を固定していなければどこでも
    expect(ignored("図.png.md")).toBe(false);
  });

  it("先頭の / は同期ルートに固定する", () => {
    const ignored = match("/下書き/");
    expect(ignored("下書き/a.md")).toBe(true);
    expect(ignored("仕事/下書き/a.md")).toBe(false);
  });

  it("途中に / を含む規則も固定として扱う", () => {
    const ignored = match("資料/図.png");
    expect(ignored("資料/図.png")).toBe(true);
    expect(ignored("仕事/資料/図.png")).toBe(false);
  });

  it("** は階層を跨ぐ", () => {
    const ignored = match("仕事/**/秘密.md");
    expect(ignored("仕事/秘密.md")).toBe(true);
    expect(ignored("仕事/2026/09/秘密.md")).toBe(true);
    expect(ignored("私用/秘密.md")).toBe(false);
  });

  it("末尾の / はフォルダにだけ一致し、その中身すべてに及ぶ", () => {
    const ignored = match("下書き/");
    expect(ignored("下書き/a.md")).toBe(true);
    expect(ignored("下書き/2026/b.md")).toBe(true);
    expect(ignored("下書き")).toBe(false); // ファイルとしての「下書き」は対象外
  });

  it("? は 1 文字", () => {
    const ignored = match("メモ?.md");
    expect(ignored("メモ1.md")).toBe(true);
    expect(ignored("メモ12.md")).toBe(false);
  });

  it("! は直前までの規則を打ち消す", () => {
    const ignored = match("*.png\n!ロゴ.png");
    expect(ignored("図.png")).toBe(true);
    expect(ignored("ロゴ.png")).toBe(false);
  });

  it("後に書いた規則の方が強い", () => {
    const ignored = match("!ロゴ.png\n*.png");
    expect(ignored("ロゴ.png")).toBe(true);
  });

  it("除外したフォルダの中のファイルは ! で戻せない（.gitignore と同じ）", () => {
    const ignored = match("下書き/\n!下書き/残す.md");
    expect(ignored("下書き/残す.md")).toBe(true);
    expect(ignored("下書き/2026/残す.md")).toBe(true);
  });

  it("フォルダ自体を ! で戻せば、中身も戻る", () => {
    const ignored = match("下書き/\n!下書き/");
    expect(ignored("下書き/a.md")).toBe(false);
  });

  it("フォルダを除外せず中身だけを除外したなら、! で個別に戻せる", () => {
    const ignored = match("下書き/*\n!下書き/残す.md");
    expect(ignored("下書き/a.md")).toBe(true);
    expect(ignored("下書き/残す.md")).toBe(false);
  });

  it("規則が無ければ何も除外しない", () => {
    const ignored = match("");
    expect(ignored("a.md")).toBe(false);
  });
});

describe("規則より強いもの", () => {
  it(".tds-version は常に除外する（同期の前に Drive を直接読み書きする）", () => {
    const ignored = match("!.tds-version");
    expect(ignored(".tds-version")).toBe(true);
  });

  it(".tds-ignore は除外できない（外すとルールが配られなくなる）", () => {
    const ignored = match(".tds-*\n*.md");
    expect(ignored(".tds-ignore")).toBe(false);
    expect(ignored("a.md")).toBe(true); // 他のファイルは規則どおり
  });
});

describe("規則のファイル", () => {
  it("後の規則ほど強い", () => {
    const ignored = match("*.png\n!ロゴ.png");
    expect(ignored("図.png")).toBe(true);
    expect(ignored("ロゴ.png")).toBe(false);
  });

  it("除外したフォルダの中身は ! で戻せない", () => {
    const ignored = match("下書き/\n!下書き/私の.md");
    expect(ignored("下書き/私の.md")).toBe(true);
  });

  it("ファイルが無くても動く", () => {
    expect(ignoreMatcher(null)("a.md")).toBe(false);
  });
});

/*
 * 初期投入されるファイルは、この parser が読む。`#` を付け忘れた説明の行は
 * 規則になる。「説明は必ず # で始まる」ことを、テンプレート側で保証する。
 */
describe("初期投入されるファイル", () => {
  it("書いてある規則だけを持つ", () => {
    expect(parseIgnore(TEAM_IGNORE_TEMPLATE)).toHaveLength(1);

    const ignored = match(TEAM_IGNORE_TEMPLATE);
    expect(ignored("Drafts/案.md")).toBe(true);
    expect(ignored("議事録.md")).toBe(false);
  });

  it("説明の行はすべて # で始まる", () => {
    const prose = TEAM_IGNORE_TEMPLATE.split("\n")
      .filter((line) => line.trim() !== "")
      .filter((line) => !line.startsWith("#"));
    expect(prose).toEqual(["Drafts/"]);
  });
});
