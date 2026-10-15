/**
 * Minimal static file server for the prerendered site, mounted under the app's
 * base path so e2e tests and Lighthouse see exactly what GitHub Pages serves.
 *
 * CLI: tsx scripts/serve-static.ts [--dir dist/system-design-lab/browser] [--port 4300] [--base /x/]
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

export interface StaticServerOptions {
  dir: string;
  basePath: string;
}

export function readBaseHref(indexHtml: string): string {
  return /<base\s+href="([^"]*)"/i.exec(indexHtml)?.[1] || '/';
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

/** Resolves a request path to a file inside `root`, or null. Never escapes `root`. */
function resolveFile(root: string, rel: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return null;
  }
  const target = resolve(root, '.' + sep + decoded);
  if (target !== root && !target.startsWith(root + sep)) return null;
  const candidates =
    decoded === '' || decoded.endsWith('/')
      ? [join(target, 'index.html')]
      : [target, join(target, 'index.html')];
  return candidates.find(isFile) ?? null;
}

export function createStaticServer({ dir, basePath }: StaticServerOptions): Server {
  const root = resolve(dir);
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const notFound = join(root, '404.html');

  return createServer((req, res) => {
    const path = (req.url ?? '/').split(/[?#]/)[0]!;
    const inBase = path === base.slice(0, -1) || path.startsWith(base);
    const file = inBase ? resolveFile(root, path.slice(base.length)) : null;

    if (!file) {
      res.writeHead(404, { 'content-type': CONTENT_TYPES['.html']! });
      res.end(isFile(notFound) ? readFileSync(notFound) : 'Not found');
      return;
    }
    const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(readFileSync(file));
  });
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = arg('dir') ?? 'dist/system-design-lab/browser';
  const port = Number(arg('port') ?? 4300);
  const index = join(dir, 'index.html');
  const basePath = arg('base') ?? (isFile(index) ? readBaseHref(readFileSync(index, 'utf8')) : '/');
  createStaticServer({ dir, basePath }).listen(port, '127.0.0.1', () => {
    console.log(`Serving ${dir} at http://localhost:${port}${basePath}`);
  });
}
