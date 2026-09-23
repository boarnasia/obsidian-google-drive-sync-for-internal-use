import { TEAM_IGNORE_PATH, VERSION_PATH } from "./configFiles";

/**
 * 除外規則（ADR-0006, ADR-0007）。`.gitignore` の部分集合を、`.tds-ignore` から読む。
 *
 * 除外は「同期の対象外にする」であって「削除する」ではない。すでに同期されている
 * ファイルが後から規則に載っても、ローカルもリモートも消さず、ベースラインから
 * 外すだけにする。共有される設定ファイルに一行足しただけで全員のリモートから
 * ファイルが消える、という挙動を避けるためである。
 */

/**
 * 常に同期しないパス。利用者の規則では上書きできない。`.tds-version` は同期の前に
 * Drive を直接読み書きする。普通のファイルとして扱うと、古い版の手元の写しが
 * 新しい版の目印を上書きしうる。
 */
export const ALWAYS_IGNORED = [VERSION_PATH];

/** 除外できないパス。ここを外すとチームのルールが配られなくなる。 */
export const NEVER_IGNORED = [TEAM_IGNORE_PATH];

interface Rule {
  test: RegExp;
  /** `!` で始まる打ち消しの規則。 */
  negate: boolean;
  /** 末尾が `/` の規則。フォルダにだけ一致する。 */
  dirOnly: boolean;
}

/**
 * 行の集まりから規則を組み立てる。
 *
 * `#` で始まる行はコメント。空行は無視する。
 */
export function parseIgnore(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const rule = compile(line);
    if (rule) rules.push(rule);
  }
  return rules;
}

function compile(pattern: string): Rule | null {
  let p = pattern;
  const negate = p.startsWith("!");
  if (negate) p = p.slice(1);
  const dirOnly = p.endsWith("/");
  if (dirOnly) p = p.slice(0, -1);
  // 先頭の `/` は同期ルート固定。パスの途中に `/` があるものも、同じく固定として扱う。
  const anchored = p.startsWith("/") || p.slice(0, -1).includes("/");
  if (p.startsWith("/")) p = p.slice(1);
  if (!p) return null;
  return { test: new RegExp(`^${anchored ? "" : "(?:.*/)?"}${globToRegex(p)}$`), negate, dirOnly };
}

/** `*` は `/` を跨がない、`**` は跨ぐ、`?` は 1 文字（`/` を除く）。 */
function globToRegex(glob: string): string {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // `**/` は「0 階層以上」。単体の `**` は何にでも一致する。
        if (glob[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
      continue;
    }
    if (c === "?") {
      out += "[^/]";
      continue;
    }
    out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return out;
}

/**
 * 同期ルート相対のパスを、除外するかどうか。
 *
 * 後の規則ほど強い。上の階層のフォルダから順に判定し、除外されたフォルダがあれば
 * その下はすべて除外する。`.gitignore` と同じく、除外したフォルダの中身を `!` で
 * 戻すことはできない。
 */
export function isIgnored(path: string, rules: Rule[]): boolean {
  if (NEVER_IGNORED.includes(path)) return false;
  for (const always of ALWAYS_IGNORED) {
    if (path === always || path.startsWith(`${always}/`)) return true;
  }

  const segments = path.split("/");
  for (let i = 0; i < segments.length; i++) {
    const current = segments.slice(0, i + 1).join("/");
    const isDir = i < segments.length - 1;
    let ignored = false;
    for (const rule of rules) {
      if (rule.dirOnly && !isDir) continue;
      if (rule.test.test(current)) ignored = !rule.negate;
    }
    if (ignored) return true;
  }
  return false;
}

/** 規則をひとつの判定関数にまとめる。規則のファイルが無ければ、何も除外しない。 */
export function ignoreMatcher(text: string | null | undefined): (path: string) => boolean {
  const rules = text ? parseIgnore(text) : [];
  return (path) => isIgnored(path, rules);
}
