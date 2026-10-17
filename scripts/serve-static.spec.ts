import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { request, type IncomingHttpHeaders } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaticServer, readBaseHref } from './serve-static';

const BASE = '/master-system-design/';

/** Raw GET so that `..` segments reach the server unnormalized. */
function get(port: number, path: string): Promise<{ status: number; type: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, type: String(res.headers['content-type']), body }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

/** GET with request headers, keeping the raw (possibly compressed) body. */
function getRaw(
  port: number,
  path: string,
  headers: Record<string, string>,
): Promise<{ headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('createStaticServer', () => {
  let root: string;
  let port: number;
  let close: () => void;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'sdl-static-'));
    const dist = join(root, 'browser');
    mkdirSync(join(dist, 'learn', 'x', 'y'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), `<base href="${BASE}"><p>home</p>`);
    writeFileSync(join(dist, '404.html'), '<p>not found page</p>');
    writeFileSync(join(dist, 'learn', 'x', 'y', 'index.html'), '<p>lesson</p>');
    writeFileSync(join(dist, 'app.js'), 'console.log(1)');
    writeFileSync(join(dist, 'styles.css'), 'body{}');
    writeFileSync(join(dist, 'data.json'), '{}');
    writeFileSync(join(dist, 'logo.svg'), '<svg/>');
    writeFileSync(join(dist, 'font.woff2'), 'x');
    writeFileSync(join(root, 'secret.txt'), 'top secret');

    const server = createStaticServer({ dir: dist, basePath: BASE });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
    close = () => server.close();
  });

  afterAll(() => close());

  it('serves index.html at the base path', async () => {
    const res = await get(port, BASE);
    expect(res.status).toBe(200);
    expect(res.body).toContain('home');
    expect(res.type).toContain('text/html');
  });

  it('serves a prerendered route with or without a trailing slash', async () => {
    expect((await get(port, `${BASE}learn/x/y/`)).body).toContain('lesson');
    expect((await get(port, `${BASE}learn/x/y`)).body).toContain('lesson');
  });

  it('returns 404.html with status 404 for unknown paths', async () => {
    const res = await get(port, `${BASE}nope/`);
    expect(res.status).toBe(404);
    expect(res.body).toContain('not found page');
  });

  it('never serves files outside the directory', async () => {
    for (const path of [
      `${BASE}../secret.txt`,
      `${BASE}%2e%2e/secret.txt`,
      `${BASE}..%2fsecret.txt`,
    ]) {
      const res = await get(port, path);
      expect(res.status, path).toBe(404);
      expect(res.body, path).not.toContain('top secret');
    }
  });

  it('returns 404 for requests outside the base path', async () => {
    expect((await get(port, '/other/')).status).toBe(404);
  });

  it('gzips text when the client accepts it, as GitHub Pages does', async () => {
    const gz = await getRaw(port, `${BASE}app.js`, { 'accept-encoding': 'gzip, deflate, br' });
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(gz.headers['vary']).toBe('Accept-Encoding');
    expect(gunzipSync(gz.body).toString()).toBe('console.log(1)');

    const plain = await getRaw(port, `${BASE}app.js`, {});
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.body.toString()).toBe('console.log(1)');

    const font = await getRaw(port, `${BASE}font.woff2`, { 'accept-encoding': 'gzip' });
    expect(font.headers['content-encoding']).toBeUndefined();
  });

  it('sends correct content types', async () => {
    expect((await get(port, `${BASE}app.js`)).type).toContain('text/javascript');
    expect((await get(port, `${BASE}styles.css`)).type).toContain('text/css');
    expect((await get(port, `${BASE}data.json`)).type).toContain('application/json');
    expect((await get(port, `${BASE}logo.svg`)).type).toContain('image/svg+xml');
    expect((await get(port, `${BASE}font.woff2`)).type).toContain('font/woff2');
  });
});

describe('readBaseHref', () => {
  it('reads the base href from index.html', () => {
    expect(readBaseHref('<head><base href="/x/y/"></head>')).toBe('/x/y/');
  });

  it('defaults to / when there is no base tag', () => {
    expect(readBaseHref('<head></head>')).toBe('/');
  });
});
