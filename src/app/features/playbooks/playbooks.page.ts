import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content/content.service';
import { SeoService } from '../../core/seo/seo.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-playbooks-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Playbooks</h1>
        <p class="page-lead">
          Step-by-step methods you can reuse in any design discussion: how to run a design
          interview, estimate capacity, and frame an ML system.
        </p>
      </header>
      <ul class="card-grid">
        @for (p of playbooks; track p.slug) {
          <li>
            <a class="card card-link" [routerLink]="p.url">
              <span class="card-kicker"><app-icon name="book-open" size="1em" /> Playbook</span>
              <span class="card-title">{{ p.title }}</span>
              <span class="card-body">{{ p.summary }}</span>
              <span class="card-meta">{{ p.estimatedMinutes }} min</span>
            </a>
          </li>
        } @empty {
          <li>Playbooks are on their way.</li>
        }
      </ul>
    </div>
  `,
})
export class PlaybooksPage {
  protected readonly playbooks = inject(ContentService).playbooks();

  constructor() {
    inject(SeoService).setPage({
      title: 'Playbooks',
      description:
        'Step-by-step playbooks for system design interviews, estimation and ML system design.',
      path: '/playbooks',
    });
  }
}
