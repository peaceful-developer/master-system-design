/**
 * Zod schemas for every content type. The build fails when any file does not
 * match. Types are inferred from the schemas and re-exported through
 * `scripts/content-types.ts` (type-only, so the app never bundles zod).
 */
import { z } from 'zod';
import { ILLUSTRATIVE_NOTE } from './content-types';

export { ILLUSTRATIVE_NOTE };

export const PHASE_IDS = [
  'foundations',
  'building-blocks',
  'data-systems',
  'ml-systems',
  'llm-systems',
  'frontier-infrastructure',
] as const;
export const TRACKS = ['A', 'B', 'C'] as const;
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export const CASE_STUDY_STATUSES = ['complete', 'outline'] as const;
export const COMPONENT_CATEGORIES = [
  'clients-edge',
  'compute',
  'data',
  'messaging',
  'ml',
  'llm',
] as const;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type PhaseId = (typeof PHASE_IDS)[number];
export type Track = (typeof TRACKS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type CaseStudyStatus = (typeof CASE_STUDY_STATUSES)[number];
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

const slug = z.string().regex(SLUG_RE, { error: 'must be lowercase kebab-case, e.g. "my-slug"' });
const slugList = z.array(slug);
const text = (min = 1) => z.string().trim().min(min);
const phase = z.enum(PHASE_IDS);
const difficulty = z.enum(DIFFICULTIES);

/** One line per issue: `path.to.field: message`. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

function duplicates(values: readonly string[]): number[] {
  const seen = new Set<string>();
  return values.flatMap((value, index) => {
    if (seen.has(value)) return [index];
    seen.add(value);
    return [];
  });
}

// ---------------------------------------------------------------- frontmatter

export const LessonFrontmatterSchema = z.strictObject({
  slug,
  title: text(3),
  phase,
  order: z.number().int().min(1),
  summary: text(10).max(200),
  estimatedMinutes: z.number().int().min(3).max(30),
  concepts: slugList,
  exercises: slugList.min(1, { error: 'every lesson ends with at least one exercise' }),
});

export const PlaybookFrontmatterSchema = z.strictObject({
  slug,
  title: text(3),
  order: z.number().int().min(1),
  summary: text(10).max(200),
  estimatedMinutes: z.number().int().min(3).max(60),
  concepts: slugList,
  exercises: slugList.min(1, { error: 'every playbook has at least one exercise' }),
});

export const ExampleFrontmatterSchema = z.strictObject({
  slug,
  title: text(3),
  summary: text(10).max(200),
  concepts: slugList,
  tags: z.array(text()),
  diagram: slug.optional(),
});

export const CaseStudyFrontmatterSchema = z.strictObject({
  slug,
  title: text(3),
  track: z.enum(TRACKS),
  order: z.number().int().min(1).max(50),
  difficulty,
  summary: text(10).max(200),
  concepts: slugList,
  prerequisites: slugList,
  estimatedMinutes: z.number().int().min(3).max(120),
  status: z.enum(CASE_STUDY_STATUSES),
  exercises: slugList,
  diagram: slug,
});

// ------------------------------------------------------------------- diagrams

const nodeId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, { error: 'node ids are lowercase letters, digits and dashes' });

export const DiagramSchema = z
  .strictObject({
    id: slug,
    title: text().optional(),
    description: text().optional(),
    nodes: z.array(
      z.strictObject({
        id: nodeId,
        type: slug,
        label: text().max(40),
        position: z.strictObject({ x: z.number(), y: z.number() }),
        config: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
      }),
    ),
    edges: z.array(
      z.strictObject({
        id: nodeId,
        from: nodeId,
        to: nodeId,
        label: text().max(40).optional(),
        config: z.strictObject({ ratio: z.number().positive().max(1000).optional() }).optional(),
      }),
    ),
  })
  .superRefine((diagram, ctx) => {
    const ids = diagram.nodes.map((n) => n.id);
    for (const i of duplicates(ids)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes', i, 'id'],
        message: `duplicate node id "${ids[i]}"`,
      });
    }
    const edgeIds = diagram.edges.map((e) => e.id);
    for (const i of duplicates(edgeIds)) {
      ctx.addIssue({
        code: 'custom',
        path: ['edges', i, 'id'],
        message: `duplicate edge id "${edgeIds[i]}"`,
      });
    }
    const known = new Set(ids);
    diagram.edges.forEach((edge, i) => {
      for (const end of ['from', 'to'] as const) {
        if (!known.has(edge[end])) {
          ctx.addIssue({
            code: 'custom',
            path: ['edges', i, end],
            message: `unknown node "${edge[end]}"`,
          });
        }
      }
      if (edge.from === edge.to) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', i],
          message: 'edge connects a node to itself',
        });
      }
    });
  });

// ------------------------------------------------------------ component catalog

/** Diagram nodes show the component type under the node title; longer names spill out of the node. */
export const NODE_SUBTITLE_MAX = 17;

export const ComponentDefSchema = z.strictObject({
  type: slug,
  label: text(),
  /** Shown under a node's title when `label` is too long to fit there. */
  shortLabel: text().max(NODE_SUBTITLE_MAX).optional(),
  category: z.enum(COMPONENT_CATEGORIES),
  icon: slug,
  description: text(10),
  sim: z
    .object({
      capacityRps: z.number().positive(),
      instances: z.number().int().min(1),
      baseLatencyMs: z.number().min(0),
      costPerHourPerInstance: z.number().min(0),
    })
    .catchall(z.number()),
});

export const ComponentCatalogSchema = z
  .strictObject({
    note: z.literal(ILLUSTRATIVE_NOTE, { error: `must be exactly "${ILLUSTRATIVE_NOTE}"` }),
    components: z.array(ComponentDefSchema).min(1),
  })
  .superRefine((catalog, ctx) => {
    const types = catalog.components.map((c) => c.type);
    for (const i of duplicates(types)) {
      ctx.addIssue({
        code: 'custom',
        path: ['components', i, 'type'],
        message: `duplicate type "${types[i]}"`,
      });
    }
    catalog.components.forEach((c, i) => {
      if (c.shortLabel === undefined && c.label.length > NODE_SUBTITLE_MAX) {
        ctx.addIssue({
          code: 'custom',
          path: ['components', i, 'label'],
          message: `too long to fit under a node title (over ${NODE_SUBTITLE_MAX} characters): add a shortLabel`,
        });
      }
    });
  });

// ------------------------------------------------------------- quizzes, drills

export const QuizSchema = z
  .strictObject({
    id: slug,
    title: text(3),
    topics: slugList,
    difficulty,
    questions: z
      .array(
        z.strictObject({
          id: slug,
          prompt: text(3),
          kind: z.enum(['single', 'multi']),
          level: difficulty,
          options: z.array(z.strictObject({ id: slug, text: text() })).min(2),
          correct: z.array(z.string()),
          explanation: text(3),
          hint: text(3).optional(),
        }),
      )
      .min(1),
  })
  .superRefine((quiz, ctx) => {
    const questionIds = quiz.questions.map((q) => q.id);
    for (const i of duplicates(questionIds)) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions', i, 'id'],
        message: `duplicate question id "${questionIds[i]}"`,
      });
    }
    quiz.questions.forEach((q, i) => {
      const path = ['questions', i];
      const optionIds = q.options.map((o) => o.id);
      for (const j of duplicates(optionIds)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'options', j, 'id'],
          message: `duplicate option id "${optionIds[j]}"`,
        });
      }
      if (q.correct.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'correct'],
          message: 'must list at least one correct option',
        });
      } else if (q.kind === 'single' && q.correct.length !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'correct'],
          message: 'single-choice questions need exactly one correct option',
        });
      }
      for (const id of q.correct.filter((c) => !optionIds.includes(c))) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'correct'],
          message: `"${id}" is not one of the options`,
        });
      }
    });
    if (quiz.questions.length >= 4 && new Set(quiz.questions.map((q) => q.level)).size < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions'],
        message: 'quizzes with 4 or more questions must mix at least 2 levels',
      });
    }
  });

