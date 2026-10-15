import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeKind = 'difficulty' | 'status' | 'track';

const TEXT: Record<BadgeKind, Record<string, string>> = {
  difficulty: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
  status: { complete: 'Complete', outline: 'Outline' },
  track: {
    A: 'Track A · Classic systems',
    B: 'Track B · ML systems',
    C: 'Track C · LLM & GenAI systems',
  },
};

const LEVEL: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };

/** Text-first badge; the difficulty dots only reinforce the word. */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'chip-outline' },
  template: `
    @if (kind() === 'difficulty') {
      <span class="flex gap-0.5" aria-hidden="true">
        @for (n of [1, 2, 3]; track n) {
          <span class="size-1.5 rounded-full border border-fg" [class.bg-fg]="n <= level()"></span>
        }
      </span>
    }
    {{ text() }}
  `,
})
export class BadgeComponent {
  readonly kind = input.required<BadgeKind>();
  readonly value = input.required<string>();
  protected readonly text = computed(() => TEXT[this.kind()][this.value()] ?? this.value());
  protected readonly level = computed(() => LEVEL[this.value()] ?? 0);
}
