import type {
  CaseStudyMeta,
  ExampleMeta,
  LearningPath,
  LessonMeta,
  PathItem,
  PhaseId,
  PlaybookMeta,
} from '@content/types';
import type { ItemKey } from '../progress/progress-model';

export interface PathEntry {
  key: ItemKey;
  kind: PathItem['kind'];
  title: string;
  url: string;
  phase: PhaseId;
  minutes?: number;
}

export interface PathMeta {
  lessons: readonly LessonMeta[];
  caseStudies: readonly CaseStudyMeta[];
  playbooks: readonly PlaybookMeta[];
  examples: readonly ExampleMeta[];
}

export function itemKey(kind: PathItem['kind'], ref: string): ItemKey {
  return `${kind}:${ref}`;
}

/** Every item on the learning path, in order, resolved to title and URL. */
export function flattenPath(path: LearningPath, meta: PathMeta): PathEntry[] {
  const lookup: Record<
    PathItem['kind'],
    Map<string, { title: string; url: string; estimatedMinutes?: number }>
  > = {
    lesson: new Map(meta.lessons.map((l) => [`${l.phase}/${l.slug}`, l])),
    'case-study': new Map(meta.caseStudies.map((c) => [c.slug, c])),
    playbook: new Map(meta.playbooks.map((p) => [p.slug, p])),
    example: new Map(meta.examples.map((e) => [e.slug, e])),
  };
  return path.phases.flatMap((phase) =>
    phase.items.flatMap((item) => {
      const found = lookup[item.kind].get(item.ref);
      if (!found) return [];
      return [
        {
          key: itemKey(item.kind, item.ref),
          kind: item.kind,
          title: found.title,
          url: found.url,
          phase: phase.id,
          minutes: found.estimatedMinutes,
        },
      ];
    }),
  );
}

export function pathNeighbors(
  entries: readonly PathEntry[],
  key: ItemKey,
): { prev?: PathEntry; next?: PathEntry } {
  const i = entries.findIndex((e) => e.key === key);
  if (i < 0) return {};
  return {
    ...(i > 0 ? { prev: entries[i - 1] } : {}),
    ...(i < entries.length - 1 ? { next: entries[i + 1] } : {}),
  };
}
