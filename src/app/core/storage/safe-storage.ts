import { isPlatformBrowser } from '@angular/common';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';

export interface KeyValueStorage {
  get(key: string): string | null;
  /** Returns false when the value could not be persisted (it stays readable in memory). */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

/**
 * Wraps a Web Storage that may be missing (SSR), blocked (privacy settings) or
 * full (quota). On the first failure it switches to an in-memory map for the
 * rest of the session, so the app keeps working instead of crashing.
 */
export function createSafeStorage(backing: () => Storage | undefined): KeyValueStorage {
  const memory = new Map<string, string>();
  let real: Storage | undefined;
  try {
    real = backing();
  } catch {
    real = undefined;
  }

  return {
    get(key) {
      if (real) {
        try {
          return real.getItem(key);
        } catch {
          real = undefined;
        }
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value);
      if (!real) return true;
      try {
        real.setItem(key, value);
        return true;
      } catch {
        real = undefined;
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        real?.removeItem(key);
      } catch {
        real = undefined;
      }
    },
  };
}

export const SAFE_STORAGE = new InjectionToken<KeyValueStorage>('SAFE_STORAGE', {
  providedIn: 'root',
  factory: () => {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    return createSafeStorage(() => (browser ? window.localStorage : undefined));
  },
});
