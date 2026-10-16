import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { GlossaryTerm, LessonMeta } from '@content/types';
import { ContentService } from '../../core/content/content.service';
import { SeoService } from '../../core/seo/seo.service';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface LetterGroup {
  letter: string;
  terms: GlossaryTerm[];
}

/** Terms grouped by first letter; anything not starting with A–Z goes under "#". */
export function groupTerms(terms: readonly GlossaryTerm[]): LetterGroup[] {
  const groups = new Map<string, GlossaryTerm[]>();
  const sorted = [...terms].sort((a, b) =>
    a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }),
  );
  for (const term of sorted) {
    const first = term.term[0]?.toUpperCase() ?? '#';
    const letter = LETTERS.includes(first) ? first : '#';
    groups.set(letter, [...(groups.get(letter) ?? []), term]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)))
    .map(([letter, list]) => ({ letter, terms: list }));
}

@Component({
  selector: 'app-glossary-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Global class names, loaded with this component instead of in the initial bundle.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './glossary.page.css',
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Glossary</h1>
        <p class="page-lead">
          Short, plain definitions of the terms used across the lessons and case studies.
        </p>
      </header>

      <nav class="az-nav" aria-label="Jump to letter" data-sticky-top>
        @for (letter of letters; track letter) {
          @if (present.has(letter)) {
            <a routerLink="/glossary" [fragment]="'letter-' + letter.toLowerCase()">{{ letter }}</a>
          } @else {
            <span aria-hidden="true">{{ letter }}</span>
          }
        }
      </nav>

      @for (group of groups; track group.letter) {
        <section
          class="glossary-group"
          [id]="'letter-' + (group.letter === '#' ? 'other' : group.letter.toLowerCase())"
        >
          <h2 class="glossary-letter">{{ group.letter }}</h2>
          @for (t of group.terms; track t.id) {
            <article class="glossary-term" [id]="t.id">
              <h3 class="glossary-term-title">{{ t.term }}</h3>
              @if (t.aliases?.length) {
                <p class="text-sm">Also called {{ t.aliases.join(', ') }}</p>
              }
              <p class="mt-1.5">{{ t.definition }}</p>
              @if (t.related?.length || taughtIn(t.id).length) {
                <p class="glossary-links">
                  @if (t.related?.length) {
                    <span>
                      See also:
                      @for (r of t.related; track r; let last = $last) {
                        <a routerLink="/glossary" [fragment]="r">{{ termName(r) }}</a
                        >{{ last ? '' : ', ' }}
                      }
                    </span>
                  }
                  @if (taughtIn(t.id).length) {
                    <span>
                      Learn it in:
                      @for (l of taughtIn(t.id); track l.url; let last = $last) {
                        <a [routerLink]="l.url">{{ l.title }}</a
                        >{{ last ? '' : ', ' }}
                      }
                    </span>
                  }
                </p>
              }
            </article>
          }
        </section>
      }
    </div>
  `,
})
export class GlossaryPage {
  private readonly content = inject(ContentService);
  private readonly terms = this.content.glossary();
  private readonly names = new Map(this.terms.map((t) => [t.id, t.term]));
  private readonly lessonsByConcept = new Map<string, LessonMeta[]>();

  protected readonly letters = LETTERS;
  protected readonly groups = groupTerms(this.terms);
  protected readonly present = new Set(this.groups.map((g) => g.letter));

  constructor() {
    for (const lesson of this.content.lessons()) {
      for (const concept of lesson.concepts) {
        this.lessonsByConcept.set(concept, [...(this.lessonsByConcept.get(concept) ?? []), lesson]);
      }
    }
    inject(SeoService).setPage({
      title: 'Glossary',
      description: 'Plain definitions of system design terms, from latency to linearizability.',
      path: '/glossary',
    });
  }

  protected termName(id: string): string {
    return this.names.get(id) ?? id;
  }

  protected taughtIn(id: string): readonly LessonMeta[] {
    return this.lessonsByConcept.get(id) ?? [];
  }
}
