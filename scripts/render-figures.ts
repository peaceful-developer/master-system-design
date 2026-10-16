/**
 * Renders every figure in content/figures/ in light, dark and reduced-motion
 * modes to PNGs for visual review (not part of the build).
 *
 *   tsx scripts/render-figures.ts [--out tmp/figures] [--only id1,id2]
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { sanitizeFigure } from './lib/svg-assets';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const THEMES = {
  light: { bg: '#ffffff', stroke: '#000000', fill: '#ffffff', muted: '#e5e5e5' },
  dark: { bg: '#0b0f0c', stroke: '#ffffff', fill: '#0b0f0c', muted: '#2a322d' },
} as const;

function page(svg: string, theme: keyof typeof THEMES): string {
  const t = THEMES[theme];
  return `<!doctype html><html><head><style>
    :root { --fig-stroke:${t.stroke}; --fig-fill:${t.fill}; --fig-muted:${t.muted};
      --fig-accent:#2bb24c; --fig-flow:#ffc93c; --fig-paper:#ffffff; --fig-ink:#000000; }
    body { margin:0; padding:16px; background:${t.bg}; color:${t.stroke}; font-family: system-ui, sans-serif; }
    svg { display:block; width:680px; height:auto; }
  </style></head><body>${svg}</body></html>`;
}

const out = resolve(arg('out') ?? 'tmp/figures');
const only = arg('only')?.split(',');
mkdirSync(out, { recursive: true });
const files = readdirSync('content/figures')
  .filter((f) => f.endsWith('.svg'))
  .filter((f) => !only || only.includes(basename(f, '.svg')));

const browser = await chromium.launch(
  existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
);
for (const file of files) {
  const id = basename(file, '.svg');
  const fig = sanitizeFigure(id, readFileSync(join('content/figures', file), 'utf8'));
  for (const message of [...fig.errors, ...fig.warnings]) console.log(`  ${message}`);
  for (const [mode, theme, reduced] of [
    ['light', 'light', false],
    ['dark', 'dark', false],
    ['static', 'light', true],
  ] as const) {
    const ctx = await browser.newContext({
      viewport: { width: 712, height: 600 },
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    const p = await ctx.newPage();
    await p.setContent(page(fig.svg, theme));
    await p.waitForTimeout(reduced ? 50 : 1200);
    await p
      .locator('svg')
      .first()
      .screenshot({ path: join(out, `${id}-${mode}.png`) });
    await ctx.close();
  }
  console.log(`rendered ${id}`);
}
await browser.close();
