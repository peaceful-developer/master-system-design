import { DOCUMENT } from '@angular/common';
import { afterNextRender, inject, Injectable, signal } from '@angular/core';
import { SAFE_STORAGE } from '../storage/safe-storage';

export type ThemePreference = 'light' | 'dark';
export const THEME_KEY = 'sdl.theme';

/**
 * Black-on-white is the default for everyone; dark is opt-in (decision D15).
 * The inline script in index.html applies a stored dark choice before first
 * paint; this service syncs with it after hydration and handles the toggle.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(SAFE_STORAGE);
  private readonly document = inject(DOCUMENT);
  private readonly _preference = signal<ThemePreference>('light');

  readonly preference = this._preference.asReadonly();

  constructor() {
    afterNextRender(() => {
      if (this.storage.get(THEME_KEY) === 'dark') this.apply('dark');
    });
  }

  toggle(): void {
    const next: ThemePreference = this._preference() === 'dark' ? 'light' : 'dark';
    this.apply(next);
    this.storage.set(THEME_KEY, next);
  }

  private apply(preference: ThemePreference): void {
    this._preference.set(preference);
    const html = this.document.documentElement;
    html.classList.toggle('dark', preference === 'dark');
    html.style.colorScheme = preference;
  }
}
