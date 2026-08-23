import { test, expect } from '@playwright/test';

const password = process.env.RAAHI_TEST_PASSWORD;

async function loginAs(page, loginId) {
  if (!password) throw new Error('RAAHI_TEST_PASSWORD is not configured');

  let response;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await page.context().request.post('/api/test-auth', {
        data: { loginId, password },
      });
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(750 * attempt);
    }
  }

  if (!response) throw lastError;
  if (!response.ok()) {
    throw new Error(`Test auth failed for ${loginId}: ${response.status()}`);
  }

  const result = await response.json();
  if (!result?.redirectTo || !result?.accessToken || !result?.refreshToken) {
    throw new Error(`Test auth returned an incomplete session for ${loginId}`);
  }

  await page.goto('/test-login');
  await page.evaluate(async ({ accessToken, refreshToken }) => {
    const key = Object.keys(localStorage).find((name) => name.startsWith('sb-') && name.endsWith('-auth-token'));
    if (key) localStorage.removeItem(key);
    localStorage.setItem('raahi_staging_session_handoff', JSON.stringify({ accessToken, refreshToken }));
  }, { accessToken: result.accessToken, refreshToken: result.refreshToken });

  // The server response also carries the genuine SSR session cookie. Navigate only
  // after the API call has completed so role checks see the same authenticated user.
  await page.goto(result.redirectTo);
}

test('anonymous passenger discovery loads without login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find your Raahi' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dhanbad/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Gomoh/ })).toBeVisible();
});

test('anonymous route discovery exposes both pilot directions', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Dhanbad/ }).click();
  await expect(page.getByText('Going from Dhanbad')).toBeVisible();
  await expect(page.getByRole('link', { name: /DG-01.*Dhanbad.*Gomoh/ })).toBeVisible();

  await page.getByRole('button', { name: /Gomoh/ }).click();
  await expect(page.getByText('Going from Gomoh')).toBeVisible();
  await expect(page.getByRole('link', { name: /GD-01.*Gomoh.*Dhanbad/ })).toBeVisible();
});

test('anonymous users cannot enter protected operational screens', async ({ page }) => {
  await page.goto('/driver-route-selection');
  await expect(page.getByText('Driver Sign In Required', { exact: true })).toBeVisible();

  await page.goto('/admin-panel');
  await expect(page.getByText('Admin Access Required', { exact: true })).toBeVisible();
});

for (const loginId of ['rajeev1', 'rajeev2', 'rajeev3', 'naresh']) {
  test(`${loginId} lands as passenger`, async ({ page }) => {
    await loginAs(page, loginId);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Passenger', { exact: true })).toBeVisible();
  });
}

test('passenger role is blocked from driver and admin operations', async ({ page }) => {
  await loginAs(page, 'rajeev2');

  await page.goto('/driver-route-selection');
  await expect(page.getByText('Driver Access Only', { exact: true })).toBeVisible();

  await page.goto('/admin-panel');
  await expect(page.getByText('Admin Access Required', { exact: true })).toBeVisible();
});

for (const loginId of ['dipti-driver', 'rajeev4-driver']) {
  test(`${loginId} lands in driver flow`, async ({ page }) => {
    await loginAs(page, loginId);
    await expect(page).toHaveURL(/\/driver-route-selection(?:\?.*)?$/);
  });
}

test('driver role is blocked from admin operations', async ({ page }) => {
  await loginAs(page, 'dipti-driver');
  await page.goto('/admin-panel');
  await expect(page.getByText('Admin Access Required', { exact: true })).toBeVisible();
});

test('ajit-admin lands in admin panel', async ({ page }) => {
  await loginAs(page, 'ajit-admin');
  await expect(page).toHaveURL(/\/admin-panel(?:\?.*)?$/);
  await expect(page.getByText('Raahi Admin', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin Access', { exact: true })).toBeVisible();
});
