import type { PathPhase } from '@content/types';
import type { ItemKey } from '../../core/progress/progress-model';
import { exercisesByItem, phaseProgress } from './phase-progress';

const phase = (items: PathPhase['items']): PathPhase => ({
  id: 'foundations',
  number: 0,
  title: 'Foundations',
  summary: 'Test phase.',
  items,
});

const PHASE = phase([
  { kind: 'lesson', ref: 'foundations/a' },
  { kind: 'lesson', ref: 'foundations/b' },
]);

const EXERCISES = new Map<ItemKey, readonly string[]>([
  ['lesson:foundations/a', ['quiz-a']],
  ['lesson:foundations/b', ['quiz-b', 'drill-b']],
]);

describe('phaseProgress', () => {
  it('counts nothing for a phase without items', () => {
    expect(phaseProgress(phase([]), new Set(), EXERCISES)).toEqual({ done: 0, total: 0 });
  });

  it('counts items and their exercises, done or not', () => {
    const completed = new Set<ItemKey>(['lesson:foundations/a', 'exercise:drill-b']);
    expect(phaseProgress(PHASE, completed, EXERCISES)).toEqual({ done: 2, total: 5 });
  });

  it('reports a fully completed phase', () => {
    const completed = new Set<ItemKey>([
      'lesson:foundations/a',
      'lesson:foundations/b',
      'exercise:quiz-a',
      'exercise:quiz-b',
      'exercise:drill-b',
    ]);
    expect(phaseProgress(PHASE, completed, EXERCISES)).toEqual({ done: 5, total: 5 });
  });

  it('counts an exercise shared by two items once', () => {
    const shared = new Map<ItemKey, readonly string[]>([
      ['lesson:foundations/a', ['quiz-a']],
      ['lesson:foundations/b', ['quiz-a']],
    ]);
    expect(phaseProgress(PHASE, new Set(['exercise:quiz-a']), shared)).toEqual({
      done: 1,
      total: 3,
    });
  });

  it('ignores completions from other phases', () => {
    const completed = new Set<ItemKey>(['lesson:building-blocks/x', 'exercise:other']);
    expect(phaseProgress(PHASE, completed, EXERCISES)).toEqual({ done: 0, total: 5 });
  });
});

describe('exercisesByItem', () => {
  it('maps lessons, case studies and playbooks to their exercise ids', () => {
    const map = exercisesByItem({
      lessons: [{ phase: 'foundations', slug: 'a', exercises: ['quiz-a'] }],
      caseStudies: [{ slug: 'url-shortener', exercises: ['url-quiz'] }],
      playbooks: [{ slug: 'framework', exercises: [] }],
    });
    expect(map.get('lesson:foundations/a')).toEqual(['quiz-a']);
    expect(map.get('case-study:url-shortener')).toEqual(['url-quiz']);
    expect(map.get('playbook:framework')).toEqual([]);
  });
});
