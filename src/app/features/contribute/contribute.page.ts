import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from '../../core/seo/seo.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { REPO_URL } from '../../site';

const WAYS = [
  {
    icon: 'pencil',
    title: 'Fix a mistake',
    body: 'Every page has an "Edit this page on GitHub" link. Small fixes to wording, numbers or diagrams are the most welcome contribution of all.',
  },
  {
    icon: 'alert-triangle',
    title: 'Report a problem',
    body: 'Found something wrong, confusing or out of date? Open an issue and say where, ideally with a source.',
  },
  {
    icon: 'book-open',
    title: 'Write content',
    body: 'Lessons, case studies, quizzes and drills are Markdown and JSON files. Templates show the expected structure.',
  },
  {
    icon: 'code',
    title: 'Improve the app',
    body: 'The site is an Angular app with no backend. Accessibility, performance and test improvements are always useful.',
  },
] as const;

@Component({
  selector: 'app-contribute-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Contribute</h1>
        <p class="page-lead">
          System Design Lab is free and open source: code under MIT, content under CC BY 4.0.
          Contributions of every size help.
        </p>
      </header>

      <ul class="feature-grid">
        @for (w of ways; track w.title) {
          <li class="feature">
            <app-icon [name]="w.icon" size="1.5rem" />
            <h2 class="feature-title">{{ w.title }}</h2>
            <p>{{ w.body }}</p>
          </li>
        }
      </ul>

      <section class="progress-section max-w-[75ch]" aria-labelledby="local-title">
        <h2 id="local-title" class="section-title">Run it locally</h2>
        <p class="mt-2">You need Node.js 24 (or 22.22.3 and later) and Git.</p>
        <pre class="code-box"><code>git clone {{ repo }}.git
cd master-system-design
npm ci
npm start</code></pre>
        <p class="mt-3">
          The site opens at <code>http://localhost:4200</code> and rebuilds when you edit anything
          in <code>content/</code>. Before opening a pull request, run
          <code>npm run validate-content</code>, <code>npm run lint</code> and
          <code>npm test</code>.
        </p>
      </section>

      <section class="progress-section max-w-[75ch]" aria-labelledby="links-title">
        <h2 id="links-title" class="section-title">Where to start</h2>
        <ul class="link-list">
          <li>
            <a [href]="repo + '/blob/main/CONTRIBUTING.md'" rel="noopener">
              Contributing guide <app-icon name="external-link" size="1em" />
            </a>
            <span>How content is structured, style rules, and the review process.</span>
          </li>
          <li>
            <a [href]="repo + '/tree/main/templates'" rel="noopener">
              Content templates <app-icon name="external-link" size="1em" />
            </a>
            <span>Starting points for lessons, case studies, quizzes and drills.</span>
          </li>
          <li>
            <a [href]="repo + '/issues/new/choose'" rel="noopener">
              Open an issue <app-icon name="external-link" size="1em" />
            </a>
            <span>Report a mistake or suggest a topic.</span>
          </li>
        </ul>
      </section>
    </div>
  `,
})
export class ContributePage {
  protected readonly ways = WAYS;
  protected readonly repo = REPO_URL;

  constructor() {
    inject(SeoService).setPage({
      title: 'Contribute',
      description: 'How to fix, write and improve System Design Lab, an open-source learning site.',
      path: '/contribute',
    });
  }
}
