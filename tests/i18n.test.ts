/*
 * 文字列辞書。
 *
 * TypeScript は `ja` が `en` の全キーを持つことをすでに保証している（型が `en` から
 * 導出されるため）。ここで確かめるのはコンパイラに見えない部分——日本語の項目が
 * 実際に日本語であること、補間する項目が値をちゃんと埋めること、そして「自動」の
 * 解決順である。コピーしただけで訳していない項目は完璧にコンパイルが通る。
 */
import { afterEach, describe, expect, it } from "vitest";
import { Strings, codeOf, en, ja, setLanguage, t } from "../src/i18n";

/**
 * 意図的に両言語で同じもの: 固有名詞、URL のプレースホルダ、記号だけのサマリ、
 * そして言語名（どちらの辞書でも自分の言語で書く）。これ以外が一致していたら
 * 訳し忘れである。
 */
const SHARED_BY_DESIGN = new Set<keyof Strings>([
  "notice",
  "syncSummary",
  "relWords",
  "languageEn",
  "languageJa",
  "targetUrlPlaceholder",
]);

const hasJapanese = (s: string): boolean => /[ぁ-んァ-ヶ一-龠]/.test(s);
const keys = Object.keys(en) as (keyof Strings)[];

afterEach(() => {
  setLanguage("en"); // モジュールの状態は共有なので、毎回既知の場所へ戻す。
});

describe("辞書の形", () => {
  it("二つの辞書のキーが一致する", () => {
    expect(Object.keys(ja).sort()).toEqual(keys.slice().sort());
  });

  it("どちらも空の項目を持たない", () => {
    expect(keys.filter((k) => en[k] === undefined || ja[k] === undefined)).toEqual([]);
  });
});

describe("翻訳", () => {
  const plain = keys.filter((k) => typeof en[k] === "string" && !SHARED_BY_DESIGN.has(k));

  it(`平文の項目がすべて訳されている（${plain.length} 件）`, () => {
    expect(plain.filter((k) => (ja[k] as string) === (en[k] as string))).toEqual([]);
  });

  it("訳された項目に実際に日本語が入っている", () => {
    expect(plain.filter((k) => !hasJapanese(ja[k] as string))).toEqual([]);
  });
});

describe("値を埋める項目", () => {
  it("syncSummary が 4 つの数を置く", () => {
    const s = ja.syncSummary(1, 2, 3, 4);
    expect(s).toContain("1");
    expect(s).toContain("4");
  });

  it.each([
    ["syncErrorCount", () => ja.syncErrorCount(7), ["7"]],
    ["syncDeferred", () => ja.syncDeferred(50), ["50"]],
    ["syncNowDesc", () => ja.syncNowDesc("5 分前", "2026/09/13"), ["5 分前", "2026/09/13"]],
    ["targetOnSharedDrive", () => ja.targetOnSharedDrive("営業部Vault", "営業部"), ["営業部Vault", "営業部"]],
    ["targetOnMyDrive", () => ja.targetOnMyDrive("個人メモ"), ["個人メモ"]],
    ["mountMapping", () => ja.mountMapping("仕事"), ["仕事"]],
    ["errOutsideMount", () => ja.errOutsideMount(".obsidian/x"), [".obsidian/x"]],
    ["errLocalMissing", () => ja.errLocalMissing("a.md"), ["a.md"]],
  ] as [string, () => string, string[]][])("%s が渡された値を置く", (_name, render, expected) => {
    const s = render();
    for (const e of expected) expect(s).toContain(e);
  });

  it("相対時刻の語が日本語で、数を置く", () => {
    expect(hasJapanese(ja.relWords.justNow)).toBe(true);
    expect(ja.relWords.minutes(5)).toContain("5");
    expect(ja.relWords.days(2)).toContain("2");
  });

  it("設定検索の別名は英語の語も残す", () => {
    expect(ja.languageAliases).toContain("language");
    expect(ja.oauthClientIdAliases).toContain("google");
  });
});

describe("言語の切り替え", () => {
  it("明示指定で現在の文字列が入れ替わる", () => {
    setLanguage("ja");
    expect(t.syncHeading).toBe(ja.syncHeading);
    expect(t.targetHeading).toBe(ja.targetHeading);

    setLanguage("en");
    expect(t.syncHeading).toBe(en.syncHeading);
  });

  it("切り替えてもキーが欠けない", () => {
    setLanguage("ja");
    expect(keys.filter((k) => t[k] === undefined)).toEqual([]);
  });

  it("明示指定は Obsidian の申告より優先する", () => {
    setLanguage("ja", "en");
    expect(t.syncHeading).toBe(ja.syncHeading);

    setLanguage("en", "ja");
    expect(t.syncHeading).toBe(en.syncHeading);
  });
});

describe("「自動」の解決", () => {
  /**
   * 環境が出す答え。英語だとは断定しない: Node には navigator.language があり、
   * このマシンのロケールが正当に決める。試すべき不変条件は「使えない入力は
   * ここへ落ちる」ことであって、それが何であるかではない。
   */
  const fromEnvironment = (): string => {
    setLanguage("auto");
    return t.syncHeading;
  };

  it("Obsidian の申告に従う", () => {
    setLanguage("auto", "ja");
    expect(t.syncHeading).toBe(ja.syncHeading);

    setLanguage("auto", "en");
    expect(t.syncHeading).toBe(en.syncHeading);
  });

  it("リージョンを落とす（ja-JP ⇒ ja）", () => {
    setLanguage("auto", "ja-JP");
    expect(t.syncHeading).toBe(ja.syncHeading);
  });

  it("同梱していない言語は英語に落ちる", () => {
    setLanguage("auto", "de");
    expect(t.syncHeading).toBe(en.syncHeading);
  });

  it("カスタム翻訳ファイルのパスを言語コードと読まない", () => {
    const env = fromEnvironment();
    setLanguage("auto", "/Users/jane/ja-custom.json");
    expect(t.syncHeading).toBe(env);
  });

  it("空の申告は例外にせず次段へ落ちる", () => {
    const env = fromEnvironment();
    setLanguage("auto", "");
    expect(t.syncHeading).toBe(env);
  });
});

describe("codeOf", () => {
  it("素のコードはそのまま", () => {
    expect(codeOf("ja")).toBe("ja");
  });

  it("リージョンを落とす", () => {
    expect(codeOf("ja-JP")).toBe("ja");
    expect(codeOf("en-GB")).toBe("en");
    expect(codeOf("pt_BR")).toBe("pt");
  });

  it("大文字小文字を揃える", () => {
    expect(codeOf("JA-JP")).toBe("ja");
  });

  it("パスはコードではない", () => {
    // Obsidian はカスタム翻訳ファイルのパスを言語コードと同じ場所に保存する。
    expect(codeOf("/Users/jane/ja-custom.json")).toBeNull();
    expect(codeOf("C:\\lang\\ja.json")).toBeNull();
  });

  it("空と不在は何も返さない", () => {
    expect(codeOf("")).toBeNull();
    expect(codeOf(null)).toBeNull();
    expect(codeOf(undefined)).toBeNull();
  });
});
