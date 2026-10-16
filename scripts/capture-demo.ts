/**
 * Records the README demo: home → learning path → first lesson → answer its quiz →
 * progress page, as docs/demo.gif, and saves the home page as docs/screenshot.png.
 * Needs a production build served locally (npm run build && npm run serve).
 *
 *   tsx scripts/capture-demo.ts [--url http://localhost:4300/] [--out docs]
 */
import { chromium, type Page } from '@playwright/test';
import gifenc from 'gifenc';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

// gifenc is CommonJS: Node exposes it to ESM only as a default export.
const { GIFEncoder, applyPalette, quantize } = gifenc;

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const BASE = (arg('url') ?? 'http://localhost:4300/').replace(/\/?$/, '/');
const OUT = arg('out') ?? 'docs';
const WIDTH = 1280;
const HEIGHT = 800;
const COLORS = 64;
const GIF_LIMIT = 2 * 1024 * 1024;
const LESSON = 'learn/foundations/how-the-web-works';
const QUIZ = 'content/quizzes/how-the-web-works-quiz.json';

interface Frame {
  rgba: Uint8Array;
  delay: number;
}

const frames: Frame[] = [];

/** Takes `count` screenshots `every` ms apart; each frame is shown for that long. */
async function record(page: Page, count: number, every = 120): Promise<void> {
  for (let i = 0; i < count; i++) {
    const png = PNG.sync.read(await page.screenshot());
    frames.push({ rgba: new Uint8Array(png.data), delay: every });
    if (i < count - 1) await page.waitForTimeout(every);
  }
}

async function scrollBy(page: Page, total: number, steps: number): Promise<void> {
  for (let i = 0; i < steps; i++) {
    // Instant scrolling: a screenshot taken during a smooth scroll can catch a half-composited page.
    await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'instant' }), total / steps);
    await record(page, 1, 80);
  }
}

/** Identical consecutive frames become one longer frame. */
function mergeRepeats(list: Frame[]): Frame[] {
  const out: Frame[] = [];
  for (const f of list) {
    const last = out.at(-1);
    if (last && Buffer.compare(last.rgba, f.rgba) === 0) last.delay += f.delay;
    else out.push({ ...f });
  }
  return out;
}

/**
 * One shared palette (index COLORS-1 reserved for transparency); after the first frame,
 * pixels that did not change are transparent, so each frame stores only what moved.
 */
function encode(list: Frame[]): Uint8Array {
  const sample = new Uint8Array(list.reduce((n, f) => n + f.rgba.length / 4, 0) * 4);
  let at = 0;
  for (const f of list) {
    sample.set(f.rgba, at);
    at += f.rgba.length;
  }
  const palette = quantize(
    sample.subarray(0, Math.min(sample.length, WIDTH * HEIGHT * 4 * 8)),
    COLORS - 1,
  );
  // The transparent slot goes after the real colors, and pixels are mapped without it,
  // so no visible pixel (dark text, say) can land on the transparent index.
  const transparent = palette.length;
  const withSlot = [...palette, [0, 0, 0]];
  const gif = GIFEncoder();
  let prev: Uint8Array | undefined;
  for (const f of list) {
    const index = applyPalette(f.rgba, palette);
    if (prev) {
      for (let p = 0; p < index.length; p++) {
        const o = p * 4;
        if (
          f.rgba[o] === prev[o] &&
          f.rgba[o + 1] === prev[o + 1] &&
          f.rgba[o + 2] === prev[o + 2]
        ) {
          index[p] = transparent;
        }
      }
    }
    gif.writeFrame(index, WIDTH, HEIGHT, {
      palette: withSlot,
      delay: f.delay,
      transparent: prev !== undefined,
      transparentIndex: transparent,
      dispose: 1,
    });
    prev = f.rgba;
  }
  gif.finish();
  return gif.bytes();
}

const browser = await chromium.launch(
  existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
);
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  reducedMotion: 'no-preference',
});
mkdirSync(OUT, { recursive: true });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(OUT, 'screenshot.png') });
await record(page, 1, 1800);

await page.getByRole('navigation').getByRole('link', { name: 'Path', exact: true }).click();
await page.waitForURL(/\/path/);
await page.waitForLoadState('networkidle');
await record(page, 1, 1500);
await scrollBy(page, 500, 5);
await record(page, 1, 1000);

await page.goto(BASE + LESSON, { waitUntil: 'networkidle' });
await record(page, 1, 1800);
await scrollBy(page, 900, 6);
await record(page, 1, 1000);

// Answer the quiz correctly, using the same file the site was built from.
const quiz = JSON.parse(readFileSync(QUIZ, 'utf8')) as {
  questions: { correct: string[] }[];
};
const questions = page.locator('.quiz-question');
// The quiz is deferred until it scrolls into view, so jump to the end of the lesson first.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await questions.first().waitFor();
await questions.first().scrollIntoViewIfNeeded();
await record(page, 1, 1000);
for (const [i, q] of quiz.questions.entries()) {
  await questions.nth(i).scrollIntoViewIfNeeded();
  for (const id of q.correct) await questions.nth(i).locator(`input[value="${id}"]`).check();
  await record(page, 1, 500);
}
await page.getByRole('button', { name: 'Check answers' }).click();
await record(page, 12, 100);
await record(page, 1, 1500);

await page.goto(BASE + 'progress', { waitUntil: 'networkidle' });
await record(page, 10, 100);
await record(page, 1, 2500);
await browser.close();

const merged = mergeRepeats(frames);
const gif = encode(merged);
writeFileSync(join(OUT, 'demo.gif'), gif);
const kb = Math.round(gif.length / 1024);
console.log(`demo.gif: ${merged.length} frames (${frames.length} captured), ${kb} KB`);
if (gif.length > GIF_LIMIT) {
  console.error(`demo.gif is over ${GIF_LIMIT / 1024 / 1024} MB; shorten the flow or lower COLORS`);
  process.exitCode = 1;
}
