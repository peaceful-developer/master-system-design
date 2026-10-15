/**
 * Validation and sanitizing for the hand-made SVG icons and figures in
 * `content/icons/` and `content/figures/`. Figures are inlined into pages, so
 * anything that could run code or load remote resources is rejected.
 */
import type { Element, ElementContent, Root } from 'hast';
import { toHtml } from 'hast-util-to-html';
import { find, svg as svgSchema } from 'property-information';
import rehypeParse from 'rehype-parse';
import { unified } from 'unified';

export interface IconResult {
  body: string;
  errors: string[];
}

export interface FigureResult {
  svg: string;
  title: string;
  animated: boolean;
  errors: string[];
  warnings: string[];
}

const ICON_ELEMENTS = new Set([
  'g',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
]);
const FIGURE_ELEMENTS = new Set([
  ...ICON_ELEMENTS,
  'text',
  'tspan',
  'defs',
  'marker',
  'linearGradient',
  'stop',
  'clipPath',
  'use',
  'style',
  'title',
  'desc',
]);
const SMIL = new Set(['animate', 'animateMotion', 'animateTransform', 'set']);
const COLOR_PROPS = new Set(['fill', 'stroke', 'stopColor', 'color']);
const HEX_OR_RGB = /#[0-9a-f]{3,8}\b|rgba?\(/i;

const attr = (prop: string): string => find(svgSchema, prop).attribute;

function parseRoot(source: string): Element | undefined {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(source) as Root;
  return tree.children.find((n): n is Element => n.type === 'element' && n.tagName === 'svg');
}

function elementChildren(el: Element): Element[] {
  return el.children.filter((c): c is Element => c.type === 'element');
}

function textOf(el: Element): string {
  return el.children
    .map((c) => (c.type === 'text' ? c.value : c.type === 'element' ? textOf(c) : ''))
    .join('');
}

function serialize(nodes: ElementContent | ElementContent[]): string {
  return toHtml(nodes, { space: 'svg', closeEmptyElements: true, tightSelfClosing: false }).trim();
}

// ---------------------------------------------------------------------- icons

export function sanitizeIcon(name: string, source: string): IconResult {
  const root = parseRoot(source);
  if (!root) return { body: '', errors: [`icon "${name}": no <svg> root element`] };
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(`icon "${name}": ${msg}`);

  if (root.properties['viewBox'] !== '0 0 24 24') fail('root must have viewBox="0 0 24 24"');

  const check = (el: Element): void => {
    if (!ICON_ELEMENTS.has(el.tagName)) {
      fail(`<${el.tagName}> is not allowed in icons`);
      return;
    }
    for (const [prop, value] of Object.entries(el.properties)) {
      const name = attr(prop);
      if (prop === 'className' || prop === 'style')
        fail(`${name} attribute is not allowed in icons`);
      else if (/^on/i.test(name)) fail(`${name} attribute is not allowed`);
      else if (COLOR_PROPS.has(prop) && !/^(currentcolor|none)$/i.test(String(value))) {
        fail(`${name}="${String(value)}" — icons may only use currentColor or none`);
      }
    }
    elementChildren(el).forEach(check);
  };
  elementChildren(root).forEach(check);

  return { body: serialize(root.children).replace(/\s*\n\s*/g, ''), errors };
}

// -------------------------------------------------------------------- figures

