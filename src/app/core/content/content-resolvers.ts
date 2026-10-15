import { inject, Injector } from '@angular/core';
import { RedirectCommand, Router, type ResolveFn } from '@angular/router';
import type {
  CompiledCaseStudy,
  CompiledDrill,
  CompiledExample,
  CompiledLesson,
  CompiledPlaybook,
  CompiledQuiz,
  ExerciseMeta,
} from '@content/types';
import type { ContentService } from './content.service';

/**
 * Builds a resolver that loads an item, or shows the not-found page (keeping
 * the URL the visitor typed) when the item does not exist. ContentService (and
 * the content manifest it carries) is imported lazily so it stays out of the
 * initial bundle.
 */
function itemResolver<T>(
  load: (content: ContentService, params: (name: string) => string) => Promise<T | undefined>,
): ResolveFn<T> {
  return async (route) => {
    const injector = inject(Injector);
    const router = inject(Router);
    const { ContentService } = await import('./content.service');
    const content = injector.get(ContentService);
    const item = await load(content, (name) => route.paramMap.get(name) ?? '');
    return item ?? new RedirectCommand(router.parseUrl('/not-found'), { skipLocationChange: true });
  };
}

export const lessonResolver = itemResolver<CompiledLesson>((c, p) =>
  c.getLesson(p('phase'), p('lesson')),
);
export const caseStudyResolver = itemResolver<CompiledCaseStudy>((c, p) =>
  c.getCaseStudy(p('slug')),
);
export const playbookResolver = itemResolver<CompiledPlaybook>((c, p) => c.getPlaybook(p('slug')));
export const exampleResolver = itemResolver<CompiledExample>((c, p) => c.getExample(p('slug')));

/** An exercise page's data: its metadata plus the loaded quiz or drill. */
export type ExerciseView =
  | { meta: ExerciseMeta; kind: 'quiz'; quiz: CompiledQuiz }
  | { meta: ExerciseMeta; kind: 'drill'; drill: CompiledDrill };

async function loadExercise(
  content: ContentService,
  id: string,
): Promise<ExerciseView | undefined> {
  const meta = content.exercise(id);
  if (meta?.kind === 'quiz') {
    const quiz = await content.getQuiz(id);
    return quiz && { meta, kind: 'quiz', quiz };
  }
  if (meta?.kind === 'drill') {
    const drill = await content.getDrill(id);
    return drill && { meta, kind: 'drill', drill };
  }
  return undefined;
}

export const exerciseResolver = itemResolver<ExerciseView>((c, p) => loadExercise(c, p('id')));
