import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Loads and renders a quiz by id (implemented in Task 12). */
@Component({
  selector: 'app-quiz-embed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [attr.data-quiz]="id()"></div>`,
})
export class QuizEmbedComponent {
  readonly id = input.required<string>();
}
