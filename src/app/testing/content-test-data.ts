/** Small, hand-written content for unit tests (stands in for src/generated/). */
import type { Provider } from '@angular/core';
import type {
  CompiledDrill,
  CompiledLesson,
  CompiledQuiz,
  ComponentDef,
  Diagram,
  LearningPath,
  LessonMeta,
} from '@content/types';
import { CONTENT_DATA, type ContentData } from '../core/content/content.service';

const component = (
  type: string,
  label: string,
  category: ComponentDef['category'],
): ComponentDef => ({
  type,
  label,
  category,
  icon: 'client',
  description: 'A component used in tests.',
  sim: { capacityRps: 100, instances: 1, baseLatencyMs: 1, costPerHourPerInstance: 0 },
});

export const TEST_DIAGRAM: Diagram = {
  id: 'demo-hld',
  title: 'Demo design',
  nodes: [
    { id: 'c', type: 'client', label: 'Browser', position: { x: 0, y: 0 } },
    { id: 'a', type: 'app-server', label: 'API', position: { x: 300, y: 0 } },
  ],
  edges: [{ id: 'e1', from: 'c', to: 'a' }],
};

export const TEST_QUIZ: CompiledQuiz = {
  id: 'demo-quiz',
  title: 'Demo quiz',
  topics: ['latency'],
  difficulty: 'beginner',
  questions: [
    {
      id: 'q1',
      prompt: 'What does latency measure?',
      kind: 'single',
      level: 'beginner',
      options: [
        { id: 'a', text: 'Waiting time' },
        { id: 'b', text: 'Requests per second' },
      ],
      correct: ['a'],
      explanation: 'Latency is how long you wait.',
      hint: 'Think about waiting.',
    },
    {
      id: 'q2',
      prompt: 'Which are tail percentiles?',
      kind: 'multi',
      level: 'intermediate',
      options: [
        { id: 'p50', text: 'p50' },
        { id: 'p99', text: 'p99' },
        { id: 'p999', text: 'p99.9' },
      ],
      correct: ['p99', 'p999'],
      explanation: 'The tail is the slowest requests.',
    },
  ],
};

export const TEST_DRILL: CompiledDrill = {
  id: 'demo-drill',
  title: 'Demo drill',
  topics: ['throughput'],
  difficulty: 'beginner',
  scenarioHtml: '<p>10 million users make 20 requests a day.</p>',
  givens: [{ label: 'Daily active users', value: 10_000_000 }],
  questions: [
    {
      id: 'avg',
      prompt: 'Average requests per second',
      unit: 'req/s',
      answer: 2315,
      tolerance: { kind: 'relative', value: 0.25 },
    },
    {
      id: 'peak',
      prompt: 'Peak requests per second',
      unit: 'req/s',
      answer: 6944,
      tolerance: { kind: 'orderOfMagnitude' },
    },
  ],
  solutionHtml: '<ol><li>200M ÷ 86,400 ≈ 2,315</li></ol>',
};

const lessonMeta = (slug: string, order: number, title: string): LessonMeta => ({
  slug,
  title,
  phase: 'foundations',
  order,
  summary: `${title} summary for tests.`,
  estimatedMinutes: 10,
  concepts: ['latency'],
  exercises: ['demo-quiz'],
  file: `content/lessons/foundations/${slug}.md`,
  url: `/learn/foundations/${slug}`,
});

export const TEST_LESSONS: LessonMeta[] = [
  lessonMeta('how-the-web-works', 1, 'How the web works'),
  lessonMeta('latency-numbers', 2, 'Latency numbers'),
];

export const TEST_LESSON: CompiledLesson = {
  ...TEST_LESSONS[1]!,
  blocks: [
    { kind: 'html', html: '<h2 id="why">Why it matters</h2><p>Every request waits.</p>' },
    { kind: 'quiz', id: 'demo-quiz' },
  ],
  headings: [{ id: 'why', text: 'Why it matters', depth: 2 }],
};

export const TEST_PATH: LearningPath = {
  phases: [
    {
      id: 'foundations',
      number: 0,
      title: 'Foundations',
      summary: 'The basics every backend needs.',
      items: [
        { kind: 'lesson', ref: 'foundations/how-the-web-works' },
        { kind: 'lesson', ref: 'foundations/latency-numbers' },
      ],
    },
    {
      id: 'building-blocks',
      number: 1,
      title: 'Building blocks',
      summary: 'Scalable parts.',
      items: [],
    },
  ],
};

export function testContentData(overrides: Partial<ContentData> = {}): ContentData {
  return {
    path: TEST_PATH,
    lessons: TEST_LESSONS,
    caseStudies: [],
    playbooks: [],
    examples: [],
    exercises: [
      {
        id: 'demo-quiz',
        kind: 'quiz',
        title: 'Demo quiz',
        topics: ['latency'],
        difficulty: 'beginner',
        url: '/exercises/demo-quiz',
        usedBy: [],
      },
    ],
    glossary: [{ id: 'latency', term: 'Latency', definition: 'How long a request waits.' }],
    components: [
      component('client', 'Client', 'clients-edge'),
      component('app-server', 'App server', 'compute'),
    ],
    loaders: {
      lesson: { 'foundations/latency-numbers': async () => TEST_LESSON },
      caseStudy: {},
      playbook: {},
      example: {},
      quiz: { 'demo-quiz': async () => TEST_QUIZ },
      drill: { 'demo-drill': async () => TEST_DRILL },
      diagram: { 'demo-hld': async () => TEST_DIAGRAM },
    },
    ...overrides,
  };
}

export function provideTestContent(overrides: Partial<ContentData> = {}): Provider {
  return { provide: CONTENT_DATA, useValue: testContentData(overrides) };
}
