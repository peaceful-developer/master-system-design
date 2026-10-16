import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { isSearchShortcut } from '../../core/search/search-shortcut';
import { ThemeService } from '../../core/theme/theme.service';
import { CalmSwitchComponent } from '../../shared/calm-switch/calm-switch.component';
import { GameChipComponent } from '../../shared/game-chip/game-chip.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { REPO_URL, SITE_NAME } from '../../site';

export const NAV_ITEMS = [
  { label: 'Path', path: '/path' },
  { label: 'Case studies', path: '/case-studies' },
  { label: 'Playbooks', path: '/playbooks' },
  { label: 'Examples', path: '/examples' },
  { label: 'Exercises', path: '/exercises' },
  { label: 'Glossary', path: '/glossary' },
  { label: 'Progress', path: '/progress' },
] as const;

@Component({
  selector: 'app-top-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent, GameChipComponent, CalmSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <header
      class="sticky top-0 z-40 border-b border-parrot-deep bg-parrot text-on-parrot"
      data-sticky-top
    >
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2">
        <a routerLink="/" class="mr-3 flex items-center gap-2 text-on-parrot no-underline">
          <img src="favicon.svg" alt="" width="34" height="34" />
          <span class="text-lg font-semibold tracking-tight">{{ siteName }}</span>
        </a>

        <nav
          id="primary-nav"
          aria-label="Primary"
          class="order-last w-full lg:order-none lg:block lg:w-auto"
          [class.hidden]="!menuOpen()"
        >
          <ul class="flex flex-col gap-1 pb-2 lg:flex-row lg:pb-0">
            @for (item of items; track item.path) {
              <li>
                <a
                  class="nav-link"
                  [routerLink]="item.path"
                  routerLinkActive="is-active"
                  ariaCurrentWhenActive="page"
                  >{{ item.label }}</a
                >
              </li>
            }
          </ul>
        </nav>

        <div class="ml-auto flex items-center gap-1">
          <ng-content />
          @defer (on idle) {
            <app-game-chip />
            <app-calm-switch [compact]="true" />
          }
          <button
            type="button"
            class="nav-icon-btn"
            aria-label="Search"
            aria-keyshortcuts="/ Control+K Meta+K"
            title="Search (/ or Ctrl+K)"
            (click)="openSearch()"
          >
            <app-icon name="search" />
          </button>
          <button
            type="button"
            class="nav-icon-btn"
            [attr.aria-label]="themeLabel()"
            (click)="theme.toggle()"
          >
            <app-icon [name]="theme.preference() === 'dark' ? 'sun' : 'moon'" />
          </button>
          <a class="nav-icon-btn gap-1.5" [href]="repoUrl" rel="noopener">
            <app-icon name="code" />
            <span class="sr-only 2xl:not-sr-only">GitHub</span>
          </a>
          <button
            type="button"
            class="nav-icon-btn lg:hidden"
            aria-controls="primary-nav"
            [attr.aria-expanded]="menuOpen()"
            [attr.aria-label]="menuOpen() ? 'Close menu' : 'Open menu'"
            (click)="menuOpen.update((open) => !open)"
          >
            <app-icon [name]="menuOpen() ? 'x' : 'menu'" />
          </button>
        </div>
      </div>
    </header>
  `,
})
export class TopNavComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly items = NAV_ITEMS;
  protected readonly siteName = SITE_NAME;
  protected readonly repoUrl = REPO_URL;
  protected readonly menuOpen = signal(false);
  protected readonly themeLabel = computed(() =>
    this.theme.preference() === 'dark'
      ? 'Theme: dark. Switch to light'
      : 'Theme: light. Switch to dark',
  );

  private readonly injector = inject(Injector);
  private searchOpen = false;

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!isSearchShortcut(event)) return;
    event.preventDefault();
    void this.openSearch();
  }

  /** Search code (CDK dialog, MiniSearch, the index) loads on first use. */
  protected async openSearch(): Promise<void> {
    if (this.searchOpen) return;
    this.searchOpen = true;
    try {
      const [{ Dialog }, { Overlay }, { SearchDialogComponent }] = await Promise.all([
        import('@angular/cdk/dialog'),
        import('@angular/cdk/overlay'),
        import('../../shared/search-dialog/search-dialog.component'),
      ]);
      const overlay = this.injector.get(Overlay);
      const ref = this.injector.get(Dialog).open(SearchDialogComponent, {
        ariaLabel: 'Search',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        panelClass: 'search-dialog-pane',
        positionStrategy: overlay.position().global().centerHorizontally().top('10vh'),
      });
      ref.closed.subscribe(() => (this.searchOpen = false));
    } catch (error) {
      this.searchOpen = false;
      throw error;
    }
  }
}
