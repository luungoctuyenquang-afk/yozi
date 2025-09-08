// tests/manifest.spec.js
const { test, expect } = require('@playwright/test');

test('manifest basic fields', async ({ page, request }) => {
  await page.goto('/');

  const candidates = ['/manifest.json', '/manifest.webmanifest', '/site.webmanifest'];
  let res, url;
  for (const u of candidates) {
    const r = await request.get(u);
    if (r.ok()) { res = r; url = u; break; }
  }
  expect(res, `No manifest found at ${candidates.join(', ')}`).toBeTruthy();

  const m = await res.json();
  expect(m.name || m.short_name, `manifest name missing at ${url}`).toBeTruthy();
  // display 有些项目用 minimal-ui，这里放宽到常见几种
  expect(['standalone', 'minimal-ui', 'fullscreen']).toContain(m.display);
  expect(Array.isArray(m.icons) && m.icons.length > 0).toBeTruthy();
});
