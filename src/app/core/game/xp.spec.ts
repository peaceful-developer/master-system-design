import { emptyProgress, type ProgressState } from '../progress/progress-model';
import { computeXp, XP_RULES } from './xp';

const META = {
  caseStudies: [
    { slug: 'url-shortener', status: 'complete' as const },
    { slug: 'chat', status: 'outline' as const },
  ],
};

const at = '2026-10-15T09:00:00.000Z';
const withCompleted = (keys: string[], extra: Partial<ProgressState> = {}): ProgressState => ({
  ...emptyProgress(),
  completed: Object.fromEntries(keys.map((k) => [k, at])),
  ...extra,
});

describe('computeXp', () => {
  it('is 0 for a new learner', () => {
    expect(computeXp(emptyProgress(), META)).toBe(0);
  });

  it('gives 20 for a lesson', () => {
    expect(computeXp(withCompleted(['lesson:foundations/indexing']), META)).toBe(20);
  });

  it('gives an exercise 10 plus a 10 bonus when the quiz score is perfect', () => {
    const state = withCompleted(['exercise:indexing-quiz'], {
      quizScores: { 'indexing-quiz': { best: 5, total: 5, lastAttemptAt: at } },
    });
    expect(computeXp(state, META)).toBe(20);
  });

  it('gives no bonus for an imperfect quiz', () => {
    const state = withCompleted(['exercise:indexing-quiz'], {
      quizScores: { 'indexing-quiz': { best: 4, total: 5, lastAttemptAt: at } },
    });
    expect(computeXp(state, META)).toBe(XP_RULES.exercise);
  });

  it('values complete case studies above outlines, and counts playbooks and examples', () => {
    const state = withCompleted([
      'case-study:url-shortener',
      'case-study:chat',
      'playbook:framework',
      'example:cache-aside',
    ]);
    expect(computeXp(state, META)).toBe(40 + 15 + 20 + 10);
  });
});
