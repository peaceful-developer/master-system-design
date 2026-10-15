import type { ExerciseMeta } from '@content/types';

export interface ExerciseFilter {
  /** Empty means every kind. */
  kinds: readonly ExerciseMeta['kind'][];
  /** Empty means every topic; otherwise an exercise matches if it has any of them. */
  topics: readonly string[];
}

export function filterExercises(
  items: readonly ExerciseMeta[],
  { kinds, topics }: ExerciseFilter,
): ExerciseMeta[] {
  return items.filter(
    (e) =>
      (kinds.length === 0 || kinds.includes(e.kind)) &&
      (topics.length === 0 || e.topics.some((t) => topics.includes(t))),
  );
}

export function exerciseTopics(items: readonly ExerciseMeta[]): string[] {
  return [...new Set(items.flatMap((e) => e.topics))].sort();
}
