import { test, expect } from '@playwright/test';

// Post-cleanup launch probe: content is intentionally unchanged.
const GD_ROUTE_ID = '1212f1bf-5b81-4d41-aad4-76323f228110';

test('GD-01 public active car exposes the configured fare and seat projection', async ({ page }) => {
  await page.goto(`/active-car-screen?route_id=${GD_ROUTE_ID}`);

  await expect(page.getByText('₹150 per seat', { exact: true })).toBeVisible();
  await expect(page.getByText('Pay the driver directly after you meet.', { exact: true })).toBeVisible();

  const noActiveCar = page.getByText('No Active Car Right Now', { exact: true });
  const activeCarHeading = page.getByRole('heading', { name: 'Active Car', exact: true });

  await expect(noActiveCar.or(activeCarHeading)).toBeVisible();

  if (await activeCarHeading.isVisible()) {
    await expect(page.getByText('Capacity', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirmed', { exact: true })).toBeVisible();
    await expect(page.getByText('Held', { exact: true })).toBeVisible();
    await expect(page.getByText('Available', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Request a Seat/ })).toBeVisible();
  }
});
