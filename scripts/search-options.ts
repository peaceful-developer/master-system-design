/**
 * MiniSearch options shared by the build (which creates the index) and the
 * app (which loads it). Both sides must use identical options.
 */
import type { Options } from 'minisearch';
import type { SearchDoc } from './content-types';

export const SEARCH_OPTIONS: Options<SearchDoc> = {
  idField: 'id',
  fields: ['title', 'summary', 'headings', 'text'],
  storeFields: ['kind', 'title', 'url', 'summary'],
  searchOptions: {
    boost: { title: 3, headings: 2 },
    prefix: true,
    fuzzy: 0.2,
  },
};
