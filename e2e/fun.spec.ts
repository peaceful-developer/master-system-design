import { expect, test, type Page } from '@playwright/test';
import { answerQuiz, quizFile } from './helpers/content';

const LESSON = 'learn/foundations/how-the-web-works';
const QUIZ = 'how-the-web-works-quiz';

async function perfectQuiz(page: Page): Promise<void> {
  await page.goto(`exercises/${QUIZ}`);
  await answerQuiz(page, quizFile(QUIZ));
  await page.getByRole('button', { name: 'Check answers' }).click();
}

const toasts = (page: Page) => page.locator('.toast-region');

test('completing a lesson shows 20 XP and a 1-day streak in the nav after a reload', async ({
  page,
}) => {
  await page.goto(LESSON);
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await page.reload();
  await expect(page.getByRole('link', { name: /\b20 XP, 1-day streak/ })).toBeVisible();
});

test('a perfect quiz cheers and unlocks achievements once', async ({ page }) => {
  await page.goto(LESSON);
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await expect(toasts(page)).toContainText('Achievement unlocked: First flight');

  await perfectQuiz(page);
  await expect(page.locator('.quiz app-mascot[data-pose="cheer"]')).toBeVisible();
  await expect(page.locator('.quiz .feather-burst')).toBeAttached();
  await expect(toasts(page)).toContainText('Achievement unlocked: Sharp eye');

  await page.reload();
  await expect(toasts(page)).toBeAttached();
  await page.waitForLoadState('networkidle');
  await expect(toasts(page)).not.toContainText('Achievement unlocked');
});

test('Calm mode hides the mascot, celebrations and toasts', async ({ page }) => {
  await page.goto(`exercises/${QUIZ}`);
  await page.getByRole('switch', { name: 'Calm mode' }).first().click();
  await perfectQuiz(page);
  await expect(page.getByText(/correct$/).first()).toBeVisible();
  await expect(page.locator('app-mascot[data-pose]')).toHaveCount(0);
  await expect(page.locator('.feather-burst')).toHaveCount(0);
  await expect(toasts(page)).not.toContainText('Achievement unlocked');
});

test('reduced motion skips the feather burst but keeps the feedback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await perfectQuiz(page);
  await expect(page.locator('.quiz app-mascot[data-pose="cheer"]')).toBeVisible();
  await expect(page.locator('.feather-burst')).toHaveCount(0);
});
