
// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',       // ⬅️ 失败后第1次重试才采集 trace
    // 下面两行可选（要更好排错就打开）
    // screenshot: 'only-on-failure',
    // video: 'retain-on-failure',
  },
  projects: [
    { name: 'Chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'WebKit - iPhone 14', use: { ...devices['iPhone 14'] } }
  ],
  webServer: {
    command: 'npx http-server . -p 3000',
    port: 3000,
    reuseExistingServer: true
  }
});
