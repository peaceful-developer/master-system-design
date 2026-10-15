import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ExerciseView } from '../../core/content/content-resolvers';
import { SeoService } from '../../core/seo/seo.service';
import { DrillComponent } from '../../shared/drill/drill.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { QuizComponent } from '../../shared/quiz/quiz.component';

@Component({
  selector: 'app-exercise-page',
  imports: [RouterLink, IconComponent, QuizComponent, DrillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page exercise-page">
      @let meta = exercise().meta;
      @let parent = meta.usedBy[0];
      <nav class="mb-6" aria-label="Back">
        @if (parent) {
          <a class="back-link" [routerLink]="parent.url">
            <app-icon name="arrow-left" size="1em" /> Back to {{ parent.title }}
          </a>
        } @else {
          <a class="back-link" routerLink="/exercises">
            <app-icon name="arrow-left" size="1em" /> All exercises
          </a>
        }
      </nav>

      <header class="page-header">
        <p class="flex items-center gap-1.5 text-sm font-semibold">
          <app-icon [name]="meta.kind === 'quiz' ? 'lightbulb' : 'flask'" size="1em" />
          {{ kindLabel() }} · {{ meta.difficulty }}
        </p>
        <h1 class="page-title mt-2">{{ meta.title }}</h1>
        @if (meta.usedBy.length > 1) {
          <p class="mt-3 text-sm">
            Also part of:
            @for (p of meta.usedBy.slice(1); track p.url; let last = $last) {
              <a [routerLink]="p.url">{{ p.title }}</a
              >{{ last ? '' : ', ' }}
            }
          </p>
        }
      </header>

      <div class="max-w-[75ch]">
        @if (quiz(); as q) {
          <app-quiz [quiz]="q" />
        } @else if (drill(); as d) {
          <app-drill [drill]="d" />
        }
      </div>

      <p class="mt-10">
        <a routerLink="/exercises">Browse all exercises</a>
      </p>
    </div>
  `,
})
export class ExercisePage {
  readonly exercise = input.required<ExerciseView>();

  protected readonly quiz = computed(() => {
    const e = this.exercise();
    return e.kind === 'quiz' ? e.quiz : undefined;
  });
  protected readonly drill = computed(() => {
    const e = this.exercise();
    return e.kind === 'drill' ? e.drill : undefined;
  });
  protected readonly kindLabel = computed(() =>
    this.exercise().kind === 'quiz' ? 'Quiz' : 'Estimation drill',
  );

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const { meta } = this.exercise();
      seo.setPage({
        title: meta.title,
        description: `${this.kindLabel()} on ${meta.topics.join(', ') || 'system design'}, with explained answers.`,
        path: meta.url,
      });
    });
  }
}
