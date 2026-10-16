import { afterNextRender, computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { SAFE_STORAGE } from '../storage/safe-storage';
import { CLOCK, localDay } from '../time/clock';
import {
  emptyProgress,
  MAX_ACTIVITY_DAYS,
  PROGRESS_KEY,
  type ItemKey,
  type Prefs,
  type ProgressState,
} from './progress-model';
import { migrateProgress } from './progress-migrate';
import { serializeExport } from './progress-io';

export const QUIZ_PASS_RATIO = 0.7;

/**
 * The learner's progress, kept in localStorage. Nothing is read during
 * prerendering: the store becomes `ready` only after the first browser render,
 * so prerendered HTML never disagrees with what hydration produces.
 */
@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly storage = inject(SAFE_STORAGE);
  private readonly clock = inject(CLOCK);
  private readonly _state = signal<ProgressState>(emptyProgress());
  private readonly _ready = signal(false);
  /** Stored data came from a newer app version: never overwrite it. */
  private readOnly = false;

  readonly state = this._state.asReadonly();
  readonly ready = this._ready.asReadonly();
  readonly completed = computed(() => this._state().completed);
  readonly quizScores = computed(() => this._state().quizScores);
  readonly drillAttempts = computed(() => this._state().drillAttempts);
  readonly prefs = computed(() => this._state().prefs);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.load();
      this._ready.set(true);
      const onStorage = (event: StorageEvent) => {
        if (event.key === PROGRESS_KEY || event.key === null) this.load();
      };
      window.addEventListener('storage', onStorage);
      destroyRef.onDestroy(() => window.removeEventListener('storage', onStorage));
    });
  }

  isComplete(key: ItemKey): boolean {
    return this._ready() && this._state().completed[key] !== undefined;
  }

  setComplete(key: ItemKey, done: boolean): void {
    this.update((s) => {
      const completed = { ...s.completed };
      if (done) completed[key] ??= this.clock().toISOString();
      else delete completed[key];
      return { ...s, completed };
    }, done);
  }

  recordQuiz(id: string, score: number, total: number): void {
    this.update((s) => {
      const previous = s.quizScores[id];
      const best = Math.max(score, previous?.best ?? 0);
      const next = {
        ...s,
        quizScores: {
          ...s.quizScores,
          [id]: { best, total, lastAttemptAt: this.clock().toISOString() },
        },
      };
      return total > 0 && score / total >= QUIZ_PASS_RATIO
        ? this.withCompleted(next, `exercise:${id}`)
        : next;
    });
  }

  recordDrill(id: string, correct: number, total: number): void {
    this.update((s) => {
      const previous = s.drillAttempts[id];
      const bestCorrect = Math.max(correct, previous?.bestCorrect ?? 0);
      const next = {
        ...s,
        drillAttempts: {
          ...s.drillAttempts,
          [id]: { bestCorrect, total, lastAttemptAt: this.clock().toISOString() },
        },
      };
      return total > 0 && correct === total ? this.withCompleted(next, `exercise:${id}`) : next;
    });
  }

  setPrefs(prefs: Partial<Prefs>): void {
    this.update((s) => ({ ...s, prefs: { ...s.prefs, ...prefs } }), false);
  }

  markAchievementsSeen(ids: readonly string[]): void {
    this.update(
      (s) => ({ ...s, seenAchievements: [...new Set([...s.seenAchievements, ...ids])].sort() }),
      false,
    );
  }

  replaceAll(state: ProgressState): void {
    this.update(() => state, false);
  }

  reset(): void {
    this.update(() => emptyProgress(), false);
  }

  exportJson(): string {
    return serializeExport(this._state(), this.clock());
  }

  private withCompleted(state: ProgressState, key: ItemKey): ProgressState {
    if (state.completed[key]) return state;
    return { ...state, completed: { ...state.completed, [key]: this.clock().toISOString() } };
  }

  /** Applies a change, records today as an activity day when it is learning, and persists. */
  private update(change: (s: ProgressState) => ProgressState, isActivity = true): void {
    let next = change(this._state());
    if (isActivity) {
      const today = localDay(this.clock());
      if (!next.activityDays.includes(today)) {
        next = {
          ...next,
          activityDays: [...next.activityDays, today].sort().slice(-MAX_ACTIVITY_DAYS),
        };
      }
    }
    this._state.set(next);
    if (!this.readOnly) this.storage.set(PROGRESS_KEY, JSON.stringify(next));
  }

  private load(): void {
    let raw: unknown = null;
    const text = this.storage.get(PROGRESS_KEY);
    if (text !== null) {
      try {
        raw = JSON.parse(text);
      } catch {
        raw = null;
      }
    }
    const { state, status } = migrateProgress(raw);
    this.readOnly = status === 'future';
    this._state.set(state);
  }
}
