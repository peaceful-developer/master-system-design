import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ItemKey } from '../../core/progress/progress-model';
import { emptyProgress, PROGRESS_KEY } from '../../core/progress/progress-model';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { provideTestContent, TEST_PATH, testCaseStudy } from '../../testing/content-test-data';
import { PathSidebarComponent } from './path-sidebar.component';

const PATH = {
  phases: [
    TEST_PATH.phases[0]!,
    {
      ...TEST_PATH.phases[1]!,
      items: [{ kind: 'case-study' as const, ref: 'url-shortener' }],
    },
    {
      id: 'data-systems' as const,
      number: 2,
      title: 'Data systems',
      summary: 'Data at scale.',
      items: [],
    },
  ],
};

async function render(current: ItemKey, completed: Record<string, string> = {}) {
  const storage = createSafeStorage(() => undefined);
  storage.set(PROGRESS_KEY, JSON.stringify({ ...emptyProgress(), completed }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestContent({
        path: PATH,
        caseStudies: [testCaseStudy('url-shortener', 'A', 'complete')],
      }),
      { provide: SAFE_STORAGE, useValue: storage },
    ],
  });
  const fixture = TestBed.createComponent(PathSidebarComponent);
  fixture.componentRef.setInput('current', current);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const groups = (el: HTMLElement) => [...el.querySelectorAll('details.path-sidebar-phase')];

describe('PathSidebarComponent', () => {
  it('lists every phase of the path, not just the current one', async () => {
    const el = await render('lesson:foundations/latency-numbers');
    expect(groups(el).map((d) => d.querySelector('summary')?.textContent?.trim())).toEqual([
      'Phase 0 · Foundations',
      'Phase 1 · Building blocks',
      'Phase 2 · Data systems',
    ]);
  });

  it('opens the phase holding the current item and folds the others', async () => {
    const el = await render('case-study:url-shortener');
    expect(groups(el).map((d) => (d as HTMLDetailsElement).open)).toEqual([false, true, false]);
  });

  it('links each item in path order, lessons and case studies alike', async () => {
    const el = await render('lesson:foundations/latency-numbers');
    const hrefs = [...el.querySelectorAll('details a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/learn/foundations/how-the-web-works',
      '/learn/foundations/latency-numbers',
      '/case-studies/url-shortener',
    ]);
  });

  it('marks completed items', async () => {
    const el = await render('lesson:foundations/latency-numbers', {
      'lesson:foundations/how-the-web-works': '2026-10-15T09:00:00.000Z',
    });
    const first = el.querySelector('details a')!;
    expect(first.querySelector('[aria-label="Completed"]')).not.toBeNull();
  });

  it('says when a phase has nothing in it yet', async () => {
    const el = await render('lesson:foundations/latency-numbers');
    expect(groups(el)[2]?.textContent).toContain('Coming soon');
  });
});
