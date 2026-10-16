import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MASCOT, type MascotPose } from '@generated/mascot';
import { ProgressStore } from '../../core/progress/progress.store';

/** Poses that carry information (the 404 page, empty states), shown even in Calm mode. */
const INFORMATIVE_POSES: readonly MascotPose[] = ['fly', 'sleep'];

/**
 * Polly, the site's parrot (content/figures/mascot-*.svg, sanitized at build
 * time), with an optional one-line caption. Calm mode hides her except where
 * the pose carries information.
 */
@Component({
  selector: 'app-mascot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mascot', '[attr.data-pose]': 'visible() ? pose() : null' },
  template: `
    @if (visible()) {
      <span
        class="mascot-art"
        [style.width]="size()"
        [attr.aria-hidden]="decorative() ? 'true' : null"
        [innerHTML]="svg()"
      ></span>
      @if (line(); as text) {
        <p class="mascot-line" [attr.aria-live]="feedback() ? 'polite' : null">{{ text }}</p>
      }
    }
  `,
})
export class MascotComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly progress = inject(ProgressStore);

  readonly pose = input<MascotPose>('idle');
  readonly size = input('6rem');
  readonly line = input<string>();
  /** The caption reacts to something the learner did, so it is announced. */
  readonly feedback = input(false);
  readonly decorative = input(true);

  protected readonly visible = computed(
    () =>
      INFORMATIVE_POSES.includes(this.pose()) ||
      !(this.progress.ready() && this.progress.prefs().calmMode),
  );
  protected readonly svg = computed<SafeHtml | null>(() => {
    const markup = MASCOT[this.pose()];
    return markup === undefined ? null : this.sanitizer.bypassSecurityTrustHtml(markup);
  });
}
