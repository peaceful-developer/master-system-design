import { convertToParamMap } from '@angular/router';
import type { CaseStudyMeta } from '@content/types';
import { testCaseStudy } from '../../testing/content-test-data';
import {
  EMPTY_FILTERS,
  filterCaseStudies,
  filtersFromParams,
  filtersToParams,
  type CaseStudyFilters,
} from './case-study-filters';

const cs = (
  slug: string,
  track: CaseStudyMeta['track'],
  order: number,
  extra: Partial<CaseStudyMeta> = {},
): CaseStudyMeta => ({ ...testCaseStudy(slug, track, 'complete', order), ...extra });

const ITEMS: CaseStudyMeta[] = [
  cs('url-shortener', 'A', 1, { difficulty: 'beginner', concepts: ['hashing', 'caching'] }),
  cs('news-feed', 'A', 2, { difficulty: 'intermediate', concepts: ['fan-out', 'caching'] }),
  cs('recsys', 'B', 1, {
    difficulty: 'advanced',
    concepts: ['two-tower-retrieval'],
    title: 'Recommendation system',
  }),
  cs('fraud', 'B', 2, {
    difficulty: 'intermediate',
    concepts: ['feature-store'],
    status: 'outline',
  }),
  cs('rag', 'C', 1, { difficulty: 'advanced', concepts: ['consistent-hashing', 'vector-db'] }),
];

const f = (over: Partial<CaseStudyFilters>): CaseStudyFilters => ({ ...EMPTY_FILTERS, ...over });
const slugs = (items: CaseStudyMeta[]) => items.map((c) => c.slug);

describe('filterCaseStudies', () => {
  it('returns everything, in order, without filters', () => {
    expect(slugs(filterCaseStudies(ITEMS, EMPTY_FILTERS))).toEqual(slugs(ITEMS));
  });

  it('filters by track', () => {
    expect(slugs(filterCaseStudies(ITEMS, f({ tracks: ['B'] })))).toEqual(['recsys', 'fraud']);
  });

  it('combines facets with AND', () => {
    expect(
      slugs(filterCaseStudies(ITEMS, f({ tracks: ['B'], difficulties: ['advanced'] }))),
    ).toEqual(['recsys']);
  });

  it('matches any selected concept (OR within a facet)', () => {
    expect(
      slugs(filterCaseStudies(ITEMS, f({ concepts: ['fan-out', 'two-tower-retrieval'] }))),
    ).toEqual(['news-feed', 'recsys']);
  });

  it('filters by status', () => {
    expect(slugs(filterCaseStudies(ITEMS, f({ statuses: ['outline'] })))).toEqual(['fraud']);
  });

  it('searches titles, summaries and concept terms, ignoring case', () => {
    expect(slugs(filterCaseStudies(ITEMS, f({ query: 'Consistent Hashing' })))).toEqual(['rag']);
    expect(slugs(filterCaseStudies(ITEMS, f({ query: 'recommendation' })))).toEqual(['recsys']);
    expect(slugs(filterCaseStudies(ITEMS, f({ query: 'summary of news' })))).toEqual(['news-feed']);
  });
});

describe('filter URL params', () => {
  it('round-trips through query params', () => {
    const filters = f({
      tracks: ['A', 'C'],
      difficulties: ['advanced'],
      concepts: ['caching'],
      statuses: ['complete'],
      query: 'feed',
    });
    const params = filtersToParams(filters);
    expect(params).toEqual({
      track: ['A', 'C'],
      difficulty: ['advanced'],
      concept: ['caching'],
      status: ['complete'],
      q: 'feed',
    });
    expect(filtersFromParams(convertToParamMap(params))).toEqual(filters);
  });

  it('leaves out empty facets', () => {
    expect(filtersToParams(f({ tracks: ['B'] }))).toEqual({ track: ['B'] });
    expect(filtersToParams(EMPTY_FILTERS)).toEqual({});
  });

  it('silently ignores unknown values', () => {
    const parsed = filtersFromParams(
      convertToParamMap({ track: ['Z', 'B'], difficulty: 'impossible', status: 'draft' }),
    );
    expect(parsed).toEqual(f({ tracks: ['B'] }));
  });
});
