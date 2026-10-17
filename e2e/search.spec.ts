import { expect, test } from '@playwright/test';

test('Ctrl+K search finds a lesson and opens it with Enter', async ({ page }) => {
  await page.goto('./');
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('Control+k');
  const box = page.getByRole('combobox');
  await expect(box).toBeFocused();
  await box.fill('consistent hashing');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/learn\/building-blocks\/sharding-and-consistent-hashing/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('consistent hashing', {
    ignoreCase: true,
  });
});
