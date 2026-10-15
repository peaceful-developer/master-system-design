import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  RedirectCommand,
  type RouterStateSnapshot,
} from '@angular/router';
import { provideTestContent, TEST_LESSON } from '../../testing/content-test-data';
import { lessonResolver } from './content-resolvers';

function routeWith(params: Record<string, string>): ActivatedRouteSnapshot {
  return { paramMap: convertToParamMap(params) } as ActivatedRouteSnapshot;
}

describe('content resolvers', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideTestContent()] }),
  );

  it('resolves a known lesson', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      lessonResolver(
        routeWith({ phase: 'foundations', lesson: 'latency-numbers' }),
        {} as RouterStateSnapshot,
      ),
    );
    expect(result).toEqual(TEST_LESSON);
  });

  it('sends unknown lessons to the not-found page without changing the URL', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      lessonResolver(
        routeWith({ phase: 'foundations', lesson: 'nope' }),
        {} as RouterStateSnapshot,
      ),
    );
    expect(result).toBeInstanceOf(RedirectCommand);
    const command = result as RedirectCommand;
    expect(command.redirectTo.toString()).toBe('/not-found');
    expect(command.navigationBehaviorOptions?.skipLocationChange).toBe(true);
  });
});
