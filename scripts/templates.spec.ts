import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ContentError } from './lib/errors';
import { loadContent } from './lib/load';
import { createCompiler, type MarkdownCompiler } from './lib/markdown';
import { validateReferences } from './lib/validate-refs';
import { validateCaseStudyStructure } from './lib/validate-structure';
import type { LearningPath, PathItem } from './schemas';
import { copyValidFixture } from './test/fixture-helpers';

const TEMPLATES = join(import.meta.dirname, '..', 'content', '_templates');

/** Values for the named placeholders; any other {{…}} is free-text guidance. */
const SAMPLE: Record<string, string> = {
  slug: 'sample-topic',
  title: 'Sample topic',
  summary: 'A sample summary that checks the template still validates.',
  phase: 'foundations',
  order: '2',
  track: 'A',
  difficulty: 'intermediate',
  minutes: '3',
  tag: 'pattern',
  'concept-id': 'latency',
  'quiz-id': 'sample-topic-quiz',
  'drill-id': 'sample-topic-drill',
  'diagram-id': 'sample-topic-hld',
  'figure-id': 'sample-topic-flow',
  'figure-title': 'A request moves from the client to the server',
  'figure-description': 'A dot travels along an arrow between two boxes.',
  'left-label': 'Client',
  'right-label': 'Server',
};

/** Fills a template the way a contributor would: named values, prose for guidance, no // comment lines. */
function fill(name: string, overrides: Record<string, string> = {}): string {
  const values = { ...SAMPLE, ...overrides };
  let text = readFileSync(join(TEMPLATES, name), 'utf8');
  if (name.endsWith('.jsonc')) text = text.replace(/^\s*\/\/.*\n/gm, '');
  return text.replace(/\{\{([^}]*)\}\}/g, (_, key: string) => values[key] ?? 'Sample text.');
}

interface Scenario {
  name: string;
  files: Record<string, string>;
  values?: Record<string, string>;
  path?: { phase: string; item: PathItem };
}

const SCENARIOS: Scenario[] = [
  {
    name: 'lesson with a quiz and a figure',
    files: {
      'lesson.md': 'lessons/foundations/sample-topic.md',
      'quiz.jsonc': 'quizzes/sample-topic-quiz.json',
      'figure.svg': 'figures/sample-topic-flow.svg',
    },
    path: { phase: 'foundations', item: { kind: 'lesson', ref: 'foundations/sample-topic' } },
  },
  {
    name: 'complete track B case study with diagram, quiz and drill',
    files: {
      'case-study-complete.md': 'case-studies/sample-topic/index.md',
      'diagram.jsonc': 'case-studies/sample-topic/diagram.json',
      'quiz.jsonc': 'quizzes/sample-topic-quiz.json',
      'drill.jsonc': 'drills/sample-topic-drill.json',
    },
    values: { track: 'B', order: '16', minutes: '5' },
    path: { phase: 'ml-systems', item: { kind: 'case-study', ref: 'sample-topic' } },
  },
  {
    name: 'case study outline with diagram',
    files: {
      'case-study-outline.md': 'case-studies/sample-topic/index.md',
      'diagram.jsonc': 'case-studies/sample-topic/diagram.json',
    },
    values: { order: '3' },
    path: { phase: 'building-blocks', item: { kind: 'case-study', ref: 'sample-topic' } },
  },
  {
    name: 'playbook with a drill',
    files: {
      'playbook.md': 'playbooks/sample-topic.md',
      'drill.jsonc': 'drills/sample-topic-drill.json',
    },
  },
  {
    name: 'worked example with its diagram',
    files: {
      'example.md': 'examples/sample-topic.md',
      'diagram.jsonc': 'diagrams/sample-topic-hld.json',
    },
  },
];

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

function install(s: Scenario): string {
  const root = copyValidFixture();
  temps.push(root);
  for (const [template, dest] of Object.entries(s.files)) {
    mkdirSync(dirname(join(root, dest)), { recursive: true });
    writeFileSync(join(root, dest), fill(template, s.values));
  }
  if (s.path) {
    const file = join(root, 'path.json');
    const path = JSON.parse(readFileSync(file, 'utf8')) as LearningPath;
    path.phases.find((p) => p.id === s.path!.phase)!.items.push(s.path.item);
    writeFileSync(file, JSON.stringify(path));
  }
  return root;
}

describe('content templates', () => {
  it.each(SCENARIOS)('$name validates with no errors or warnings', async (s) => {
    const results = await validate(install(s));
    expect(results.map((e) => `${e.severity}: ${e.file} ${e.message}`)).toEqual([]);
  });

  it('covers every template in content/_templates', () => {
    const used = new Set(SCENARIOS.flatMap((s) => Object.keys(s.files)));
    expect(readdirSync(TEMPLATES).sort()).toEqual([...used].sort());
  });

  it('leaves no placeholder unfilled', () => {
    for (const name of readdirSync(TEMPLATES)) expect(fill(name)).not.toMatch(/\{\{|\}\}/);
  });
});
