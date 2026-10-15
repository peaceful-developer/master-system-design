import type { PathPhase, PhaseId } from '@content/types';
import { itemKey } from '../../core/content/path-nav';
import type { ItemKey } from '../../core/progress/progress-model';

export interface ExerciseOwners {
  lessons: readonly { phase: PhaseId; slug: string; exercises: readonly string[] }[];
  caseStudies: readonly { slug: string; exercises: readonly string[] }[];
  playbooks: readonly { slug: string; exercises: readonly string[] }[];
}

/** Path item → the exercise ids it ends with. */
export function exercisesByItem(owners: ExerciseOwners): Map<ItemKey, readonly string[]> {
  return new Map<ItemKey, readonly string[]>([
    ...owners.lessons.map((l) => [itemKey('lesson', `${l.phase}/${l.slug}`), l.exercises] as const),
    ...owners.caseStudies.map((c) => [itemKey('case-study', c.slug), c.exercises] as const),
    ...owners.playbooks.map((p) => [itemKey('playbook', p.slug), p.exercises] as const),
  ]);
}

/** The keys a phase counts toward its progress: its items, then their exercises (each once). */
export function phaseKeys(
  phase: PathPhase,
  exercises: ReadonlyMap<ItemKey, readonly string[]>,
): ItemKey[] {
  const items = phase.items.map((i) => itemKey(i.kind, i.ref));
  const exerciseKeys = items.flatMap((key) =>
    (exercises.get(key) ?? []).map((id): ItemKey => `exercise:${id}`),
  );
  return [...new Set([...items, ...exerciseKeys])];
}

export function phaseProgress(
  phase: PathPhase,
  completed: ReadonlySet<ItemKey>,
  exercises: ReadonlyMap<ItemKey, readonly string[]>,
): { done: number; total: number } {
  const keys = phaseKeys(phase, exercises);
  return { done: keys.filter((k) => completed.has(k)).length, total: keys.length };
}
