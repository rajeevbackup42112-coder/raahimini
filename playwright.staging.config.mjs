import { defineConfig } from '@playwright/test';

const baseURL = process.env.RAAHI_STAGING_URL;
if (!baseURL) {
  throw new Error('RAAHI_STAGING_URL must be explicitly configured for staging E2E. Refusing to use a fallback target.');
}

const parsed = new URL(baseURL);
if (parsed.protocol !== 'https:') {
  throw new Error('RAAHI_STAGING_URL must use HTTPS.');
}

export default defineConfig({
  testDir: './tests/e2e-staging',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
