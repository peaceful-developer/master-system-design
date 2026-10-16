import { emptyProgress } from './progress-model';
import { migrateProgress } from './progress-migrate';

describe('migrateProgress', () => {
  it.each([null, undefined, 'x', 42, [], {}, { version: 0 }])(
    'resets unreadable data: %j',
    (raw) => {
      expect(migrateProgress(raw)).toEqual({ state: emptyProgress(), status: 'reset' });
    },
  );

  it('flags data from a newer version without reading it', () => {
    expect(migrateProgress({ version: 9, completed: { 'lesson:a/b': 'x' } })).toEqual({
      state: emptyProgress(),
      status: 'future',
    });
  });

  it('keeps valid v1 entries and drops malformed ones one by one', () => {
    const { state, status } = migrateProgress({
      version: 1,
      completed: {
        'lesson:foundations/indexing': '2026-10-01T10:00:00.000Z',
        'lesson:a': 5,
        'bogus:x': '2026-10-01T10:00:00.000Z',
      },
      quizScores: {
        good: { best: 4, total: 5, lastAttemptAt: '2026-10-01T10:00:00.000Z' },
        bad: { best: 9, total: 5, lastAttemptAt: 'x' },
      },
      drillAttempts: {
        d: { bestCorrect: 2, total: 2, lastAttemptAt: '2026-10-01T10:00:00.000Z' },
        e: 'nope',
      },
      activityDays: ['2026-10-02', '2026-10-01', '2026-10-01', 'yesterday'],
      seenAchievements: ['first-flight', 7],
      prefs: { learnerLevel: 'wizard', calmMode: true },
    });
    expect(status).toBe('ok');
    expect(state.completed).toEqual({ 'lesson:foundations/indexing': '2026-10-01T10:00:00.000Z' });
    expect(Object.keys(state.quizScores)).toEqual(['good']);
    expect(Object.keys(state.drillAttempts)).toEqual(['d']);
    expect(state.activityDays).toEqual(['2026-10-01', '2026-10-02']);
    expect(state.seenAchievements).toEqual(['first-flight']);
    expect(state.prefs).toEqual({ learnerLevel: null, calmMode: true });
  });
});
