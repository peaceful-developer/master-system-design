import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PathEntry } from '../../core/content/path-nav';
import { IconComponent } from '../icon/icon.component';

/** Previous / next along the learning path. */
@Component({
  selector: 'app-prev-next',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (prev() || next()) {
      <nav class="prev-next" aria-label="Learning path">
        @if (prev(); as p) {
          <a class="prev-next-link" [routerLink]="p.url" rel="prev">
            <span class="prev-next-dir"><app-icon name="arrow-left" size="1em" /> Previous</span>
            <span class="prev-next-title">{{ p.title }}</span>
          </a>
        } @else {
          <span></span>
        }
        @if (next(); as n) {
          <a class="prev-next-link text-right" [routerLink]="n.url" rel="next">
            <span class="prev-next-dir justify-end"
              >Next <app-icon name="arrow-right" size="1em"
            /></span>
            <span class="prev-next-title">{{ n.title }}</span>
          </a>
        }
      </nav>
    }
  `,
})
export class PrevNextComponent {
  readonly prev = input<PathEntry>();
  readonly next = input<PathEntry>();
}
