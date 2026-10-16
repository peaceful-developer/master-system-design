export type ItemKind = 'lesson' | 'case-study' | 'playbook' | 'example' | 'exercise';

/** `lesson:<phase>/<slug>`, `case-study:<slug>`, `exercise:<id>`, … */
export type ItemKey = `${ItemKind}:${string}`;

export const ITEM_KEY_RE =
  /^(lesson|case-study|playbook|example|exercise):[a-z0-9-]+(\/[a-z0-9-]+)?$/;

export type LearnerLevel = 'new' | 'some' | 'expert';

export interface Prefs {
  learnerLevel: LearnerLevel | null;
  calmMode: boolean;
}

export interface QuizScore {
  best: number;
  total: number;
  lastAttemptAt: string;
}

export interface DrillAttempt {
  bestCorrect: number;
  total: number;
  lastAttemptAt: string;
}

export interface ProgressState {
  version: 1;
  /** Completed item → ISO timestamp of completion. */
  completed: Partial<Record<ItemKey, string>>;
  quizScores: Record<string, QuizScore>;
  drillAttempts: Record<string, DrillAttempt>;
  /** Local `YYYY-MM-DD` days with any learning activity, sorted, at most 400. */
  activityDays: string[];
  seenAchievements: string[];
  prefs: Prefs;
  /** Reserved for saved canvas designs (Phase 2). */
  savedDesigns: Record<string, never>;
}

export const PROGRESS_VERSION = 1;
export const PROGRESS_KEY = 'sdl.progress';
export const MAX_ACTIVITY_DAYS = 400;

export function emptyProgress(): ProgressState {
  return {
    version: 1,
    completed: {},
    quizScores: {},
    drillAttempts: {},
    activityDays: [],
    seenAchievements: [],
    prefs: { learnerLevel: null, calmMode: false },
    savedDesigns: {},
  };
}