function checkCss(css: string, fail: (msg: string) => void, warn: (msg: string) => void): void {
  if (/@import/i.test(css)) fail('@import is not allowed in figure CSS');
  if (/url\(\s*(?!['"]?#)/i.test(css))
    fail('url(...) must reference an element inside the figure (#id)');
  if (/expression\s*\(/i.test(css)) fail('expression() is not allowed in figure CSS');
  for (const [, , value] of css.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
    const literal = HEX_OR_RGB.exec(value!.replace(/var\(\s*--fig-[\w-]+\s*,[^)]*\)/g, ''));
    if (literal)
      warn(`hard-coded color "${literal[0]}" — use var(--fig-…, fallback) so it follows the theme`);
  }
}

/** Rewrites every id to `fig-<figureId>-<id>` and all references to it. */
function namespaceIds(root: Element, figureId: string): void {
  const renamed = new Map<string, string>();
  const collect = (el: Element): void => {
    const id = el.properties['id'];
    if (typeof id === 'string') {
      renamed.set(id, `fig-${figureId}-${id}`);
      el.properties['id'] = `fig-${figureId}-${id}`;
    }
    elementChildren(el).forEach(collect);
  };
  collect(root);
  if (renamed.size === 0) return;

  const rewrite = (value: string): string => {
    let out = value;
    for (const [from, to] of renamed) {
      out = out
        .replace(new RegExp(`url\\(\\s*#${from}\\s*\\)`, 'g'), `url(#${to})`)
        .replace(new RegExp(`#${from}(?![\\w-])`, 'g'), `#${to}`);
    }
    return out;
  };
  const visit = (el: Element): void => {
    for (const [prop, value] of Object.entries(el.properties)) {
      if (prop !== 'id' && typeof value === 'string') el.properties[prop] = rewrite(value);
    }
    if (el.tagName === 'style') {
      for (const child of el.children)
        if (child.type === 'text') child.value = rewrite(child.value);
    }
    elementChildren(el).forEach(visit);
  };
  visit(root);
}

function closingBrace(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  return css.length - 1;
}

function scopeSelector(selector: string, scope: string): string {
  if (selector === 'svg' || selector === ':root') return scope;
  if (selector.startsWith('svg ')) return `${scope}${selector.slice(3)}`;
  return `${scope} ${selector}`;
}

/** Prefixes every rule's selectors with `scope`, recursing into @media/@supports. */
function prefixRules(css: string, scope: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) return out + css.slice(i);
    const close = closingBrace(css, open);
    const prelude = css.slice(i, open);
    const body = css.slice(open + 1, close);
    const lead = prelude.slice(0, prelude.length - prelude.trimStart().length);
    const selector = prelude.trim();
    if (/^@(media|supports)\b/.test(selector)) out += `${prelude}{${prefixRules(body, scope)}}`;
    else if (selector.startsWith('@')) out += `${prelude}{${body}}`;
    else {
      const scoped = selector.split(',').map((s) => scopeSelector(s.trim(), scope));
      out += `${lead}${scoped.join(', ')} {${body}}`;
    }
    i = close + 1;
  }
  return out;
}

/**
 * Inline SVG <style> applies to the whole document, so figure CSS is scoped to
 * the figure's root id and its keyframes are renamed per figure.
 */
function scopeCss(css: string, figureId: string): string {
  let out = css;
  for (const [, name] of css.matchAll(/@keyframes\s+([\w-]+)/g)) {
    const renamed = `fig-${figureId}-${name}`;
    out = out
      .replace(new RegExp(`@keyframes\\s+${name}\\b`, 'g'), `@keyframes ${renamed}`)
      .replace(new RegExp(`(animation(?:-name)?\\s*:[^;}]*?)\\b${name}\\b`, 'g'), `$1${renamed}`);
  }
  return prefixRules(out, `#fig-${figureId}`);
}

export function sanitizeFigure(id: string, source: string): FigureResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (msg: string) => errors.push(`figure "${id}": ${msg}`);
  const warn = (msg: string) => warnings.push(`figure "${id}": ${msg}`);
  const root = parseRoot(source);
  if (!root)
    return {
      svg: '',
      title: '',
      animated: false,
      errors: [`figure "${id}": no <svg> root element`],
      warnings,
    };

  if (typeof root.properties['viewBox'] !== 'string') fail('root must have a viewBox');
  const top = elementChildren(root);
  const titleEl = top[0]?.tagName === 'title' ? top[0] : undefined;
  if (!titleEl) fail('<title> must be the first child (it is the accessible name)');
  const descEl = top.find((el) => el.tagName === 'desc');
  if (!descEl) warn('add a <desc> describing what the figure shows');

  let css = '';
  const check = (el: Element): void => {
    if (SMIL.has(el.tagName)) {
      fail(
        `<${el.tagName}> is not allowed — use CSS animations (SMIL can't respect reduced motion)`,
      );
      return;
    }
    if (!FIGURE_ELEMENTS.has(el.tagName)) {
      fail(`<${el.tagName}> is not allowed in figures`);
      return;
    }
    for (const [prop, value] of Object.entries(el.properties)) {
      const name = attr(prop);
      const str = String(value);
      if (/^on/i.test(name)) fail(`${name} attribute is not allowed`);
      else if ((prop === 'href' || prop === 'xLinkHref') && !str.startsWith('#')) {
        fail(`${name}="${str}" must point inside the figure (#id)`);
      } else if (prop === 'style') checkCss(`x{${str}}`, fail, warn);
      else if (COLOR_PROPS.has(prop) && HEX_OR_RGB.test(str)) {
        warn(`hard-coded color ${name}="${str}" — use a --fig-* token so it follows the theme`);
      }
    }
    if (el.tagName === 'style') css += textOf(el);
    elementChildren(el).forEach(check);
  };
  top.forEach(check);

  checkCss(css, fail, warn);
  const animated = /@keyframes/i.test(css);
  if (animated && !/prefers-reduced-motion\s*:\s*reduce/i.test(css)) {
    fail('animated figures need a @media (prefers-reduced-motion: reduce) rule');
  }

  namespaceIds(root, id);
  const scopeStyles = (el: Element): void => {
    if (el.tagName === 'style') {
      for (const child of el.children)
        if (child.type === 'text') child.value = scopeCss(child.value, id);
    }
    elementChildren(el).forEach(scopeStyles);
  };
  scopeStyles(root);
  const labelledBy: string[] = [];
  if (titleEl) {
    titleEl.properties['id'] = `fig-${id}-title`;
    labelledBy.push(`fig-${id}-title`);
  }
  if (descEl) {
    descEl.properties['id'] = `fig-${id}-desc`;
    labelledBy.push(`fig-${id}-desc`);
  }
  delete root.properties['width'];
  delete root.properties['height'];
  root.properties = {
    ...root.properties,
    id: `fig-${id}`,
    role: 'img',
    ariaLabelledBy: labelledBy.length > 0 ? labelledBy : undefined,
  };

  return {
    svg: serialize(root),
    title: titleEl ? textOf(titleEl).trim() : '',
    animated,
    errors,
    warnings,
  };
}
