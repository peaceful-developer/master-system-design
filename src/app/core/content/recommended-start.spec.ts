import type { LearningPath } from '@content/types';
import {
  testCaseStudy,
  testExercise,
  testLesson,
  testPlaybook,
} from '../../testing/content-test-data';
import { recommendedStart, type RecommendMeta } from './recommended-start';

const PATH: LearningPath = {
  phases: [
    {
      id: 'foundations',
      number: 0,
      title: 'Foundations',
      summary: 'Basics.',
      items: [
        { kind: 'lesson', ref: 'foundations/web' },
        { kind: 'lesson', ref: 'foundations/apis' },
      ],
    },
    {
      id: 'building-blocks',
      number: 1,
      title: 'Building blocks',
      summary: 'Blocks.',
      items: [
        { kind: 'lesson', ref: 'building-blocks/scaling' },
        { kind: 'lesson', ref: 'building-blocks/estimation' },
        { kind: 'case-study', ref: 'url-shortener' },
      ],
    },
    {
      id: 'ml-systems',
      number: 3,
      title: 'ML systems',
      summary: 'ML.',
      items: [{ kind: 'playbook', ref: 'ml-system-design-framework' }],
    },
  ],
};

const META: RecommendMeta = {
  lessons: [
    testLesson('foundations', 'web', 1, ['web-quiz']),
    testLesson('foundations', 'apis', 2, ['apis-quiz']),
    testLesson('building-blocks', 'scaling', 1, ['scaling-quiz']),
    testLesson('building-blocks', 'estimation', 2, ['qps-drill', 'estimation-quiz']),
  ],
  caseStudies: [
    testCaseStudy('url-shortener', 'A', 'complete', 1),
    testCaseStudy('chat', 'A', 'outline', 2),
    testCaseStudy('news-feed', 'A', 'complete', 3),
    testCaseStudy('recsys', 'B', 'complete', 1),
    testCaseStudy('rag-assistant', 'C', 'complete', 1),
    testCaseStudy('fraud', 'B', 'outline', 2),
  ],
  playbooks: [
    testPlaybook('ml-system-design-framework', 2),
    testPlaybook('interview-framework', 1),
  ],
  examples: [],
  exercises: [
    testExercise('web-quiz', 'quiz'),
    testExercise('apis-quiz', 'quiz'),
    testExercise('scaling-quiz', 'quiz'),
    testExercise('qps-drill', 'drill'),
    testExercise('estimation-quiz', 'quiz'),
  ],
};

describe('recommendedStart', () => {
  it('starts newcomers at the first foundations lesson', () => {
    const result = recommendedStart('new', PATH, META)!;
    expect(result.start.key).toBe('lesson:foundations/web');
    expect(result.start.url).toBe('/learn/foundations/web');
    expect(result.fastTrack).toEqual([]);
  });

  it('starts learners with some experience at Phase 1, fast-tracking its quizzes and Track A case studies', () => {
    const result = recommendedStart('some', PATH, META)!;
    expect(result.start.key).toBe('lesson:building-blocks/scaling');
    expect(result.fastTrack).toEqual([
      'exercise:scaling-quiz',
      'exercise:estimation-quiz',
      'case-study:url-shortener',
      'case-study:news-feed',
    ]);
  });

  it('starts experts at the ML design framework, fast-tracking Track B/C case studies and playbooks', () => {
    const result = recommendedStart('expert', PATH, META)!;
    expect(result.start.key).toBe('playbook:ml-system-design-framework');
    expect(result.start.url).toBe('/playbooks/ml-system-design-framework');
    expect(result.fastTrack).toEqual([
      'case-study:recsys',
      'case-study:rag-assistant',
      'playbook:interview-framework',
      'playbook:ml-system-design-framework',
    ]);
  });

  it('falls back to the first building-blocks lesson for experts until the ML framework exists', () => {
    const path: LearningPath = { phases: PATH.phases.slice(0, 2) };
    const result = recommendedStart('expert', path, { ...META, playbooks: [] })!;
    expect(result.start.key).toBe('lesson:building-blocks/scaling');
  });

  it('returns undefined for an empty path', () => {
    expect(recommendedStart('new', { phases: [] }, META)).toBeUndefined();
  });
});
