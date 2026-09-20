/**
 * ローカル固有ファイルの分類（ADR-0006）。`_SyncLocal/local-only.md` を読み書きする。
 *
 * このファイルは人とプラグインの両方が書く。プラグインは全文を上書きせず、行の
 * 追加と、対象でなくなった行の削除だけを行う。利用者が動かした分類と、セクションの
 * 外に書いた記述は必ず残す。
 */

/** 分類。未整理のものはアップロードを止める。 */
export type Section = "unsorted" | "shared" | "trash";

export const SECTIONS: Section[] = ["unsorted", "shared", "trash"];

/**
 * 機械が読む印。見出しの文言は利用者が自由に書き換えてよく、UI が 12 言語あっても
 * 壊れないようにするため、識別はこのコメントで行う。
 */
const MARKER = /<!--\s*gds:(unsorted|shared|trash)\s*-->/;

/** `- [[パス/ファイル.md]]` の行。パス付きで書くのは、同名ファイルを区別するため。 */
const LINK_LINE = /^\s*-\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/;

export interface LocalOnlyDoc {
  /** 分類ごとのパス。 */
  entries: Record<Section, string[]>;
  /** 印の無い見出しの下にあった行。安全側に倒して未整理として扱う。 */
  unmarked: string[];
}

export interface LocalOnlyLabels {
  heading: Record<Section, string>;
  intro: string;
}

/** 読み取り。印のある見出しだけを分類として扱う。 */
export function parseLocalOnly(text: string): LocalOnlyDoc {
  const entries: Record<Section, string[]> = { unsorted: [], shared: [], trash: [] };
  const unmarked: string[] = [];
  let current: Section | null = null;
  let inSection = false;

  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) {
      const marker = MARKER.exec(line);
      current = marker ? (marker[1] as Section) : null;
      inSection = true;
      continue;
    }
    const link = LINK_LINE.exec(line);
    if (!link) continue;
    const path = link[1].trim();
    if (!path) continue;
    if (current) entries[current].push(path);
    else if (inSection) unmarked.push(path);
  }
  return { entries, unmarked };
}

/**
 * 今あるローカル固有ファイルに合わせて更新する。
 *
 * 新しく現れたものは未整理へ。対象でなくなったもの（リモートにも現れた、消えた）は
 * 取り除く。すでに分類されているものは、そのセクションのまま残す。
 */
export function reconcileLocalOnly(doc: LocalOnlyDoc, localOnly: readonly string[]): LocalOnlyDoc {
  const live = new Set(localOnly);
  const kept: Record<Section, string[]> = { unsorted: [], shared: [], trash: [] };
  const seen = new Set<string>();

  for (const section of SECTIONS) {
    for (const path of doc.entries[section]) {
      if (!live.has(path) || seen.has(path)) continue;
      kept[section].push(path);
      seen.add(path);
    }
  }
  // 印の無い見出しの下にあった行も、分類されていないものとして拾い直す。
  for (const path of [...doc.unmarked, ...localOnly]) {
    if (!live.has(path) || seen.has(path)) continue;
    kept.unsorted.push(path);
    seen.add(path);
  }
  return { entries: kept, unmarked: [] };
}

/**
 * ファイルへ書き戻す。
 *
 * 分類されたセクションだけを組み立て直し、その外にある記述には触らない。
 * `previous` を渡すと、その本文のうちセクション外の部分を保つ。
 */
export function renderLocalOnly(doc: LocalOnlyDoc, labels: LocalOnlyLabels, previous?: string): string {
  const preamble = previous === undefined ? `${labels.intro}\n` : preambleOf(previous, labels.intro);
  const body = SECTIONS.map((section) => {
    const lines = doc.entries[section].map((path) => `- [[${path}]]`);
    return `## ${labels.heading[section]} <!-- gds:${section} -->\n\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
  }).join("\n");
  return `${preamble}\n${body}`;
}

/** 最初の見出しより前だけを残す。利用者が書いた前置きを消さないため。 */
function preambleOf(previous: string, fallback: string): string {
  const lines = previous.split(/\r?\n/);
  const firstHeading = lines.findIndex((l) => /^#{1,6}\s/.test(l));
  if (firstHeading < 0) return previous.trim() ? `${previous.trimEnd()}\n` : `${fallback}\n`;
  const head = lines.slice(0, firstHeading).join("\n").trimEnd();
  return head ? `${head}\n` : `${fallback}\n`;
}
