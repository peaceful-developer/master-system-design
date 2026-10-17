import { expect, test, type Page } from '@playwright/test';

const BLACK = 'rgb(0, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';
const PARROT = 'rgb(43, 178, 76)';

const style = (page: Page, selector: string, prop: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

// D15: black text on white, whatever the system color scheme; parrot green only for the
// navigation and buttons, with black labels.
for (const colorScheme of ['light', 'dark'] as const) {
  test(`default theme is black on white with a ${colorScheme} system preference`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('learn/foundations/how-the-web-works');
    // The page color is set on <html>; <body> is transparent over it.
    const pageBackground = await page.evaluate(() =>
      [document.body, document.documentElement]
        .map((el) => getComputedStyle(el).backgroundColor)
        .find((c) => c !== 'rgba(0, 0, 0, 0)'),
    );
    expect(pageBackground).toBe(WHITE);
    expect(await style(page, 'article p', 'color')).toBe(BLACK);
    expect(await style(page, 'h1', 'color')).toBe(BLACK);
    expect(await style(page, 'article a.term', 'color')).toBe(BLACK);
    expect(await style(page, 'body > app-root header', 'background-color')).toBe(PARROT);
    expect(await style(page, 'body > app-root header nav a', 'color')).toBe(BLACK);

    await page.goto('./');
    expect(await style(page, '.hero .btn', 'background-color')).toBe(PARROT);
    expect(await style(page, '.hero .btn', 'color')).toBe(BLACK);
  });
}
