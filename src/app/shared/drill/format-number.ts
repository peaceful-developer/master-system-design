const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });
const grouped = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

/** 1.2M, 350K, 4.5B, 0.25 */
export function formatCompact(n: number): string {
  return compact.format(n);
}

/** 2,315 — and 86,400 (86.4K) for large numbers, so both forms are visible. */
export function formatValue(n: number): string {
  const full = grouped.format(n);
  return Math.abs(n) >= 10_000 ? `${full} (${formatCompact(n)})` : full;
}
