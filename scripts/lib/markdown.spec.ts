import { beforeAll, describe, expect, it } from 'vitest';
import { createCompiler, type MarkdownCompiler } from './markdown';

const FIGURE_SVG =
  '<svg id="fig-flow" role="img" viewBox="0 0 10 10"><title id="fig-flow-title">Flow</title></svg>';
const figures = new Map([['flow', { svg: FIGURE_SVG, title: 'Flow' }]]);
const ctx = { file: 'content/lessons/foundations/x.md', figures };

let compiler: MarkdownCompiler;
beforeAll(async () => {
  compiler = await createCompiler();
});

const compile = (source: string) => compiler.compile(source, ctx);
const html = (source: string) =>
  compile(source).then((r) =>
    r.doc.blocks
      .filter((b) => b.kind === 'html')
      .map((b) => (b as { html: string }).html)
      .join('\n'),
  );

describe('frontmatter', () => {
  it('extracts YAML frontmatter and leaves it out of the body', async () => {
    const result = await compile('---\nslug: a\nconcepts: [x, y]\n---\n\nHello');
    expect(result.frontmatter).toEqual({ slug: 'a', concepts: ['x', 'y'] });
    expect(await html('---\nslug: a\n---\n\nHello')).not.toContain('slug');
  });

  it('compiles plain markdown without frontmatter (drill scenarios)', async () => {
    const result = await compile('Hello **world**');
    expect(result.frontmatter).toBeUndefined();
    expect(result.errors).toEqual([]);
  });
});

describe('component shortcodes', () => {
  it('splits ::quiz into its own block between HTML blocks', async () => {
    const result = await compile('Before.\n\n::quiz{id="q1"}\n\nAfter.');
    expect(result.doc.blocks.map((b) => b.kind)).toEqual(['html', 'quiz', 'html']);
    expect(result.doc.blocks[1]).toEqual({ kind: 'quiz', id: 'q1' });
    expect(result.refs.quizzes).toEqual(['q1']);
  });

  it('supports ::diagram and ::drill', async () => {
    const result = await compile('::diagram{id="d1"}\n\n::drill{id="dr1"}');
    expect(result.doc.blocks).toEqual([
      { kind: 'diagram', id: 'd1' },
      { kind: 'drill', id: 'dr1' },
    ]);
    expect(result.refs.diagrams).toEqual(['d1']);
    expect(result.refs.drills).toEqual(['dr1']);
  });

  it('inlines ::figure with its caption', async () => {
    const out = await html('::figure{id="flow" caption="How it flows"}');
    expect(out).toContain('<figure class="figure" data-figure="flow">');
    expect(out).toContain('<title id="fig-flow-title">Flow</title>');
    expect(out).toContain('<figcaption>How it flows</figcaption>');
  });

  it('requires a caption on ::figure', async () => {
    const result = await compile('::figure{id="flow"}');
    expect(result.errors.map((e) => e.message).join('\n')).toMatch(/line 1: .*caption/);
  });

  it('reports a shortcode without an id', async () => {
    const result = await compile('::quiz');
    expect(result.errors.map((e) => e.message).join('\n')).toMatch(/line 1: ::quiz needs an id/);
  });

  it('reports unknown directives with their line number', async () => {
    const result = await compile('Intro\n\n::bogus{id="x"}');
    expect(result.errors.map((e) => e.message).join('\n')).toMatch(
      /line 3: unknown directive ::bogus/,
    );
  });
});

describe('callouts', () => {
  it('renders :::warning as an aside', async () => {
    const out = await html(':::warning\nCareful.\n:::');
    expect(out).toContain(
      '<aside class="callout callout-warning" role="note" aria-label="Warning">',
    );
    expect(out).toContain('<p class="callout-title">Warning</p>');
    expect(out).toContain('<p>Careful.</p>');
  });

  it('uses the [Label] when given', async () => {
    const out = await html(':::tip[Pro tip]\nCache it.\n:::');
    expect(out).toContain('aria-label="Pro tip"');
    expect(out).toContain('<p class="callout-title">Pro tip</p>');
  });

  it('gives :::primer and :::interview their default labels', async () => {
    expect(await html(':::primer\nBasics.\n:::')).toContain(
      '<p class="callout-title">New to this?</p>',
    );
    expect(await html(':::interview\nSay p99.\n:::')).toContain(
      '<p class="callout-title">Interview tip</p>',
    );
  });

  it('renders :::deeper as closed details whose text is searchable', async () => {
    const result = await compile(
      ':::deeper[Consistent hashing math]\nVirtual nodes smooth load.\n:::',
    );
    const out = (result.doc.blocks[0] as { html: string }).html;
    expect(out).toContain('<details class="deeper">');
    expect(out).toContain('<summary>Go deeper: Consistent hashing math</summary>');
    expect(out).not.toContain(' open');
    expect(result.text).toContain('Virtual nodes smooth load.');
  });

  it('records which callouts were used', async () => {
    const result = await compile(
      ':::primer\na\n:::\n\n:::deeper[x]\nb\n:::\n\n:::interview\nc\n:::',
    );
    expect(result.refs.callouts).toEqual(['primer', 'deeper', 'interview']);
  });
});

