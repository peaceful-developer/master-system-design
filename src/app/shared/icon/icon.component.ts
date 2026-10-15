import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { ICONS } from '@generated/icons';

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * One of our hand-drawn 24×24 stroke icons (content/icons/). Icon bodies are
 * sanitized at build time, so they are trusted here.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', '[innerHTML]': 'svg()' },
  template: '',
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<string>();
  /** When set, the icon is announced as an image with this label; otherwise it is decorative. */
  readonly label = input<string>();
  readonly size = input('1.25em');

  protected readonly svg = computed<SafeHtml | null>(() => {
    const body = ICONS[this.name()];
    if (body === undefined) return null;
    const label = this.label();
    const a11y = label
      ? `role="img" aria-label="${escapeAttr(label)}"`
      : 'aria-hidden="true" focusable="false"';
    const size = escapeAttr(this.size());
    return this.sanitizer.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`,
    );
  });
}
