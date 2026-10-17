import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { CompiledQuiz, Difficulty, QuizQuestion } from '@content/types';
import { ProgressStore, QUIZ_PASS_RATIO } from '../../core/progress/progress.store';
import { FeatherBurstComponent } from '../celebrate/feather-burst.component';
import { IconComponent } from '../icon/icon.component';
import { mascotLine } from '../mascot/mascot-lines';
import { MascotComponent } from '../mascot/mascot.component';
import { scoreQuiz } from './quiz-scoring';

const LEVEL_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

@Component({
  selector: 'app-quiz',
  imports: [IconComponent, MascotComponent, FeatherBurstComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block my-10' },
  template: `
    <section class="quiz card" [attr.aria-labelledby]="ids + '-title'">
      <header class="quiz-header">
        <app-icon name="lightbulb" size="1.5em" />
        <div>
          <h2 class="quiz-title" [id]="ids + '-title'">{{ quiz().title }}</h2>
          <p class="text-sm">Quiz · {{ quiz().questions.length }} questions</p>
        </div>
      </header>

      <form (submit)="$event.preventDefault(); check()">
        @for (q of quiz().questions; track q.id; let i = $index) {
          <fieldset class="quiz-question">
            <legend class="quiz-legend">
              <span class="quiz-meta">
                Question {{ i + 1 }}
                <span class="chip-outline">{{ levelLabel(q.level) }}</span>
              </span>
              <span class="quiz-prompt">{{ q.prompt }}</span>
              @if (q.kind === 'multi') {
                <span class="quiz-instruction">Select all that apply.</span>
              }
            </legend>

            <div class="quiz-options">
              @for (o of q.options; track o.id) {
                <label
                  class="quiz-option"
                  [class.is-expected]="checked() && isExpected(q, o.id)"
                  [class.is-wrong]="checked() && isSelected(q.id, o.id) && !isExpected(q, o.id)"
                >
                  <input
                    [type]="q.kind === 'single' ? 'radio' : 'checkbox'"
                    [name]="ids + '-' + q.id"
                    [value]="o.id"
                    [checked]="isSelected(q.id, o.id)"
                    [disabled]="checked() || !store.ready()"
                    (change)="choose(q, o.id, $event)"
                  />
                  <span class="quiz-option-text">{{ o.text }}</span>
                  @if (checked() && isExpected(q, o.id)) {
                    <span class="quiz-answer-mark">
                      <app-icon name="check" size="1em" /> Correct answer
                    </span>
                  }
                </label>
              }
            </div>

            @if (q.hint && !checked()) {
              <button
                type="button"
                class="quiz-hint-toggle"
                [attr.aria-expanded]="hintOpen(q.id)"
                [attr.aria-controls]="ids + '-' + q.id + '-hint'"
                (click)="toggleHint(q.id)"
              >
                <app-icon name="lightbulb" size="1em" />
                {{ hintOpen(q.id) ? 'Hide hint' : 'Show hint' }}
              </button>
              <p class="quiz-hint" [id]="ids + '-' + q.id + '-hint'" [hidden]="!hintOpen(q.id)">
                {{ q.hint }}
              </p>
            }

            @if (result(); as r) {
              <div class="quiz-feedback" [class.is-correct]="r.perQuestion[q.id]?.correct">
                <p class="quiz-verdict">
                  <app-icon [name]="r.perQuestion[q.id]?.correct ? 'check-circle' : 'x'" />
                  {{ r.perQuestion[q.id]?.correct ? 'Correct' : 'Incorrect' }}
                </p>
                <p>{{ q.explanation }}</p>
              </div>
            }
          </fieldset>
        }

        <div class="quiz-actions">
          @if (result(); as r) {
            <p class="quiz-score">
              {{ r.score }} of {{ r.total }} correct
              <app-feather-burst [active]="r.score === r.total" />
            </p>
            <button type="button" class="btn-secondary quiz-retry" (click)="retry()">
              Try again
            </button>
            <app-mascot
              class="quiz-mascot"
              size="3.5rem"
              [pose]="reaction().pose"
              [line]="reaction().line"
              [feedback]="true"
            />
          } @else {
            <button type="submit" class="btn" [disabled]="!allAnswered()">Check answers</button>
            @if (!allAnswered()) {
              <p class="text-sm">
                Answer every question to check your answers ({{ answeredCount() }} of
                {{ quiz().questions.length }} answered).
              </p>
            }
          }
        </div>
      </form>
    </section>
  `,
})
export class QuizComponent {
  /** Inputs stay disabled until saved progress has loaded: a prerendered page looks usable
   *  before the app boots, and answers given then would be wiped when it takes over. */
  protected readonly store = inject(ProgressStore);
  private readonly announcer = inject(LiveAnnouncer);
  private static nextId = 0;

  readonly quiz = input.required<CompiledQuiz>();

  protected readonly ids = `quiz-${QuizComponent.nextId++}`;
  private readonly answers = signal<Record<string, string[]>>({});
  private readonly hints = signal<ReadonlySet<string>>(new Set());
  protected readonly checked = signal(false);

  protected readonly answeredCount = computed(
    () => this.quiz().questions.filter((q) => (this.answers()[q.id]?.length ?? 0) > 0).length,
  );
  protected readonly allAnswered = computed(
    () => this.answeredCount() === this.quiz().questions.length,
  );
  protected readonly result = computed(() =>
    this.checked() ? scoreQuiz(this.quiz(), this.answers()) : null,
  );

  protected readonly reaction = computed(() => {
    const r = this.result();
    const id = this.quiz().id;
    if (!r || r.total === 0) return { pose: 'thinking' as const, line: undefined };
    if (r.score === r.total) return { pose: 'cheer' as const, line: mascotLine('perfect', id) };
    if (r.score / r.total >= QUIZ_PASS_RATIO) {
      return { pose: 'cheer' as const, line: mascotLine('correct', id) };
    }
    return { pose: 'puzzled' as const, line: mascotLine('incorrect', id) };
  });

  protected levelLabel(level: Difficulty): string {
    return LEVEL_LABELS[level];
  }

  protected isSelected(questionId: string, optionId: string): boolean {
    return this.answers()[questionId]?.includes(optionId) ?? false;
  }

  protected isExpected(question: QuizQuestion, optionId: string): boolean {
    return question.correct.includes(optionId);
  }

  protected hintOpen(questionId: string): boolean {
    return this.hints().has(questionId);
  }

  protected choose(question: QuizQuestion, optionId: string, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.answers.update((all) => {
      const current = all[question.id] ?? [];
      const next =
        question.kind === 'single'
          ? [optionId]
          : on
            ? [...new Set([...current, optionId])]
            : current.filter((id) => id !== optionId);
      return { ...all, [question.id]: next };
    });
  }

  protected toggleHint(questionId: string): void {
    this.hints.update((open) => {
      const next = new Set(open);
      if (!next.delete(questionId)) next.add(questionId);
      return next;
    });
  }

  protected check(): void {
    if (!this.allAnswered() || this.checked()) return;
    this.checked.set(true);
    const { score, total } = this.result()!;
    this.store.recordQuiz(this.quiz().id, score, total);
    void this.announcer.announce(`${score} of ${total} correct`, 'polite');
  }

  protected retry(): void {
    this.answers.set({});
    this.hints.set(new Set());
    this.checked.set(false);
  }
}
