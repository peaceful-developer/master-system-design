import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { REPO_URL, SITE_NAME } from '../../site';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="mt-20 border-t border-rule">
      <div
        class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm"
      >
        <p>
          <strong>{{ siteName }}</strong> · Free and open source · Code MIT · Content CC BY 4.0
        </p>
        <nav aria-label="Footer">
          <ul class="flex gap-5">
            <li><a routerLink="/contribute">Contribute</a></li>
            <li><a [href]="repoUrl" rel="noopener">GitHub</a></li>
          </ul>
        </nav>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  protected readonly siteName = SITE_NAME;
  protected readonly repoUrl = REPO_URL;
}
