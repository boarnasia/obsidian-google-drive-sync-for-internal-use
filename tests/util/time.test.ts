/*
 * relativeTime() — 同期管理サイドバーの「最終同期」「最終計算時刻」の表示。純粋な表示用ヘルパであり、
 * 同期や削除の判断には一切効かない（正しさはベースラインが担う）。
 */
import { describe, expect, it } from "vitest";
import { RelativeTimeWords, relativeTime } from "../../src/util/time";

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;
const NOW = 1_000_000_000_000;

const ago = (delta: number, words?: RelativeTimeWords): string => relativeTime(NOW - delta, NOW, words);

describe("relativeTime（既定の英語）", () => {
  it.each([
    [0, "just now"],
    [10 * S, "just now"],
    [44 * S, "just now"],
    [1 * M, "1 minute ago"],
    [5 * M, "5 minutes ago"],
    [1 * H, "1 hour ago"],
    [3 * H, "3 hours ago"],
    [1 * D, "1 day ago"],
    [2 * D, "2 days ago"],
  ])("%i ms 前 → %s", (delta, expected) => {
    expect(ago(delta)).toBe(expected);
  });

  it("バケットの境目で単位が切り替わる", () => {
    expect(ago(45 * S)).toBe("1 minute ago");
    expect(ago(59 * M + 30 * S)).toBe("1 hour ago");
    expect(ago(23 * H + 40 * M)).toBe("1 day ago");
  });

  it("丸めを重ねて繰り上げない（各単位を経過時間から直接丸める）", () => {
    expect(ago(1 * H + 29 * M + 30 * S)).toBe("1 hour ago"); // 1.49 時間
    expect(ago(1 * D + 11 * H + 40 * M)).toBe("1 day ago"); // 1.49 日
  });

  it("未来の時刻でも負の数を出さない", () => {
    expect(relativeTime(NOW + 10 * M, NOW)).toBe("just now");
  });
});

describe("relativeTime（語を差し替える）", () => {
  const ja: RelativeTimeWords = {
    justNow: "たった今",
    minutes: (n) => `${n} 分前`,
    hours: (n) => `${n} 時間前`,
    days: (n) => `${n} 日前`,
  };

  it("渡した語だけを使う（モジュールは i18n に依存しない）", () => {
    expect(ago(10 * S, ja)).toBe("たった今");
    expect(ago(5 * M, ja)).toBe("5 分前");
    expect(ago(3 * H, ja)).toBe("3 時間前");
    expect(ago(2 * D, ja)).toBe("2 日前");
  });
});
