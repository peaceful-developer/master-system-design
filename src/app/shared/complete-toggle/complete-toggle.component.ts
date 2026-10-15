import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { ItemKey } from '../../core/progress/progress-model';
import { ProgressStore } from '../../core/progress/progress.store';
import { IconComponent } from '../icon/icon.component';

/** "Mark as complete" button. Space is reserved while progress loads, so nothing shifts. */
@Component({
  selector: 'app-complete-toggle',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block min-h-10' },
  template: `
    @if (store.ready()) {
      <button
        type="button"
        [class]="done() ? 'btn' : 'btn-secondary'"
        [attr.aria-pressed]="done()"
        (click)="store.setComplete(itemKey(), !done())"
      >
        <app-icon [name]="done() ? 'check-circle' : 'circle'" />
        {{ done() ? 'Completed' : 'Mark as complete' }}
      </button>
    }
  `,
})
export class CompleteToggleComponent {
  protected readonly store = inject(ProgressStore);
  readonly itemKey = input.required<ItemKey>();
  protected readonly done = computed(() => this.store.isComplete(this.itemKey()));
}
