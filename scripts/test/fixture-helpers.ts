import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const VALID_FIXTURE = join(import.meta.dirname, 'fixtures', 'valid');

/** Copies the valid fixture tree to a temp dir and returns its path. */
export function copyValidFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sdl-content-'));
  cpSync(VALID_FIXTURE, dir, { recursive: true });
  return dir;
}

/** Replaces `from` with `to` in a fixture file; throws if `from` is absent (keeps tests honest). */
export function edit(root: string, rel: string, from: string | RegExp, to: string): void {
  const path = join(root, rel);
  const before = readFileSync(path, 'utf8');
  const after = before.replace(from, to);
  if (after === before) throw new Error(`edit(): pattern not found in ${rel}: ${String(from)}`);
  writeFileSync(path, after);
}

export function write(root: string, rel: string, content: string): void {
  writeFileSync(join(root, rel), content);
}
