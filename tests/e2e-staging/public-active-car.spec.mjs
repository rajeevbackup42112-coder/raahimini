import { test, expect } from '@playwright/test';

const GD_ROUTE_ID = '1212f1bf-5b81-4d41-aad4-76323f228110';

test('GD-01 public active car exposes fare and V2 live ride projection', async ({ page }) => {
  await page.goto(`/active-car-screen?route_id=${GD_ROUTE_ID}`);

  await expect(page.getByText('₹150 per seat', { exact: true })).toBeVisible();
  await expect(page.getByText('Pay the driver directly after you meet.', { exact: true })).toBeVisible();

  const noActiveCar = page.getByText('No Active Car Right Now', { exact: true });
  const liveRaahi = page.getByText('Live Raahi', { exact: true });

  await expect(noActiveCar.or(liveRaahi)).toBeVisible();

  if (await liveRaahi.isVisible()) {
    await expect(page.getByText('Seats', { exact: true })).toBeVisible();
    await expect(page.getByText('Fare', { exact: true })).toBeVisible();
    await expect(page.getByText('Pay driver directly', { exact: true })).toBeVisible();
    await expect(page.getByText('Your Raahi driver', { exact: true })).toBeVisible();

    const collecting = page.getByText('Collecting now', { exact: true });
    const tripStarted = page.getByText('Trip started', { exact: true });
    await expect(collecting.or(tripStarted)).toBeVisible();

    if (await collecting.isVisible()) {
      const bookSeat = page.getByRole('link', { name: /Book Seat/ });
      const fullCar = page.getByText('Car is Full — Next car coming soon', { exact: true });
      await expect(bookSeat.or(fullCar)).toBeVisible();
    }
  }
});
