/**
 * Human "x ago" rendering for the last-synced info shown in settings.
 * PURE display helper — never used in any sync / delete decision (correctness
 * comes from the three-way-merge baseline, not from wall-clock time).
 */

/**
 * The words a language uses for each bucket. Passed in rather than looked up
 * here so this module stays free of any UI/i18n dependency (and so the unit
 * test can exercise the bucket boundaries without a language at all).
 */
export interface RelativeTimeWords {
  justNow: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;
}

const EN: RelativeTimeWords = {
  justNow: "just now",
  minutes: (n) => `${n} minute${n === 1 ? "" : "s"} ago`,
  hours: (n) => `${n} hour${n === 1 ? "" : "s"} ago`,
  days: (n) => `${n} day${n === 1 ? "" : "s"} ago`,
};

export function relativeTime(then: number, now: number, w: RelativeTimeWords = EN): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 45) return w.justNow;
  const m = Math.round(s / 60);
  if (m < 60) return w.minutes(m);
  const h = Math.round(m / 60);
  if (h < 24) return w.hours(h);
  return w.days(Math.round(h / 24));
}
