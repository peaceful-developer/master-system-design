import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SITE_NAME } from './site';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="sr-only-focusable btn absolute left-2 top-2 z-50" href="#main">Skip to content</a>
    <header class="border-b border-parrot-deep bg-parrot">
      <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <a routerLink="/" class="flex items-center gap-2 font-semibold no-underline text-on-parrot">
          <img src="logo.svg" alt="" width="28" height="28" />
          <span>{{ siteName }}</span>
        </a>
      </div>
    </header>
    <main id="main" tabindex="-1" class="mx-auto max-w-7xl px-4 py-8">
      <router-outlet />
    </main>
  `,
})
export class App {
  protected readonly siteName = SITE_NAME;
}
