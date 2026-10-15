import { expect, type Page } from '@playwright/test';

/** Collects console errors and uncaught page errors; call `assert()` at the end of a test. */
export function trackConsoleErrors(page: Page): { assert: () => void } {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return {
    assert: () => expect(errors, 'console errors').toEqual([]),
  };
}
