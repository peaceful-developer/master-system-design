import { TestBed } from '@angular/core/testing';
import type { SearchDoc } from '@content/types';
import { testSearchIndex } from '../../testing/search-test-index';
import { SEARCH_INDEX_LOADER, SearchService } from './search.service';

function setup(index = testSearchIndex()) {
  const loader = vi.fn(async () => index);
  TestBed.configureTestingModule({
    providers: [{ provide: SEARCH_INDEX_LOADER, useValue: loader }],
  });
  return { search: TestBed.inject(SearchService), loader };
}

describe('SearchService', () => {
  it('matches word prefixes', async () => {
    const { search } = setup();
    const hits = await search.search('cach');
    expect(hits.map((h) => h.title)).toContain('Caching and CDNs');
    expect(hits[0]).toEqual(
      expect.objectContaining({
        url: expect.any(String),
        kind: expect.any(String),
        summary: expect.any(String),
      }),
    );
  });

  it('tolerates small typos', async () => {
    const { search } = setup();
    const hits = await search.search('latncy');
    expect(hits[0]?.url).toBe('/learn/foundations/latency-numbers');
  });

  it('ignores queries shorter than two characters, without loading the index', async () => {
    const { search, loader } = setup();
    expect(await search.search(' a ')).toEqual([]);
    expect(loader).not.toHaveBeenCalled();
  });

  it('returns at most 20 hits', async () => {
    const docs: SearchDoc[] = Array.from({ length: 30 }, (_, i) => ({
      id: `/doc-${i}`,
      url: `/doc-${i}`,
      kind: 'lesson',
      title: `Replication part ${i}`,
      summary: 'Replication.',
      headings: '',
      text: '',
    }));
    const { search } = setup(testSearchIndex(docs));
    expect((await search.search('replication')).length).toBe(20);
  });

  it('loads the index only once', async () => {
    const { search, loader } = setup();
    await search.search('cache');
    await search.search('latency');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
