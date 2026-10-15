import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Progress ring with the count written out (never color alone). */
@Component({
  selector: 'app-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2' },
  template: `
    <span role="img" [attr.aria-label]="ariaLabel()" class="inline-flex">
      <svg viewBox="0 0 40 40" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          [attr.r]="radius"
          fill="none"
          stroke="var(--color-rule)"
          stroke-width="5"
        />
        <circle
          class="ring-value"
          cx="20"
          cy="20"
          [attr.r]="radius"
          fill="none"
          stroke="var(--color-parrot)"
          stroke-width="5"
          stroke-linecap="round"
          transform="rotate(-90 20 20)"
          [attr.stroke-dasharray]="dash()"
        />
      </svg>
    </span>
    <span class="text-sm font-semibold tabular-nums" aria-hidden="true"
      >{{ done() }} / {{ total() }}</span
    >
  `,
})
export class ProgressRingComponent {
  readonly done = input.required<number>();
  readonly total = input.required<number>();
  readonly label = input.required<string>();
  readonly size = input(40);

  protected readonly radius = RADIUS;
  protected readonly ariaLabel = computed(
    () => `${this.label()}: ${this.done()} of ${this.total()} complete`,
  );
  protected readonly dash = computed(() => {
    const ratio = this.total() > 0 ? Math.min(1, this.done() / this.total()) : 0;
    const filled = ratio * CIRCUMFERENCE;
    return `${filled.toFixed(2)} ${(CIRCUMFERENCE - filled).toFixed(2)}`;
  });
}
