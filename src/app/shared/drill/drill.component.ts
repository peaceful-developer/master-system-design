import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { CompiledDrill, DrillQuestion } from '@content/types';
import { ProgressStore } from '../../core/progress/progress.store';
import { InternalLinksDirective } from '../content-blocks/internal-links.directive';
import { TrustedHtmlPipe } from '../content-blocks/trusted-html.pipe';
import { FeatherBurstComponent } from '../celebrate/feather-burst.component';
import { IconComponent } from '../icon/icon.component';
import { mascotLine } from '../mascot/mascot-lines';
import { MascotComponent } from '../mascot/mascot.component';
import { formatValue } from './format-number';
import { parseHumanNumber } from './parse-number';
import { checkAnswer, describeTolerance, type AnswerCheck } from './tolerance';

interface QuestionOutcome extends AnswerCheck {
  answer: number;
}

@Component({
  selector: 'app-drill',
  imports: [
    IconComponent,
    TrustedHtmlPipe,
    InternalLinksDirective,
    MascotComponent,
    FeatherBurstComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block my-10' },
  template: `
    <section class="drill card" [attr.aria-labelledby]="ids + '-title'">
      <header class="drill-header">
        <app-icon name="flask" size="1.5em" />
        <div>
          <h2 class="drill-title" [id]="ids + '-title'">{{ drill().title }}</h2>
          <p class="text-sm">Estimation drill · {{ drill().questions.length }} answers</p>
        </div>
      </header>

      <div
        class="prose-content"
        appInternalLinks
        [innerHTML]="drill().scenarioHtml | trustedHtml"
      ></div>

      @if (drill().givens.length > 0) {
        <table class="drill-givens">
          <caption class="sr-only">
            Given values
          </caption>
          <thead>
            <tr>
              <th scope="col">Given</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            @for (g of drill().givens; track g.label) {
              <tr>
                <th scope="row">{{ g.label }}</th>
                <td>{{ display(g.value) }}{{ g.unit ? ' ' + g.unit : '' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }

      <form (submit)="$event.preventDefault(); check()">
        @for (q of drill().questions; track q.id) {
          <div class="drill-question">
            <label class="drill-label" [for]="ids + '-' + q.id">
              {{ q.prompt }} <span class="drill-unit">({{ q.unit }})</span>
            </label>
            <p class="text-sm" [id]="ids + '-' + q.id + '-tol'">Accepted {{ toleranceText(q) }}.</p>
            <input
              class="drill-input"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              spellcheck="false"
              placeholder="e.g. 2.5k"
              [id]="ids + '-' + q.id"
              [value]="raw()[q.id] ?? ''"
              [disabled]="checked() || !store.ready()"
              [attr.aria-invalid]="error(q.id) ? 'true' : null"
              [attr.aria-describedby]="
                ids + '-' + q.id + '-tol' + (error(q.id) ? ' ' + ids + '-' + q.id + '-err' : '')
              "
              (input)="setRaw(q.id, $event)"
            />
            @if (error(q.id); as message) {
              <p class="drill-error" [id]="ids + '-' + q.id + '-err'">
                <app-icon name="alert-triangle" size="1em" /> {{ message }}
              </p>
            }
            @if (outcomes()?.[q.id]; as o) {
              <div class="drill-feedback" [class.is-correct]="o.correct">
                <p class="quiz-verdict">
                  <app-icon [name]="o.correct ? 'check-circle' : 'x'" />
                  {{ o.correct ? 'Correct' : 'Not quite' }}
                </p>
                <p>{{ feedback(q, o) }}</p>
              </div>
            }
          </div>
        }

        <div class="drill-actions">
          @if (checked()) {
            <p class="quiz-score">
              {{ correctCount() }} of {{ drill().questions.length }} within range
              <app-feather-burst [active]="correctCount() === drill().questions.length" />
            </p>
            <button type="button" class="btn-secondary" (click)="retry()">Try again</button>
            <app-mascot
              class="quiz-mascot"
              size="3.5rem"
              [pose]="reaction().pose"
              [line]="reaction().line"
              [feedback]="true"
            />
          } @else {
            <button type="submit" class="btn" [disabled]="!canCheck()">Check my estimates</button>
          }
        </div>
      </form>

      @if (checked()) {
        <section class="drill-solution" [attr.aria-labelledby]="ids + '-solution'">
          <h3 class="drill-title" [id]="ids + '-solution'">Step-by-step solution</h3>
          <div
            class="prose-content"
            appInternalLinks
            [innerHTML]="drill().solutionHtml | trustedHtml"
          ></div>
        </section>
      }
    </section>
  `,
})
export class DrillComponent {
  /** Inputs stay disabled until saved progress has loaded: a prerendered page looks usable
   *  before the app boots, and answers given then would be wiped when it takes over. */
  protected readonly store = inject(ProgressStore);
  private readonly announcer = inject(LiveAnnouncer);
  private static nextId = 0;

  readonly drill = input.required<CompiledDrill>();

  protected readonly ids = `drill-${DrillComponent.nextId++}`;
  protected readonly raw = signal<Record<string, string>>({});
  protected readonly checked = signal(false);

  private readonly parsed = computed(() => {
    const values: Record<string, number | null> = {};
    for (const q of this.drill().questions) values[q.id] = parseHumanNumber(this.raw()[q.id] ?? '');
    return values;
  });

  protected readonly canCheck = computed(() =>
    this.drill().questions.every((q) => this.parsed()[q.id] !== null),
  );

  protected readonly outcomes = computed<Record<string, QuestionOutcome> | null>(() => {
    if (!this.checked()) return null;
    const out: Record<string, QuestionOutcome> = {};
    for (const q of this.drill().questions) {
      const answer = this.parsed()[q.id]!;
      out[q.id] = { answer, ...checkAnswer(answer, q.answer, q.tolerance) };
    }
    return out;
  });

  protected readonly correctCount = computed(
    () => Object.values(this.outcomes() ?? {}).filter((o) => o.correct).length,
  );

  protected readonly reaction = computed(() => {
    const total = this.drill().questions.length;
    const correct = this.correctCount();
    const id = this.drill().id;
    if (correct === total) return { pose: 'cheer' as const, line: mascotLine('perfect', id) };
    if (correct * 2 >= total) return { pose: 'cheer' as const, line: mascotLine('correct', id) };
    return { pose: 'puzzled' as const, line: mascotLine('incorrect', id) };
  });

  protected error(questionId: string): string | null {
    const text = (this.raw()[questionId] ?? '').trim();
    if (!text || this.parsed()[questionId] !== null) return null;
    return `Couldn’t read “${text}” as a number. Try 1.2M or 1200000.`;
  }

  protected display(value: number | string): string {
    return typeof value === 'number' ? formatValue(value) : value;
  }

  protected toleranceText(q: DrillQuestion): string {
    return describeTolerance(q.tolerance, q.unit);
  }

  protected feedback(q: DrillQuestion, o: QuestionOutcome): string {
    const off =
      o.deltaPct === null || Math.abs(o.deltaPct) < 0.5
        ? 'spot on'
        : `${Math.round(Math.abs(o.deltaPct))}% ${o.deltaPct > 0 ? 'high' : 'low'}`;
    const expected = `${formatValue(q.answer)} ${q.unit}`;
    return o.correct
      ? `You were ${off}. The reference answer is ${expected}.`
      : `Expected about ${expected}; you were ${off}. Compare your steps with the solution below.`;
  }

  protected setRaw(questionId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.raw.update((all) => ({ ...all, [questionId]: value }));
  }

  protected check(): void {
    if (!this.canCheck() || this.checked()) return;
    this.checked.set(true);
    const total = this.drill().questions.length;
    this.store.recordDrill(this.drill().id, this.correctCount(), total);
    void this.announcer.announce(`${this.correctCount()} of ${total} within range`, 'polite');
  }

  protected retry(): void {
    this.raw.set({});
    this.checked.set(false);
  }
}
