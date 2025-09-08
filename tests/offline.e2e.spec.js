const { test, expect } = require('@playwright/test');

const SCOPE = '/__e2e_scope__/';
const SW_URL = `${SCOPE}__e2e_sw.js`;
const PING  = `${SCOPE}__e2e_ping__`;

const swCode = `
  const SCOPE='${SCOPE}';
  self.addEventListener('install', e => self.skipWaiting());
  self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (url.pathname === '${PING}') {
      e.respondWith(new Response('pong', { status: 200, headers: { 'Content-Type':'text/plain' } }));
      return;
    }
    if (!url.pathname.startsWith(SCOPE) || e.request.method !== 'GET') return;
    e.respondWith(fetch(e.request).catch(() =>
      new Response('<!doctype html><title>offline</title>', { status: 200, headers: { 'Content-Type':'text/html' } })
    ));
  });
`;

test.describe('offline', () => {
  test.beforeEach(async ({ context }) => {
    // 提供“测试 SW”脚本，并明确允许的作用域，禁缓存
    await context.route(`**${SW_URL}`, r =>
      r.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/javascript',
          'Service-Worker-Allowed': SCOPE,
          'Cache-Control': 'no-store'
        },
        body: swCode
      })
    );
    // 软屏蔽生产 sw.js（仅测试期）
    await context.route('**/sw.js', r =>
      r.fulfill({ status: 200, headers: { 'Content-Type':'application/javascript' }, body: '/* noop for e2e */' })
    );
  });

  test.afterEach(async ({ context }) => {
    await context.unroute(`**${SW_URL}`).catch(() => {});
    await context.unroute('**/sw.js').catch(() => {});
  });

  test('SW registers & works offline', async ({ page, context }) => {
    await page.goto(SCOPE);

    // 显式注册，若失败让异常冒出来（不要吞掉）
    await page.evaluate(({ SW_URL, SCOPE }) =>
      navigator.serviceWorker.register(SW_URL, { scope: SCOPE })
    , { SW_URL, SCOPE });

    // 只等待“我们的 SW”出现
    await context.waitForEvent('serviceworker', {
      timeout: 30_000,
      predicate: sw => sw.url().endsWith(SW_URL)
    });

    // 等待我们的注册处于 active 状态
    await expect.poll(() =>
      page.evaluate(async (scope) => {
        const reg = await navigator.serviceWorker.getRegistration(scope);
        return !!(reg && reg.active);
      }, SCOPE),
      { timeout: 30_000, message: 'Service worker not active' }
    ).toBe(true);

    // 必要时通过一次 reload 让页面切换到 controller
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
      await page.reload();
    }
    await expect.poll(
      () => page.evaluate(() => !!navigator.serviceWorker.controller),
      { timeout: 15_000, message: 'Service worker did not take control' }
    ).toBe(true);

    // 离线自检
    await context.setOffline(true);
    const text = await page.evaluate((u) => fetch(u).then(r => r.text()).catch(() => ''), PING);
    await context.setOffline(false);
    expect(text).toBe('pong');
  });
});
