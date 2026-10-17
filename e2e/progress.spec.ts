import { expect, test, type Page } from '@playwright/test';
import { trackConsoleErrors } from './helpers/console';
import { answerQuiz, quizFile, seedStorage } from './helpers/content';

const LESSON = 'learn/foundations/how-the-web-works';
const QUIZ = 'how-the-web-works-quiz';

const completeToggle = (page: Page) =>
  page.getByRole('button', { name: /^(Mark as complete|Completed)$/ });

test('a completed lesson stays complete after a reload', async ({ page }) => {
  const console = trackConsoleErrors(page);
  await page.goto(LESSON);
  await completeToggle(page).click();
  await expect(completeToggle(page)).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(completeToggle(page)).toHaveText('Completed');
  console.assert();
});

test('a perfect quiz score shows on the progress page after a reload', async ({ page }) => {
  const quiz = quizFile(QUIZ);
  await page.goto(`exercises/${QUIZ}`);
  await answerQuiz(page, quiz);
  await page.getByRole('button', { name: 'Check answers' }).click();
  await expect(
    page.getByText(`${quiz.questions.length} of ${quiz.questions.length} correct`),
  ).toBeVisible();
  await page.goto('progress');
  await page.reload();
  const scores = page.getByRole('table').filter({ hasText: 'Best score' });
  await expect(scores).toContainText(`${quiz.questions.length} / ${quiz.questions.length}`);
});

test('export, reset and import restore progress', async ({ page }, testInfo) => {
  await page.goto(LESSON);
  await completeToggle(page).click();
  await expect(completeToggle(page)).toHaveText('Completed');

  await page.goto('progress');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  const file = testInfo.outputPath('progress.json');
  await (await download).saveAs(file);

  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset progress' }).click();
  await page.goto(LESSON);
  await expect(completeToggle(page)).toHaveText('Mark as complete');

  await page.goto('progress');
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace progress' }).click();
  await expect(page.getByText('Progress imported.')).toBeVisible();
  await page.goto(LESSON);
  await expect(completeToggle(page)).toHaveText('Completed');
});

test('corrupted saved progress loads cleanly', async ({ page }) => {
  const console = trackConsoleErrors(page);
  await seedStorage(page, { 'sdl.progress': '{"version":1,"completed":{"lesson:x"' });
  await page.goto('progress');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your progress');
  await page.goto(LESSON);
  await completeToggle(page).click();
  await expect(completeToggle(page)).toHaveText('Completed');
  console.assert();
});

test('the app still works when localStorage throws', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage is disabled', 'SecurityError');
      },
    });
  });
  await page.goto(LESSON);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await completeToggle(page).click();
  await expect(completeToggle(page)).toHaveText('Completed');
  await page.goto('progress');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your progress');
  expect(errors).toEqual([]);
});
