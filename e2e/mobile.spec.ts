import { expect, test } from '@playwright/test';

// Runs in the "mobile" project (360 px wide): diagrams, tables and code scroll inside their own
// containers, so the page itself never scrolls sideways.
for (const path of [
  'learn/foundations/how-the-web-works',
  'case-studies/url-shortener',
  'case-studies/llm-inference-serving',
]) {
  test(`${path} has no sideways page scroll at 360 px`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(360);
  });
}

// Checks the Arial-metric fallback in src/index.html, so it needs Arial or Liberation Sans
// (CI installs fonts-liberation). With only DejaVu Sans, the shift is smaller but not zero.
test('a case study does not jump when the web font arrives', async ({ page }) => {
  // A slow network: the page first paints from the inlined critical CSS, then the full
  // stylesheet (with the @font-face rules) and the fonts arrive.
  await page.route(/\/styles-[\w-]+\.css$|\.woff2$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.setViewportSize({ width: 412, height: 823 });
  await page.addInitScript(() => {
    const w = window as Window & { cls?: number };
    w.cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number })[]) {
        w.cls! += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('case-studies/url-shortener');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const cls = await page.evaluate(() => (window as Window & { cls?: number }).cls ?? 0);
  expect(cls).toBeLessThan(0.01);
});
