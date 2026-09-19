import { en, Strings } from "./locales/en";
import { ja } from "./locales/ja";
import { zh } from "./locales/zh";
import { zhTW } from "./locales/zh-TW";
import { ko } from "./locales/ko";
import { hi } from "./locales/hi";
import { kn } from "./locales/kn";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { de } from "./locales/de";
import { ptBR } from "./locales/pt-BR";
import { ru } from "./locales/ru";

export type { Strings };
export { en, ja, zh, zhTW, ko, hi, kn, es, fr, de, ptBR, ru };

/**
 * UI 文字列。
 *
 * `en` が唯一の真実で、`Strings` はそこから導出する。したがって他の辞書にキーの
 * 漏れ・綴り違い・引数の不一致があるとビルドが通らない。言語を足すことは
 * `locales/` にファイルを一つ足して下の表に載せることであり、訳し忘れは実行時の
 * 英語混入ではなくビルドエラーになる。
 *
 * コードは Obsidian の言語コードに揃える（簡体字は "zh"、繁体字は "zh-TW"）。
 */
export const LOCALES = {
  en,
  ja,
  zh,
  "zh-TW": zhTW,
  ko,
  hi,
  kn,
  es,
  fr,
  de,
  "pt-BR": ptBR,
  ru,
} satisfies Record<string, Strings>;

export type Lang = keyof typeof LOCALES;

/** 言語の選択肢。どの言語で表示していても、読める人が自分の言語を見つけられるよう自称で書く。 */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: "English",
  ja: "日本語",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  ko: "한국어",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  "pt-BR": "Português (Brasil)",
  ru: "Русский",
};

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALES, value);
}

/**
 * ソースの生の値を正規化した言語タグに落とす（小文字、区切りは "-"）。無ければ null。
 *
 * Obsidian はカスタム翻訳ファイルのパスを言語コードと同じ場所に保存するため、
 * パス区切りを含む値はコードではない（"/Users/jane/ja-custom.json" は日本語ではない）。
 */
export function codeOf(raw: string | null | undefined): string | null {
  if (!raw || raw.includes("/") || raw.includes("\\")) return null;
  return raw.trim().toLowerCase().replace(/_/g, "-") || null;
}

/**
 * 正規化済みのタグを同梱している言語に寄せる。同梱していなければ null。
 *
 * 中国語だけはリージョンと文字体系で分かれる。台湾・香港・マカオと "Hant" は繁体字、
 * それ以外は簡体字。ポルトガル語はブラジル版しか持たないので地域を問わずそこへ寄せる。
 */
export function langOf(code: string): Lang | null {
  const [base, ...rest] = code.split("-");
  if (base === "zh") return rest.some((p) => ["tw", "hk", "mo", "hant"].includes(p)) ? "zh-TW" : "zh";
  if (base === "pt") return "pt-BR";
  return isLang(base) ? base : null;
}

function storedLanguage(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage?.getItem("language") ?? null;
  } catch {
    return null;
  }
}

function navigatorLanguage(): string | null {
  try {
    return typeof navigator === "undefined" ? null : navigator.language || null;
  } catch {
    return null;
  }
}

/**
 * 「自動」が何に解決されるか。
 *
 * `obsidianLanguage` は obsidian モジュールの `getLanguage()`——正統な答え——であり、
 * import ではなく引数で渡す。この module は Node のテストパイロットにも束ねられ、
 * そこには import 元の Obsidian が無いため。
 *
 * `localStorage["language"]` だけを読むのでは足りない。Obsidian はこのキーを
 * 利用者が言語を明示的に選んだときにしか書かず、OS から継承した場合——よくある方——は
 * キーが存在しないままになる。`getLanguage()` はそのキーの読み取りに OS からの
 * フォールバックを足したものである。下位の段は、値が何も渡されなかったときだけ効く。
 */
function resolveAuto(obsidianLanguage?: string | null): Lang {
  // 最初に得られたコードで決める。同梱していない言語なら、下位の段へは落とさず英語にする。
  const code = codeOf(obsidianLanguage) ?? codeOf(storedLanguage()) ?? codeOf(navigatorLanguage());
  return (code && langOf(code)) || "en";
}

/** 利用者が指定した言語、あるいは「Obsidian に従う」。 */
export type LangPref = "auto" | Lang;

/**
 * 現在の文字列。
 *
 * 中身を入れ替える安定したオブジェクトである。`t` を import した各モジュールは
 * 再 import なしに現在の言語を読み続け、文字列を読む約 100 箇所は関数呼び出しを
 * しなくて済む。設定が読み込まれる前にこの module が初期化されるため検出言語で
 * 始まり、読み込まれ次第 `setLanguage` が保存された選択で上書きする。
 */
export const t: Strings = { ...LOCALES[resolveAuto()] };

export function setLanguage(pref: LangPref, obsidianLanguage?: string | null): void {
  const lang: Lang = pref === "auto" ? resolveAuto(obsidianLanguage) : pref;
  Object.assign(t, LOCALES[lang]);
}
