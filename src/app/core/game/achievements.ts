import type { CaseStudyStatus, PhaseId, Track } from '@content/types';
import type { DrillAttempt, ItemKey, QuizScore } from '../progress/progress-model';

export interface AchievementContext {
  completed: ReadonlySet<ItemKey>;
  quizScores: Readonly<Record<string, QuizScore>>;
  drillAttempts: Readonly<Record<string, DrillAttempt>>;
  /** Lesson keys of each phase. */
  lessonsByPhase: ReadonlyMap<PhaseId, readonly ItemKey[]>;
  caseStudies: readonly { slug: string; track: Track; status: CaseStudyStatus }[];
  streak: { current: number; longest: number };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned(ctx: AchievementContext): boolean;
}

const anyCompleted = (ctx: AchievementContext, prefix: string) =>
  [...ctx.completed].some((k) => k.startsWith(prefix));

const phaseDone = (ctx: AchievementContext, phase: PhaseId) => {
  const lessons = ctx.lessonsByPhase.get(phase) ?? [];
  return lessons.length > 0 && lessons.every((k) => ctx.completed.has(k));
};

const trackExplored = (ctx: AchievementContext, track: Track) =>
  ctx.caseStudies.some(
    (c) =>
      c.track === track && c.status === 'complete' && ctx.completed.has(`case-study:${c.slug}`),
  );

const perfectQuizzes = (ctx: AchievementContext) =>
  Object.values(ctx.quizScores).filter((s) => s.total > 0 && s.best === s.total).length;

const perfectDrills = (ctx: AchievementContext) =>
  Object.values(ctx.drillAttempts).filter((d) => d.total > 0 && d.bestCorrect === d.total).length;

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-flight',
    title: 'First flight',
    description: 'Complete your first lesson.',
    icon: 'feather',
    earned: (c) => anyCompleted(c, 'lesson:'),
  },
  {
    id: 'foundations-done',
    title: 'Solid ground',
    description: 'Complete every Foundations lesson.',
    icon: 'book-open',
    earned: (c) => phaseDone(c, 'foundations'),
  },
  {
    id: 'building-blocks-done',
    title: 'Builder',
    description: 'Complete every building-blocks lesson.',
    icon: 'layers',
    earned: (c) => phaseDone(c, 'building-blocks'),
  },
  {
    id: 'first-case-study',
    title: 'Case cracked',
    description: 'Complete your first case study.',
    icon: 'route',
    earned: (c) => anyCompleted(c, 'case-study:'),
  },
  {
    id: 'track-a-explorer',
    title: 'Systems explorer',
    description: 'Complete a full Track A (classic systems) case study.',
    icon: 'app-server',
    earned: (c) => trackExplored(c, 'A'),
  },
  {
    id: 'track-b-explorer',
    title: 'ML explorer',
    description: 'Complete a full Track B (ML systems) case study.',
    icon: 'model-server-gpu',
    earned: (c) => trackExplored(c, 'B'),
  },
  {
    id: 'track-c-explorer',
    title: 'LLM explorer',
    description: 'Complete a full Track C (LLM systems) case study.',
    icon: 'llm-api',
    earned: (c) => trackExplored(c, 'C'),
  },
  {
    id: 'perfect-quiz',
    title: 'Sharp eye',
    description: 'Get every answer right in a quiz.',
    icon: 'star',
    earned: (c) => perfectQuizzes(c) >= 1,
  },
  {
    id: 'five-perfect-quizzes',
    title: 'Quiz ace',
    description: 'Get five quizzes completely right.',
    icon: 'trophy',
    earned: (c) => perfectQuizzes(c) >= 5,
  },
  {
    id: 'estimator',
    title: 'Estimator',
    description: 'Get every answer within range in three estimation drills.',
    icon: 'flask',
    earned: (c) => perfectDrills(c) >= 3,
  },
  {
    id: 'streak-3',
    title: 'Warming up',
    description: 'Learn on three days in a row.',
    icon: 'flame',
    earned: (c) => c.streak.longest >= 3,
  },
  {
    id: 'streak-7',
    title: 'On a roll',
    description: 'Learn on seven days in a row.',
    icon: 'sparkles',
    earned: (c) => c.streak.longest >= 7,
  },
];

export function earnedAchievements(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((a) => a.earned(ctx)).map((a) => a.id);
}

export function newAchievements(earned: readonly string[], seen: readonly string[]): string[] {
  const seenSet = new Set(seen);
  return earned.filter((id) => !seenSet.has(id));
}
