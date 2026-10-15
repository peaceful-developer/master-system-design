import type { Tolerance } from '@content/types';

export const DEFAULT_TOLERANCE: Tolerance = { kind: 'relative', value: 0.25 };
/** "Same order of magnitude" = within half a decade, about 3.16× either way (decision D12). */
const MAGNITUDE_WINDOW = 0.5;
const EPSILON = 1e-9;

export interface AnswerCheck {
  correct: boolean;
  /** How far off, in percent of the expected value (positive = too high); null when expected is 0. */
  deltaPct: number | null;
}

export function checkAnswer(
  answer: number,
  expected: number,
  tolerance: Tolerance = DEFAULT_TOLERANCE,
): AnswerCheck {
  const deltaPct = expected !== 0 ? ((answer - expected) / Math.abs(expected)) * 100 : null;
  let correct: boolean;
  switch (tolerance.kind) {
    case 'relative':
      correct =
        expected === 0
          ? Math.abs(answer) <= EPSILON
          : Math.abs(answer - expected) <= tolerance.value * Math.abs(expected) + EPSILON;
      break;
    case 'absolute':
      correct = Math.abs(answer - expected) <= tolerance.value + EPSILON;
      break;
    case 'orderOfMagnitude':
      correct =
        answer > 0 && expected > 0 && Math.abs(Math.log10(answer / expected)) <= MAGNITUDE_WINDOW;
      break;
  }
  return { correct, deltaPct };
}

export function describeTolerance(tolerance: Tolerance, unit: string): string {
  switch (tolerance.kind) {
    case 'relative':
      return `within ±${Math.round(tolerance.value * 100)}%`;
    case 'absolute':
      return `within ±${tolerance.value} ${unit}`;
    case 'orderOfMagnitude':
      return 'in the right order of magnitude (within about 3× either way)';
  }
}
