import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ContentService } from '../../core/content/content.service';
import type { ItemKey } from '../../core/progress/progress-model';
import { ProgressStore } from '../../core/progress/progress.store';
import { IconComponent } from '../../shared/icon/icon.component';

/**
 * The whole learning path as a sidebar: one foldable group per phase, with the phase that
 * holds the current item open, so a reader can see and jump to every phase from any page.
 */
@Component({
  selector: 'app-path-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="All phases" class="space-y-1">
      @for (phase of phases(); track phase.id) {
        <details class="path-sidebar-phase" [attr.open]="phase.id === currentPhase() ? '' : null">
          <summary class="cursor-pointer rounded px-3 py-1.5 text-sm font-semibold">
            Phase {{ phase.number }} · {{ phase.title }}
          </summary>
          @if (phase.entries.length > 0) {
            <ol class="mt-0.5 mb-2 space-y-0.5">
              @for (e of phase.entries; track e.key) {
                <li>
                  <a
                    class="menu-item text-[0.9375rem]"
                    [routerLink]="e.url"
                    routerLinkActive="is-active"
                    ariaCurrentWhenActive="page"
                  >
                    <app-icon
                      [name]="store.isComplete(e.key) ? 'check-circle' : 'circle'"
                      [label]="store.isComplete(e.key) ? 'Completed' : undefined"
                      size="1em"
                    />
                    <span>{{ e.title }}</span>
                  </a>
                </li>
              }
            </ol>
          } @else {
            <p class="mb-2 px-3 text-sm">Coming soon</p>
          }
        </details>
      }
    </nav>
  `,
})
export class PathSidebarComponent {
  private readonly content = inject(ContentService);
  protected readonly store = inject(ProgressStore);

  /** The item on this page; its phase starts open. */
  readonly current = input.required<ItemKey>();

  protected readonly phases = computed(() => {
    const entries = this.content.pathEntries();
    return this.content.path().phases.map((p) => ({
      ...p,
      entries: entries.filter((e) => e.phase === p.id),
    }));
  });

  protected readonly currentPhase = computed(
    () => this.content.pathEntries().find((e) => e.key === this.current())?.phase,
  );
}
