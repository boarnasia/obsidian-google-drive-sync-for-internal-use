/*
 * 文字列辞書のオフラインテスト。
 *
 * TypeScript は `ja` が `en` の全キーを持つことをすでに保証している（型が `en` から
 * 導出されるため）。ここで確かめるのはコンパイラに見えない部分——日本語の項目が
 * 実際に日本語であること、補間する項目が値をちゃんと埋めること。コピーしただけで
 * 訳していない項目は完璧にコンパイルが通る。それを捕まえるのがこのテスト。
 * 実行: sh scripts/run-pilot.sh scripts/i18n-test.ts
 */
import { codeOf, en, ja, setLanguage, Strings, t } from "../src/i18n";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
  }
}

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

function main(): void {
  const keys = Object.keys(en) as (keyof Strings)[];
  check("二つの辞書のキーが一致する", keys.length === Object.keys(ja).length);
  check("どちらも空の項目を持たない", keys.every((k) => en[k] !== undefined && ja[k] !== undefined));

  // ------------------------------------------------ 平文の項目が訳されている
  const plain = keys.filter((k) => typeof en[k] === "string" && !SHARED_BY_DESIGN.has(k));
  const untranslated = plain.filter((k) => (ja[k] as string) === (en[k] as string));
  check(`平文の項目がすべて訳されている（${plain.length} 件）`, untranslated.length === 0);
  if (untranslated.length) console.log("        未訳:", untranslated.join(", "));

  const notJapanese = plain.filter((k) => !hasJapanese(ja[k] as string));
  check("訳された項目に実際に日本語が入っている", notJapanese.length === 0);
  if (notJapanese.length) console.log("        日本語なし:", notJapanese.join(", "));

  // ------------------------------------------------ 補間する項目が値を埋める
  check("syncSummary が 4 つの数を置く", ja.syncSummary(1, 2, 3, 4).includes("1") && ja.syncSummary(1, 2, 3, 4).includes("4"));
  check("syncErrorCount が件数を置く", ja.syncErrorCount(7).includes("7"));
  check("syncDeferred が件数を置く", ja.syncDeferred(50).includes("50"));
  check("syncNowDesc が二つの時刻を置く", ja.syncNowDesc("5 分前", "2026/09/13").includes("5 分前") && ja.syncNowDesc("5 分前", "2026/09/13").includes("2026/09/13"));
  check("targetOnSharedDrive がフォルダ名とドライブ名を置く", (() => {
    const s = ja.targetOnSharedDrive("営業部Vault", "営業部");
    return s.includes("営業部Vault") && s.includes("営業部");
  })());
  check("targetOnMyDrive がフォルダ名を置く", ja.targetOnMyDrive("個人メモ").includes("個人メモ"));
  check("mountMapping がフォルダ名を置く", ja.mountMapping("仕事").includes("仕事"));
  check("errOutsideMount がパスを置く", ja.errOutsideMount(".obsidian/x").includes(".obsidian/x"));
  check("errLocalMissing がパスを置く", ja.errLocalMissing("a.md").includes("a.md"));

  // -------------------------------------------------------- 相対時刻の語
  check("相対時刻の語が日本語", hasJapanese(ja.relWords.justNow) && hasJapanese(ja.relWords.minutes(5)));
  check("相対時刻の語が数を置く", ja.relWords.minutes(5).includes("5") && ja.relWords.days(2).includes("2"));

  // -------------------------------------------------------- 検索用の別名
  check("設定検索の別名は英語の語も残す", ja.languageAliases.includes("language") && ja.oauthClientIdAliases.includes("google"));

  // ---------------------------------------------------------- 言語の切替
  setLanguage("ja");
  check("setLanguage('ja') で現在の文字列が入れ替わる", t.syncHeading === ja.syncHeading && t.targetHeading === ja.targetHeading);
  setLanguage("en");
  check("setLanguage('en') で戻る", t.syncHeading === en.syncHeading);

  // 環境が出す答え。英語だとは断定しない: Node には navigator.language があり、
  // このマシンのロケールが正当に決める。試すべき不変条件は「使えない入力は
  // ここへ落ちる」ことであって、それが何であるかではない。
  setLanguage("auto");
  const fromEnvironment = t.syncHeading;

  setLanguage("auto", "ja");
  check("自動は Obsidian の申告に従う", t.syncHeading === ja.syncHeading);
  setLanguage("auto", "ja-JP");
  check("自動はリージョンを落とす（ja-JP ⇒ ja）", t.syncHeading === ja.syncHeading);
  setLanguage("auto", "en");
  check("自動は申告された英語にも従う", t.syncHeading === en.syncHeading);
  setLanguage("auto", "de");
  check("同梱していない言語は英語に落ちる", t.syncHeading === en.syncHeading);
  setLanguage("auto", "/Users/jane/ja-custom.json");
  check("カスタム翻訳ファイルのパスを言語コードと読まない", t.syncHeading === fromEnvironment);
  setLanguage("auto", "");
  check("空の申告は例外にせず次段へ落ちる", t.syncHeading === fromEnvironment);
  setLanguage("ja", "en");
  check("明示指定は Obsidian の申告より優先する", t.syncHeading === ja.syncHeading);
  setLanguage("en", "ja");
  check("逆向きも同じ", t.syncHeading === en.syncHeading);
  check("切り替えてもキーが欠けない", keys.every((k) => t[k] !== undefined));

  // ------------------------------------------------------ 正規化を単体で
  check("素のコードはそのまま", codeOf("ja") === "ja");
  check("リージョンを落とす", codeOf("ja-JP") === "ja" && codeOf("en-GB") === "en" && codeOf("pt_BR") === "pt");
  check("大文字小文字を揃える", codeOf("JA-JP") === "ja");
  check("POSIX のパスはコードではない", codeOf("/Users/jane/ja-custom.json") === null);
  check("Windows のパスもコードではない", codeOf("C:\\lang\\ja.json") === null);
  check("空と不在は何も返さない", codeOf("") === null && codeOf(null) === null && codeOf(undefined) === null);

  console.log(`\n=== i18n: ${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed) ===`);
  if (failed) process.exitCode = 1;
}

main();
