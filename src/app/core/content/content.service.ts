import { inject, Injectable, InjectionToken } from '@angular/core';
import type {
  CaseStudyMeta,
  CompiledCaseStudy,
  CompiledDrill,
  CompiledExample,
  CompiledLesson,
  CompiledPlaybook,
  CompiledQuiz,
  ComponentDef,
  Diagram,
  ExampleMeta,
  ExerciseMeta,
  GlossaryTerm,
  LearningPath,
  LessonMeta,
  PathPhase,
  PhaseId,
  PlaybookMeta,
} from '@content/types';
import { LOADERS } from '@generated/loaders';
import {
  CASE_STUDIES,
  COMPONENTS,
  EXAMPLES,
  EXERCISES,
  GLOSSARY,
  LESSONS,
  PATH,
  PLAYBOOKS,
} from '@generated/manifest';
import { flattenPath, type PathEntry } from './path-nav';

type Loaders<T> = Record<string, () => Promise<T>>;

export interface ContentLoaders {
  lesson: Loaders<CompiledLesson>;
  caseStudy: Loaders<CompiledCaseStudy>;
  playbook: Loaders<CompiledPlaybook>;
  example: Loaders<CompiledExample>;
  quiz: Loaders<CompiledQuiz>;
  drill: Loaders<CompiledDrill>;
  diagram: Loaders<Diagram>;
}

export interface ContentData {
  path: LearningPath;
  lessons: LessonMeta[];
  caseStudies: CaseStudyMeta[];
  playbooks: PlaybookMeta[];
  examples: ExampleMeta[];
  exercises: ExerciseMeta[];
  glossary: GlossaryTerm[];
  components: ComponentDef[];
  loaders: ContentLoaders;
}

/** The compiled content (src/generated/); replaced with fixtures in unit tests. */
export const CONTENT_DATA = new InjectionToken<ContentData>('CONTENT_DATA', {
  providedIn: 'root',
  factory: () => ({
    path: PATH,
    lessons: LESSONS,
    caseStudies: CASE_STUDIES,
    playbooks: PLAYBOOKS,
    examples: EXAMPLES,
    exercises: EXERCISES,
    glossary: GLOSSARY,
    components: COMPONENTS,
    loaders: LOADERS,
  }),
});

async function load<T>(loaders: Loaders<T>, key: string): Promise<T | undefined> {
  const loader = Object.hasOwn(loaders, key) ? loaders[key] : undefined;
  return loader ? loader() : undefined;
}

/**
 * Metadata is available synchronously (small); item bodies are lazily imported
 * JSON chunks, so a page only downloads the content it shows.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly data = inject(CONTENT_DATA);
  private readonly componentMap = new Map(this.data.components.map((c) => [c.type, c]));
  private entries?: PathEntry[];

  path(): LearningPath {
    return this.data.path;
  }

  phase(id: PhaseId): PathPhase | undefined {
    return this.data.path.phases.find((p) => p.id === id);
  }

  /** Every item on the learning path in order (for prev/next and progress). */
  pathEntries(): PathEntry[] {
    return (this.entries ??= flattenPath(this.data.path, this.data));
  }

  lessons(phase?: PhaseId): LessonMeta[] {
    return phase ? this.data.lessons.filter((l) => l.phase === phase) : this.data.lessons;
  }

  caseStudies(): CaseStudyMeta[] {
    return this.data.caseStudies;
  }

  playbooks(): PlaybookMeta[] {
    return this.data.playbooks;
  }

  examples(): ExampleMeta[] {
    return this.data.examples;
  }

  exercises(): ExerciseMeta[] {
    return this.data.exercises;
  }

  exercise(id: string): ExerciseMeta | undefined {
    return this.data.exercises.find((e) => e.id === id);
  }

  glossary(): GlossaryTerm[] {
    return this.data.glossary;
  }

  components(): ReadonlyMap<string, ComponentDef> {
    return this.componentMap;
  }

  getLesson(phase: string, slug: string): Promise<CompiledLesson | undefined> {
    return load(this.data.loaders.lesson, `${phase}/${slug}`);
  }

  getCaseStudy(slug: string): Promise<CompiledCaseStudy | undefined> {
    return load(this.data.loaders.caseStudy, slug);
  }

  getPlaybook(slug: string): Promise<CompiledPlaybook | undefined> {
    return load(this.data.loaders.playbook, slug);
  }

  getExample(slug: string): Promise<CompiledExample | undefined> {
    return load(this.data.loaders.example, slug);
  }

  getQuiz(id: string): Promise<CompiledQuiz | undefined> {
    return load(this.data.loaders.quiz, id);
  }

  getDrill(id: string): Promise<CompiledDrill | undefined> {
    return load(this.data.loaders.drill, id);
  }

  getDiagram(id: string): Promise<Diagram | undefined> {
    return load(this.data.loaders.diagram, id);
  }
}
