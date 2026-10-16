import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { ProgressStore } from '../../core/progress/progress.store';
import { IconComponent } from '../icon/icon.component';

/** Calm mode: hides the mascot, celebrations, toasts and the nav level chip. */
@Component({
  selector: 'app-calm-switch',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Global class names, loaded with this component instead of in the initial bundle.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './calm-switch.component.css',
  template: `
    @if (compact()) {
      <button
        type="button"
        role="switch"
        class="nav-icon-btn calm-switch-compact"
        [class.is-on]="on()"
        [attr.aria-checked]="on()"
        aria-label="Calm mode"
        title="Calm mode: hide the mascot and celebrations"
        (click)="toggle()"
      >
        <app-icon name="feather" />
      </button>
    } @else {
      <div class="calm-switch">
        <button
          type="button"
          role="switch"
          class="switch-track"
          [attr.aria-checked]="on()"
          aria-labelledby="calm-label"
          aria-describedby="calm-desc"
          (click)="toggle()"
        >
          <span class="switch-thumb"></span>
        </button>
        <div>
          <p id="calm-label" class="font-semibold">Calm mode</p>
          <p id="calm-desc" class="text-sm">
            Hides the mascot, celebrations and achievement pop-ups. Your progress still counts.
          </p>
        </div>
      </div>
    }
  `,
})
export class CalmSwitchComponent {
  private readonly progress = inject(ProgressStore);

  readonly compact = input(false);
  protected readonly on = computed(() => this.progress.ready() && this.progress.prefs().calmMode);

  protected toggle(): void {
    this.progress.setPrefs({ calmMode: !this.on() });
  }
}
