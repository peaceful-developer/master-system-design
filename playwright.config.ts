import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { readBaseHref } from './scripts/serve-static';

const DIST = 'dist/system-design-lab/browser';
const PORT = 4300;
const indexHtml = `${DIST}/index.html`;
const basePath = existsSync(indexHtml) ? readBaseHref(readFileSync(indexHtml, 'utf8')) : '/';

// Inside the hosted dev container a pinned Chromium is preinstalled; elsewhere
// (CI, laptops) Playwright uses the browser it installed itself.
const preinstalled = '/opt/pw-browsers/chromium';
const launchOptions =
  process.env['CI'] || !existsSync(preinstalled) ? {} : { executablePath: preinstalled };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // One retry on CI so a rare runner hiccup doesn't block a deploy; retried tests are
  // still reported as flaky.
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${basePath}`,
    trace: 'retain-on-failure',
    launchOptions,
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } },
    },
  ],
  webServer: {
    command: `npx tsx scripts/serve-static.ts --dir ${DIST} --port ${PORT}`,
    url: `http://localhost:${PORT}${basePath}`,
    reuseExistingServer: !process.env['CI'],
  },
});
