import type { CaseStudyStatus } from '@content/types';
import type { ItemKey, ProgressState } from '../progress/progress-model';

export const XP_RULES = {
  lesson: 20,
  playbook: 20,
  example: 10,
  caseStudyComplete: 40,
  caseStudyOutline: 15,
  exercise: 10,
  perfectQuizBonus: 10,
} as const;

export interface XpMeta {
  caseStudies: readonly { slug: string; status: CaseStudyStatus }[];
}

/** Experience points from everything completed, plus a bonus for each perfect quiz. */
export function computeXp(state: ProgressState, meta: XpMeta): number {
  const status = new Map(meta.caseStudies.map((c) => [c.slug, c.status]));
  let xp = 0;
  for (const key of Object.keys(state.completed) as ItemKey[]) {
    const [kind, ref = ''] = key.split(':') as [string, string?];
    switch (kind) {
      case 'lesson':
        xp += XP_RULES.lesson;
        break;
      case 'playbook':
        xp += XP_RULES.playbook;
        break;
      case 'example':
        xp += XP_RULES.example;
        break;
      case 'case-study':
        xp +=
          status.get(ref) === 'complete' ? XP_RULES.caseStudyComplete : XP_RULES.caseStudyOutline;
        break;
      case 'exercise':
        xp += XP_RULES.exercise;
        break;
    }
  }
  for (const score of Object.values(state.quizScores)) {
    if (score.total > 0 && score.best === score.total) xp += XP_RULES.perfectQuizBonus;
  }
  return xp;
}
