import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { FooterComponent } from './layout/footer/footer.component';
import { TopNavComponent } from './layout/top-nav/top-nav.component';
import { AchievementToastComponent } from './shared/achievement-toast/achievement-toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopNavComponent, FooterComponent, AchievementToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <app-top-nav />
    <main id="main" tabindex="-1" class="min-h-[60vh] outline-none">
      <router-outlet />
    </main>
    <app-footer />
    @defer (on idle) {
      <app-achievement-toast />
    }
  `,
})
export class App {
  constructor() {
    // Created eagerly so a stored dark-theme choice is synced after hydration.
    inject(ThemeService);
  }
}
