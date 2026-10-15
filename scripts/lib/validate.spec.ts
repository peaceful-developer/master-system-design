import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { copyValidFixture, edit, VALID_FIXTURE, write } from '../test/fixture-helpers';
import type { ContentError } from './errors';
import { loadContent } from './load';
import { createCompiler, type MarkdownCompiler } from './markdown';
import { allRoutes } from './routes';
import { validateReferences } from './validate-refs';
import { validateCaseStudyStructure } from './validate-structure';

let compiler: MarkdownCompiler;
const temps: string[] = [];

beforeAll(async () => {
  compiler = await createCompiler();
});
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function validate(root: string): Promise<ContentError[]> {
  const { content, errors } = await loadContent(root, compiler);
  return [
    ...errors,
    ...validateReferences(content),
    ...content.caseStudies.flatMap((cs) => validateCaseStudyStructure(cs)),
  ];
}

const only = (errors: ContentError[], severity: ContentError['severity'] = 'error') =>
  errors.filter((e) => e.severity === severity);

async function mutate(change: (root: string) => void): Promise<ContentError[]> {
  const root = copyValidFixture();
  temps.push(root);
  change(root);
  return only(await validate(root));
}

const describeErrors = (errors: ContentError[]) =>
  errors.map((e) => `${e.file} ${e.message}`).join('\n');

describe('valid fixture', () => {
  it('loads every item with zero errors', async () => {
    const { content, errors } = await loadContent(VALID_FIXTURE, compiler);
    expect(only(errors)).toEqual([]);
    expect(content.lessons).toHaveLength(1);
    expect(content.playbooks).toHaveLength(1);
    expect(content.examples).toHaveLength(1);
    expect(content.caseStudies.map((c) => c.data.slug)).toEqual(['rate-limiter', 'url-shortener']);
    expect(content.quizzes).toHaveLength(2);
    expect(content.drills).toHaveLength(1);
    expect(content.diagrams.map((d) => d.data.id).sort()).toEqual([
      'cache-aside',
      'rate-limiter-hld',
      'url-shortener-hld',
    ]);
    expect([...content.figures.keys()]).toEqual(['request-flow']);
    expect([...content.icons.keys()]).toEqual(['app-server', 'cache', 'client']);
  });

  it('passes every cross-reference and structure rule, without warnings', async () => {
    const results = await validate(VALID_FIXTURE);
    expect(describeErrors(only(results))).toBe('');
    expect(describeErrors(only(results, 'warning'))).toBe('');
  });

  it('compiles drill scenario and solution markdown to HTML', async () => {
    const { content } = await loadContent(VALID_FIXTURE, compiler);
    expect(content.drills[0]!.scenarioHtml).toContain('<strong>10 million</strong>');
    expect(content.drills[0]!.solutionHtml).toContain('<ol>');
  });

  it('lists every app route', async () => {
    const { content } = await loadContent(VALID_FIXTURE, compiler);
    expect(allRoutes(content)).toEqual([
      '/',
      '/case-studies',
      '/case-studies/rate-limiter',
      '/case-studies/url-shortener',
      '/contribute',
      '/examples',
      '/examples/cache-aside',
      '/exercises',
      '/exercises/latency-quiz',
      '/exercises/qps-drill',
      '/exercises/url-shortener-quiz',
      '/glossary',
      '/learn/foundations/latency-basics',
      '/path',
      '/playbooks',
      '/playbooks/estimation',
      '/playground',
      '/progress',
    ]);
  });
});

describe('schema errors carry the file path', () => {
  it('reports an invalid quiz in quizzes/latency-quiz.json', async () => {
    const errors = await mutate((r) =>
      edit(r, 'quizzes/latency-quiz.json', '"correct": ["b", "c"]', '"correct": []'),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]!.file).toMatch(/quizzes\/latency-quiz\.json$/);
    expect(errors[0]!.message).toMatch(/questions\.1\.correct/);
  });

  it('reports invalid frontmatter', async () => {
    const errors = await mutate((r) =>
      edit(
        r,
        'lessons/foundations/latency-basics.md',
        'estimatedMinutes: 4',
        'estimatedMinutes: 400',
      ),
    );
    expect(errors[0]!.file).toMatch(/latency-basics\.md$/);
    expect(errors[0]!.message).toMatch(/estimatedMinutes/);
  });
});

