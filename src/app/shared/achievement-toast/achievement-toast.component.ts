import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ACHIEVEMENTS, type Achievement } from '../../core/game/achievements';
import { GameStore } from '../../core/game/game.store';
import { ProgressStore } from '../../core/progress/progress.store';
import { IconComponent } from '../icon/icon.component';

const TOAST_MS = 7000;

/**
 * Announces achievements as they are earned, then marks them seen. In Calm
 * mode they are marked seen silently (they are still listed on /progress).
 */
@Component({
  selector: 'app-achievement-toast',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-region" role="status" aria-live="polite">
      @for (a of shown(); track a.id) {
        <div class="toast">
          <span class="toast-badge"><app-icon [name]="a.icon" /></span>
          <div class="flex-1">
            <p class="font-semibold">Achievement unlocked: {{ a.title }}</p>
            <p class="text-sm">{{ a.description }}</p>
          </div>
          <button
            type="button"
            class="toast-close"
            [attr.aria-label]="'Dismiss ' + a.title"
            (click)="dismiss(a.id)"
          >
            <app-icon name="x" size="1em" />
          </button>
        </div>
      }
    </div>
  `,
})
export class AchievementToastComponent {
  private readonly game = inject(GameStore);
  private readonly progress = inject(ProgressStore);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  protected readonly shown = signal<Achievement[]>([]);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
    effect(() => {
      const unseen = this.game.unseen();
      if (unseen.length === 0) return;
      const calm = this.game.calm();
      untracked(() => {
        this.progress.markAchievementsSeen(unseen);
        if (calm) return;
        const fresh = ACHIEVEMENTS.filter((a) => unseen.includes(a.id));
        this.shown.update((list) => [...list, ...fresh]);
        for (const a of fresh) {
          const timer = setTimeout(() => {
            this.timers.delete(timer);
            this.dismiss(a.id);
          }, TOAST_MS);
          this.timers.add(timer);
        }
      });
    });
  }

  protected dismiss(id: string): void {
    this.shown.update((list) => list.filter((a) => a.id !== id));
  }
}
