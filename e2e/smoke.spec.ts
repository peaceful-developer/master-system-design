import { expect, test } from '@playwright/test';
import { SITE_NAME } from '../src/app/site';
import { trackConsoleErrors } from './helpers/console';

test('home page loads under the base path without console errors', async ({ page }) => {
  const console = trackConsoleErrors(page);
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(new RegExp(SITE_NAME));
  await expect(page.locator('header')).toContainText(SITE_NAME);
  await page.waitForLoadState('networkidle');
  console.assert();
});

test('unknown URLs return the 404 page with status 404', async ({ page }) => {
  const response = await page.goto('./this-page-does-not-exist/');
  expect(response?.status()).toBe(404);
});
