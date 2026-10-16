/**
 * Shapes of the compiled content the build writes to `src/generated/`.
 * The app imports this file as `@content/types`. It holds types plus a few
 * plain constants, so nothing from the build tooling (zod, unified) reaches
 * the browser bundle.
 */
import type {
  CaseStudyFrontmatter,
  Difficulty,
  Drill,
  ExampleFrontmatter,
  LessonFrontmatter,
  PlaybookFrontmatter,
  Quiz,
} from './schemas';

export type {
  CaseStudyFrontmatter,
  CaseStudyStatus,
  ComponentCategory,
  ComponentCatalog,
  ComponentDef,
  Diagram,
  DiagramEdge,
  DiagramNode,
  Difficulty,
  Drill,
  DrillQuestion,
  ExampleFrontmatter,
  GlossaryTerm,
  LearningPath,
  LessonFrontmatter,
  PathItem,
  PathPhase,
  PhaseId,
  PlaybookFrontmatter,
  Quiz,
  QuizQuestion,
  Tolerance,
  Track,
} from './schemas';

/** Shown wherever simulator numbers appear (they are teaching values, not measurements). */
export const ILLUSTRATIVE_NOTE = 'Illustrative teaching values, not vendor benchmarks.';

export type ContentBlock =
  | { kind: 'html'; html: string }
  | { kind: 'diagram'; id: string }
  | { kind: 'quiz'; id: string }
  | { kind: 'drill'; id: string };

export interface Heading {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface CompiledDoc {
  blocks: ContentBlock[];
  headings: Heading[];
}

/** Where an item came from and where it lives in the app. */
export interface ItemLocation {
  /** Repo-relative source path, used for "Edit this page on GitHub". */
  file: string;
  /** App path with a leading slash and no trailing slash, e.g. `/learn/foundations/indexing`. */
  url: string;
}

export type LessonMeta = LessonFrontmatter & ItemLocation;
export type PlaybookMeta = PlaybookFrontmatter & ItemLocation;
export type ExampleMeta = ExampleFrontmatter & ItemLocation;
export type CaseStudyMeta = CaseStudyFrontmatter & ItemLocation;

export type CompiledLesson = LessonMeta & CompiledDoc;
export type CompiledPlaybook = PlaybookMeta & CompiledDoc;
export type CompiledExample = ExampleMeta & CompiledDoc;
export type CompiledCaseStudy = CaseStudyMeta & CompiledDoc;

export type CompiledQuiz = Quiz;
export type CompiledDrill = Omit<Drill, 'scenario' | 'solution'> & {
  scenarioHtml: string;
  solutionHtml: string;
};

/** A page that links to an exercise (shown as "back to …" on the exercise page). */
export interface ExerciseParent {
  kind: 'lesson' | 'case-study' | 'playbook';
  title: string;
  url: string;
}

export interface ExerciseMeta {
  id: string;
  kind: 'quiz' | 'drill';
  title: string;
  topics: string[];
  difficulty: Difficulty;
  url: string;
  usedBy: ExerciseParent[];
}

export type SearchKind = 'lesson' | 'case-study' | 'playbook' | 'example' | 'exercise' | 'glossary';

export interface SearchDoc {
  /** The app URL; also the MiniSearch id. */
  id: string;
  url: string;
  kind: SearchKind;
  title: string;
  summary: string;
  headings: string;
  text: string;
}

export interface RoutesFile {
  all: string[];
  params: {
    lessons: { phase: string; lesson: string }[];
    caseStudies: { slug: string }[];
    playbooks: { slug: string }[];
    examples: { slug: string }[];
    exercises: { id: string }[];
  };
}