describe('glossary terms and links', () => {
  it('turns :term into a glossary link', async () => {
    const result = await compile('The :term[CAP theorem]{id="cap-theorem"} says so.');
    const out = (result.doc.blocks[0] as { html: string }).html;
    expect(out).toContain(
      '<a class="term" href="glossary#cap-theorem" data-internal="/glossary#cap-theorem" data-term="cap-theorem">CAP theorem</a>',
    );
    expect(result.refs.terms).toEqual(['cap-theorem']);
  });

  it('rewrites internal links to base-relative hrefs and records them', async () => {
    const result = await compile(
      'See [the glossary](/glossary) and [indexing](/learn/foundations/indexing#b-trees).',
    );
    const out = (result.doc.blocks[0] as { html: string }).html;
    expect(out).toContain('<a href="glossary" data-internal="/glossary">');
    expect(out).toContain('href="learn/foundations/indexing#b-trees"');
    expect(result.refs.links).toEqual(['/glossary', '/learn/foundations/indexing#b-trees']);
  });

  it('marks in-page anchors', async () => {
    const out = await html('Jump to [budgets](#budgets).');
    expect(out).toContain('<a href="#budgets" data-anchor="budgets">');
  });

  it('marks external links', async () => {
    const out = await html('Read [the paper](https://example.org/paper).');
    expect(out).toContain('<a href="https://example.org/paper" class="external" rel="noopener">');
  });

  it('rejects javascript: and other schemes', async () => {
    const result = await compile('[x](javascript:alert(1)) and [y](mailto:a@b.c)');
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]!.message).toMatch(/line 1: .*javascript:/);
  });

  it('rejects raw HTML', async () => {
    const result = await compile('Hi\n\n<script>alert(1)</script>');
    expect(result.errors.map((e) => e.message).join('\n')).toMatch(/line 3: raw HTML/);
    expect(await html('Hi\n\n<script>alert(1)</script>')).not.toContain('<script');
  });
});

describe('headings, code and text', () => {
  it('collects h2/h3 headings with slug ids in order', async () => {
    const result = await compile('## First part\n\ntext\n\n### Detail one\n\n## Second part');
    expect(result.doc.headings).toEqual([
      { id: 'first-part', text: 'First part', depth: 2 },
      { id: 'detail-one', text: 'Detail one', depth: 3 },
      { id: 'second-part', text: 'Second part', depth: 2 },
    ]);
  });

  it('records which diagrams appear under each h2 section', async () => {
    const result = await compile('## Intro\n\nx\n\n## High-level design\n\n::diagram{id="hld"}');
    expect(result.sections).toEqual([
      { title: 'Intro', diagrams: [] },
      { title: 'High-level design', diagrams: ['hld'] },
    ]);
  });

  it('highlights code at build time with dual-theme CSS variables', async () => {
    const out = await html('```ts\nconst a = 1;\n```');
    expect(out).toContain('class="shiki');
    expect(out).toMatch(/--shiki-light:/);
    expect(out).toMatch(/--shiki-dark:/);
  });

  it('rejects unknown code languages', async () => {
    const result = await compile('Intro\n\n```cobol\nDISPLAY "HI".\n```');
    expect(result.errors.map((e) => e.message).join('\n')).toMatch(/line 3: .*cobol/);
  });

  it('builds search text without code', async () => {
    const result = await compile(
      '## Title\n\nSome **bold** words.\n\n```ts\nconst hidden = 1;\n```',
    );
    expect(result.text).toContain('Some bold words.');
    expect(result.text).not.toContain('hidden');
  });

  it('is deterministic', async () => {
    const source = '## A\n\n:::note\nx\n:::\n\n```ts\nlet a = 1;\n```\n\n::quiz{id="q"}';
    expect(JSON.stringify(await compile(source))).toBe(JSON.stringify(await compile(source)));
  });
});
