import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { CompiledExample } from '@content/types';
import { ContentService } from '../../core/content/content.service';
import type { ItemKey } from '../../core/progress/progress-model';
import { SeoService } from '../../core/seo/seo.service';
import { DocLayoutComponent } from '../../layout/doc-layout/doc-layout.component';
import { TocComponent } from '../../layout/toc/toc.component';
import { CompleteToggleComponent } from '../../shared/complete-toggle/complete-toggle.component';
import { ContentBlocksComponent } from '../../shared/content-blocks/content-blocks.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { REPO_URL } from '../../site';

@Component({
  selector: 'app-example-page',
  imports: [
    RouterLink,
    RouterLinkActive,
    DocLayoutComponent,
    TocComponent,
    ContentBlocksComponent,
    CompleteToggleComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-doc-layout sidebarLabel="All examples">
      <nav sidebar aria-label="Worked examples">
        <p class="mb-2 px-3 text-sm font-semibold">Worked examples</p>
        <ul class="space-y-0.5">
          @for (e of examples(); track e.slug) {
            <li>
              <a
                class="menu-item text-[0.9375rem]"
                [routerLink]="e.url"
                routerLinkActive="is-active"
                ariaCurrentWhenActive="page"
              >
                {{ e.title }}
              </a>
            </li>
          }
        </ul>
      </nav>

      <article>
        <header class="mb-8 max-w-[75ch]">
          <p class="text-sm font-semibold">Worked example</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight">{{ example().title }}</h1>
          <p class="mt-3 text-lg">{{ example().summary }}</p>
          @if (example().tags.length > 0) {
            <ul class="mt-3 flex flex-wrap gap-2" aria-label="Tags">
              @for (tag of example().tags; track tag) {
                <li class="chip-outline">{{ tag }}</li>
              }
            </ul>
          }
        </header>
        <app-content-blocks [blocks]="example().blocks" />
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
      </article>

      <app-toc toc [headings]="example().headings" />
    </app-doc-layout>
  `,
})
export class ExamplePage {
  private readonly content = inject(ContentService);
  readonly example = input.required<CompiledExample>();

  protected readonly examples = computed(() => this.content.examples());
  protected readonly key = computed<ItemKey>(() => `example:${this.example().slug}`);
  protected readonly editUrl = computed(() => `${REPO_URL}/edit/main/${this.example().file}`);

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const e = this.example();
      seo.setPage({ title: e.title, description: e.summary, path: e.url });
    });
  }
}
