import { describe, expect, it } from 'vitest';
import { sanitizeFigure, sanitizeIcon } from './svg-assets';

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24">
  <rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/></svg>`;

const FIGURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80">
  <title>Packet travelling</title>
  <desc>A dot moves along an arrow.</desc>
  <style>
    .packet { fill: var(--fig-accent, #2bb24c); animation: travel 2s linear infinite; }
    #arrow path { fill: var(--fig-stroke, #000); }
    @keyframes travel { from { transform: translateX(0); } to { transform: translateX(180px); } }
    @media (prefers-reduced-motion: reduce) { .packet { animation: none; } }
  </style>
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"><path d="M0 0 10 5 0 10z"/></marker></defs>
  <line x1="0" y1="40" x2="200" y2="40" stroke="currentColor" marker-end="url(#arrow)"/>
  <use href="#arrow"/>
  <circle class="packet" cx="10" cy="40" r="6"/>
</svg>`;

const withBody = (body: string, extraStyle = '') =>
  `<svg viewBox="0 0 100 100"><title>T</title><desc>D</desc><style>${extraStyle}</style>${body}</svg>`;

describe('sanitizeIcon', () => {
  it('accepts a valid icon and strips root attributes', () => {
    const result = sanitizeIcon('client', ICON);
    expect(result.errors).toEqual([]);
    expect(result.body).toContain('<rect');
    expect(result.body).toContain('<path d="M8 20h8"');
    expect(result.body).not.toContain('<svg');
    expect(result.body).not.toContain('xmlns');
  });

  it('returns the icon as structured elements (for SVG templates without innerHTML)', () => {
    expect(sanitizeIcon('client', ICON).elements).toEqual([
      { tag: 'rect', attrs: { x: '3', y: '4', width: '18', height: '12', rx: '2' } },
      { tag: 'path', attrs: { d: 'M8 20h8' } },
    ]);
  });

  it('rejects groups so icons stay flat', () => {
    const svg = ICON.replace('<path d="M8 20h8"/>', '<g><path d="M8 20h8"/></g>');
    expect(sanitizeIcon('x', svg).errors.join('\n')).toMatch(/<g>/);
  });

  it('rejects a hard-coded fill color', () => {
    const svg = ICON.replace('<path d="M8 20h8"/>', '<path d="M8 20h8" fill="#f00"/>');
    expect(sanitizeIcon('x', svg).errors.join('\n')).toMatch(/fill="#f00"/);
  });

  it('rejects text elements', () => {
    const svg = ICON.replace('<path d="M8 20h8"/>', '<text>A</text>');
    expect(sanitizeIcon('x', svg).errors.join('\n')).toMatch(/<text>/);
  });

  it('rejects a viewBox other than 0 0 24 24', () => {
    expect(sanitizeIcon('x', ICON.replace('0 0 24 24', '0 0 16 16')).errors.join('\n')).toMatch(
      /viewBox/,
    );
  });

  it('rejects class and style attributes', () => {
    const svg = ICON.replace('<rect ', '<rect class="a" style="stroke:red" ');
    const errors = sanitizeIcon('x', svg).errors.join('\n');
    expect(errors).toMatch(/class/);
    expect(errors).toMatch(/style/);
  });
});

describe('sanitizeFigure', () => {
  it('accepts a valid animated figure', () => {
    const result = sanitizeFigure('flow', FIGURE);
    expect(result.errors).toEqual([]);
    expect(result.animated).toBe(true);
    expect(result.title).toBe('Packet travelling');
    expect(result.svg).toMatch(/^<svg[^>]*role="img"/);
  });

  it('rewrites ids and every reference to them consistently', () => {
    const { svg } = sanitizeFigure('flow', FIGURE);
    expect(svg).toContain('id="fig-flow-arrow"');
    expect(svg).toContain('url(#fig-flow-arrow)');
    expect(svg).toContain('href="#fig-flow-arrow"');
    expect(svg).toContain('#fig-flow-arrow path');
    expect(svg).not.toMatch(/["(]#arrow\b/);
  });

  it('scopes figure CSS so figures cannot restyle each other or the page', () => {
    const { svg } = sanitizeFigure('flow', FIGURE);
    expect(svg).toMatch(/<svg[^>]*id="fig-flow"/);
    expect(svg).toContain('#fig-flow .packet {');
    expect(svg).toContain('#fig-flow #fig-flow-arrow path {');
    expect(svg).toContain('@keyframes fig-flow-travel {');
    expect(svg).toContain('animation: fig-flow-travel 2s');
    expect(svg).toContain('@media (prefers-reduced-motion: reduce) { #fig-flow .packet {');
    expect(svg).not.toMatch(/[{}]\s*\.packet/);
    // Keyframe steps are not selectors and stay untouched.
    expect(svg).toContain('from { transform: translateX(0); }');
  });

  it('gives two figures with the same internal id distinct ids', () => {
    const a = sanitizeFigure('a', FIGURE).svg;
    const b = sanitizeFigure('b', FIGURE).svg;
    expect(a).toContain('id="fig-a-arrow"');
    expect(b).toContain('id="fig-b-arrow"');
  });

  it.each([
    ['script', withBody('<script>alert(1)</script>'), /<script>/],
    ['event handler', withBody('<rect onload="x()" width="1" height="1"/>'), /onload/i],
    ['external href', withBody('<use href="https://evil.example/x.svg#a"/>'), /href/],
    [
      'SMIL animation',
      withBody('<rect width="1" height="1"><animate attributeName="x"/></rect>'),
      /<animate>.*CSS/,
    ],
    ['CSS import', withBody('', '@import url(https://evil.example/a.css);'), /@import/],
    ['external url()', withBody('', '.a { fill: url(https://x.example/p.png); }'), /url\(/],
    ['foreignObject', withBody('<foreignObject><p>x</p></foreignObject>'), /<foreignObject>/],
  ])('rejects %s', (_name, svg, pattern) => {
    expect(sanitizeFigure('bad', svg).errors.join('\n')).toMatch(pattern);
  });

  it('reports one error per problem', () => {
    const svg = withBody('<script>x</script><rect onclick="y()" width="1" height="1"/>');
    expect(sanitizeFigure('bad', svg).errors).toHaveLength(2);
  });

  it('requires a reduced-motion rule when the figure animates', () => {
    const svg = withBody(
      '<circle r="1"/>',
      '@keyframes k { to { opacity: 0; } } circle { animation: k 1s; }',
    );
    expect(sanitizeFigure('bad', svg).errors.join('\n')).toMatch(/prefers-reduced-motion/);
  });

  it('requires <title> as the first child', () => {
    const svg = '<svg viewBox="0 0 10 10"><circle r="1"/></svg>';
    expect(sanitizeFigure('bad', svg).errors.join('\n')).toMatch(/<title>/);
  });

  it('warns (but does not fail) on hard-coded colors outside --fig tokens', () => {
    const result = sanitizeFigure('w', withBody('<circle r="1" fill="#123456"/>'));
    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toMatch(/#123456/);
  });

  it('warns when <desc> is missing', () => {
    const result = sanitizeFigure('w', '<svg viewBox="0 0 10 10"><title>T</title></svg>');
    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toMatch(/<desc>/);
  });
});
