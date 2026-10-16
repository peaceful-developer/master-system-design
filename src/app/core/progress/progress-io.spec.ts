import { emptyProgress, type ProgressState } from './progress-model';
import { parseImport, serializeExport } from './progress-io';

const sample = (): ProgressState => ({
  ...emptyProgress(),
  completed: { 'lesson:foundations/indexing': '2026-10-01T10:00:00.000Z' },
  quizScores: { q: { best: 3, total: 4, lastAttemptAt: '2026-10-01T10:00:00.000Z' } },
  activityDays: ['2026-10-01'],
  prefs: { learnerLevel: 'some', calmMode: false },
});

describe('progress export and import', () => {
  it('round-trips an export', () => {
    const text = serializeExport(sample(), new Date('2026-10-15T09:00:00.000Z'));
    expect(JSON.parse(text)).toMatchObject({
      app: 'system-design-lab',
      exportedAt: '2026-10-15T09:00:00.000Z',
    });
    expect(parseImport(text)).toEqual({ ok: true, state: sample() });
  });

  it.each([
    ['a file over 1 MB', 'x'.repeat(1_000_001), /larger than 1 MB/],
    ['text that is not JSON', '{nope', /not a valid JSON file/],
    [
      'a file from another app',
      JSON.stringify({ app: 'other', progress: sample() }),
      /not a System Design Lab progress export/,
    ],
    [
      'a file from a newer version',
      JSON.stringify({ app: 'system-design-lab', progress: { ...sample(), version: 3 } }),
      /newer version/,
    ],
    [
      'damaged progress data',
      JSON.stringify({ app: 'system-design-lab', progress: 'garbage' }),
      /damaged or in an unknown format/,
    ],
  ])('rejects %s with a readable message', (_name, text, message) => {
    const result = parseImport(text);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toMatch(message);
  });
});
