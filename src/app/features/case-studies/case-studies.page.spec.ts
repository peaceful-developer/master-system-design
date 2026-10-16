import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { provideTestContent, testCaseStudy } from '../../testing/content-test-data';
import { CaseStudiesPage } from './case-studies.page';

const ITEMS = [
  testCaseStudy('url-shortener', 'A', 'complete', 1),
  testCaseStudy('news-feed', 'A', 'outline', 2),
  testCaseStudy('recsys', 'B', 'complete', 1),
  testCaseStudy('rag', 'C', 'outline', 1),
];

async function render(items = ITEMS) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestContent({ caseStudies: items }),
      { provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) },
    ],
  });
  const fixture = TestBed.createComponent(CaseStudiesPage);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('CaseStudiesPage', () => {
  it('lists every case study grouped by track', async () => {
    const { el } = await render();
    const groups = [...el.querySelectorAll('section.track-group')];
    expect(groups.map((g) => g.querySelector('h2')?.textContent?.trim())).toEqual([
      'Track A · Classic systems',
      'Track B · ML systems',
      'Track C · LLM and GenAI systems',
    ]);
    expect(groups[0]!.querySelectorAll('li a').length).toBe(2);
    expect(el.textContent).toContain('Showing 4 of 4');
  });

  it('marks outlines', async () => {
    const { el } = await render();
    const newsFeed = el.querySelector('a[href="/case-studies/news-feed"]')!;
    expect(newsFeed.textContent).toContain('Outline');
  });

  it('narrows the list when a track is ticked', async () => {
    const { el, fixture } = await render();
    el.querySelector<HTMLInputElement>('input[name="track"][value="B"]')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('section.track-group').length).toBe(1);
    expect(el.textContent).toContain('Showing 1 of 4');
  });

  it('searches as you type', async () => {
    const { el, fixture } = await render();
    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'rag';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Showing 1 of 4');
  });

  it('explains that case studies are coming when there are none yet', async () => {
    const { el } = await render([]);
    expect(el.querySelector('form.catalog-filters')).toBeNull();
    expect(el.textContent).toContain('Case studies are being written');
  });
});
