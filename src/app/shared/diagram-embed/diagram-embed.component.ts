import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Renders a content diagram by id (implemented in Task 11). */
@Component({
  selector: 'app-diagram-embed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="diagram-placeholder" [attr.data-diagram]="id()"></div>`,
})
export class DiagramEmbedComponent {
  readonly id = input.required<string>();
}
