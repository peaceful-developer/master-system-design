/** A small search index built the same way as the real one, for unit tests. */
import { SEARCH_OPTIONS } from '@content/search-options';
import type { SearchDoc } from '@content/types';
import MiniSearch from 'minisearch';

const doc = (url: string, kind: SearchDoc['kind'], title: string, text = ''): SearchDoc => ({
  id: url,
  url,
  kind,
  title,
  summary: `About ${title.toLowerCase()}.`,
  headings: '',
  text,
});

export const TEST_SEARCH_DOCS: SearchDoc[] = [
  doc('/learn/building-blocks/caching-and-cdns', 'lesson', 'Caching and CDNs', 'cache hit rate'),
  doc('/learn/foundations/latency-numbers', 'lesson', 'Latency numbers', 'p99 tail latency'),
  doc('/glossary#cache-aside', 'glossary', 'Cache-aside', 'lazy loading'),
  doc('/exercises/caching-quiz', 'exercise', 'Caching quiz', 'cache'),
];

export function testSearchIndex(docs: SearchDoc[] = TEST_SEARCH_DOCS): unknown {
  const index = new MiniSearch<SearchDoc>(SEARCH_OPTIONS);
  index.addAll(docs);
  return JSON.parse(JSON.stringify(index));
}
