import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { CompiledCaseStudy } from '@content/types';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { provideTestContent, testCaseStudy } from '../../testing/content-test-data';
import { CaseStudyPage } from './case-study.page';

const PREREQ = testCaseStudy('url-shortener', 'A', 'complete', 1);

function compiled(status: 'complete' | 'outline'): CompiledCaseStudy {
  return {
    ...testCaseStudy('recsys', 'B', status, 2),
    title: 'Recommendation system',
    concepts: ['latency'],
    prerequisites: ['url-shortener'],
    blocks: [{ kind: 'html', html: '<h2 id="requirements">Requirements</h2><p>Body.</p>' }],
    headings: [{ id: 'requirements', text: 'Requirements', depth: 2 }],
  };
}

async function render(status: 'complete' | 'outline') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestContent({ caseStudies: [PREREQ, compiled(status)] }),
      { provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) },
    ],
  });
  const fixture = TestBed.createComponent(CaseStudyPage);
  fixture.componentRef.setInput('caseStudy', compiled(status));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('CaseStudyPage', () => {
  it('shows the track, difficulty, reading time and concept links', async () => {
    const el = await render('complete');
    const header = el.querySelector('article header')!;
    expect(header.textContent).toContain('Track B · ML systems');
    expect(header.textContent).toContain('intermediate');
    expect(header.textContent).toContain('30 min');
    expect(el.querySelector('h1')?.textContent).toContain('Recommendation system');
    const concept = header.querySelector('a.concept-chip');
    expect(concept?.getAttribute('href')).toBe('/glossary#latency');
    expect(concept?.textContent).toContain('Latency');
  });

  it('links prerequisites', async () => {
    const el = await render('complete');
    const prereq = el.querySelector('.prerequisites a');
    expect(prereq?.getAttribute('href')).toBe('/case-studies/url-shortener');
    expect(prereq?.textContent).toContain('Case study url-shortener');
  });

  it('separates the prerequisites label from the first link', async () => {
    const el = await render('complete');
    const line = el.querySelector('.prerequisites')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(line).toBe('Read first: Case study url-shortener');
  });

  it('shows no outline banner for a complete case study', async () => {
    const el = await render('complete');
    expect(el.querySelector('.outline-banner')).toBeNull();
  });

  it('invites contributions on an outline', async () => {
    const el = await render('outline');
    const banner = el.querySelector('.outline-banner')!;
    expect(banner.textContent).toContain('Outline: contributions welcome');
    const links = [...banner.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/contribute');
    expect(links.some((h) => h?.includes('/edit/main/content/case-studies/recsys.md'))).toBe(true);
  });

  it('renders the body', async () => {
    const el = await render('complete');
    expect(el.querySelector('.prose-content h2#requirements')).not.toBeNull();
  });
});
