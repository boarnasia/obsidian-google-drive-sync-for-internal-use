/**
 * `x.y.z` の大小。a が新しければ正、古ければ負、同じなら 0。
 *
 * 足りない桁は 0、`-` 以降（プレリリース）は見ない。数字として読めない版は
 * 比べようがないので null を返し、呼び出し側に扱いを決めさせる。
 */
export function compareVersions(a: string, b: string): number | null {
  const pa = parts(a);
  const pb = parts(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function parts(v: string): number[] | null {
  const core = v.trim().split("-")[0];
  if (!/^\d+(\.\d+)*$/.test(core)) return null;
  return core.split(".").map(Number);
}
