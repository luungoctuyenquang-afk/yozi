const { test, expect } = require('@playwright/test');

test('PWA basics', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const swPossible = await page.evaluate(() => 'serviceWorker' in navigator);
  expect(swPossible).toBeTruthy();
});
