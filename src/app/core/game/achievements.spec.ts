import type { ItemKey } from '../progress/progress-model';
import {
  ACHIEVEMENTS,
  earnedAchievements,
  newAchievements,
  type AchievementContext,
} from './achievements';

const at = '2026-10-15T09:00:00.000Z';
const perfect = { best: 5, total: 5, lastAttemptAt: at };
const imperfect = { best: 3, total: 5, lastAttemptAt: at };
const allRight = { bestCorrect: 3, total: 3, lastAttemptAt: at };

function ctx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    completed: new Set<ItemKey>(),
    quizScores: {},
    drillAttempts: {},
    lessonsByPhase: new Map([
      ['foundations', ['lesson:foundations/a', 'lesson:foundations/b'] as ItemKey[]],
      ['building-blocks', ['lesson:building-blocks/c'] as ItemKey[]],
    ]),
    caseStudies: [
      { slug: 'url-shortener', track: 'A', status: 'complete' },
      { slug: 'recsys', track: 'B', status: 'complete' },
      { slug: 'rag', track: 'C', status: 'complete' },
      { slug: 'chat', track: 'A', status: 'outline' },
    ],
    streak: { current: 0, longest: 0 },
    ...overrides,
  };
}

const done = (...keys: string[]) => new Set(keys as ItemKey[]);
const earned = (id: string, c: AchievementContext) =>
  ACHIEVEMENTS.find((a) => a.id === id)!.earned(c);

describe('ACHIEVEMENTS', () => {
  it('has the twelve planned achievements with titles, descriptions and icons', () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      'first-flight',
      'foundations-done',
      'building-blocks-done',
      'first-case-study',
      'track-a-explorer',
      'track-b-explorer',
      'track-c-explorer',
      'perfect-quiz',
      'five-perfect-quizzes',
      'estimator',
      'streak-3',
      'streak-7',
    ]);
    for (const a of ACHIEVEMENTS) {
      expect(a.title && a.description && a.icon).toBeTruthy();
    }
  });

  it.each([
    ['first-flight', ctx({ completed: done('lesson:foundations/a') }), ctx()],
    [
      'foundations-done',
      ctx({ completed: done('lesson:foundations/a', 'lesson:foundations/b') }),
      ctx({ completed: done('lesson:foundations/a') }),
    ],
    [
      'building-blocks-done',
      ctx({ completed: done('lesson:building-blocks/c') }),
      ctx({ completed: done('lesson:foundations/a') }),
    ],
    [
      'first-case-study',
      ctx({ completed: done('case-study:chat') }),
      ctx({ completed: done('lesson:foundations/a') }),
    ],
    [
      'track-a-explorer',
      ctx({ completed: done('case-study:url-shortener') }),
      ctx({ completed: done('case-study:chat') }), // an outline doesn't count
    ],
    [
      'track-b-explorer',
      ctx({ completed: done('case-study:recsys') }),
      ctx({ completed: done('case-study:url-shortener') }),
    ],
    [
      'track-c-explorer',
      ctx({ completed: done('case-study:rag') }),
      ctx({ completed: done('case-study:recsys') }),
    ],
    ['perfect-quiz', ctx({ quizScores: { q1: perfect } }), ctx({ quizScores: { q1: imperfect } })],
    [
      'five-perfect-quizzes',
      ctx({ quizScores: { q1: perfect, q2: perfect, q3: perfect, q4: perfect, q5: perfect } }),
      ctx({ quizScores: { q1: perfect, q2: perfect, q3: perfect, q4: perfect, q5: imperfect } }),
    ],
    [
      'estimator',
      ctx({ drillAttempts: { d1: allRight, d2: allRight, d3: allRight } }),
      ctx({ drillAttempts: { d1: allRight, d2: allRight, d3: { ...allRight, bestCorrect: 2 } } }),
    ],
    [
      'streak-3',
      ctx({ streak: { current: 0, longest: 3 } }),
      ctx({ streak: { current: 2, longest: 2 } }),
    ],
    [
      'streak-7',
      ctx({ streak: { current: 7, longest: 7 } }),
      ctx({ streak: { current: 6, longest: 6 } }),
    ],
  ])('%s: earned in the positive case only', (id, yes, no) => {
    expect(earned(id, yes)).toBe(true);
    expect(earned(id, no)).toBe(false);
  });

  it('never awards a phase badge for a phase with no lessons', () => {
    const empty = ctx({ lessonsByPhase: new Map() });
    expect(earned('foundations-done', empty)).toBe(false);
  });
});

describe('earnedAchievements / newAchievements', () => {
  it('lists earned ids in catalogue order', () => {
    const c = ctx({
      completed: done('lesson:foundations/a'),
      quizScores: { q1: perfect },
    });
    expect(earnedAchievements(c)).toEqual(['first-flight', 'perfect-quiz']);
  });

  it('returns only achievements not yet seen', () => {
    expect(newAchievements(['first-flight', 'perfect-quiz'], ['first-flight'])).toEqual([
      'perfect-quiz',
    ]);
    expect(newAchievements(['first-flight'], ['first-flight'])).toEqual([]);
  });
});
