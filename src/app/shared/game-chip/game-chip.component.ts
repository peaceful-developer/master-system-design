import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameStore } from '../../core/game/game.store';
import { FeatherBurstComponent } from '../celebrate/feather-burst.component';
import { IconComponent } from '../icon/icon.component';

const BURST_MS = 1200;

/** "Lv 4 Flyer · 6-day streak" in the nav, linking to the progress page. */
@Component({
  selector: 'app-game-chip',
  imports: [RouterLink, IconComponent, FeatherBurstComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Global class names, loaded with this component instead of in the initial bundle.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './game-chip.component.css',
  template: `
    @if (game.active() && !game.calm()) {
      <a class="game-chip" routerLink="/progress">
        <!-- One spoken name at every width, starting with the visible "Lv N" so voice control
             users can say what they see; the visible pieces below are for sighted users. -->
        <span class="sr-only">{{ label() }}</span>
        <span aria-hidden="true">Lv {{ game.level().level.n }}</span>
        <span class="game-chip-name" aria-hidden="true">{{ game.level().level.name }}</span>
        @if (game.streak().current > 0) {
          <span class="game-chip-streak" aria-hidden="true">
            <app-icon name="flame" size="1em" />
            <span class="game-chip-streak-text">{{ game.streak().current }}-day streak</span>
            <span class="game-chip-streak-short">{{ game.streak().current }}</span>
          </span>
        }
        <app-feather-burst [active]="leveledUp()" />
      </a>
    }
  `,
})
export class GameChipComponent {
  protected readonly game = inject(GameStore);
  protected readonly leveledUp = signal(false);

  protected readonly label = computed(() => {
    const { level } = this.game.level();
    const streak = this.game.streak().current;
    return (
      `Lv ${level.n}, ${level.name}, ${this.game.xp()} XP` +
      (streak > 0 ? `, ${streak}-day streak` : '') +
      '. View your progress'
    );
  });

  constructor() {
    let previous: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
    effect(() => {
      if (!this.game.active()) return;
      const n = this.game.level().level.n;
      if (previous !== null && n > previous) {
        untracked(() => this.leveledUp.set(true));
        clearTimeout(timer);
        timer = setTimeout(() => this.leveledUp.set(false), BURST_MS);
      }
      previous = n;
    });
  }
}
