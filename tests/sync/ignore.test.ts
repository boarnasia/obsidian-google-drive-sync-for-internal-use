/*
 * 除外規則。`.gitignore` の部分集合を Markdown から読む（ADR-0006）。
 *
 * ここで守るのは二つ。書いた人の意図どおりに一致すること、そして「除外できない
 * もの」と「常に除外するもの」が規則より強いことである。
 */
import { describe, expect, it } from "vitest";
import { ignoreMatcher, parseIgnore } from "../../src/sync/ignore";
import { TEAM_IGNORE_TEMPLATE, localIgnoreTemplate } from "../../src/sync/configFiles";

const match = (rules: string) => ignoreMatcher(rules);

describe("書式", () => {
  it("コメントと空行は規則にならない", () => {
    expect(parseIgnore("# これは説明\n\n   \n")).toEqual([]);
  });

  it("Markdown の見出しもコメントとして読む", () => {
    // 設定ファイルは Markdown なので、`# 使い方` のような行が必ず混ざる。
    const ignored = match("# 使い方\n下書き/");
    expect(ignored("下書き/メモ.md")).toBe(true);
    expect(ignored("使い方")).toBe(false);
  });

  it("コードブロックの柵は無視し、中の規則は読む", () => {
    const ignored = match("```\n*.png\n```");
    expect(ignored("図.png")).toBe(true);
  });

  it("箇条書きで書かれていても読む", () => {
    expect(match("- *.tmp")("a.tmp")).toBe(true);
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

  it("規則が無ければ何も除外しない", () => {
    const ignored = match("");
    expect(ignored("a.md")).toBe(false);
  });
});

describe("規則より強いもの", () => {
  it("_SyncLocal/ は常に除外する（各自の設定はチームに配らない）", () => {
    const ignored = match("!_SyncLocal/ignore.md");
    expect(ignored("_SyncLocal/ignore.md")).toBe(true);
    expect(ignored("_SyncLocal/local-only.md")).toBe(true);
  });

  it("_Sync/ignore.md は除外できない（外すとルールが配られなくなる）", () => {
    const ignored = match("_Sync/\n*.md");
    expect(ignored("_Sync/ignore.md")).toBe(false);
    expect(ignored("_Sync/README.md")).toBe(true); // 他のファイルは規則どおり
  });
});

describe("重ね方", () => {
  it("チームの規則と各自の規則を、この順で重ねる", () => {
    const ignored = ignoreMatcher("*.png", "!ロゴ.png\n下書き/");
    expect(ignored("図.png")).toBe(true);
    expect(ignored("ロゴ.png")).toBe(false); // 各自の打ち消しが後に来る
    expect(ignored("下書き/a.md")).toBe(true);
  });

  it("設定ファイルが無くても動く", () => {
    const ignored = ignoreMatcher(null, undefined);
    expect(ignored("a.md")).toBe(false);
  });
});

/*
 * 初期投入されるファイルは、この parser が読む。Markdown の散文として書くと
 * 説明の一行一行が規則になり、どれが設定でどれが説明かが読めなくなる。
 * 「説明は必ず # で始まる」ことを、テンプレート側で保証する。
 */
describe("初期投入されるファイル", () => {
  const LOCAL = localIgnoreTemplate({
    title: "自分だけの除外規則",
    body: "ここに書いた規則は自分の Vault にだけ効きます。# はコメント、* ? ** はグロブ、先頭の / は同期ルート固定、末尾の / はフォルダ、! は打ち消しです。",
  });

  it("チームのテンプレートは、書いてある規則だけを持つ", () => {
    expect(parseIgnore(TEAM_IGNORE_TEMPLATE)).toHaveLength(2);

    const ignored = match(TEAM_IGNORE_TEMPLATE);
    expect(ignored("Drafts/案.md")).toBe(true);
    expect(ignored("作業.tmp")).toBe(true);
    expect(ignored("議事録.md")).toBe(false);
  });

  it("各自のテンプレートは規則を一つも持たない（白紙から始まる）", () => {
    expect(parseIgnore(LOCAL)).toEqual([]);
  });

  it("説明の行はすべて # で始まる", () => {
    const prose = (text: string): string[] =>
      text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .filter((line) => !line.startsWith("#"));

    expect(prose(TEAM_IGNORE_TEMPLATE)).toEqual(["Drafts/", "*.tmp"]);
    expect(prose(LOCAL)).toEqual([]);
  });

  /*
   * 翻訳は後から増える。`#` を付けるのは文面ではなくテンプレート側の仕事にしてある。
   */
  it("翻訳が # を付け忘れても規則にならない", () => {
    const careless = localIgnoreTemplate({ title: "!全部戻す", body: "*.md\n下書き/" });
    expect(parseIgnore(careless)).toEqual([]);
  });
});
