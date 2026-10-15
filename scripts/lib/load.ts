/**
 * Reads the content directory into typed, compiled items. Every file problem
 * (bad JSON, schema errors, markdown errors) is collected; nothing throws.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import type { z } from 'zod';
import type { CompiledDoc } from '../content-types';
import {
  CaseStudyFrontmatterSchema,
  ComponentCatalogSchema,
  DiagramSchema,
  DrillSchema,
  ExampleFrontmatterSchema,
  formatIssues,
  GlossarySchema,
  LearningPathSchema,
  LessonFrontmatterSchema,
  PlaybookFrontmatterSchema,
  QuizSchema,
  type CaseStudyFrontmatter,
  type ComponentCatalog,
  type Diagram,
  type Drill,
  type ExampleFrontmatter,
  type Glossary,
  type LearningPath,
  type LessonFrontmatter,
  type PlaybookFrontmatter,
  type Quiz,
} from '../schemas';
import { emptyRefs, type ContentRefs } from './directives';
import { contentError, contentWarning, type ContentError } from './errors';
import type { FigureAsset, MarkdownCompiler, Section } from './markdown';
import { sanitizeFigure, sanitizeIcon, type IconElement } from './svg-assets';

export interface DocItem<T> {
  file: string;
  data: T;
  doc: CompiledDoc;
  sections: Section[];
  text: string;
  refs: ContentRefs;
}

export interface JsonItem<T> {
  file: string;
  data: T;
}

export interface DrillItem extends JsonItem<Drill> {
  scenarioHtml: string;
  solutionHtml: string;
  refs: ContentRefs;
}

export interface DiagramItem extends JsonItem<Diagram> {
  /** Case-study slug (folder) when the diagram lives next to a case study. */
  owner?: string;
}

export interface FigureItem extends FigureAsset {
  file: string;
  animated: boolean;
}

export interface LoadedContent {
  lessons: DocItem<LessonFrontmatter>[];
  playbooks: DocItem<PlaybookFrontmatter>[];
  examples: DocItem<ExampleFrontmatter>[];
  caseStudies: DocItem<CaseStudyFrontmatter>[];
  quizzes: JsonItem<Quiz>[];
  drills: DrillItem[];
  diagrams: DiagramItem[];
  figures: Map<string, FigureItem>;
  icons: Map<string, { file: string; body: string; elements: IconElement[] }>;
  glossary?: JsonItem<Glossary>;
  components?: JsonItem<ComponentCatalog>;
  path?: JsonItem<LearningPath>;
  /**
   * Ids of items that exist on disk but failed validation. Reference rules
   * treat them as existing so one broken file reports one error, not a cascade.
   */
  unparsed: Record<UnparsedKind, Set<string>>;
}

export type UnparsedKind =
  'lesson' | 'playbook' | 'example' | 'case-study' | 'quiz' | 'drill' | 'diagram';

/** Repo-relative path with forward slashes, as shown in errors and "Edit on GitHub". */
export const displayPath = (abs: string): string =>
  relative(process.cwd(), abs).split(sep).join('/');

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      if (name.startsWith('_') || name.startsWith('.')) return [];
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return listFiles(path, ext);
      return name.endsWith(ext) ? [path] : [];
    });
}

