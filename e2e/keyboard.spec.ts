import { expect, test, type Locator, type Page } from '@playwright/test';
import { drillFile, quizFile } from './helpers/content';

/** Presses Tab until `target` has focus, like a keyboard user would. */
async function tabTo(page: Page, target: Locator, limit = 200): Promise<void> {
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Tab never reached the target');
}

test('a quiz can be completed with the keyboard only', async ({ page }) => {
  const quiz = quizFile('how-the-web-works-quiz');
  await page.goto(`exercises/${quiz.id}`);
  const questions = page.locator('.quiz-question');
  for (const [i, q] of quiz.questions.entries()) {
    const inputs = questions.nth(i).locator('input');
    if (q.kind === 'single') {
      // Tab enters the radio group on its first option; arrow keys move and select.
      await tabTo(page, inputs.first());
      const steps = q.options.findIndex((o) => o.id === q.correct[0]);
      if (steps === 0) await page.keyboard.press('Space');
      for (let s = 0; s < steps; s++) await page.keyboard.press('ArrowDown');
    } else {
      for (const id of q.correct) {
        await tabTo(page, questions.nth(i).locator(`input[value="${id}"]`));
        await page.keyboard.press('Space');
      }
    }
  }
  await tabTo(page, page.getByRole('button', { name: 'Check answers' }));
  await page.keyboard.press('Enter');
  const n = quiz.questions.length;
  await expect(page.getByText(`${n} of ${n} correct`)).toBeVisible();
});

test('a drill can be completed with the keyboard only', async ({ page }) => {
  const drill = drillFile('qps-estimation-1');
  await page.goto(`exercises/${drill.id}`);
  const inputs = page.locator('.drill-input');
  for (const [i, q] of drill.questions.entries()) {
    await tabTo(page, inputs.nth(i));
    await page.keyboard.type(String(q.answer));
  }
  await tabTo(page, page.getByRole('button', { name: 'Check my estimates' }));
  await page.keyboard.press('Enter');
  const n = drill.questions.length;
  await expect(page.getByText(`${n} of ${n} within range`)).toBeVisible();
});
