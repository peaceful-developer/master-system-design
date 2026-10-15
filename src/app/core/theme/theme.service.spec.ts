import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { createSafeStorage, SAFE_STORAGE } from '../storage/safe-storage';
import { THEME_KEY, ThemeService } from './theme.service';

function setup(stored?: string) {
  const storage = createSafeStorage(() => undefined);
  if (stored) storage.set(THEME_KEY, stored);
  TestBed.configureTestingModule({ providers: [{ provide: SAFE_STORAGE, useValue: storage }] });
  const theme = TestBed.inject(ThemeService);
  TestBed.tick();
  return { theme, storage, html: TestBed.inject(DOCUMENT).documentElement };
}

describe('ThemeService', () => {
  afterEach(() => document.documentElement.classList.remove('dark'));

  it('defaults to black-on-white even when the OS prefers dark', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('dark'),
    })) as typeof window.matchMedia;
    const { theme, html } = setup();
    expect(theme.preference()).toBe('light');
    expect(html.classList.contains('dark')).toBe(false);
    window.matchMedia = original;
  });

  it('toggles to dark and back, persisting the choice', () => {
    const { theme, storage, html } = setup();
    theme.toggle();
    expect(theme.preference()).toBe('dark');
    expect(html.classList.contains('dark')).toBe(true);
    expect(html.style.colorScheme).toBe('dark');
    expect(storage.get(THEME_KEY)).toBe('dark');
    theme.toggle();
    expect(theme.preference()).toBe('light');
    expect(html.classList.contains('dark')).toBe(false);
    expect(storage.get(THEME_KEY)).toBe('light');
  });

  it('restores a stored dark preference after the first render', () => {
    const { theme, html } = setup('dark');
    expect(theme.preference()).toBe('dark');
    expect(html.classList.contains('dark')).toBe(true);
  });

  it('ignores an unknown stored value', () => {
    expect(setup('purple').theme.preference()).toBe('light');
  });
});
