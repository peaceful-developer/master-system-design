import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { emptyProgress, PROGRESS_KEY } from '../../core/progress/progress-model';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { provideTestContent } from '../../testing/content-test-data';
import { HomePage } from './home.page';

describe('HomePage', () => {
  async function render(saved?: unknown) {
    const storage = createSafeStorage(() => undefined);
    if (saved) storage.set(PROGRESS_KEY, JSON.stringify(saved));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestContent(),
        { provide: SAFE_STORAGE, useValue: storage },
      ],
    });
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, storage };
  }

  const savedLevel = (storage: ReturnType<typeof createSafeStorage>) =>
    JSON.parse(storage.get(PROGRESS_KEY)!).prefs.learnerLevel;

  it('has a headline and a primary call to action', async () => {
    const { el } = await render();
    expect(el.querySelector('h1')?.textContent).toBeTruthy();
    const cta = el.querySelector('a.btn');
    expect(cta?.textContent).toContain('Start learning');
  });

  it('asks where to start and saves the choice', async () => {
    const { fixture, el, storage } = await render();
    const options = [...el.querySelectorAll<HTMLInputElement>('input[name="learner-level"]')];
    expect(options.map((o) => o.value)).toEqual(['new', 'some', 'expert']);
    expect(el.querySelector('a.start-here')).toBeNull();

    options[0]!.click();
    await fixture.whenStable();

    expect(savedLevel(storage)).toBe('new');
    const start = el.querySelector('a.start-here');
    expect(start?.getAttribute('href')).toBe('/learn/foundations/how-the-web-works');
    expect(el.textContent).toContain('How the web works');
  });

  it('remembers a level chosen earlier', async () => {
    const saved = { ...emptyProgress(), prefs: { learnerLevel: 'expert', calmMode: false } };
    const { el } = await render(saved);
    const expert = el.querySelector<HTMLInputElement>('input[value="expert"]')!;
    expect(expert.checked).toBe(true);
    expect(el.querySelector('a.start-here')).not.toBeNull();
  });

  it('lists every phase of the learning ladder', async () => {
    const { el } = await render();
    const steps = el.querySelectorAll('.ladder > li');
    expect(steps.length).toBe(2);
    expect(steps[0]?.textContent).toContain('Foundations');
  });
});
