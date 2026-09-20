/*
 * ローカル固有ファイルの分類ファイル（ADR-0006）。
 *
 * 人とプラグインが同じファイルを書く。ここで守るのは「利用者が動かした分類と、
 * 自分で書いた記述を、プラグインが壊さないこと」である。
 */
import { describe, expect, it } from "vitest";
import { LocalOnlyLabels, parseLocalOnly, reconcileLocalOnly, renderLocalOnly } from "../../src/sync/localOnly";

const LABELS: LocalOnlyLabels = {
  heading: { unsorted: "未整理", shared: "共有", trash: "削除" },
  intro: "ここはローカルにしかないファイルの一覧です。",
};

const DOC = `ここはローカルにしかないファイルの一覧です。

## 未整理 <!-- gds:unsorted -->

- [[下書き/思いつき.md]]

## 共有 <!-- gds:shared -->

- [[議事録/2026-09-20.md]]

## 削除 <!-- gds:trash -->

- [[古いメモ.md]]
`;

describe("読み取り", () => {
  it("印のある見出しごとに分類を読む", () => {
    const doc = parseLocalOnly(DOC);

    expect(doc.entries.unsorted).toEqual(["下書き/思いつき.md"]);
    expect(doc.entries.shared).toEqual(["議事録/2026-09-20.md"]);
    expect(doc.entries.trash).toEqual(["古いメモ.md"]);
  });

  it("見出しの文言が書き換えられていても、印で読む", () => {
    const doc = parseLocalOnly("## あとで決める <!-- gds:unsorted -->\n\n- [[a.md]]\n");
    expect(doc.entries.unsorted).toEqual(["a.md"]);
  });

  it("印の無い見出しの下は、未整理として扱う（安全側）", () => {
    const doc = parseLocalOnly("## 削除\n\n- [[a.md]]\n");
    expect(doc.entries.trash).toEqual([]);
    expect(doc.unmarked).toEqual(["a.md"]);
  });

  it("表示名つきのリンクからもパスを取る", () => {
    const doc = parseLocalOnly("## x <!-- gds:shared -->\n\n- [[仕事/報告.md|今月の報告]]\n");
    expect(doc.entries.shared).toEqual(["仕事/報告.md"]);
  });

  it("リンクでない行は読まない", () => {
    const doc = parseLocalOnly("## x <!-- gds:shared -->\n\nこれはメモです。\n- ただの箇条書き\n");
    expect(doc.entries.shared).toEqual([]);
  });
});

describe("更新", () => {
  it("新しく現れたファイルは未整理に入る", () => {
    const next = reconcileLocalOnly(parseLocalOnly(DOC), [
      "下書き/思いつき.md",
      "議事録/2026-09-20.md",
      "古いメモ.md",
      "新しい.md",
    ]);

    expect(next.entries.unsorted).toEqual(["下書き/思いつき.md", "新しい.md"]);
  });

  it("利用者が動かした分類は保つ", () => {
    const next = reconcileLocalOnly(parseLocalOnly(DOC), ["議事録/2026-09-20.md"]);
    expect(next.entries.shared).toEqual(["議事録/2026-09-20.md"]);
    expect(next.entries.unsorted).toEqual([]);
  });

  it("対象でなくなったファイルの行は取り除く", () => {
    const next = reconcileLocalOnly(parseLocalOnly(DOC), ["下書き/思いつき.md"]);

    expect(next.entries.shared).toEqual([]);
    expect(next.entries.trash).toEqual([]);
  });

  it("印の無い見出しにあった行も、生きていれば未整理として拾い直す", () => {
    const doc = parseLocalOnly("## 削除\n\n- [[a.md]]\n");
    const next = reconcileLocalOnly(doc, ["a.md"]);

    expect(next.entries.unsorted).toEqual(["a.md"]);
  });

  it("同じパスが二度書かれていても一度しか残さない", () => {
    const doc = parseLocalOnly("## x <!-- gds:shared -->\n\n- [[a.md]]\n- [[a.md]]\n");
    const next = reconcileLocalOnly(doc, ["a.md"]);

    expect(next.entries.shared).toEqual(["a.md"]);
  });
});

describe("書き戻し", () => {
  it("三つのセクションを印つきで書く", () => {
    const text = renderLocalOnly(reconcileLocalOnly(parseLocalOnly(DOC), ["a.md"]), LABELS, DOC);

    expect(text).toContain("## 未整理 <!-- gds:unsorted -->");
    expect(text).toContain("## 共有 <!-- gds:shared -->");
    expect(text).toContain("## 削除 <!-- gds:trash -->");
    expect(text).toContain("- [[a.md]]");
  });

  it("書いたものを読み直すと同じ分類になる", () => {
    const doc = parseLocalOnly(DOC);
    expect(parseLocalOnly(renderLocalOnly(doc, LABELS, DOC)).entries).toEqual(doc.entries);
  });

  it("最初の見出しより前に書かれたメモは残す", () => {
    const withNote = `ここはローカルにしかないファイルの一覧です。\n\n自分用のメモ: 下書きは共有しない。\n\n## 未整理 <!-- gds:unsorted -->\n\n- [[a.md]]\n`;
    const text = renderLocalOnly(reconcileLocalOnly(parseLocalOnly(withNote), ["a.md"]), LABELS, withNote);

    expect(text).toContain("自分用のメモ: 下書きは共有しない。");
  });

  it("元のファイルが無ければ説明文から作る", () => {
    const text = renderLocalOnly({ entries: { unsorted: [], shared: [], trash: [] }, unmarked: [] }, LABELS);
    expect(text).toContain(LABELS.intro);
  });
});
