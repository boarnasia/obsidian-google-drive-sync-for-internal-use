/*
 * 文字列辞書。
 *
 * TypeScript は各辞書が `en` の全キーを持つことをすでに保証している（型が `en` から
 * 導出されるため）。ここで確かめるのはコンパイラに見えない部分——訳した項目が
 * 実際にその言語の文字で書かれていること、補間する項目が値をちゃんと埋めること、
 * そして「自動」の解決順である。コピーしただけで訳していない項目は完璧にコンパイルが通る。
 */
import { afterEach, describe, expect, it } from "vitest";
import { LANGUAGE_NAMES, LOCALES, Lang, Strings, codeOf, en, ja, langOf, setLanguage, t } from "../src/i18n";

/** 意図的にどの言語でも同じもの: 固有名詞、URL のプレースホルダ、記号だけのサマリ。 */
const SHARED_BY_DESIGN = new Set<keyof Strings>(["notice", "syncSummary", "relWords", "targetUrlPlaceholder"]);

/** 英語と綴りが一致するのが正しい訳。これ以外の一致は訳し忘れとみなす。 */
const SAME_AS_ENGLISH: Partial<Record<Lang, (keyof Strings)[]>> = {
  es: ["generalHeading"],
};

/** 非ラテン文字の言語は、訳した項目にその文字が実際に入っているかまで見る。 */
const SCRIPT: Partial<Record<Lang, RegExp>> = {
  ja: /[ぁ-んァ-ヶ一-龠]/,
  zh: /[\u4e00-\u9fff]/,
  "zh-TW": /[\u4e00-\u9fff]/,
  ko: /[\uac00-\ud7af]/,
  hi: /[\u0900-\u097f]/,
  kn: /[\u0c80-\u0cff]/,
  ru: /[\u0400-\u04ff]/,
};

const hasJapanese = (s: string): boolean => SCRIPT.ja!.test(s);
const keys = Object.keys(en) as (keyof Strings)[];
const others = (Object.keys(LOCALES) as Lang[]).filter((l) => l !== "en");

afterEach(() => {
  setLanguage("en"); // モジュールの状態は共有なので、毎回既知の場所へ戻す。
});

describe("辞書の形", () => {
  it.each(others)("%s のキーが英語と一致する", (lang) => {
    expect(Object.keys(LOCALES[lang]).sort()).toEqual(keys.slice().sort());
  });

  it.each(others)("%s は空の項目を持たない", (lang) => {
    const d = LOCALES[lang] as Strings;
    expect(keys.filter((k) => d[k] === undefined || d[k] === "")).toEqual([]);
  });

  it("すべての言語に選択肢の名前がある", () => {
    expect(Object.keys(LANGUAGE_NAMES).sort()).toEqual(Object.keys(LOCALES).sort());
  });
});

describe("翻訳", () => {
  const plain = keys.filter((k) => typeof en[k] === "string" && !SHARED_BY_DESIGN.has(k));

  it.each(others)(`%s の平文の項目がすべて訳されている（${plain.length} 件）`, (lang) => {
    const d = LOCALES[lang] as Strings;
    const allowed = new Set(SAME_AS_ENGLISH[lang] ?? []);
    expect(plain.filter((k) => !allowed.has(k) && (d[k] as string) === (en[k] as string))).toEqual([]);
  });

  it.each(Object.keys(SCRIPT) as Lang[])("%s の訳にその言語の文字が入っている", (lang) => {
    const d = LOCALES[lang] as Strings;
    expect(plain.filter((k) => !SCRIPT[lang]!.test(d[k] as string))).toEqual([]);
  });

  it.each(others)("%s の相対時刻が数を置き、英語と違う", (lang) => {
    const w = (LOCALES[lang] as Strings).relWords;
    for (const n of [1, 2, 5, 21]) {
      expect(w.minutes(n)).toContain(String(n));
      expect(w.hours(n)).toContain(String(n));
      expect(w.days(n)).toContain(String(n));
    }
    expect(w.minutes(5)).not.toBe(en.relWords.minutes(5));
  });

  it.each(others)("%s の設定検索の別名は英語の語も残す", (lang) => {
    const d = LOCALES[lang] as Strings;
    expect(d.languageAliases).toContain("language");
    expect(d.oauthClientIdAliases).toContain("google");
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
    ["targetOnSharedDrive", () => ja.targetOnSharedDrive("営業部 / Vault"), ["営業部 / Vault"]],
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

  it("ロシア語の相対時刻は数に応じて語形を変える", () => {
    const w = LOCALES.ru.relWords;
    expect(w.minutes(1)).toBe("1 минуту назад");
    expect(w.minutes(3)).toBe("3 минуты назад");
    expect(w.minutes(5)).toBe("5 минут назад");
    expect(w.minutes(11)).toBe("11 минут назад");
    expect(w.minutes(21)).toBe("21 минуту назад");
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
    setLanguage("auto", "it");
    expect(t.syncHeading).toBe(en.syncHeading);
  });

  it.each([
    ["zh", "zh"],
    ["zh-CN", "zh"],
    ["zh-Hans", "zh"],
    ["zh-TW", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["zh-Hant-TW", "zh-TW"],
    ["pt", "pt-BR"],
    ["pt-BR", "pt-BR"],
    ["kn-IN", "kn"],
    ["hi", "hi"],
  ] as [string, Lang][])("%s は %s の辞書になる", (reported, lang) => {
    setLanguage("auto", reported);
    expect(t.syncHeading).toBe(LOCALES[lang].syncHeading);
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
  it("小文字にそろえ、区切りを - にする", () => {
    expect(codeOf("ja")).toBe("ja");
    expect(codeOf("JA-JP")).toBe("ja-jp");
    expect(codeOf("pt_BR")).toBe("pt-br");
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

describe("langOf", () => {
  it("リージョンを落として同梱の言語に寄せる", () => {
    expect(langOf("ja-jp")).toBe("ja");
    expect(langOf("en-gb")).toBe("en");
  });

  it("同梱していない言語は null", () => {
    expect(langOf("it")).toBeNull();
  });
});
