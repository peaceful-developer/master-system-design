import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import {
  CaseStudyFrontmatterSchema,
  ComponentCatalogSchema,
  DiagramSchema,
  DrillSchema,
  ExampleFrontmatterSchema,
  GlossarySchema,
  LearningPathSchema,
  LessonFrontmatterSchema,
  PlaybookFrontmatterSchema,
  QuizSchema,
  formatIssues,
} from './schemas';

const VALID = join(import.meta.dirname, 'test', 'fixtures', 'valid');

const json = (rel: string): unknown => JSON.parse(readFileSync(join(VALID, rel), 'utf8'));
const frontmatter = (rel: string): Record<string, unknown> => {
  const text = readFileSync(join(VALID, rel), 'utf8');
  return parseYaml(/^---\n([\s\S]*?)\n---/.exec(text)![1]!) as Record<string, unknown>;
};

/** Parses and returns the formatted error lines (empty when valid). */
function errorsOf(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : formatIssues(result.error);
}

describe('valid fixtures parse', () => {
  it.each([
    ['lesson', LessonFrontmatterSchema, () => frontmatter('lessons/foundations/latency-basics.md')],
    ['playbook', PlaybookFrontmatterSchema, () => frontmatter('playbooks/estimation.md')],
    ['example', ExampleFrontmatterSchema, () => frontmatter('examples/cache-aside.md')],
    [
      'complete case study',
      CaseStudyFrontmatterSchema,
      () => frontmatter('case-studies/url-shortener/index.md'),
    ],
    [
      'outline case study',
      CaseStudyFrontmatterSchema,
      () => frontmatter('case-studies/rate-limiter/index.md'),
    ],
    ['diagram', DiagramSchema, () => json('case-studies/url-shortener/diagram.json')],
    ['standalone diagram', DiagramSchema, () => json('diagrams/cache-aside.json')],
    ['components', ComponentCatalogSchema, () => json('components.json')],
    ['quiz', QuizSchema, () => json('quizzes/latency-quiz.json')],
    ['drill', DrillSchema, () => json('drills/qps-drill.json')],
    ['glossary', GlossarySchema, () => json('glossary.json')],
    ['path', LearningPathSchema, () => json('path.json')],
  ] as const)('%s', (_name, schema, load) => {
    expect(errorsOf(schema, load())).toEqual([]);
  });

  it('applies the default drill tolerance of ±25%', () => {
    const drill = DrillSchema.parse(json('drills/qps-drill.json'));
    expect(drill.questions[0]!.tolerance).toEqual({ kind: 'relative', value: 0.25 });
    expect(drill.questions[1]!.tolerance).toEqual({ kind: 'orderOfMagnitude' });
  });
});

describe('invalid content is rejected with the field named', () => {
  const quiz = () =>
    structuredClone(json('quizzes/latency-quiz.json')) as {
      questions: { correct: string[]; kind: string; level: string }[];
    };

  it('quiz question with no correct answer', () => {
    const q = quiz();
    q.questions[1]!.correct = [];
    expect(errorsOf(QuizSchema, q).join('\n')).toMatch(/questions\.1\.correct/);
  });

  it('single-choice question with two correct answers', () => {
    const q = quiz();
    q.questions[0]!.correct = ['a', 'b'];
    expect(errorsOf(QuizSchema, q).join('\n')).toMatch(/questions\.0\.correct: .*exactly one/);
  });

  it('correct answer that is not an option', () => {
    const q = quiz();
    q.questions[0]!.correct = ['z'];
    expect(errorsOf(QuizSchema, q).join('\n')).toMatch(/questions\.0\.correct: .*"z"/);
  });

  it('long quiz that does not mix levels', () => {
    const base = quiz().questions[0]!;
    const q = { ...quiz(), questions: [1, 2, 3, 4].map((n) => ({ ...base, id: `q${n}` })) };
    expect(errorsOf(QuizSchema, q).join('\n')).toMatch(/questions: .*levels/);
  });

  it('drill with a zero tolerance', () => {
    const d = structuredClone(json('drills/qps-drill.json')) as {
      questions: { tolerance?: unknown }[];
    };
    d.questions[0]!.tolerance = { kind: 'relative', value: 0 };
    expect(errorsOf(DrillSchema, d).join('\n')).toMatch(/questions\.0\.tolerance\.value/);
  });

  it('case study with an unknown track', () => {
    const fm = { ...frontmatter('case-studies/url-shortener/index.md'), track: 'D' };
    expect(errorsOf(CaseStudyFrontmatterSchema, fm).join('\n')).toMatch(/^track: /m);
  });

  it('slug that is not kebab-case', () => {
    const fm = { ...frontmatter('lessons/foundations/latency-basics.md'), slug: 'Bad Slug' };
    expect(errorsOf(LessonFrontmatterSchema, fm).join('\n')).toMatch(/^slug: .*kebab-case/m);
  });

  it('unknown frontmatter field (catches typos)', () => {
    const fm = { ...frontmatter('lessons/foundations/latency-basics.md'), sumary: 'typo' };
    expect(errorsOf(LessonFrontmatterSchema, fm).join('\n')).toMatch(/sumary/);
  });

  const diagram = () =>
    structuredClone(json('case-studies/url-shortener/diagram.json')) as {
      nodes: { id: string }[];
      edges: { from: string; to: string }[];
    };

  it('diagram edge to a missing node', () => {
    const d = diagram();
    d.edges[0]!.to = 'ghost';
    expect(errorsOf(DiagramSchema, d).join('\n')).toMatch(/edges\.0\.to: .*"ghost"/);
  });

  it('diagram self-loop edge', () => {
    const d = diagram();
    d.edges[0]!.to = d.edges[0]!.from;
    expect(errorsOf(DiagramSchema, d).join('\n')).toMatch(/edges\.0: .*itself/);
  });

  it('diagram with a duplicate node id', () => {
    const d = diagram();
    d.nodes[1]!.id = d.nodes[0]!.id;
    expect(errorsOf(DiagramSchema, d).join('\n')).toMatch(/nodes\.1\.id: .*duplicate/);
  });

  it('component with zero instances', () => {
    const c = structuredClone(json('components.json')) as {
      components: { sim: { instances: number } }[];
    };
    c.components[0]!.sim.instances = 0;
    expect(errorsOf(ComponentCatalogSchema, c).join('\n')).toMatch(/components\.0\.sim\.instances/);
  });

  it('component whose node subtitle is too long', () => {
    const c = structuredClone(json('components.json')) as {
      components: { label: string; shortLabel?: string }[];
    };
    c.components[0]!.label = 'Client application (any)';
    delete c.components[0]!.shortLabel;
    expect(errorsOf(ComponentCatalogSchema, c).join('\n')).toMatch(
      /components\.0\.label: .*add a shortLabel/,
    );
    c.components[0]!.shortLabel = 'Client';
    expect(errorsOf(ComponentCatalogSchema, c)).toEqual([]);
    c.components[0]!.shortLabel = 'Still far too long here';
    expect(errorsOf(ComponentCatalogSchema, c).join('\n')).toMatch(/components\.0\.shortLabel/);
  });

  it('component catalog without the illustrative-values note', () => {
    const c = { ...(json('components.json') as object), note: 'Benchmarks' };
    expect(errorsOf(ComponentCatalogSchema, c).join('\n')).toMatch(/^note: /m);
  });
});
