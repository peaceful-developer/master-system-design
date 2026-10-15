import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MASCOT, type MascotPose } from '@generated/mascot';

/**
 * Polly, the site's parrot (content/figures/mascot-*.svg, sanitized at build
 * time). Decorative by default; pass `decorative=false` to announce her.
 */
@Component({
  selector: 'app-mascot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mascot',
    '[style.width]': 'size()',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
    '[innerHTML]': 'svg()',
  },
  template: '',
})
export class MascotComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly pose = input<MascotPose>('idle');
  readonly size = input('6rem');
  readonly decorative = input(true);

  protected readonly svg = computed<SafeHtml | null>(() => {
    const markup = MASCOT[this.pose()];
    return markup === undefined ? null : this.sanitizer.bypassSecurityTrustHtml(markup);
  });
}
