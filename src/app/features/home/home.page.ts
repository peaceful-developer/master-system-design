import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PhaseId } from '@content/types';
import { ContentService } from '../../core/content/content.service';
import { SeoService } from '../../core/seo/seo.service';
import { ShowcaseFigureComponent } from '../../shared/figure/showcase-figure.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { MascotComponent } from '../../shared/mascot/mascot.component';
import { StartPickerComponent } from '../../shared/start-picker/start-picker.component';
import { SITE_TAGLINE } from '../../site';

/** What a learner can do after each phase (shown on the learning ladder). */
export const PHASE_OUTCOMES: Record<PhaseId, string> = {
  foundations:
    'Explain what happens when a page loads, choose a database, and reason about latency.',
  'building-blocks':
    'Scale a service, add caches, replicate and shard data, and estimate capacity.',
  'data-systems': 'Design pipelines that move, transform and index data at scale.',
  'ml-systems': 'Frame an ML product and design its data, training, serving and evaluation.',
  'llm-systems': 'Build LLM products that are fast, grounded, safe and affordable.',
  'frontier-infrastructure':
    'Reason about training clusters, model parallelism, failures and cost.',
};

const FEATURES = [
  {
    icon: 'book-open',
    title: 'Lessons that start simple',
    body: 'Every lesson opens with a plain-language primer, then goes deeper for those who want it.',
  },
  {
    icon: 'layers',
    title: 'Real designs, explained',
    body: 'Case studies walk through requirements, estimates, diagrams and trade-offs step by step.',
  },
  {
    icon: 'flask',
    title: 'Practice as you go',
    body: 'Quizzes and estimation drills check your understanding. Progress stays in your browser.',
  },
] as const;

@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    IconComponent,
    MascotComponent,
    StartPickerComponent,
    ShowcaseFigureComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page home">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-text">
          <h1 id="hero-title" class="hero-title">
            Learn system design, from your first API to LLM infrastructure.
          </h1>
          <p class="hero-lead">
            Free lessons, real case studies and hands-on practice that take you from the basics to
            senior, ML and LLM design interviews.
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <a class="btn" [routerLink]="firstUrl()">
              Start learning <app-icon name="arrow-right" size="1em" />
            </a>
            @if (hasCaseStudies()) {
              <a class="btn-secondary" routerLink="/case-studies">Browse case studies</a>
            } @else {
              <a class="btn-secondary" routerLink="/path">See the learning path</a>
            }
          </div>
        </div>
        <app-mascot class="hero-mascot" pose="idle" size="9rem" />
      </section>

      <section class="home-section" aria-label="Choose a starting point">
        <app-start-picker />
      </section>

      <section class="home-section" aria-labelledby="what-title">
        <h2 id="what-title" class="section-title">What this is</h2>
        <p class="section-lead">
          A free, open-source course in designing software systems: how the parts work, how they fit
          together, and how to reason about trade-offs, all the way to ML and LLM systems.
        </p>
        <ul class="feature-grid">
          @for (f of features; track f.title) {
            <li class="feature">
              <app-icon [name]="f.icon" size="1.5rem" />
              <h3 class="feature-title">{{ f.title }}</h3>
              <p>{{ f.body }}</p>
            </li>
          }
        </ul>
      </section>

      <section class="home-section" aria-labelledby="ladder-title">
        <h2 id="ladder-title" class="section-title">The learning ladder</h2>
        <p class="section-lead">Six phases. Each one builds on the last.</p>
        <ol class="ladder">
          @for (p of phases(); track p.id) {
            <li class="ladder-step">
              <span class="ladder-number" aria-hidden="true">{{ p.number }}</span>
              <div>
                <h3 class="ladder-title">
                  <a routerLink="/path" [fragment]="p.id">{{ p.title }}</a>
                </h3>
                <p>{{ p.summary }}</p>
                <p class="ladder-outcome">
                  <span class="font-semibold">You'll be able to:</span> {{ outcomes[p.id] }}
                </p>
                <p class="ladder-meta">
                  @if (p.items.length > 0) {
                    {{ p.items.length }} {{ p.items.length === 1 ? 'item' : 'items' }}
                  } @else {
                    Coming soon
                  }
                </p>
              </div>
            </li>
          }
        </ol>
      </section>

      @if (featured().length > 0) {
        <section class="home-section" aria-labelledby="featured-title">
          <h2 id="featured-title" class="section-title">Featured case studies</h2>
          <ul class="card-grid mt-6">
            @for (c of featured(); track c.slug) {
              <li>
                <a class="card card-link" [routerLink]="c.url">
                  <span class="card-kicker">Track {{ c.track }} · {{ c.difficulty }}</span>
                  <span class="card-title">{{ c.title }}</span>
                  <span class="card-body">{{ c.summary }}</span>
                </a>
              </li>
            }
          </ul>
        </section>
      }

      <section class="home-section" aria-labelledby="figure-title">
        <h2 id="figure-title" class="section-title">See it move</h2>
        <p class="section-lead">
          Diagrams are animated where motion explains something, like the round trips behind loading
          a page.
        </p>
        <app-showcase-figure
          figure="request-lifecycle"
          caption="Loading a page for the first time: DNS, TCP, TLS, then HTTP."
        />
      </section>
    </div>
  `,
})
export class HomePage {
  private readonly content = inject(ContentService);

  protected readonly features = FEATURES;
  protected readonly outcomes = PHASE_OUTCOMES;
  protected readonly phases = computed(() => this.content.path().phases);
  protected readonly firstUrl = computed(() => this.content.pathEntries()[0]?.url ?? '/path');
  protected readonly hasCaseStudies = computed(() => this.content.caseStudies().length > 0);
  protected readonly featured = computed(() =>
    this.content
      .caseStudies()
      .filter((c) => c.status === 'complete')
      .sort((a, b) => a.track.localeCompare(b.track) || a.order - b.order),
  );

  constructor() {
    inject(SeoService).setPage({ description: SITE_TAGLINE, path: '/' });
  }
}
