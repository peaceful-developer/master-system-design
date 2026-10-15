import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content/content.service';
import { SeoService } from '../../core/seo/seo.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-examples-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Worked examples</h1>
        <p class="page-lead">
          Reusable patterns explained end to end, each with a diagram: when to use them, how they
          work and what they cost.
        </p>
      </header>
      <ul class="card-grid">
        @for (e of examples; track e.slug) {
          <li>
            <a class="card card-link" [routerLink]="e.url">
              <span class="card-kicker"><app-icon name="layers" size="1em" /> Pattern</span>
              <span class="card-title">{{ e.title }}</span>
              <span class="card-body">{{ e.summary }}</span>
            </a>
          </li>
        } @empty {
          <li>Worked examples are on their way.</li>
        }
      </ul>
    </div>
  `,
})
export class ExamplesPage {
  protected readonly examples = inject(ContentService).examples();

  constructor() {
    inject(SeoService).setPage({
      title: 'Worked examples',
      description: 'Reusable system design patterns explained end to end with diagrams.',
      path: '/examples',
    });
  }
}
