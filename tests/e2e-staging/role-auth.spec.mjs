import { test, expect } from '@playwright/test';

const password = process.env.RAAHI_TEST_PASSWORD;

async function loginAs(page, loginId) {
  if (!password) throw new Error('RAAHI_TEST_PASSWORD is not configured');
  await page.goto('/test-login');
  await page.getByLabel('Login ID').fill(loginId);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('anonymous passenger discovery loads without login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Where are you?' })).toBeVisible();
  await expect(page.getByText('Dhanbad', { exact: true })).toBeVisible();
  await expect(page.getByText('Gomoh', { exact: true })).toBeVisible();
});

for (const loginId of ['rajeev1', 'rajeev2', 'rajeev3', 'naresh']) {
  test(`${loginId} lands as passenger`, async ({ page }) => {
    await loginAs(page, loginId);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Passenger', { exact: true })).toBeVisible();
  });
}

for (const loginId of ['dipti-driver', 'rajeev4-driver']) {
  test(`${loginId} lands in driver flow`, async ({ page }) => {
    await loginAs(page, loginId);
    await expect(page).toHaveURL(/\/driver-route-selection(?:\?.*)?$/);
  });
}

test('ajit-admin lands in admin panel', async ({ page }) => {
  await loginAs(page, 'ajit-admin');
  await expect(page).toHaveURL(/\/admin-panel(?:\?.*)?$/);
});
