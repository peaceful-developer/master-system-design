import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';

const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

/** Every prerendered path, from the content build (`npm run build` writes it first). */
export const ROUTES = json<{ all: string[] }>('src/generated/routes.json');

/** A site path as a URL relative to the base href, so tests work under any base path. */
export const rel = (path: string): string => path.replace(/^\//, '') || './';

export interface QuizFile {
  id: string;
  questions: {
    id: string;
    kind: 'single' | 'multi';
    options: { id: string }[];
    correct: string[];
  }[];
}

export interface DrillFile {
  id: string;
  questions: { id: string; answer: number }[];
}

export const quizFile = (id: string) => json<QuizFile>(`content/quizzes/${id}.json`);
export const drillFile = (id: string) => json<DrillFile>(`content/drills/${id}.json`);

/** Checks the correct option(s) of every question, using the same file the site was built from. */
export async function answerQuiz(scope: Page | Locator, quiz: QuizFile): Promise<void> {
  const questions = scope.locator('.quiz-question');
  for (const [i, q] of quiz.questions.entries()) {
    for (const id of q.correct) await questions.nth(i).locator(`input[value="${id}"]`).check();
  }
}

/** Seeds localStorage before any page script runs. */
export async function seedStorage(page: Page, entries: Record<string, string>): Promise<void> {
  await page.addInitScript((e) => {
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v);
  }, entries);
}
