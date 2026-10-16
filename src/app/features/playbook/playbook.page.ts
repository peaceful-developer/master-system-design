import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { CompiledPlaybook } from '@content/types';
import { ContentService } from '../../core/content/content.service';
import { pathNeighbors } from '../../core/content/path-nav';
import type { ItemKey } from '../../core/progress/progress-model';
import { SeoService } from '../../core/seo/seo.service';
import { DocLayoutComponent } from '../../layout/doc-layout/doc-layout.component';
import { TocComponent } from '../../layout/toc/toc.component';
import { CompleteToggleComponent } from '../../shared/complete-toggle/complete-toggle.component';
import { ContentBlocksComponent } from '../../shared/content-blocks/content-blocks.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PracticeListComponent } from '../../shared/practice-list/practice-list.component';
import { PrevNextComponent } from '../../shared/prev-next/prev-next.component';
import { REPO_URL } from '../../site';

@Component({
  selector: 'app-playbook-page',
  imports: [
    RouterLink,
    RouterLinkActive,
    DocLayoutComponent,
    TocComponent,
    ContentBlocksComponent,
    CompleteToggleComponent,
    PracticeListComponent,
    PrevNextComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-doc-layout sidebarLabel="All playbooks">
      <nav sidebar aria-label="Playbooks">
        <p class="mb-2 px-3 text-sm font-semibold">Playbooks</p>
        <ol class="space-y-0.5">
          @for (p of playbooks(); track p.slug) {
            <li>
              <a
                class="menu-item text-[0.9375rem]"
                [routerLink]="p.url"
                routerLinkActive="is-active"
                ariaCurrentWhenActive="page"
              >
                {{ p.title }}
              </a>
            </li>
          }
        </ol>
      </nav>

      <article>
        <header class="mb-8 max-w-[75ch]">
          <p class="text-sm font-semibold">Playbook</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight">{{ playbook().title }}</h1>
          <p class="mt-3 text-lg">{{ playbook().summary }}</p>
          <p class="mt-3 flex items-center gap-1.5 text-sm">
            <app-icon name="clock" size="1em" /> {{ playbook().estimatedMinutes }} min read
          </p>
        </header>
        <app-content-blocks [blocks]="playbook().blocks" />
        <app-practice-list [exerciseIds]="playbook().exercises" />
        <div class="mt-10 flex max-w-[75ch] flex-wrap items-center justify-between gap-4">
          <app-complete-toggle [itemKey]="key()" />
          <a
            class="edit-link inline-flex items-center gap-1.5 text-sm"
            [href]="editUrl()"
            rel="noopener"
          >
            <app-icon name="pencil" size="1em" /> Edit this page on GitHub
          </a>
        </div>
        <app-prev-next [prev]="neighbors().prev" [next]="neighbors().next" />
      </article>

      <app-toc toc [headings]="playbook().headings" />
    </app-doc-layout>
  `,
})
export class PlaybookPage {
  private readonly content = inject(ContentService);
  readonly playbook = input.required<CompiledPlaybook>();

  protected readonly playbooks = computed(() => this.content.playbooks());
  protected readonly key = computed<ItemKey>(() => `playbook:${this.playbook().slug}`);
  protected readonly neighbors = computed(() =>
    pathNeighbors(this.content.pathEntries(), this.key()),
  );
  protected readonly editUrl = computed(() => `${REPO_URL}/edit/main/${this.playbook().file}`);

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const p = this.playbook();
      seo.setPage({ title: p.title, description: p.summary, path: p.url });
    });
  }
}
