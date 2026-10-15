import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Loads and renders an estimation drill by id (implemented in Task 13). */
@Component({
  selector: 'app-drill-embed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [attr.data-drill]="id()"></div>`,
})
export class DrillEmbedComponent {
  readonly id = input.required<string>();
}
