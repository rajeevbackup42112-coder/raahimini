import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e-staging',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.RAAHI_STAGING_URL || 'https://raahimini-x1xy611.public.builtwithrocket.new',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
