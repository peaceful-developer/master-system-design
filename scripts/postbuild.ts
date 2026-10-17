/**
 * Runs after `ng build`: adds the files static hosts need.
 * - 404.html: the client-side shell, so unknown URLs still boot the app
 * - .nojekyll: stops GitHub Pages from hiding files that start with "_"
 * - robots.txt and sitemap.xml
 * - a preload for the body font in every page, so text does not wait for the stylesheet
 *   to be downloaded and parsed before the font is requested
 *
 * CLI: tsx scripts/postbuild.ts [distDir]   (SITE_URL env overrides the canonical URL)
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SITE_URL } from '../src/app/site';

export interface PostbuildOptions {
  siteUrl: string;
  routes: readonly string[];
}

function absoluteUrl(siteUrl: string, route: string): string {
  const trimmed = route.replace(/^\/+|\/+$/g, '');
  return trimmed ? `${siteUrl}${trimmed}/` : siteUrl;
}

/** The Latin subset of the body font; its file name carries a build hash. */
const BODY_FONT = /^ibm-plex-sans-latin-wght-normal-[\w-]+\.woff2$/;

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => join(e.parentPath, e.name));
}

function preloadBodyFont(distDir: string): void {
  const media = join(distDir, 'media');
  const font = existsSync(media) ? readdirSync(media).find((f) => BODY_FONT.test(f)) : undefined;
  if (!font) return;
  const link = `<link rel="preload" href="media/${font}" as="font" type="font/woff2" crossorigin>`;
  for (const file of htmlFiles(distDir)) {
    const html = readFileSync(file, 'utf8');
    if (html.includes(link) || !html.includes('</head>')) continue;
    // Right after <base>, so the href resolves under the base path and the request starts early.
    const base = /<base [^>]*>/i.exec(html);
    const at = base ? base.index + base[0].length : html.indexOf('</head>');
    writeFileSync(file, html.slice(0, at) + link + html.slice(at));
  }
}

export async function postbuild(
  distDir: string,
  { siteUrl, routes }: PostbuildOptions,
): Promise<void> {
  const shell = join(distDir, 'index.csr.html');
  copyFileSync(existsSync(shell) ? shell : join(distDir, 'index.html'), join(distDir, '404.html'));
  preloadBodyFont(distDir);
  writeFileSync(join(distDir, '.nojekyll'), '');
  writeFileSync(
    join(distDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`,
  );

  const urls = routes
    .map((route) => `  <url>\n    <loc>${absoluteUrl(siteUrl, route)}</loc>\n  </url>`)
    .join('\n');
  writeFileSync(
    join(distDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
}

function readRoutes(): string[] {
  const file = join('src', 'generated', 'routes.json');
  if (!existsSync(file)) return ['/'];
  return (JSON.parse(readFileSync(file, 'utf8')) as { all: string[] }).all;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = process.argv[2] ?? 'dist/system-design-lab/browser';
  await postbuild(dist, { siteUrl: process.env['SITE_URL'] ?? SITE_URL, routes: readRoutes() });
  console.log(
    `postbuild: wrote 404.html, .nojekyll, robots.txt, sitemap.xml and font preloads to ${dist}`,
  );
}
