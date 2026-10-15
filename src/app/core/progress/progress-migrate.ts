import {
  emptyProgress,
  ITEM_KEY_RE,
  MAX_ACTIVITY_DAYS,
  PROGRESS_VERSION,
  type DrillAttempt,
  type ItemKey,
  type LearnerLevel,
  type ProgressState,
  type QuizScore,
} from './progress-model';

export interface MigrationResult {
  state: ProgressState;
  /** ok: read successfully · reset: unreadable, start fresh · future: written by a newer app, do not overwrite */
  status: 'ok' | 'reset' | 'future';
}

type Raw = Record<string, unknown>;

/** Upgrades older stored shapes, one version at a time. Add `n: (v_n) => v_n+1` here. */
const MIGRATIONS: Record<number, (state: Raw) => Raw> = {};

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LEVELS: readonly LearnerLevel[] = ['new', 'some', 'expert'];

function entries<T>(value: unknown, keep: (key: string, v: unknown) => v is T): Record<string, T> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([k, v]) => keep(k, v))) as Record<
    string,
    T
  >;
}

function sanitizeV1(raw: Raw): ProgressState {
  const state = emptyProgress();
  state.completed = entries(
    raw['completed'],
    (k, v): v is string => ITEM_KEY_RE.test(k) && typeof v === 'string',
  ) as Partial<Record<ItemKey, string>>;
  state.quizScores = entries(
    raw['quizScores'],
    (_k, v): v is QuizScore =>
      isRecord(v) &&
      isCount(v['best']) &&
      isCount(v['total']) &&
      v['total'] > 0 &&
      v['best'] <= v['total'] &&
      typeof v['lastAttemptAt'] === 'string',
  );
  state.drillAttempts = entries(
    raw['drillAttempts'],
    (_k, v): v is DrillAttempt =>
      isRecord(v) &&
      isCount(v['bestCorrect']) &&
      isCount(v['total']) &&
      v['total'] > 0 &&
      v['bestCorrect'] <= v['total'] &&
      typeof v['lastAttemptAt'] === 'string',
  );
  const days = Array.isArray(raw['activityDays']) ? raw['activityDays'] : [];
  state.activityDays = [
    ...new Set(days.filter((d): d is string => typeof d === 'string' && DAY_RE.test(d))),
  ]
    .sort()
    .slice(-MAX_ACTIVITY_DAYS);
  const seen = Array.isArray(raw['seenAchievements']) ? raw['seenAchievements'] : [];
  state.seenAchievements = [
    ...new Set(seen.filter((s): s is string => typeof s === 'string')),
  ].sort();
  const prefs = isRecord(raw['prefs']) ? raw['prefs'] : {};
  state.prefs = {
    learnerLevel: LEVELS.includes(prefs['learnerLevel'] as LearnerLevel)
      ? (prefs['learnerLevel'] as LearnerLevel)
      : null,
    calmMode: prefs['calmMode'] === true,
  };
  return state;
}

/** Reads any stored or imported value into the current shape without ever throwing. */
export function migrateProgress(raw: unknown): MigrationResult {
  if (!isRecord(raw) || typeof raw['version'] !== 'number') {
    return { state: emptyProgress(), status: 'reset' };
  }
  if (raw['version'] > PROGRESS_VERSION) return { state: emptyProgress(), status: 'future' };

  let current: Raw = raw;
  for (let v = raw['version']; v < PROGRESS_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return { state: emptyProgress(), status: 'reset' };
    current = step(current);
  }
  return { state: sanitizeV1(current), status: 'ok' };
}
