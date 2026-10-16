import { InjectionToken } from '@angular/core';

/** The current time; replaced in tests. */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

/** Local calendar day as `YYYY-MM-DD` (streaks follow the learner's own days). */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
