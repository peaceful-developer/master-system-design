import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './lib/contrast';
import { readThemeTokens } from './lib/theme-tokens';

const STYLES = readFileSync(join(import.meta.dirname, '..', 'src', 'styles.css'), 'utf8');

const TEXT_PAIRS: [fg: string, bg: string][] = [
  ['--color-fg', '--color-bg'],
  ['--color-fg', '--color-surface'],
  ['--color-fg', '--color-code-bg'],
  ['--color-fg', '--color-ok-soft'],
  ['--color-fg', '--color-bad-soft'],
  ['--color-fg', '--color-xp-soft'],
  ['--color-fg', '--color-info-soft'],
  ['--color-on-parrot', '--color-parrot'],
  ['--color-on-parrot', '--color-parrot-hover'],
];

function filesUnder(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : filesUnder(path, exts);
    return exts.some((e) => name.endsWith(e)) ? [path] : [];
  });
}

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#2BB24C', '#2BB24C')).toBeCloseTo(1, 5);
  });

  it('matches the measured parrot values', () => {
    expect(contrastRatio('#000000', '#2BB24C')).toBeCloseTo(7.58, 1);
    expect(contrastRatio('#2BB24C', '#FFFFFF')).toBeCloseTo(2.77, 1);
  });
});

describe('theme tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`every text/background pair is at least 4.5:1 in the ${theme} theme`, () => {
      const tokens = readThemeTokens(STYLES, theme);
      for (const [fg, bg] of TEXT_PAIRS) {
        expect(tokens[fg], `${fg} missing`).toBeDefined();
        expect(tokens[bg], `${bg} missing`).toBeDefined();
        const ratio = contrastRatio(tokens[fg]!, tokens[bg]!);
        expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`parrot control borders are at least 3:1 against the page in the ${theme} theme`, () => {
      const tokens = readThemeTokens(STYLES, theme);
      expect(
        contrastRatio(tokens['--color-parrot-deep']!, tokens['--color-bg']!),
      ).toBeGreaterThanOrEqual(3);
    });
  }

  it('uses black text on a white page in the default theme', () => {
    const tokens = readThemeTokens(STYLES, 'light');
    expect(tokens['--color-fg']?.toUpperCase()).toBe('#000000');
    expect(tokens['--color-bg']?.toUpperCase()).toBe('#FFFFFF');
    expect(tokens['--color-parrot']?.toUpperCase()).toBe('#2BB24C');
  });

  it('never uses parrot green as a text color', () => {
    const srcDir = join(import.meta.dirname, '..', 'src');
    const offenders = filesUnder(srcDir, ['.css', '.html', '.ts']).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return (
        /(^|[^-\w])color:\s*var\(--color-parrot/m.test(text) ||
        /\btext-parrot(-hover|-deep)?\b/.test(text)
      );
    });
    expect(offenders).toEqual([]);
  });

  it('gives primary buttons a visible border', () => {
    const btn = /\.btn\s*\{([^}]*)\}/.exec(STYLES);
    expect(btn?.[1]).toMatch(/border:\s*1px solid var\(--color-parrot-deep\)/);
  });
});
