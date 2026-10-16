import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { provideTestContent, TEST_LESSON } from '../../testing/content-test-data';
import { REPO_URL } from '../../site';
import { LessonPage } from './lesson.page';

describe('LessonPage', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestContent(),
        { provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) },
      ],
    });
    const fixture = TestBed.createComponent(LessonPage);
    fixture.componentRef.setInput('lesson', TEST_LESSON);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the phase, title, summary and reading time', async () => {
    const el = await render();
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Latency numbers');
    const header = el.querySelector('article header')!.textContent!;
    expect(header).toContain('Phase 0 · Foundations');
    expect(header).toContain('Latency numbers summary for tests.');
    expect(header).toContain('10 min read');
  });

  it('renders the lesson content', async () => {
    const el = await render();
    expect(el.querySelector('.prose-content h2#why')?.textContent).toBe('Why it matters');
  });

  it('lists the phase lessons in the sidebar', async () => {
    const el = await render();
    const links = [...el.querySelectorAll('nav[aria-label="Lessons in this phase"] a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/learn/foundations/how-the-web-works',
      '/learn/foundations/latency-numbers',
    ]);
  });

  it('links its practice exercises', async () => {
    const el = await render();
    const practice = el.querySelector('section[aria-labelledby="practice-heading"]')!;
    expect(practice.querySelector('a')?.getAttribute('href')).toBe('/exercises/demo-quiz');
    expect(practice.textContent).toContain('Demo quiz');
  });

  it('links to the previous lesson on the path and to its source', async () => {
    const el = await render();
    const prev = el.querySelector('a[rel="prev"]');
    expect(prev?.getAttribute('href')).toBe('/learn/foundations/how-the-web-works');
    expect(prev?.textContent).toContain('How the web works');
    expect(el.querySelector('a[rel="next"]')).toBeNull();
    const edit = el.querySelector('a.edit-link');
    expect(edit?.getAttribute('href')).toBe(
      `${REPO_URL}/edit/main/content/lessons/foundations/latency-numbers.md`,
    );
  });
});
