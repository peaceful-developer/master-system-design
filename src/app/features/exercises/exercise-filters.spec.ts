import type { ExerciseMeta } from '@content/types';
import { exerciseTopics, filterExercises } from './exercise-filters';

const ex = (id: string, kind: ExerciseMeta['kind'], topics: string[]): ExerciseMeta => ({
  id,
  kind,
  title: id,
  topics,
  difficulty: 'beginner',
  url: `/exercises/${id}`,
  usedBy: [],
});

const ITEMS = [
  ex('caching-quiz', 'quiz', ['caching', 'cdn']),
  ex('latency-budget', 'drill', ['latency']),
  ex('qps', 'drill', ['estimation', 'traffic']),
  ex('replication-quiz', 'quiz', ['replication', 'databases']),
];

const ids = (items: ExerciseMeta[]) => items.map((e) => e.id);

describe('filterExercises', () => {
  it('returns everything when no filter is set', () => {
    expect(ids(filterExercises(ITEMS, { kinds: [], topics: [] }))).toEqual(ids(ITEMS));
  });

  it('filters by kind', () => {
    expect(ids(filterExercises(ITEMS, { kinds: ['drill'], topics: [] }))).toEqual([
      'latency-budget',
      'qps',
    ]);
  });

  it('keeps exercises that share any selected topic', () => {
    expect(ids(filterExercises(ITEMS, { kinds: [], topics: ['latency', 'databases'] }))).toEqual([
      'latency-budget',
      'replication-quiz',
    ]);
  });

  it('combines kind and topic filters', () => {
    expect(
      ids(filterExercises(ITEMS, { kinds: ['quiz'], topics: ['latency', 'caching'] })),
    ).toEqual(['caching-quiz']);
  });
});

describe('exerciseTopics', () => {
  it('lists every topic once, sorted', () => {
    expect(exerciseTopics(ITEMS)).toEqual([
      'caching',
      'cdn',
      'databases',
      'estimation',
      'latency',
      'replication',
      'traffic',
    ]);
  });
});
