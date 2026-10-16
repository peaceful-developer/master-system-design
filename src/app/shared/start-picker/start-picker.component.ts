import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content/content.service';
import type { LearnerLevel } from '../../core/progress/progress-model';
import { ProgressStore } from '../../core/progress/progress.store';
import { IconComponent } from '../icon/icon.component';

export const LEARNER_LEVELS: readonly { id: LearnerLevel; title: string; detail: string }[] = [
  {
    id: 'new',
    title: 'New to this',
    detail: 'Start with how the web, APIs and databases work. No experience needed.',
  },
  {
    id: 'some',
    title: 'I know the basics',
    detail: 'Start with scaling, caching and replication. Quizzes help you skip what you know.',
  },
  {
    id: 'expert',
    title: 'Preparing for senior / ML / LLM design',
    detail: 'Start with the ML design framework and the advanced case studies.',
  },
];

/** "Where should I start?": saves the learner's level and points at their first step. */
@Component({
  selector: 'app-start-picker',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Global class names, loaded with this component instead of in the initial bundle.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './start-picker.component.css',
  template: `
    <fieldset class="picker" [class.picker-compact]="compact()">
      <legend class="picker-legend">Where should I start?</legend>
      <div class="picker-options">
        @for (level of levels; track level.id) {
          <label class="picker-card" [class.is-selected]="selected() === level.id">
            <input
              type="radio"
              class="sr-only"
              name="learner-level"
              [value]="level.id"
              [checked]="selected() === level.id"
              (change)="choose(level.id)"
            />
            <span class="picker-card-head">
              <span class="picker-card-title">{{ level.title }}</span>
              <span class="picker-check" aria-hidden="true">
                @if (selected() === level.id) {
                  <app-icon name="check" size="0.9rem" />
                }
              </span>
            </span>
            @if (!compact()) {
              <span class="picker-card-detail">{{ level.detail }}</span>
            }
          </label>
        }
      </div>
    </fieldset>

    @if (recommendation(); as r) {
      <div class="picker-result" aria-live="polite">
        <p>
          <span class="font-semibold">Your first step:</span>
          {{ r.start.title }}
        </p>
        <a class="btn start-here" [routerLink]="r.start.url">
          Start here <app-icon name="arrow-right" size="1em" />
        </a>
        @if (r.fastTrack.length > 0) {
          <p class="picker-fast-track">
            Already know some of it? Items marked
            <span class="chip-outline">Recommended for you</span> on the
            <a routerLink="/path">learning path</a> let you check yourself and move faster.
          </p>
        }
      </div>
    }
  `,
})
export class StartPickerComponent {
  private readonly content = inject(ContentService);
  private readonly store = inject(ProgressStore);

  readonly compact = input(false);

  protected readonly levels = LEARNER_LEVELS;
  protected readonly selected = computed(() =>
    this.store.ready() ? this.store.prefs().learnerLevel : null,
  );
  protected readonly recommendation = computed(() => {
    const level = this.selected();
    return level ? this.content.recommendedStart(level) : undefined;
  });

  protected choose(level: LearnerLevel): void {
    this.store.setPrefs({ learnerLevel: level });
  }
}
