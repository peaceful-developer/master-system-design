import { DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import type { SearchKind } from '@content/types';
import { MIN_QUERY_LENGTH, SearchService, type SearchHit } from '../../core/search/search.service';
import { IconComponent } from '../icon/icon.component';

const KIND_LABELS: Record<SearchKind, string> = {
  lesson: 'Lesson',
  'case-study': 'Case study',
  playbook: 'Playbook',
  example: 'Worked example',
  exercise: 'Exercise',
  glossary: 'Glossary',
};

/** Site search as a combobox: type, move with the arrow keys, Enter to open, Esc to close. */
@Component({
  selector: 'app-search-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Global class names, loaded with this component instead of in the initial bundle.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './search-dialog.component.css',
  host: { class: 'search-panel' },
  template: `
    <div class="search-field">
      <app-icon name="search" />
      <input
        class="search-box"
        type="text"
        role="combobox"
        aria-label="Search the site"
        aria-autocomplete="list"
        aria-controls="search-results"
        autocomplete="off"
        spellcheck="false"
        placeholder="Search lessons, case studies and terms"
        [attr.aria-expanded]="hits().length > 0"
        [attr.aria-activedescendant]="active() >= 0 ? 'search-hit-' + active() : null"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
      />
      <kbd class="search-esc" aria-hidden="true">Esc</kbd>
    </div>

    <ul id="search-results" class="search-results" role="listbox" aria-label="Search results">
      @for (hit of hits(); track hit.url; let i = $index) {
        <!-- Combobox pattern: focus stays in the input, which handles the keyboard
             (arrows, Enter); options are pointer targets only. -->
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <li
          role="option"
          class="search-hit"
          [id]="'search-hit-' + i"
          [attr.data-url]="hit.url"
          [attr.aria-selected]="i === active()"
          (mousemove)="active.set(i)"
          (click)="open(hit)"
        >
          <span class="search-kind">{{ kindLabel(hit.kind) }}</span>
          <span class="search-title">{{ hit.title }}</span>
          <span class="search-summary">{{ hit.summary }}</span>
        </li>
      }
    </ul>

    <p class="search-status" aria-live="polite">{{ status() }}</p>
  `,
})
export class SearchDialogComponent {
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  private readonly ref = inject(DialogRef);

  protected readonly query = signal('');
  protected readonly hits = signal<SearchHit[]>([]);
  protected readonly active = signal(-1);
  private readonly searched = signal('');
  private request = 0;

  protected readonly status = computed(() => {
    const q = this.query().trim();
    if (q.length < MIN_QUERY_LENGTH) return 'Type at least two characters.';
    if (this.searched() !== q) return 'Searching…';
    const n = this.hits().length;
    return n === 0 ? `No results for “${q}”.` : `${n} result${n === 1 ? '' : 's'}.`;
  });

  protected kindLabel(kind: SearchKind): string {
    return KIND_LABELS[kind];
  }

  protected async onInput(event: Event): Promise<void> {
    const q = (event.target as HTMLInputElement).value;
    this.query.set(q);
    const id = ++this.request;
    const hits = await this.search.search(q);
    if (id !== this.request) return; // a newer query has started
    this.hits.set(hits);
    this.active.set(-1);
    this.searched.set(q.trim());
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.hits().length;
    switch (event.key) {
      case 'ArrowDown':
        if (count === 0) return;
        event.preventDefault();
        this.active.update((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        if (count === 0) return;
        event.preventDefault();
        this.active.update((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case 'Enter': {
        const hit = this.hits()[Math.max(0, this.active())];
        if (!hit) return;
        event.preventDefault();
        this.open(hit);
        break;
      }
    }
  }

  protected open(hit: SearchHit): void {
    this.ref.close();
    void this.router.navigateByUrl(hit.url);
  }
}
