import { inject, Injectable, InjectionToken } from '@angular/core';
import { SEARCH_OPTIONS } from '@content/search-options';
import type { SearchDoc, SearchKind } from '@content/types';
import MiniSearch, { type AsPlainObject } from 'minisearch';

export interface SearchHit {
  url: string;
  title: string;
  kind: SearchKind;
  summary: string;
}

export const MIN_QUERY_LENGTH = 2;
export const MAX_HITS = 20;

/** Loads the prebuilt index (src/generated/search-index.json) as its own chunk. */
export const SEARCH_INDEX_LOADER = new InjectionToken<() => Promise<unknown>>(
  'SEARCH_INDEX_LOADER',
  {
    providedIn: 'root',
    factory: () => () => import('@generated/search-index.json').then((m) => m.default),
  },
);

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly loadIndex = inject(SEARCH_INDEX_LOADER);
  private index?: Promise<MiniSearch<SearchDoc>>;

  async search(query: string): Promise<SearchHit[]> {
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH) return [];
    this.index ??= this.loadIndex().then((json) =>
      MiniSearch.loadJS<SearchDoc>(json as AsPlainObject, SEARCH_OPTIONS),
    );
    const results = (await this.index).search(text);
    return results.slice(0, MAX_HITS).map((r) => ({
      url: r['url'] as string,
      title: r['title'] as string,
      kind: r['kind'] as SearchKind,
      summary: r['summary'] as string,
    }));
  }
}
