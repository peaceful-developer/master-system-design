import { computeStreak } from './streak';

describe('computeStreak', () => {
  it('is zero with no activity', () => {
    expect(computeStreak([], '2026-10-15')).toEqual({ current: 0, longest: 0 });
  });

  it('stays alive when the last active day was yesterday', () => {
    expect(computeStreak(['2026-10-13', '2026-10-14'], '2026-10-15')).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('counts today', () => {
    expect(computeStreak(['2026-10-14', '2026-10-15'], '2026-10-15').current).toBe(2);
  });

  it('breaks after a full missed day', () => {
    expect(computeStreak(['2026-10-12', '2026-10-13'], '2026-10-15')).toEqual({
      current: 0,
      longest: 2,
    });
  });

  it('keeps the longest run across a gap', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-15'];
    expect(computeStreak(days, '2026-10-15')).toEqual({ current: 1, longest: 3 });
  });

  it('tolerates duplicates and unsorted input', () => {
    const days = ['2026-10-15', '2026-10-14', '2026-10-15', '2026-10-13', '2026-10-14'];
    expect(computeStreak(days, '2026-10-15')).toEqual({ current: 3, longest: 3 });
  });

  it('crosses month boundaries', () => {
    expect(computeStreak(['2026-09-30', '2026-10-01'], '2026-10-01').current).toBe(2);
  });

  it('ignores days after today', () => {
    expect(computeStreak(['2026-10-15', '2026-10-20'], '2026-10-15').current).toBe(1);
  });
});
