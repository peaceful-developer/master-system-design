import { expect, test } from '@playwright/test';
import { trackConsoleErrors } from './helpers/console';
import { rel, ROUTES } from './helpers/content';

test.describe('every prerendered route', () => {
  for (const path of ROUTES.all) {
    test(`${path} loads directly with a heading and no console errors`, async ({ page }) => {
      const console = trackConsoleErrors(page);
      const response = await page.goto(rel(path));
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      console.assert();
    });
  }
});

test('an unknown URL shows the not-found page', async ({ page }) => {
  await page.goto('learn/foundations/no-such-lesson/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page flew the coop');
});
