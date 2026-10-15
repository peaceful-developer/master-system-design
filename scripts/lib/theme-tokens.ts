/** Returns the body of the first `{ … }` block that follows `opener` (brace-balanced). */
function blockAfter(css: string, opener: RegExp): string {
  const match = opener.exec(css);
  if (!match) return '';
  let depth = 0;
  const start = css.indexOf('{', match.index);
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i);
  }
  return '';
}

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[name!] = value!.trim();
  }
  return out;
}

/**
 * Reads the design tokens declared in `@theme { … }` (light, the default) and,
 * for the dark theme, applies the overrides declared in `.dark { … }`.
 */
export function readThemeTokens(css: string, theme: 'light' | 'dark'): Record<string, string> {
  const light = declarations(blockAfter(css, /@theme\s*\{/));
  if (theme === 'light') return light;
  return { ...light, ...declarations(blockAfter(css, /(^|\n)\s*\.dark\s*\{/)) };
}
