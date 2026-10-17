import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { emptyProgress, PROGRESS_KEY } from '../../core/progress/progress-model';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { CLOCK } from '../../core/time/clock';
import { provideTestContent } from '../../testing/content-test-data';
import { GameChipComponent } from './game-chip.component';

const at = '2026-10-15T09:00:00.000Z';

function setup(saved: unknown) {
  const storage = createSafeStorage(() => undefined);
  storage.set(PROGRESS_KEY, JSON.stringify(saved));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestContent(),
      { provide: SAFE_STORAGE, useValue: storage },
      { provide: CLOCK, useValue: () => new Date('2026-10-15T18:00:00') },
    ],
  });
  return TestBed.createComponent(GameChipComponent);
}

const ACTIVE = {
  ...emptyProgress(),
  completed: {
    'lesson:foundations/how-the-web-works': at,
    'lesson:foundations/latency-numbers': at,
    'exercise:demo-quiz': at,
  },
  quizScores: { 'demo-quiz': { best: 2, total: 2, lastAttemptAt: at } },
  activityDays: ['2026-10-14', '2026-10-15'],
};

describe('GameChipComponent', () => {
  it('renders nothing before progress is loaded (so prerendered HTML has no game state)', () => {
    const fixture = setup(ACTIVE);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('a')).toBeNull();
  });

  it('shows level and streak, linking to the progress page', async () => {
    const fixture = setup(ACTIVE);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a.game-chip');
    expect(link?.getAttribute('href')).toBe('/progress');
    // 2 lessons (40) + quiz (10) + perfect bonus (10) = 60 XP → level 2.
    expect(link?.textContent).toContain('Lv 2');
    expect(link?.textContent).toContain('Hatchling');
    expect(link?.textContent).toContain('2-day streak');
  });

  it('names the link starting with its visible text, at every width (WCAG 2.5.3)', async () => {
    const fixture = setup(ACTIVE);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a.game-chip');
    expect(link?.hasAttribute('aria-label')).toBe(false);
    expect(link?.querySelector('.sr-only')?.textContent?.trim()).toBe(
      'Lv 2, Hatchling, 60 XP, 2-day streak. View your progress',
    );
  });

  it('leaves out the streak when there is none', async () => {
    const fixture = setup({ ...ACTIVE, activityDays: ['2026-10-01'] });
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a.game-chip');
    expect(link?.textContent).not.toContain('streak');
  });

  it('is hidden in Calm mode', async () => {
    const fixture = setup({ ...ACTIVE, prefs: { learnerLevel: null, calmMode: true } });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('a.game-chip')).toBeNull();
  });
});
