import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['worldbook/tests/**/*.ts'],
    exclude: ['**/node_modules/**','**/playwright-report/**','tests/**','e2e/**'],
  },
})