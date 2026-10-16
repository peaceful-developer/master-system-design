import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { CaseStudyMeta } from '@content/types';
import { ContentService } from '../../core/content/content.service';
import { ProgressStore } from '../../core/progress/progress.store';
import { SeoService } from '../../core/seo/seo.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { MascotComponent } from '../../shared/mascot/mascot.component';
import {
  DIFFICULTY_VALUES,
  EMPTY_FILTERS,
  filterCaseStudies,
  filtersFromParams,
  filtersToParams,
  STATUS_VALUES,
  TRACK_VALUES,
  type CaseStudyFilters,
} from './case-study-filters';
import { TRACK_LABELS } from './tracks';

type ListFacet = 'tracks' | 'difficulties' | 'concepts' | 'statuses';

@Component({
  selector: 'app-case-studies-page',
  imports: [RouterLink, IconComponent, MascotComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Global class names, loaded with this component instead of in the initial bundle.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './case-studies.page.css',
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Case studies</h1>
        <p class="page-lead">
          Real systems designed step by step: requirements, estimates, a diagram, deep dives and
          trade-offs. Outlines are ready-made starting points that welcome contributions.
        </p>
      </header>

      @if (all.length === 0) {
        <div class="path-empty">
          <app-mascot pose="sleep" size="4.5rem" />
          <p>
            Case studies are being written. Meanwhile, the
            <a routerLink="/path">learning path</a> has every lesson published so far.
          </p>
        </div>
      } @else {
        <div class="catalog">
          <form class="catalog-filters" role="search" (submit)="$event.preventDefault()">
            <label class="filter-search">
              <span class="filter-legend">Search</span>
              <input
                type="search"
                class="search-input"
                placeholder="Title, summary or concept"
                [value]="filters().query"
                (input)="setQuery($event)"
              />
            </label>

            <fieldset class="filter-group">
              <legend class="filter-legend">Track</legend>
              @for (t of tracks; track t) {
                <label class="check-row">
                  <input
                    type="checkbox"
                    name="track"
                    [value]="t"
                    [checked]="filters().tracks.includes(t)"
                    (change)="toggle('tracks', t)"
                  />
                  {{ t }} · {{ trackLabels[t] }}
                </label>
              }
            </fieldset>

            <fieldset class="filter-group">
              <legend class="filter-legend">Difficulty</legend>
              @for (d of difficulties; track d) {
                <label class="check-row">
                  <input
                    type="checkbox"
                    name="difficulty"
                    [value]="d"
                    [checked]="filters().difficulties.includes(d)"
                    (change)="toggle('difficulties', d)"
                  />
                  {{ d }}
                </label>
              }
            </fieldset>

            <fieldset class="filter-group">
              <legend class="filter-legend">Status</legend>
              @for (s of statuses; track s) {
                <label class="check-row">
                  <input
                    type="checkbox"
                    name="status"
                    [value]="s"
                    [checked]="filters().statuses.includes(s)"
                    (change)="toggle('statuses', s)"
                  />
                  {{ s === 'complete' ? 'Complete' : 'Outline' }}
                </label>
              }
            </fieldset>

            @if (concepts.length > 0) {
              <details class="filter-group" [open]="filters().concepts.length > 0">
                <summary class="filter-legend">Concepts</summary>
                <fieldset class="concept-list">
                  <legend class="sr-only">Concepts</legend>
                  @for (c of concepts; track c.id) {
                    <label class="check-row">
                      <input
                        type="checkbox"
                        name="concept"
                        [value]="c.id"
                        [checked]="filters().concepts.includes(c.id)"
                        (change)="toggle('concepts', c.id)"
                      />
                      {{ c.name }}
                    </label>
                  }
                </fieldset>
              </details>
            }

            @if (isFiltered()) {
              <button type="button" class="filter-clear" (click)="update(empty)">
                Clear filters
              </button>
            }
          </form>

          <div>
            <p class="text-sm" aria-live="polite">
              Showing {{ shown().length }} of {{ all.length }}
            </p>
            @for (group of groups(); track group.track) {
              <section class="track-group" [attr.aria-labelledby]="'track-' + group.track">
                <h2 class="section-title" [id]="'track-' + group.track">
                  Track {{ group.track }} · {{ trackLabels[group.track] }}
                </h2>
                <ol class="case-list">
                  @for (c of group.items; track c.slug) {
                    <li>
                      <a class="case-row" [routerLink]="c.url">
                        <span class="case-order" aria-hidden="true">{{ c.order }}</span>
                        <span class="flex-1">
                          <span class="case-title">{{ c.title }}</span>
                          <span class="case-meta">
                            <span class="chip-outline">{{ c.difficulty }}</span>
                            @if (c.status === 'outline') {
                              <span class="chip-outline">Outline</span>
                            }
                            <span>{{ c.estimatedMinutes }} min</span>
                          </span>
                        </span>
                        @if (isDone(c.slug)) {
                          <app-icon name="check-circle" label="Completed" />
                        }
                      </a>
                    </li>
                  }
                </ol>
              </section>
            } @empty {
              <p class="mt-6">No case studies match these filters.</p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CaseStudiesPage {
  private readonly content = inject(ContentService);
  private readonly store = inject(ProgressStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly all = [...this.content.caseStudies()].sort(
    (a, b) => a.track.localeCompare(b.track) || a.order - b.order,
  );
  protected readonly tracks = TRACK_VALUES;
  protected readonly difficulties = DIFFICULTY_VALUES;
  protected readonly statuses = STATUS_VALUES;
  protected readonly trackLabels = TRACK_LABELS;
  protected readonly empty = EMPTY_FILTERS;
  protected readonly concepts = this.conceptOptions();

  protected readonly filters = signal<CaseStudyFilters>(EMPTY_FILTERS);
  protected readonly shown = computed(() => filterCaseStudies(this.all, this.filters()));
  protected readonly isFiltered = computed(
    () => Object.keys(filtersToParams(this.filters())).length > 0,
  );
  protected readonly groups = computed(() =>
    this.tracks
      .map((track) => ({ track, items: this.shown().filter((c) => c.track === track) }))
      .filter((g) => g.items.length > 0),
  );

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.filters.set(filtersFromParams(params)));
    inject(SeoService).setPage({
      title: 'Case studies',
      description:
        'Fifty system design case studies, from URL shorteners to LLM platforms, with diagrams and trade-offs.',
      path: '/case-studies',
    });
  }

  protected toggle(facet: ListFacet, value: string): void {
    const current = this.filters()[facet] as string[];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    this.update({ ...this.filters(), [facet]: next });
  }

  protected setQuery(event: Event): void {
    this.update({ ...this.filters(), query: (event.target as HTMLInputElement).value });
  }

  protected update(filters: CaseStudyFilters): void {
    this.filters.set(filters);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filtersToParams(filters),
      replaceUrl: true,
    });
  }

  protected isDone(slug: string): boolean {
    return this.store.isComplete(`case-study:${slug}`);
  }

  private conceptOptions(): { id: string; name: string }[] {
    const names = new Map(this.content.glossary().map((t) => [t.id, t.term]));
    const ids = new Set(this.all.flatMap((c: CaseStudyMeta) => c.concepts));
    return [...ids]
      .map((id) => ({ id, name: names.get(id) ?? id.replace(/-/g, ' ') }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