export const ToleranceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('relative'), value: z.number().gt(0).max(10) }),
  z.strictObject({ kind: z.literal('absolute'), value: z.number().min(0) }),
  z.strictObject({ kind: z.literal('orderOfMagnitude') }),
]);

export const DEFAULT_TOLERANCE = { kind: 'relative', value: 0.25 } as const;

export const DrillSchema = z
  .strictObject({
    id: slug,
    title: text(3),
    topics: slugList,
    difficulty,
    scenario: text(10),
    givens: z.array(
      z.strictObject({
        label: text(),
        value: z.union([z.number(), text()]),
        unit: text().optional(),
      }),
    ),
    questions: z
      .array(
        z.strictObject({
          id: slug,
          prompt: text(3),
          unit: text(),
          answer: z.number(),
          tolerance: ToleranceSchema.default(DEFAULT_TOLERANCE),
        }),
      )
      .min(1),
    solution: text(10),
  })
  .superRefine((drill, ctx) => {
    const ids = drill.questions.map((q) => q.id);
    for (const i of duplicates(ids)) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions', i, 'id'],
        message: `duplicate question id "${ids[i]}"`,
      });
    }
  });

// ----------------------------------------------------------- glossary and path

export const GlossaryTermSchema = z.strictObject({
  id: slug,
  term: text(),
  definition: text(10).max(400),
  aliases: z.array(text()).optional(),
  related: slugList.optional(),
});

export const GlossarySchema = z.strictObject({ terms: z.array(GlossaryTermSchema) });

export const PathItemSchema = z.strictObject({
  kind: z.enum(['lesson', 'case-study', 'playbook', 'example']),
  ref: z
    .string()
    .regex(/^[a-z0-9-]+(\/[a-z0-9-]+)?$/, { error: 'ref is a slug, or phase/slug for lessons' }),
});

export const LearningPathSchema = z.strictObject({
  phases: z.array(
    z.strictObject({
      id: phase,
      number: z.number().int().min(0).max(5),
      title: text(3),
      summary: text(10),
      items: z.array(PathItemSchema),
    }),
  ),
});

// ----------------------------------------------------------------------- types

export type LessonFrontmatter = z.infer<typeof LessonFrontmatterSchema>;
export type PlaybookFrontmatter = z.infer<typeof PlaybookFrontmatterSchema>;
export type ExampleFrontmatter = z.infer<typeof ExampleFrontmatterSchema>;
export type CaseStudyFrontmatter = z.infer<typeof CaseStudyFrontmatterSchema>;
export type Diagram = z.infer<typeof DiagramSchema>;
export type DiagramNode = Diagram['nodes'][number];
export type DiagramEdge = Diagram['edges'][number];
export type ComponentDef = z.infer<typeof ComponentDefSchema>;
export type ComponentCatalog = z.infer<typeof ComponentCatalogSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type QuizQuestion = Quiz['questions'][number];
export type Tolerance = z.infer<typeof ToleranceSchema>;
export type Drill = z.infer<typeof DrillSchema>;
export type DrillQuestion = Drill['questions'][number];
export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;
export type Glossary = z.infer<typeof GlossarySchema>;
export type PathItem = z.infer<typeof PathItemSchema>;
export type LearningPath = z.infer<typeof LearningPathSchema>;
export type PathPhase = LearningPath['phases'][number];
