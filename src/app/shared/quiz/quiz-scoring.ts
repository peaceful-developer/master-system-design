import type { CompiledQuiz } from '@content/types';

export interface QuestionResult {
  correct: boolean;
  selected: string[];
  expected: string[];
}

export interface QuizResult {
  score: number;
  total: number;
  perQuestion: Record<string, QuestionResult>;
}

/** A question is right only when the selected set equals the correct set exactly. */
export function scoreQuiz(
  quiz: CompiledQuiz,
  answers: Readonly<Record<string, readonly string[]>>,
): QuizResult {
  const perQuestion: Record<string, QuestionResult> = {};
  let score = 0;
  for (const question of quiz.questions) {
    const selected = [...new Set(answers[question.id] ?? [])].sort();
    const expected = [...question.correct].sort();
    const correct =
      selected.length === expected.length && selected.every((id, i) => id === expected[i]);
    if (correct) score++;
    perQuestion[question.id] = { correct, selected, expected };
  }
  return { score, total: quiz.questions.length, perQuestion };
}
