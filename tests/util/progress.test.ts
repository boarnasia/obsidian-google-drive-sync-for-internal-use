/*
 * 取り込みの進み具合の表示に使う計算。同期の判断には効かない。
 */
import { describe, expect, it } from "vitest";
import { RateEstimator, formatBytes, percentOf } from "../../src/util/progress";

describe("formatBytes", () => {
  it("1024 刻みで単位を上げる", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(705 * 1024 * 1024)).toBe("705 MB");
  });
});

describe("percentOf", () => {
  const p = (over: object) => ({ phase: "download" as const, done: 0, total: 0, bytesDone: 0, bytesTotal: 0, failed: 0, current: "", ...over });

  it("バイト数で測る（件数ではない）", () => {
    expect(percentOf(p({ done: 9, total: 10, bytesDone: 10, bytesTotal: 100 }))).toBe(10);
  });

  it("中身の無いファイルばかりなら件数で測る", () => {
    expect(percentOf(p({ done: 1, total: 4 }))).toBe(25);
  });

  it("何も無ければ 100", () => {
    expect(percentOf(p({}))).toBe(100);
  });
});

describe("RateEstimator", () => {
  it("観測の幅が短いうちは見積もらない", () => {
    const r = new RateEstimator();
    r.add(0, 0);
    r.add(1000, 100);
    expect(r.remainingMs(1000)).toBeNull();
  });

  it("直近の速度から残り時間を出す", () => {
    const r = new RateEstimator();
    r.add(0, 0);
    r.add(2000, 200); // 100 B/s
    expect(r.remainingMs(1000)).toBe(8000);
  });

  it("窓より古い観測は使わない（速度の変化に追いつく）", () => {
    const r = new RateEstimator(10_000);
    r.add(0, 0);
    r.add(10_000, 100); // 最初は遅い
    r.add(20_000, 10_100); // 今は 1000 B/s
    expect(r.remainingMs(20_100)).toBe(10_000);
  });
});
