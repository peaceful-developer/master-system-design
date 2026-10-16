import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  PendingTasks,
  signal,
} from '@angular/core';
import type { CaseStudyStatus, PhaseId, Track } from '@content/types';
import type { ItemKey } from '../progress/progress-model';
import { ProgressStore } from '../progress/progress.store';
import { CLOCK, localDay } from '../time/clock';
import { earnedAchievements, newAchievements } from './achievements';
import { levelFor } from './levels';
import { computeStreak } from './streak';
import { computeXp } from './xp';

interface GameMeta {
  lessonsByPhase: ReadonlyMap<PhaseId, readonly ItemKey[]>;
  caseStudies: readonly { slug: string; track: Track; status: CaseStudyStatus }[];
}

const NO_STREAK = { current: 0, longest: 0 };

/**
 * XP, level, streak and achievements, all derived from ProgressStore. Nothing
 * is computed until progress has loaded in the browser, so prerendered HTML
 * never contains game state. Content metadata is imported lazily to keep the
 * manifest out of the initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly progress = inject(ProgressStore);
  private readonly clock = inject(CLOCK);
  private readonly injector = inject(Injector);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly meta = signal<GameMeta | null>(null);
  private loading = false;
  private destroyed = false;

  /** True once progress and content metadata are both available. */
  readonly active = computed(() => this.progress.ready() && this.meta() !== null);
  readonly calm = computed(() => this.progress.ready() && this.progress.prefs().calmMode);

  readonly xp = computed(() => {
    const meta = this.meta();
    return this.active() && meta ? computeXp(this.progress.state(), meta) : 0;
  });
  readonly level = computed(() => levelFor(this.xp()));
  readonly streak = computed(() =>
    this.progress.ready()
      ? computeStreak(this.progress.state().activityDays, localDay(this.clock()))
      : NO_STREAK,
  );
  readonly earned = computed(() => {
    const meta = this.meta();
    if (!this.active() || !meta) return [];
    const state = this.progress.state();
    return earnedAchievements({
      completed: new Set(Object.keys(state.completed) as ItemKey[]),
      quizScores: state.quizScores,
      drillAttempts: state.drillAttempts,
      lessonsByPhase: meta.lessonsByPhase,
      caseStudies: meta.caseStudies,
      streak: this.streak(),
    });
  });
  readonly unseen = computed(() =>
    newAchievements(this.earned(), this.progress.state().seenAchievements),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
    effect(() => {
      if (this.progress.ready() && !this.loading) {
        this.loading = true;
        void this.loadMeta();
      }
    });
  }

  private async loadMeta(): Promise<void> {
    const done = this.pendingTasks.add();
    try {
      const { ContentService } = await import('../content/content.service');
      // The app (or a test) may have been torn down while the chunk loaded.
      if (this.destroyed) return;
      const content = this.injector.get(ContentService);
      const lessonsByPhase = new Map<PhaseId, ItemKey[]>();
      for (const l of content.lessons()) {
        const keys = lessonsByPhase.get(l.phase) ?? [];
        keys.push(`lesson:${l.phase}/${l.slug}`);
        lessonsByPhase.set(l.phase, keys);
      }
      this.meta.set({
        lessonsByPhase,
        caseStudies: content
          .caseStudies()
          .map((c) => ({ slug: c.slug, track: c.track, status: c.status })),
      });
    } finally {
      done();
    }
  }
}
