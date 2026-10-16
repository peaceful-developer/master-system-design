import { ChangeDetectionStrategy, Component, inject, input, resource } from '@angular/core';
import { ContentService } from '../../core/content/content.service';
import { QuizComponent } from './quiz.component';

/** Loads a quiz by id (`::quiz{id}` in content, or the exercise page). */
@Component({
  selector: 'app-quiz-embed',
  imports: [QuizComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (quiz.value(); as q) {
      <app-quiz [quiz]="q" />
    } @else if (quiz.isLoading()) {
      <div class="exercise-placeholder" aria-busy="true">Loading quiz…</div>
    } @else {
      <p class="exercise-placeholder">This quiz is not available.</p>
    }
  `,
})
export class QuizEmbedComponent {
  private readonly content = inject(ContentService);
  readonly id = input.required<string>();
  protected readonly quiz = resource({
    params: () => this.id(),
    loader: ({ params }) => this.content.getQuiz(params),
  });
}
