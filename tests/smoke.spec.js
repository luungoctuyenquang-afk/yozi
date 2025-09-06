// tests/smoke.spec.js
const { test, expect } = require('@playwright/test');

// ① 基础可用 & manifest 存在
test('PWA basics', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const swPossible = await page.evaluate(() => 'serviceWorker' in navigator);
  expect(swPossible).toBeTruthy();
});

// ② Service Worker 注册 & 离线可用（需要你的 SW 正确缓存）
test('SW registers & works offline', async ({ page, context }) => {
  await page.goto('/');
  // 等待 SW 激活
  await page.waitForFunction(() => navigator.serviceWorker?.ready);

  // 断网 → 刷新 → 页面仍应可见（说明离线缓存生效）
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('body')).toBeVisible();
  await context.setOffline(false);
});

// ③ 校验 manifest 关键字段
test('manifest basic fields', async ({ page, request }) => {
  await page.goto('/');
  const res = await request.get('/manifest.json');
  const m = await res.json();
  expect(m.name || m.short_name).toBeTruthy();
  expect(m.display).toBe('standalone');
  expect(Array.isArray(m.icons) && m.icons.length > 0).toBeTruthy();
});
