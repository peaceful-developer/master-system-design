import { TEST_LESSONS, TEST_PATH } from '../../testing/content-test-data';
import { flattenPath, pathNeighbors } from './path-nav';

const entries = flattenPath(
  {
    ...TEST_PATH,
    phases: [
      TEST_PATH.phases[0]!,
      {
        ...TEST_PATH.phases[1]!,
        items: [{ kind: 'case-study', ref: 'url-shortener' }],
      },
    ],
  },
  {
    lessons: TEST_LESSONS,
    caseStudies: [
      {
        slug: 'url-shortener',
        title: 'URL shortener',
        track: 'A',
        order: 1,
        difficulty: 'beginner',
        summary: 'Short links at scale.',
        concepts: [],
        prerequisites: [],
        estimatedMinutes: 30,
        status: 'complete',
        exercises: [],
        diagram: 'url-shortener-hld',
        file: 'content/case-studies/url-shortener/index.md',
        url: '/case-studies/url-shortener',
      },
    ],
    playbooks: [],
    examples: [],
  },
);

describe('flattenPath', () => {
  it('lists every placed item in path order with its key, title and url', () => {
    expect(entries.map((e) => [e.key, e.title, e.url, e.phase])).toEqual([
      [
        'lesson:foundations/how-the-web-works',
        'How the web works',
        '/learn/foundations/how-the-web-works',
        'foundations',
      ],
      [
        'lesson:foundations/latency-numbers',
        'Latency numbers',
        '/learn/foundations/latency-numbers',
        'foundations',
      ],
      [
        'case-study:url-shortener',
        'URL shortener',
        '/case-studies/url-shortener',
        'building-blocks',
      ],
    ]);
  });
});

describe('pathNeighbors', () => {
  it('has only a next item at the start', () => {
    const { prev, next } = pathNeighbors(entries, 'lesson:foundations/how-the-web-works');
    expect(prev).toBeUndefined();
    expect(next?.title).toBe('Latency numbers');
  });

  it('has both neighbours in the middle, across phases', () => {
    const { prev, next } = pathNeighbors(entries, 'lesson:foundations/latency-numbers');
    expect(prev?.title).toBe('How the web works');
    expect(next?.title).toBe('URL shortener');
  });

  it('has only a previous item at the end', () => {
    const { prev, next } = pathNeighbors(entries, 'case-study:url-shortener');
    expect(prev?.title).toBe('Latency numbers');
    expect(next).toBeUndefined();
  });

  it('has no neighbours for an item that is not on the path', () => {
    expect(pathNeighbors(entries, 'playbook:nope')).toEqual({});
  });
});
