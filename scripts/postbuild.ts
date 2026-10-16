/**
 * Runs after `ng build`: adds the files static hosts need.
 * - 404.html: the client-side shell, so unknown URLs still boot the app
 * - .nojekyll: stops GitHub Pages from hiding files that start with "_"
 * - robots.txt and sitemap.xml
 *
 * CLI: tsx scripts/postbuild.ts [distDir]   (SITE_URL env overrides the canonical URL)
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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

export async function postbuild(
  distDir: string,
  { siteUrl, routes }: PostbuildOptions,
): Promise<void> {
  const shell = join(distDir, 'index.csr.html');
  copyFileSync(existsSync(shell) ? shell : join(distDir, 'index.html'), join(distDir, '404.html'));
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
  console.log(`postbuild: wrote 404.html, .nojekyll, robots.txt, sitemap.xml to ${dist}`);
}
