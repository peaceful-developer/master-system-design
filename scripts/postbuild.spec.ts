import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { postbuild } from './postbuild';

const SITE = 'https://example.github.io/lab/';

describe('postbuild', () => {
  let dist: string;

  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'sdl-post-'));
    writeFileSync(join(dist, 'index.html'), '<p>prerendered home</p>');
    writeFileSync(join(dist, 'index.csr.html'), '<p>client shell</p>');
  });

  it('writes 404.html from the client-side shell', async () => {
    await postbuild(dist, { siteUrl: SITE, routes: ['/'] });
    expect(readFileSync(join(dist, '404.html'), 'utf8')).toContain('client shell');
  });

  it('falls back to index.html when there is no client-side shell', async () => {
    const only = mkdtempSync(join(tmpdir(), 'sdl-post-'));
    writeFileSync(join(only, 'index.html'), '<p>prerendered home</p>');
    await postbuild(only, { siteUrl: SITE, routes: ['/'] });
    expect(readFileSync(join(only, '404.html'), 'utf8')).toContain('prerendered home');
  });

  it('writes .nojekyll and robots.txt pointing at the sitemap', async () => {
    await postbuild(dist, { siteUrl: SITE, routes: ['/'] });
    expect(existsSync(join(dist, '.nojekyll'))).toBe(true);
    const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain(`Sitemap: ${SITE}sitemap.xml`);
  });

  it('lists every route in sitemap.xml with a trailing slash', async () => {
    await postbuild(dist, { siteUrl: SITE, routes: ['/', '/path', '/learn/foundations/indexing'] });
    const xml = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
    expect(xml).toContain(`<loc>${SITE}</loc>`);
    expect(xml).toContain(`<loc>${SITE}path/</loc>`);
    expect(xml).toContain(`<loc>${SITE}learn/foundations/indexing/</loc>`);
    expect(xml.match(/<url>/g)).toHaveLength(3);
  });

  it('preloads the body font once in every page, so text does not wait on the stylesheet', async () => {
    const font = 'ibm-plex-sans-latin-wght-normal-AB12CD34.woff2';
    mkdirSync(join(dist, 'media'));
    writeFileSync(join(dist, 'media', font), 'woff2');
    writeFileSync(join(dist, 'media', 'jetbrains-mono-latin-wght-normal-ZZ.woff2'), 'woff2');
    mkdirSync(join(dist, 'learn', 'x'), { recursive: true });
    const page = '<html><head><base href="/lab/"><title>x</title></head><body></body></html>';
    writeFileSync(join(dist, 'index.csr.html'), page);
    writeFileSync(join(dist, 'learn', 'x', 'index.html'), page);
    const link = `<link rel="preload" href="media/${font}" as="font" type="font/woff2" crossorigin>`;

    await postbuild(dist, { siteUrl: SITE, routes: ['/'] });
    await postbuild(dist, { siteUrl: SITE, routes: ['/'] });

    for (const file of ['404.html', 'index.csr.html', join('learn', 'x', 'index.html')]) {
      const html = readFileSync(join(dist, file), 'utf8');
      expect(html.split(link)).toHaveLength(2);
      expect(html.indexOf(link)).toBeLessThan(html.indexOf('</head>'));
    }
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).not.toContain('jetbrains');
  });

  it('is idempotent', async () => {
    await postbuild(dist, { siteUrl: SITE, routes: ['/', '/path'] });
    const first = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
    await postbuild(dist, { siteUrl: SITE, routes: ['/', '/path'] });
    expect(readFileSync(join(dist, 'sitemap.xml'), 'utf8')).toBe(first);
    expect(readFileSync(join(dist, '404.html'), 'utf8')).toContain('client shell');
  });
});