export async function loadContent(
  root: string,
  compiler: MarkdownCompiler,
): Promise<{ content: LoadedContent; errors: ContentError[] }> {
  const errors: ContentError[] = [];
  const content: LoadedContent = {
    lessons: [],
    playbooks: [],
    examples: [],
    caseStudies: [],
    quizzes: [],
    drills: [],
    diagrams: [],
    figures: new Map(),
    icons: new Map(),
    unparsed: {
      lesson: new Set(),
      playbook: new Set(),
      example: new Set(),
      'case-study': new Set(),
      quiz: new Set(),
      drill: new Set(),
      diagram: new Set(),
    },
  };

  function parseWith<T>(
    file: string,
    value: unknown,
    schema: z.ZodType<T>,
    prefix = '',
  ): T | undefined {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    for (const line of formatIssues(result.error))
      errors.push(contentError(file, `${prefix}${line}`));
    return undefined;
  }

  function readJson<T>(
    abs: string,
    schema: z.ZodType<T>,
    kind?: UnparsedKind,
  ): JsonItem<T> | undefined {
    const file = displayPath(abs);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(abs, 'utf8'));
    } catch (err) {
      errors.push(contentError(file, `invalid JSON: ${(err as Error).message}`));
      if (kind) content.unparsed[kind].add(basename(abs, '.json'));
      return undefined;
    }
    const data = parseWith(file, raw, schema);
    if (data === undefined && kind) {
      const id = (raw as { id?: unknown } | null)?.id;
      content.unparsed[kind].add(typeof id === 'string' ? id : basename(abs, '.json'));
    }
    return data === undefined ? undefined : { file, data };
  }

  function requiredJson<T>(name: string, schema: z.ZodType<T>): JsonItem<T> | undefined {
    const abs = join(root, name);
    if (!existsSync(abs)) {
      errors.push(contentError(displayPath(abs), `missing required file ${name}`));
      return undefined;
    }
    return readJson(abs, schema);
  }

  // SVG assets first: the markdown compiler inlines figures.
  for (const abs of listFiles(join(root, 'icons'), '.svg')) {
    const name = basename(abs, '.svg');
    const { body, elements, errors: iconErrors } = sanitizeIcon(name, readFileSync(abs, 'utf8'));
    iconErrors.forEach((m) => errors.push(contentError(displayPath(abs), m)));
    if (iconErrors.length === 0)
      content.icons.set(name, { file: displayPath(abs), body, elements });
  }
  for (const abs of listFiles(join(root, 'figures'), '.svg')) {
    const id = basename(abs, '.svg');
    const fig = sanitizeFigure(id, readFileSync(abs, 'utf8'));
    fig.errors.forEach((m) => errors.push(contentError(displayPath(abs), m)));
    fig.warnings.forEach((m) => errors.push(contentWarning(displayPath(abs), m)));
    if (fig.errors.length === 0) {
      content.figures.set(id, {
        file: displayPath(abs),
        svg: fig.svg,
        title: fig.title,
        animated: fig.animated,
      });
    }
  }

  /** The id an item would have, derived from its path (used when its frontmatter is invalid). */
  const keyFromPath = (abs: string, kind: UnparsedKind): string =>
    kind === 'lesson'
      ? `${basename(dirname(abs))}/${basename(abs, '.md')}`
      : kind === 'case-study'
        ? basename(dirname(abs))
        : basename(abs, '.md');

  async function readDoc<T>(
    abs: string,
    schema: z.ZodType<T>,
    kind: UnparsedKind,
  ): Promise<DocItem<T> | undefined> {
    const file = displayPath(abs);
    const result = await compiler.compile(readFileSync(abs, 'utf8'), {
      file,
      figures: content.figures,
    });
    errors.push(...result.errors);
    if (result.frontmatter === undefined) {
      errors.push(
        contentError(file, 'missing YAML frontmatter (--- … ---) at the top of the file'),
      );
      content.unparsed[kind].add(keyFromPath(abs, kind));
      return undefined;
    }
    const data = parseWith(file, result.frontmatter, schema, 'frontmatter.');
    if (data === undefined) {
      content.unparsed[kind].add(keyFromPath(abs, kind));
      return undefined;
    }
    return {
      file,
      data,
      doc: result.doc,
      sections: result.sections,
      text: result.text,
      refs: result.refs,
    };
  }

  const collect = async <T>(
    files: string[],
    schema: z.ZodType<T>,
    kind: UnparsedKind,
    into: DocItem<T>[],
  ) => {
    for (const abs of files) {
      const item = await readDoc(abs, schema, kind);
      if (item) into.push(item);
    }
  };

  await collect(
    listFiles(join(root, 'lessons'), '.md'),
    LessonFrontmatterSchema,
    'lesson',
    content.lessons,
  );
  await collect(
    listFiles(join(root, 'playbooks'), '.md'),
    PlaybookFrontmatterSchema,
    'playbook',
    content.playbooks,
  );
  await collect(
    listFiles(join(root, 'examples'), '.md'),
    ExampleFrontmatterSchema,
    'example',
    content.examples,
  );
  await collect(
    listFiles(join(root, 'case-studies'), '.md').filter((f) => basename(f) === 'index.md'),
    CaseStudyFrontmatterSchema,
    'case-study',
    content.caseStudies,
  );

  for (const abs of listFiles(join(root, 'case-studies'), '.json').filter(
    (f) => basename(f) === 'diagram.json',
  )) {
    const item = readJson(abs, DiagramSchema, 'diagram');
    if (item) content.diagrams.push({ ...item, owner: basename(dirname(abs)) });
  }
  for (const abs of listFiles(join(root, 'diagrams'), '.json')) {
    const item = readJson(abs, DiagramSchema, 'diagram');
    if (item) content.diagrams.push(item);
  }
  for (const abs of listFiles(join(root, 'quizzes'), '.json')) {
    const item = readJson(abs, QuizSchema, 'quiz');
    if (item) content.quizzes.push(item);
  }
  for (const abs of listFiles(join(root, 'drills'), '.json')) {
    const item = readJson(abs, DrillSchema, 'drill');
    if (!item) continue;
    const refs = emptyRefs();
    const toHtml = async (markdown: string, field: string) => {
      const result = await compiler.compile(markdown, {
        file: item.file,
        figures: content.figures,
      });
      result.errors.forEach((e) => errors.push({ ...e, message: `${field}: ${e.message}` }));
      for (const key of Object.keys(refs) as (keyof ContentRefs)[])
        refs[key].push(...result.refs[key]);
      if (result.doc.blocks.some((b) => b.kind !== 'html')) {
        errors.push(
          contentError(
            item.file,
            `${field}: ::diagram, ::quiz and ::drill are not allowed in drills`,
          ),
        );
      }
      return result.doc.blocks.map((b) => (b.kind === 'html' ? b.html : '')).join('\n');
    };
    content.drills.push({
      ...item,
      scenarioHtml: await toHtml(item.data.scenario, 'scenario'),
      solutionHtml: await toHtml(item.data.solution, 'solution'),
      refs,
    });
  }

  content.glossary = requiredJson('glossary.json', GlossarySchema);
  content.components = requiredJson('components.json', ComponentCatalogSchema);
  content.path = requiredJson('path.json', LearningPathSchema);

  return { content, errors };
}
