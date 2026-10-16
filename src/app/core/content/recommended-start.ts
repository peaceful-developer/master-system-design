import type { ExerciseMeta, LearningPath, Track } from '@content/types';
import type { ItemKey, LearnerLevel } from '../progress/progress-model';
import { flattenPath, itemKey, type PathEntry, type PathMeta } from './path-nav';

export interface RecommendMeta extends PathMeta {
  exercises: readonly ExerciseMeta[];
}

export interface RecommendedStart {
  start: PathEntry;
  /** Items worth doing first to check what you already know. */
  fastTrack: ItemKey[];
}

export const ML_FRAMEWORK_PLAYBOOK = 'ml-system-design-framework';

/**
 * Where a learner should begin, given how much they already know. Each level
 * falls back to an earlier start while its preferred item hasn't been written
 * yet; undefined only when the path is empty.
 */
export function recommendedStart(
  level: LearnerLevel,
  path: LearningPath,
  meta: RecommendMeta,
): RecommendedStart | undefined {
  const entries = flattenPath(path, meta);
  const firstLesson = (phase: PathEntry['phase']) =>
    entries.find((e) => e.kind === 'lesson' && e.phase === phase);
  const completeCaseStudies = (tracks: readonly Track[]) =>
    [...meta.caseStudies]
      .filter((c) => c.status === 'complete' && tracks.includes(c.track))
      .sort((a, b) => a.track.localeCompare(b.track) || a.order - b.order)
      .map((c) => itemKey('case-study', c.slug));

  const fallback = firstLesson('foundations') ?? entries[0];
  if (!fallback) return undefined;

  switch (level) {
    case 'new':
      return { start: fallback, fastTrack: [] };
    case 'some': {
      const quizIds = new Set(meta.exercises.filter((e) => e.kind === 'quiz').map((e) => e.id));
      const phaseOneQuizzes = meta.lessons
        .filter((l) => l.phase === 'building-blocks')
        .sort((a, b) => a.order - b.order)
        .flatMap((l) => l.exercises.filter((id) => quizIds.has(id)))
        .map((id): ItemKey => `exercise:${id}`);
      return {
        start: firstLesson('building-blocks') ?? fallback,
        fastTrack: [...phaseOneQuizzes, ...completeCaseStudies(['A'])],
      };
    }
    case 'expert': {
      const framework = entries.find((e) => e.key === itemKey('playbook', ML_FRAMEWORK_PLAYBOOK));
      const playbooks = [...meta.playbooks]
        .sort((a, b) => a.order - b.order)
        .map((p) => itemKey('playbook', p.slug));
      return {
        start: framework ?? firstLesson('building-blocks') ?? fallback,
        fastTrack: [...completeCaseStudies(['B', 'C']), ...playbooks],
      };
    }
  }
}
