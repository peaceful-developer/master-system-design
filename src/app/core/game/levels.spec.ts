import { LEVELS, levelFor } from './levels';

describe('levelFor', () => {
  it('starts at Egg with progress toward Hatchling', () => {
    const r = levelFor(0);
    expect(r.level.name).toBe('Egg');
    expect(r.next?.name).toBe('Hatchling');
    expect(r.progressToNext).toBe(0);
  });

  it('reaches Fledgling at exactly 150 XP', () => {
    expect(levelFor(150).level.name).toBe('Fledgling');
    expect(levelFor(149).level.name).toBe('Hatchling');
  });

  it('reports progress within a level', () => {
    expect(levelFor(225).progressToNext).toBeCloseTo(0.5);
  });

  it('tops out at Principal Parrot with no next level', () => {
    const r = levelFor(5000);
    expect(r.level.name).toBe('Principal Parrot');
    expect(r.next).toBeUndefined();
    expect(r.progressToNext).toBe(1);
  });

  it('has eight increasing levels', () => {
    expect(LEVELS.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(LEVELS.every((l, i) => i === 0 || l.min > LEVELS[i - 1]!.min)).toBe(true);
  });
});
