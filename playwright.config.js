const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  use: { baseURL: 'http://localhost:3000' },
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
