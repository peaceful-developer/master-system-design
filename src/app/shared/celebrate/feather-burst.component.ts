import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { REDUCED_MOTION } from '../../core/a11y/reduced-motion';
import { ProgressStore } from '../../core/progress/progress.store';

const FEATHERS = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * A short, restrained burst of small parrot-green feathers (CSS only, ~0.9 s)
 * for a perfect score or a level-up. Skipped in Calm mode and under reduced motion.
 */
@Component({
  selector: 'app-feather-burst',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'feather-burst-host' },
  template: `
    @if (show()) {
      <span class="feather-burst">
        @for (i of feathers; track i) {
          <span class="feather" [style.--i]="i"></span>
        }
      </span>
    }
  `,
})
export class FeatherBurstComponent {
  private readonly progress = inject(ProgressStore);
  private readonly reducedMotion = inject(REDUCED_MOTION);

  readonly active = input(false);

  protected readonly feathers = FEATHERS;
  protected readonly show = computed(
    () =>
      this.active() &&
      !this.reducedMotion() &&
      !(this.progress.ready() && this.progress.prefs().calmMode),
  );
}
