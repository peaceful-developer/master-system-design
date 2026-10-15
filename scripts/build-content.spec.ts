import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import MiniSearch from 'minisearch';
import { afterEach, describe, expect, it } from 'vitest';
import { runBuild } from './build-content';
import type { RoutesFile, SearchDoc } from './content-types';
import { SEARCH_OPTIONS } from './search-options';
import { copyValidFixture, edit, VALID_FIXTURE } from './test/fixture-helpers';

const temps: string[] = [];
const tempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p)] = readFileSync(p, 'utf8');
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

describe('runBuild', () => {
  it('emits the manifest, loaders, items, icons, search index and routes', async () => {
    const out = tempDir('sdl-out-');
    const result = await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    expect(result.errors.filter((e) => e.severity === 'error')).toEqual([]);
    expect(Object.keys(snapshot(out)).sort()).toEqual([
      'icons.ts',
      'items/case-study/rate-limiter.json',
      'items/case-study/url-shortener.json',
      'items/diagram/cache-aside.json',
      'items/diagram/rate-limiter-hld.json',
      'items/diagram/url-shortener-hld.json',
      'items/drill/qps-drill.json',
      'items/example/cache-aside.json',
      'items/lesson/foundations--latency-basics.json',
      'items/playbook/estimation.json',
      'items/quiz/latency-quiz.json',
      'items/quiz/url-shortener-quiz.json',
      'loaders.ts',
      'manifest.ts',
      'mascot.ts',
      'routes.json',
      'search-index.json',
    ]);
  });

  it('writes compiled items with their location and blocks', async () => {
    const out = tempDir('sdl-out-');
    await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    const lesson = JSON.parse(
      readFileSync(join(out, 'items/lesson/foundations--latency-basics.json'), 'utf8'),
    );
    expect(lesson.url).toBe('/learn/foundations/latency-basics');
    expect(lesson.file).toMatch(/lessons\/foundations\/latency-basics\.md$/);
    expect(lesson.blocks.at(-1)).toEqual({ kind: 'quiz', id: 'latency-quiz' });
    expect(lesson.headings.map((h: { id: string }) => h.id)).toEqual([
      'why-latency-matters',
      'budgets',
    ]);
  });

  it('records which pages use each exercise', async () => {
    const out = tempDir('sdl-out-');
    await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    const manifest = readFileSync(join(out, 'manifest.ts'), 'utf8');
    expect(manifest).toContain('"url": "/exercises/qps-drill"');
    expect(manifest).toMatch(
      /"usedBy": \[\s*\{\s*"kind": "playbook",\s*"title": "Back-of-envelope estimation",\s*"url": "\/playbooks\/estimation"/,
    );
  });

  it('writes lazy loaders keyed by item id', async () => {
    const out = tempDir('sdl-out-');
    await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    const loaders = readFileSync(join(out, 'loaders.ts'), 'utf8');
    expect(loaders).toContain(
      `'foundations/latency-basics': () => import('./items/lesson/foundations--latency-basics.json').then((m) => m.default as unknown as CompiledLesson)`,
    );
  });

  it('writes icons both as markup and as structured elements', async () => {
    const out = tempDir('sdl-out-');
    await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    const icons = readFileSync(join(out, 'icons.ts'), 'utf8');
    expect(icons).toContain('export const ICONS: Record<string, string>');
    expect(icons).toContain('export const ICON_ELEMENTS: Record<string, IconElement[]>');
    expect(icons).toMatch(
      /"cache": \[\s*\{\s*"tag": "path",\s*"attrs": \{\s*"d": "M13 2 4 14h7l-1 8 9-12h-7z"/,
    );
  });

  it('writes route params for prerendering', async () => {
    const out = tempDir('sdl-out-');
    await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    const routes = JSON.parse(readFileSync(join(out, 'routes.json'), 'utf8')) as RoutesFile;
    expect(routes.all).toContain('/learn/foundations/latency-basics');
    expect(routes.params.lessons).toEqual([{ phase: 'foundations', lesson: 'latency-basics' }]);
    expect(routes.params.exercises.map((e) => e.id)).toEqual([
      'latency-quiz',
      'qps-drill',
      'url-shortener-quiz',
    ]);
  });

  it('is deterministic and writes nothing on an unchanged rebuild', async () => {
    const out = tempDir('sdl-out-');
    await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    const first = snapshot(out);
    const second = await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    expect(second.written).toBe(0);
    expect(snapshot(out)).toEqual(first);
  });

  it('writes nothing in check mode', async () => {
    const out = tempDir('sdl-out-');
    const result = await runBuild({ contentDir: VALID_FIXTURE, outDir: out, check: true });
    expect(result.written).toBe(0);
    expect(snapshot(out)).toEqual({});
  });

  it('leaves the output untouched when content is invalid', async () => {
    const out = tempDir('sdl-out-');
    await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    const before = snapshot(out);
    const broken = copyValidFixture();
    temps.push(broken);
    edit(broken, 'quizzes/latency-quiz.json', '"correct": ["a"]', '"correct": []');
    const result = await runBuild({ contentDir: broken, outDir: out });
    expect(result.errors.some((e) => e.severity === 'error')).toBe(true);
    expect(snapshot(out)).toEqual(before);
  });

  it('removes the output of a deleted item', async () => {
    const out = tempDir('sdl-out-');
    const content = copyValidFixture();
    temps.push(content);
    await runBuild({ contentDir: content, outDir: out });
    expect(existsSync(join(out, 'items/example/cache-aside.json'))).toBe(true);
    rmSync(join(content, 'examples/cache-aside.md'));
    rmSync(join(content, 'diagrams/cache-aside.json'));
    const result = await runBuild({ contentDir: content, outDir: out });
    expect(result.errors.filter((e) => e.severity === 'error')).toEqual([]);
    expect(existsSync(join(out, 'items/example/cache-aside.json'))).toBe(false);
  });

  it('requires all six mascot poses once any mascot figure exists', async () => {
    const content = copyValidFixture();
    temps.push(content);
    const fig = readFileSync(join(content, 'figures/request-flow.svg'), 'utf8');
    (await import('node:fs')).writeFileSync(join(content, 'figures/mascot-idle.svg'), fig);
    const result = await runBuild({
      contentDir: content,
      outDir: tempDir('sdl-out-'),
      check: true,
    });
    expect(result.errors.map((e) => e.message).join('\n')).toMatch(/mascot-thinking/);
  });
});

describe('search index', () => {
  async function load(): Promise<MiniSearch<SearchDoc>> {
    const out = tempDir('sdl-out-');
    await runBuild({ contentDir: VALID_FIXTURE, outDir: out });
    return MiniSearch.loadJSON<SearchDoc>(
      readFileSync(join(out, 'search-index.json'), 'utf8'),
      SEARCH_OPTIONS,
    );
  }

  it('finds pages by prefix', async () => {
    const urls = (await load()).search('cach').map((r) => r.id);
    expect(urls).toContain('/examples/cache-aside');
    expect(urls).toContain('/glossary#caching');
  });

  it('tolerates typos', async () => {
    expect((await load()).search('latncy').map((r) => r.id)).toContain(
      '/learn/foundations/latency-basics',
    );
  });

  it('stores what the results list needs', async () => {
    const [hit] = (await load()).search('latency basics');
    expect(hit).toMatchObject({
      kind: 'lesson',
      title: 'Latency basics',
      url: '/learn/foundations/latency-basics',
    });
  });
});
