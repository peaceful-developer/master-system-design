import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  RedirectCommand,
  type RouterStateSnapshot,
} from '@angular/router';
import { exerciseResolver, type ExerciseView } from '../../core/content/content-resolvers';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import {
  provideTestContent,
  testExercise,
  TEST_DRILL,
  TEST_QUIZ,
} from '../../testing/content-test-data';
import { ExercisePage } from './exercise.page';

const QUIZ_META = {
  ...testExercise('demo-quiz', 'quiz'),
  title: 'Demo quiz',
  usedBy: [
    {
      kind: 'lesson' as const,
      title: 'Latency numbers',
      url: '/learn/foundations/latency-numbers',
    },
  ],
};
const DRILL_META = { ...testExercise('demo-drill', 'drill'), title: 'Demo drill' };

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestContent({ exercises: [QUIZ_META, DRILL_META] }),
      { provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) },
    ],
  });
}

async function resolve(id: string) {
  return TestBed.runInInjectionContext(() =>
    exerciseResolver(
      { paramMap: convertToParamMap({ id }) } as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ),
  );
}

async function render(view: ExerciseView) {
  const fixture = TestBed.createComponent(ExercisePage);
  fixture.componentRef.setInput('exercise', view);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('exerciseResolver', () => {
  beforeEach(setup);

  it('loads a quiz with its metadata', async () => {
    expect(await resolve('demo-quiz')).toEqual({ meta: QUIZ_META, kind: 'quiz', quiz: TEST_QUIZ });
  });

  it('loads a drill with its metadata', async () => {
    expect(await resolve('demo-drill')).toEqual({
      meta: DRILL_META,
      kind: 'drill',
      drill: TEST_DRILL,
    });
  });

  it('sends unknown exercises to the not-found page', async () => {
    expect(await resolve('nope')).toBeInstanceOf(RedirectCommand);
  });
});

describe('ExercisePage', () => {
  beforeEach(setup);

  it('renders a quiz, with a link back to the lesson that uses it', async () => {
    const el = await render((await resolve('demo-quiz')) as ExerciseView);
    expect(el.querySelector('h1')?.textContent).toContain('Demo quiz');
    expect(el.querySelector('app-quiz')).not.toBeNull();
    expect(el.querySelector('app-drill')).toBeNull();
    const back = el.querySelector('a.back-link');
    expect(back?.getAttribute('href')).toBe('/learn/foundations/latency-numbers');
    expect(back?.textContent).toContain('Latency numbers');
  });

  it('renders a drill', async () => {
    const el = await render((await resolve('demo-drill')) as ExerciseView);
    expect(el.querySelector('app-drill')).not.toBeNull();
    expect(el.querySelector('app-quiz')).toBeNull();
  });

  it('links to all exercises when nothing else uses this one', async () => {
    const el = await render((await resolve('demo-drill')) as ExerciseView);
    expect(el.querySelector('a.back-link')?.getAttribute('href')).toBe('/exercises');
  });
});
