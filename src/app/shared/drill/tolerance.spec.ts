import { checkAnswer, describeTolerance } from './tolerance';

describe('checkAnswer', () => {
  it('relative: accepts within ±25% of the expected value', () => {
    const tol = { kind: 'relative', value: 0.25 } as const;
    expect(checkAnswer(1250, 1000, tol).correct).toBe(true);
    expect(checkAnswer(750, 1000, tol).correct).toBe(true);
    expect(checkAnswer(1251, 1000, tol).correct).toBe(false);
    expect(checkAnswer(1180, 1000, tol).deltaPct).toBeCloseTo(18, 5);
  });

  it('relative: an expected value of 0 needs an answer of 0', () => {
    const tol = { kind: 'relative', value: 0.25 } as const;
    expect(checkAnswer(0, 0, tol)).toEqual({ correct: true, deltaPct: null });
    expect(checkAnswer(0.1, 0, tol).correct).toBe(false);
  });

  it('defaults to ±25%', () => {
    expect(checkAnswer(1240, 1000).correct).toBe(true);
    expect(checkAnswer(1260, 1000).correct).toBe(false);
  });

  it('order of magnitude: within about 3.16× either way', () => {
    const tol = { kind: 'orderOfMagnitude' } as const;
    expect(checkAnswer(3162, 1000, tol).correct).toBe(true);
    expect(checkAnswer(3200, 1000, tol).correct).toBe(false);
    expect(checkAnswer(317, 1000, tol).correct).toBe(true);
    expect(checkAnswer(300, 1000, tol).correct).toBe(false);
    expect(checkAnswer(-1000, 1000, tol).correct).toBe(false);
    expect(checkAnswer(0, 1000, tol).correct).toBe(false);
  });

  it('absolute: within a fixed distance', () => {
    const tol = { kind: 'absolute', value: 5 } as const;
    expect(checkAnswer(105, 100, tol).correct).toBe(true);
    expect(checkAnswer(106, 100, tol).correct).toBe(false);
  });
});

describe('describeTolerance', () => {
  it('explains each kind in words', () => {
    expect(describeTolerance({ kind: 'relative', value: 0.25 }, 'req/s')).toBe('within ±25%');
    expect(describeTolerance({ kind: 'absolute', value: 5 }, 'ms')).toBe('within ±5 ms');
    expect(describeTolerance({ kind: 'orderOfMagnitude' }, 'GB')).toBe(
      'in the right order of magnitude (within about 3× either way)',
    );
  });
});
