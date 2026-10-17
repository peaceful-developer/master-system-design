import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedStorage } from './helpers/content';

const PAGES = [
  './',
  'path',
  'learn/foundations/how-the-web-works',
  'case-studies/url-shortener',
  'case-studies',
  'playbooks/back-of-envelope-estimation',
  'examples/cache-aside',
  'exercises/how-the-web-works-quiz',
  'progress',
  'glossary',
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    for (const path of PAGES) {
      test(`${path} has no serious or critical axe violations`, async ({ page }) => {
        if (theme === 'dark') await seedStorage(page, { 'sdl.theme': 'dark' });
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const { violations } = await new AxeBuilder({ page }).analyze();
        const blocking = violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map(
            (v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target).join(', ')}`,
          );
        expect(blocking).toEqual([]);
      });
    }
  });
}
