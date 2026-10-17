import { expect, test } from '@playwright/test';
import { trackConsoleErrors } from './helpers/console';

const LESSON = 'learn/foundations/how-the-web-works';
const NEXT_LESSON = 'learn/foundations/apis-rest-grpc-websockets';
const basePath = () => new URL(test.info().project.use.baseURL!).pathname;

test('a glossary link in lesson text lands on the term under the base path', async ({ page }) => {
  await page.goto(LESSON);
  const term = page.locator('article a.term').first();
  const id = await term.getAttribute('data-term');
  await term.click();
  await expect(page).toHaveURL(new RegExp(`^[^#]*${basePath()}glossary#${id}$`));
  await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
});

test('a table of contents link scrolls to its section and keeps the base path', async ({
  page,
}) => {
  await page.goto(LESSON);
  const toc = page.getByRole('navigation', { name: 'On this page' });
  const link = toc.getByRole('link').nth(2);
  const fragment = (await link.getAttribute('href'))!.split('#')[1]!;
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${basePath()}${LESSON}/?#${fragment}$`));
  await expect(page.locator(`[id="${fragment}"]`)).toBeInViewport();
});

test('next and previous follow the learning path', async ({ page }) => {
  await page.goto(LESSON);
  const nav = page.getByRole('navigation', { name: 'Learning path' });
  await nav.getByRole('link', { name: /Next/ }).click();
  await expect(page).toHaveURL(new RegExp(`${NEXT_LESSON}/?$`));
  await nav.getByRole('link', { name: /Previous/ }).click();
  await expect(page).toHaveURL(new RegExp(`${LESSON}/?$`));
});

test('a deep link survives a full reload', async ({ page }) => {
  const console = trackConsoleErrors(page);
  await page.goto('case-studies/rate-limiter');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rate limiter');
  await page.waitForLoadState('networkidle');
  console.assert();
});

test('hydration keeps the prerendered lesson text instead of re-rendering it', async ({ page }) => {
  type Marked = Window & { prerendered?: Element | null };
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      (window as Marked).prerendered = document.querySelector('.prose-content > p');
    });
  });
  await page.goto(LESSON);
  // A working toggle shows the app has hydrated.
  await page.getByRole('button', { name: 'Mark as complete' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();
  const kept = await page.evaluate(() => {
    const p = (window as Marked).prerendered;
    return !!p && p.isConnected && p === document.querySelector('.prose-content > p');
  });
  expect(kept).toBe(true);
});
