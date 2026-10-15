import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { CompiledLesson } from '@content/types';
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

@Component({
  selector: 'app-lesson-page',
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
    <app-doc-layout [sidebarLabel]="'Phase ' + phaseNumber() + ' lessons'">
      <nav sidebar aria-label="Lessons in this phase">
        <p class="mb-2 px-3 text-sm font-semibold">
          Phase {{ phaseNumber() }} · {{ phaseTitle() }}
        </p>
        <ol class="space-y-0.5">
          @for (l of phaseLessons(); track l.slug) {
            <li>
              <a
                class="menu-item text-[0.9375rem]"
                [routerLink]="l.url"
                routerLinkActive="is-active"
                ariaCurrentWhenActive="page"
              >
                <app-icon
                  [name]="store.isComplete(keyOf(l.phase, l.slug)) ? 'check-circle' : 'circle'"
                  [label]="store.isComplete(keyOf(l.phase, l.slug)) ? 'Completed' : undefined"
                  size="1em"
                />
                <span>{{ l.title }}</span>
              </a>
            </li>
          }
        </ol>
      </nav>

      <article>
        <header class="mb-8 max-w-[75ch]">
          <p class="text-sm font-semibold">Phase {{ phaseNumber() }} · {{ phaseTitle() }}</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight">{{ lesson().title }}</h1>
          <p class="mt-3 text-lg">{{ lesson().summary }}</p>
          <p class="mt-3 flex items-center gap-1.5 text-sm">
            <app-icon name="clock" size="1em" /> {{ lesson().estimatedMinutes }} min read
          </p>
        </header>

        <app-content-blocks [blocks]="lesson().blocks" />

        <app-practice-list [exerciseIds]="lesson().exercises" />

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

      <app-toc toc [headings]="lesson().headings" />
    </app-doc-layout>
  `,
})
export class LessonPage {
  private readonly content = inject(ContentService);
  protected readonly store = inject(ProgressStore);

  readonly lesson = input.required<CompiledLesson>();

  protected readonly phase = computed(() => this.content.phase(this.lesson().phase));
  protected readonly phaseNumber = computed(() => this.phase()?.number ?? 0);
  protected readonly phaseTitle = computed(() => this.phase()?.title ?? '');
  protected readonly phaseLessons = computed(() => this.content.lessons(this.lesson().phase));
  protected readonly key = computed<ItemKey>(() =>
    this.keyOf(this.lesson().phase, this.lesson().slug),
  );
  protected readonly neighbors = computed(() =>
    pathNeighbors(this.content.pathEntries(), this.key()),
  );
  protected readonly editUrl = computed(() => `${REPO_URL}/edit/main/${this.lesson().file}`);

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const l = this.lesson();
      seo.setPage({ title: l.title, description: l.summary, path: l.url });
    });
  }

  protected keyOf(phase: string, slug: string): ItemKey {
    return `lesson:${phase}/${slug}`;
  }
}
