import { MASCOT_LINES, mascotLine } from './mascot-lines';

describe('mascotLine', () => {
  it('has lines for every situation', () => {
    for (const situation of [
      'correct',
      'incorrect',
      'hint',
      'perfect',
      'levelUp',
      'streak',
    ] as const) {
      expect(MASCOT_LINES[situation].length).toBeGreaterThan(1);
    }
  });

  it('picks the same line for the same key, so prerendering and tests stay stable', () => {
    expect(mascotLine('correct', 'caching-quiz')).toBe(mascotLine('correct', 'caching-quiz'));
    expect(MASCOT_LINES.correct).toContain(mascotLine('correct', 'caching-quiz'));
  });

  it('varies across keys', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(new Set(keys.map((k) => mascotLine('incorrect', k))).size).toBeGreaterThan(1);
  });
});
