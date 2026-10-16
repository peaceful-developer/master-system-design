import type { ParamMap, Params } from '@angular/router';
import type { CaseStudyMeta, CaseStudyStatus, Difficulty, Track } from '@content/types';

export interface CaseStudyFilters {
  tracks: Track[];
  difficulties: Difficulty[];
  concepts: string[];
  statuses: CaseStudyStatus[];
  query: string;
}

export const EMPTY_FILTERS: CaseStudyFilters = {
  tracks: [],
  difficulties: [],
  concepts: [],
  statuses: [],
  query: '',
};

export const TRACK_VALUES: readonly Track[] = ['A', 'B', 'C'];
export const DIFFICULTY_VALUES: readonly Difficulty[] = ['beginner', 'intermediate', 'advanced'];
export const STATUS_VALUES: readonly CaseStudyStatus[] = ['complete', 'outline'];

const conceptText = (id: string) => id.replace(/-/g, ' ');

/** OR within a facet, AND across facets; the query searches title, summary and concepts. */
export function filterCaseStudies(
  items: readonly CaseStudyMeta[],
  f: CaseStudyFilters,
): CaseStudyMeta[] {
  const query = f.query.trim().toLowerCase();
  return items.filter(
    (c) =>
      (f.tracks.length === 0 || f.tracks.includes(c.track)) &&
      (f.difficulties.length === 0 || f.difficulties.includes(c.difficulty)) &&
      (f.statuses.length === 0 || f.statuses.includes(c.status)) &&
      (f.concepts.length === 0 || c.concepts.some((k) => f.concepts.includes(k))) &&
      (query === '' ||
        [c.title, c.summary, ...c.concepts.map(conceptText)].some((text) =>
          text.toLowerCase().includes(query),
        )),
  );
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pick<T extends string>(values: readonly string[], allowed: readonly T[]): T[] {
  return [...new Set(values)].filter((v): v is T => (allowed as readonly string[]).includes(v));
}

/** Reads filters from the URL, dropping anything unknown. */
export function filtersFromParams(p: ParamMap): CaseStudyFilters {
  return {
    tracks: pick(p.getAll('track'), TRACK_VALUES),
    difficulties: pick(p.getAll('difficulty'), DIFFICULTY_VALUES),
    concepts: [...new Set(p.getAll('concept'))].filter((c) => SLUG_RE.test(c)),
    statuses: pick(p.getAll('status'), STATUS_VALUES),
    query: (p.get('q') ?? '').slice(0, 100),
  };
}

/** Writes filters as query params, leaving out empty facets. */
export function filtersToParams(f: CaseStudyFilters): Params {
  const params: Params = {};
  if (f.tracks.length) params['track'] = f.tracks;
  if (f.difficulties.length) params['difficulty'] = f.difficulties;
  if (f.concepts.length) params['concept'] = f.concepts;
  if (f.statuses.length) params['status'] = f.statuses;
  // Kept as typed (not trimmed) so a space typed between words survives the URL round trip.
  if (f.query.trim()) params['q'] = f.query;
  return params;
}