describe('cross-reference rules', () => {
  it.each([
    [
      'R1 duplicate exercise id across quizzes and drills',
      (r: string) =>
        write(
          r,
          'drills/latency-quiz.json',
          readFixture('drills/qps-drill.json').replace('"id": "qps-drill"', '"id": "latency-quiz"'),
        ),
      /drills\/latency-quiz\.json \[R1\] duplicate exercise id "latency-quiz"/,
    ],
    [
      'R2 lesson slug does not match its file name',
      (r: string) =>
        edit(
          r,
          'lessons/foundations/latency-basics.md',
          'slug: latency-basics',
          'slug: latency-intro',
        ),
      /latency-basics\.md \[R2\]/,
    ],
    [
      'R2 case-study diagram id does not match frontmatter',
      (r: string) =>
        edit(
          r,
          'case-studies/url-shortener/diagram.json',
          '"url-shortener-hld"',
          '"shortener-hld"',
        ),
      /url-shortener\/(index\.md|diagram\.json) \[R2\]/,
    ],
    [
      'R3 diagram uses an unknown component type',
      (r: string) =>
        edit(r, 'diagrams/cache-aside.json', '"type": "cache"', '"type": "ghost-cache"'),
      /diagrams\/cache-aside\.json \[R3\] .*"ghost-cache"/,
    ],
    [
      'R3 component icon is missing',
      (r: string) => edit(r, 'components.json', '"icon": "cache"', '"icon": "no-such-icon"'),
      /components\.json \[R3\] .*"no-such-icon"/,
    ],
    [
      'R4 unknown concept',
      (r: string) =>
        edit(
          r,
          'lessons/foundations/latency-basics.md',
          'concepts: [latency, throughput]',
          'concepts: [latency, bandwidth]',
        ),
      /latency-basics\.md \[R4\] .*"bandwidth"/,
    ],
    [
      'R4 unknown :term id',
      (r: string) => edit(r, 'examples/cache-aside.md', '{id="caching"}', '{id="memoization"}'),
      /cache-aside\.md \[R4\] .*"memoization"/,
    ],
    [
      'R6 unknown exercise in frontmatter',
      (r: string) =>
        edit(
          r,
          'lessons/foundations/latency-basics.md',
          'exercises: [latency-quiz]',
          'exercises: [latency-quiz, ghost-quiz]',
        ),
      /latency-basics\.md \[R6\] .*"ghost-quiz"/,
    ],
    [
      'R6 embedded quiz does not exist',
      (r: string) =>
        edit(r, 'playbooks/estimation.md', '::drill{id="qps-drill"}', '::quiz{id="nope-quiz"}'),
      /estimation\.md \[R6\] .*"nope-quiz"/,
    ],
    [
      'R6 complete case study without a quiz',
      (r: string) => {
        edit(
          r,
          'case-studies/url-shortener/index.md',
          'exercises: [url-shortener-quiz, qps-drill]',
          'exercises: [qps-drill]',
        );
        edit(
          r,
          'case-studies/url-shortener/index.md',
          '::quiz{id="url-shortener-quiz"}',
          'Practice the drill.',
        );
      },
      /url-shortener\/index\.md \[R6\] .*quiz/,
    ],
    [
      'R7 unknown diagram',
      (r: string) =>
        edit(r, 'examples/cache-aside.md', '::diagram{id="cache-aside"}', '::diagram{id="ghost"}'),
      /cache-aside\.md \[R7\] .*"ghost"/,
    ],
    [
      'R8 broken internal link',
      (r: string) =>
        edit(
          r,
          'lessons/foundations/latency-basics.md',
          '[glossary](/glossary)',
          '[glossary](/learn/foundations/nope)',
        ),
      /latency-basics\.md \[R8\] .*\/learn\/foundations\/nope/,
    ],
    [
      'R8 in-page anchor to a missing heading',
      (r: string) =>
        edit(r, 'lessons/foundations/latency-basics.md', '(#budgets)', '(#no-such-heading)'),
      /latency-basics\.md \[R8\] .*#no-such-heading/,
    ],
    [
      'R8 glossary anchor to a missing term',
      (r: string) =>
        edit(
          r,
          'lessons/foundations/latency-basics.md',
          '[glossary](/glossary)',
          '[glossary](/glossary#nope)',
        ),
      /latency-basics\.md \[R8\] .*\/glossary#nope/,
    ],
    [
      'R9 case study missing from the path',
      (r: string) =>
        edit(r, 'path.json', ',\n        { "kind": "case-study", "ref": "rate-limiter" }', ''),
      /path\.json \[R9\] .*rate-limiter/,
    ],
    [
      'R9 lesson placed in the wrong phase',
      (r: string) => {
        edit(
          r,
          'path.json',
          '"items": [{ "kind": "lesson", "ref": "foundations/latency-basics" }]',
          '"items": []',
        );
        edit(
          r,
          'path.json',
          '{ "kind": "playbook", "ref": "estimation" },',
          '{ "kind": "playbook", "ref": "estimation" },\n        { "kind": "lesson", "ref": "foundations/latency-basics" },',
        );
      },
      /path\.json \[R9\] .*foundations\/latency-basics/,
    ],
    [
      'R10 track A order outside 1–15',
      (r: string) => edit(r, 'case-studies/rate-limiter/index.md', 'order: 2', 'order: 20'),
      /rate-limiter\/index\.md \[R10\]/,
    ],
    [
      'R11 lesson without an interview tip',
      (r: string) =>
        edit(r, 'lessons/foundations/latency-basics.md', /:::interview[\s\S]*?:::\n/, ''),
      /latency-basics\.md \[R11\] .*interview/,
    ],
  ])('%s', async (_name, change, pattern) => {
    const errors = await mutate(change);
    expect(describeErrors(errors)).toMatch(pattern);
  });

  it('R5 reports a prerequisite cycle with its path', async () => {
    const errors = await mutate((r) =>
      edit(
        r,
        'case-studies/url-shortener/index.md',
        'prerequisites: []',
        'prerequisites: [rate-limiter]',
      ),
    );
    expect(describeErrors(errors)).toMatch(
      /\[R5\] prerequisite cycle: (url-shortener → rate-limiter → url-shortener|rate-limiter → url-shortener → rate-limiter)/,
    );
  });

  it('reports every defect in one run (no fail-fast)', async () => {
    const errors = await mutate((r) => {
      edit(r, 'diagrams/cache-aside.json', '"type": "cache"', '"type": "ghost-cache"');
      edit(r, 'case-studies/rate-limiter/index.md', 'order: 2', 'order: 20');
      edit(r, 'lessons/foundations/latency-basics.md', '(#budgets)', '(#nowhere)');
    });
    expect(describeErrors(errors)).toMatch(/\[R3\]/);
    expect(describeErrors(errors)).toMatch(/\[R10\]/);
    expect(describeErrors(errors)).toMatch(/\[R8\]/);
  });
});

