import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page text-center">
      <h1 class="page-title">This page flew the coop</h1>
      <p class="page-lead mx-auto">
        We couldn’t find what you were looking for. It may have moved, or the link may have a typo.
      </p>
      <p class="mt-8 flex flex-wrap justify-center gap-3">
        <a class="btn" routerLink="/path">Go to the learning path</a>
        <a class="btn-secondary" routerLink="/">Home</a>
      </p>
    </div>
  `,
})
export class NotFoundPage {
  constructor() {
    inject(SeoService).setPage({
      title: 'Page not found',
      description: 'This page could not be found.',
      path: '/not-found',
    });
  }
}
