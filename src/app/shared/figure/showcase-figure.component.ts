import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { SHOWCASE, type ShowcaseFigure } from '@generated/showcase';

/** One of the animated explainers, outside a lesson (e.g. on the home page). */
@Component({
  selector: 'app-showcase-figure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svg(); as markup) {
      <figure class="showcase-figure">
        <div class="showcase-figure-art" [innerHTML]="markup"></div>
        <figcaption>{{ caption() }}</figcaption>
      </figure>
    }
  `,
})
export class ShowcaseFigureComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly figure = input.required<ShowcaseFigure>();
  readonly caption = input.required<string>();

  protected readonly svg = computed<SafeHtml | null>(() => {
    const markup = SHOWCASE[this.figure()];
    return markup === undefined ? null : this.sanitizer.bypassSecurityTrustHtml(markup);
  });
}
