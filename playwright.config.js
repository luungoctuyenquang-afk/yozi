
// playwright.config.js
// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'WebKit - iPhone 14', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npx http-server . -p 5173',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000
  }
});
