import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ExerciseMeta } from '@content/types';
import { ContentService } from '../../core/content/content.service';
import { ProgressStore } from '../../core/progress/progress.store';
import { SeoService } from '../../core/seo/seo.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { exerciseTopics, filterExercises } from './exercise-filters';

type Kind = ExerciseMeta['kind'];

const KINDS: readonly { id: Kind; label: string }[] = [
  { id: 'quiz', label: 'Quizzes' },
  { id: 'drill', label: 'Estimation drills' },
];

@Component({
  selector: 'app-exercises-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Global class names, loaded with this component instead of in the initial bundle.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './exercises.page.css',
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Exercises</h1>
        <p class="page-lead">
          Quizzes check your understanding; estimation drills build the habit of putting numbers on
          a design. Every one explains its answers.
        </p>
      </header>

      <div class="filters" role="group" aria-label="Filter exercises">
        <div class="filter-row">
          <span class="filter-label">Type</span>
          @for (k of kinds; track k.id) {
            <button
              type="button"
              class="filter-chip"
              [attr.aria-pressed]="kindFilter().includes(k.id)"
              (click)="toggleKind(k.id)"
            >
              {{ k.label }}
            </button>
          }
        </div>
        <div class="filter-row">
          <span class="filter-label">Topic</span>
          @for (t of topics; track t) {
            <button
              type="button"
              class="filter-chip"
              [attr.aria-pressed]="topicFilter().includes(t)"
              (click)="toggleTopic(t)"
            >
              {{ t }}
            </button>
          }
        </div>
        @if (kindFilter().length > 0 || topicFilter().length > 0) {
          <button type="button" class="filter-clear" (click)="clear()">Clear filters</button>
        }
      </div>

      <p class="mt-6 text-sm" aria-live="polite">
        Showing {{ shown().length }} of {{ all.length }} exercises
      </p>

      <ul class="card-grid mt-3">
        @for (e of shown(); track e.id) {
          <li>
            <a class="card card-link" [routerLink]="e.url">
              <span class="card-kicker">
                <app-icon [name]="e.kind === 'quiz' ? 'lightbulb' : 'flask'" size="1em" />
                {{ e.kind === 'quiz' ? 'Quiz' : 'Estimation drill' }} · {{ e.difficulty }}
              </span>
              <span class="card-title">{{ e.title }}</span>
              @if (e.usedBy[0]; as parent) {
                <span class="card-body">From: {{ parent.title }}</span>
              }
              <span class="card-meta flex items-center justify-between gap-2">
                <span>{{ e.topics.join(', ') }}</span>
                @if (isDone(e.id)) {
                  <app-icon name="check-circle" label="Completed" />
                }
              </span>
            </a>
          </li>
        } @empty {
          <li>No exercises match these filters.</li>
        }
      </ul>
    </div>
  `,
})
export class ExercisesPage {
  private readonly store = inject(ProgressStore);

  protected readonly all = inject(ContentService).exercises();
  protected readonly kinds = KINDS;
  protected readonly topics = exerciseTopics(this.all);
  protected readonly kindFilter = signal<Kind[]>([]);
  protected readonly topicFilter = signal<string[]>([]);
  protected readonly shown = computed(() =>
    filterExercises(this.all, { kinds: this.kindFilter(), topics: this.topicFilter() }),
  );

  constructor() {
    inject(SeoService).setPage({
      title: 'Exercises',
      description: 'Quizzes and estimation drills for every lesson, with explained answers.',
      path: '/exercises',
    });
  }

  protected toggleKind(kind: Kind): void {
    this.kindFilter.update((list) => toggle(list, kind));
  }

  protected toggleTopic(topic: string): void {
    this.topicFilter.update((list) => toggle(list, topic));
  }

  protected clear(): void {
    this.kindFilter.set([]);
    this.topicFilter.set([]);
  }

  protected isDone(id: string): boolean {
    return this.store.isComplete(`exercise:${id}`);
  }
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
