const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` → days since the epoch (calendar arithmetic, no time zones). */
function dayNumber(day: string): number | null {
  const m = DAY_RE.exec(day);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

/**
 * Consecutive active days. The current streak ends today or yesterday: it
 * isn't broken until a whole day passes with no learning.
 */
export function computeStreak(
  days: readonly string[],
  today: string,
): { current: number; longest: number } {
  const todayN = dayNumber(today);
  if (todayN === null) return { current: 0, longest: 0 };
  const sorted = [...new Set(days.map(dayNumber))]
    .filter((d): d is number => d !== null && d <= todayN)
    .sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    run = previous !== undefined && sorted[i]! - previous === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const last = sorted.at(-1);
  const current = last !== undefined && todayN - last <= 1 ? run : 0;
  return { current, longest };
}
