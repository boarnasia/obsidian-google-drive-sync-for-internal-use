import { CloneProgress } from "../sync/types";

/** 人が読むバイト数。1024 刻み、小数は 1 桁まで。 */
export function formatBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/**
 * 残り時間の見積もり。
 *
 * 直近の窓の中の転送速度だけを使う。最初からの平均にすると、一覧の取得や
 * 速度の変化を引きずって、終盤でも見積もりが動かない。
 */
export class RateEstimator {
  private samples: { at: number; bytes: number }[] = [];

  /**
   * @param windowMs 速度を測る窓の幅。
   * @param minSpanMs 見積もりを出すのに要る観測の幅。短いと、最初の数件で大きく外れる。
   */
  constructor(
    private readonly windowMs = 10_000,
    private readonly minSpanMs = 2_000
  ) {}

  add(at: number, bytes: number): void {
    this.samples.push({ at, bytes });
    while (this.samples.length > 2 && this.samples[1].at <= at - this.windowMs) this.samples.shift();
  }

  /** 残りのミリ秒。まだ見積もれなければ null。 */
  remainingMs(bytesTotal: number): number | null {
    if (this.samples.length < 2) return null;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const span = last.at - first.at;
    const moved = last.bytes - first.bytes;
    if (span < this.minSpanMs || moved <= 0) return null;
    return ((bytesTotal - last.bytes) / moved) * span;
  }
}

/** ダウンロードの割合（0〜100）。バイト数で測る。中身の無いファイルばかりなら件数で測る。 */
export function percentOf(p: Extract<CloneProgress, { phase: "download" }>): number {
  const ratio = p.bytesTotal > 0 ? p.bytesDone / p.bytesTotal : p.total > 0 ? p.done / p.total : 1;
  return Math.floor(Math.min(1, ratio) * 100);
}