describe('case-study structure', () => {
  it('rejects an ML/LLM section in a track A case study', async () => {
    const errors = await mutate((r) =>
      edit(
        r,
        'case-studies/url-shortener/index.md',
        '## Trade-offs',
        '## ML/LLM design\n\nNone.\n\n## Trade-offs',
      ),
    );
    expect(describeErrors(errors)).toMatch(
      /url-shortener\/index\.md \[structure\] .*ML\/LLM design/,
    );
  });

  it('rejects an outline that is missing Key concepts', async () => {
    const errors = await mutate((r) =>
      edit(
        r,
        'case-studies/rate-limiter/index.md',
        /## Key concepts[\s\S]*?(?=## High-level design)/,
        '',
      ),
    );
    expect(describeErrors(errors)).toMatch(/rate-limiter\/index\.md \[structure\] .*Key concepts/);
  });

  it('requires the diagram inside High-level design', async () => {
    const errors = await mutate((r) =>
      edit(
        r,
        'case-studies/rate-limiter/index.md',
        '## High-level design\n\n::diagram{id="rate-limiter-hld"}',
        '## High-level design\n\nSoon.',
      ),
    );
    expect(describeErrors(errors)).toMatch(
      /rate-limiter\/index\.md \[structure\] .*rate-limiter-hld/,
    );
  });

  it('warns when estimatedMinutes is far from the reading time', async () => {
    const root = copyValidFixture();
    temps.push(root);
    edit(
      root,
      'case-studies/url-shortener/index.md',
      'estimatedMinutes: 3',
      'estimatedMinutes: 90',
    );
    const warnings = only(await validate(root), 'warning');
    expect(describeErrors(warnings)).toMatch(/url-shortener\/index\.md .*estimatedMinutes/);
  });
});

function readFixture(rel: string): string {
  return readFileSync(join(VALID_FIXTURE, rel), 'utf8');
}
