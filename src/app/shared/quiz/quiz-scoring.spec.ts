import { TEST_QUIZ } from '../../testing/content-test-data';
import { scoreQuiz } from './quiz-scoring';

describe('scoreQuiz', () => {
  it('scores a single-choice question', () => {
    expect(scoreQuiz(TEST_QUIZ, { q1: ['a'] }).perQuestion['q1']!.correct).toBe(true);
    expect(scoreQuiz(TEST_QUIZ, { q1: ['b'] }).perQuestion['q1']!.correct).toBe(false);
  });

  it('requires the exact set for multi-select', () => {
    const correct = (selected: string[]) =>
      scoreQuiz(TEST_QUIZ, { q2: selected }).perQuestion['q2']!.correct;
    expect(correct(['p999', 'p99'])).toBe(true);
    expect(correct(['p99'])).toBe(false);
    expect(correct(['p50', 'p99', 'p999'])).toBe(false);
  });

  it('counts unanswered questions as incorrect', () => {
    const result = scoreQuiz(TEST_QUIZ, { q1: ['a'] });
    expect(result).toMatchObject({ score: 1, total: 2 });
    expect(result.perQuestion['q2']).toEqual({
      correct: false,
      selected: [],
      expected: ['p99', 'p999'],
    });
  });

  it('totals the score', () => {
    expect(scoreQuiz(TEST_QUIZ, { q1: ['a'], q2: ['p99', 'p999'] })).toMatchObject({
      score: 2,
      total: 2,
    });
  });
});
