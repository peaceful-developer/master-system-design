import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { CompiledCaseStudy } from '@content/types';
import { ContentService } from '../../core/content/content.service';
import { pathNeighbors } from '../../core/content/path-nav';
import type { ItemKey } from '../../core/progress/progress-model';
import { ProgressStore } from '../../core/progress/progress.store';
import { SeoService } from '../../core/seo/seo.service';
import { DocLayoutComponent } from '../../layout/doc-layout/doc-layout.component';
import { TocComponent } from '../../layout/toc/toc.component';
import { CompleteToggleComponent } from '../../shared/complete-toggle/complete-toggle.component';
import { ContentBlocksComponent } from '../../shared/content-blocks/content-blocks.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PracticeListComponent } from '../../shared/practice-list/practice-list.component';
import { PrevNextComponent } from '../../shared/prev-next/prev-next.component';
import { REPO_URL } from '../../site';
import { TRACK_LABELS } from '../case-studies/tracks';

@Component({
  selector: 'app-case-study-page',
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
    <app-doc-layout [sidebarLabel]="'Track ' + caseStudy().track + ' case studies'">
      <nav sidebar [attr.aria-label]="'Track ' + caseStudy().track + ' case studies'">
        <p class="mb-2 px-3 text-sm font-semibold">
          Track {{ caseStudy().track }} · {{ trackLabel() }}
        </p>
        <ol class="space-y-0.5">
          @for (c of siblings(); track c.slug) {
            <li>
              <a
                class="menu-item text-[0.9375rem]"
                [routerLink]="c.url"
                routerLinkActive="is-active"
                ariaCurrentWhenActive="page"
              >
                <app-icon
                  [name]="store.isComplete(keyOf(c.slug)) ? 'check-circle' : 'circle'"
                  [label]="store.isComplete(keyOf(c.slug)) ? 'Completed' : undefined"
                  size="1em"
                />
                <span>{{ c.title }}</span>
              </a>
            </li>
          }
        </ol>
        <p class="mt-4 px-3 text-sm"><a routerLink="/case-studies">All case studies</a></p>
      </nav>

      <article>
        <header class="mb-8 max-w-[75ch]">
          <p class="text-sm font-semibold">Track {{ caseStudy().track }} · {{ trackLabel() }}</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight">{{ caseStudy().title }}</h1>
          <p class="mt-3 text-lg">{{ caseStudy().summary }}</p>
          <p class="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span class="chip-outline">{{ caseStudy().difficulty }}</span>
            <span class="inline-flex items-center gap-1.5">
              <app-icon name="clock" size="1em" /> {{ caseStudy().estimatedMinutes }} min
            </span>
          </p>
          @if (concepts().length > 0) {
            <p class="concept-chips mt-4">
              <span class="sr-only">Concepts:</span>
              @for (c of concepts(); track c.id) {
                <a class="concept-chip" routerLink="/glossary" [fragment]="c.id">{{ c.name }}</a>
              }
            </p>
          }
          @if (prerequisites().length > 0) {
            <p class="prerequisites mt-3 text-sm">
              <span class="font-semibold">Read first:</span>
              @for (p of prerequisites(); track p.slug; let last = $last) {
                <a [routerLink]="p.url">{{ p.title }}</a
                >{{ last ? '' : ', ' }}
              }
            </p>
          }
        </header>

        @if (caseStudy().status === 'outline') {
          <aside class="outline-banner" aria-label="Outline">
            <app-icon name="pencil" />
            <div>
              <p class="font-semibold">Outline: contributions welcome</p>
              <p class="text-sm">
                This case study has its structure and key points but not the full write-up yet.
                <a routerLink="/contribute">Learn how to contribute</a> or
                <a [href]="editUrl()" rel="noopener">edit it on GitHub</a>.
              </p>
            </div>
          </aside>
        }

        <app-content-blocks [blocks]="caseStudy().blocks" />
        <app-practice-list [exerciseIds]="caseStudy().exercises" />

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

      <app-toc toc [headings]="caseStudy().headings" />
    </app-doc-layout>
  `,
})
export class CaseStudyPage {
  private readonly content = inject(ContentService);
  protected readonly store = inject(ProgressStore);

  readonly caseStudy = input.required<CompiledCaseStudy>();

  protected readonly trackLabel = computed(() => TRACK_LABELS[this.caseStudy().track]);
  protected readonly siblings = computed(() =>
    this.content
      .caseStudies()
      .filter((c) => c.track === this.caseStudy().track)
      .sort((a, b) => a.order - b.order),
  );
  protected readonly concepts = computed(() => {
    const names = new Map(this.content.glossary().map((t) => [t.id, t.term]));
    return this.caseStudy().concepts.map((id) => ({ id, name: names.get(id) ?? id }));
  });
  protected readonly prerequisites = computed(() => {
    const bySlug = new Map(this.content.caseStudies().map((c) => [c.slug, c]));
    return this.caseStudy().prerequisites.flatMap((slug) => {
      const c = bySlug.get(slug);
      return c ? [c] : [];
    });
  });
  protected readonly key = computed<ItemKey>(() => this.keyOf(this.caseStudy().slug));
  protected readonly neighbors = computed(() =>
    pathNeighbors(this.content.pathEntries(), this.key()),
  );
  protected readonly editUrl = computed(() => `${REPO_URL}/edit/main/${this.caseStudy().file}`);

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const c = this.caseStudy();
      seo.setPage({ title: c.title, description: c.summary, path: c.url });
    });
  }

  protected keyOf(slug: string): ItemKey {
    return `case-study:${slug}`;
  }
}
