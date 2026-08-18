import { test, expect } from '@playwright/test';

const password = process.env.RAAHI_TEST_PASSWORD;
const GD_ROUTE_ID = '1212f1bf-5b81-4d41-aad4-76323f228110';

async function loginContext(context, loginId) {
  if (!password) throw new Error('RAAHI_TEST_PASSWORD is not configured');

  let response;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`[operational] auth ${loginId} attempt ${attempt}`);
      response = await context.request.post('/api/test-auth', {
        data: { loginId, password },
        timeout: 15_000,
      });
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }

  if (!response) throw lastError;
  if (!response.ok()) throw new Error(`Test auth failed for ${loginId}: ${response.status()}`);
  return response.json();
}

test('controlled passenger request → driver confirm → trip completion → restore collector', async ({ browser }) => {
  test.setTimeout(180_000);

  const passengerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const driverContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const passenger = await passengerContext.newPage();
  const driver = await driverContext.newPage();

  console.log('[operational] passenger login');
  await loginContext(passengerContext, 'rajeev2');
  console.log('[operational] passenger active car');
  await passenger.goto(`/active-car-screen?route_id=${GD_ROUTE_ID}`);
  await expect(passenger.getByRole('heading', { name: 'Active Car', exact: true })).toBeVisible();
  await passenger.getByRole('link', { name: /Request a Seat/ }).click();

  console.log('[operational] passenger request form');
  await expect(passenger).toHaveURL(/\/request-seat-screen/);
  const firstPickup = passenger.getByRole('radio').first();
  await firstPickup.check();
  await passenger.getByRole('button', { name: '1', exact: true }).click();
  await passenger.getByRole('button', { name: 'Request Seat', exact: true }).click();

  console.log('[operational] passenger held');
  await expect(passenger).toHaveURL(/\/request-status-screen/);
  await expect(passenger.getByText('Held', { exact: true }).first()).toBeVisible();
  await expect(passenger.getByText('1 Seat', { exact: true })).toBeVisible();

  console.log('[operational] driver login');
  await loginContext(driverContext, 'rajeev4-driver');
  await driver.goto('/driver-active-car-screen');
  console.log('[operational] driver confirm');
  await expect(driver.getByText('Passenger Requests (1)', { exact: true })).toBeVisible();
  await driver.getByRole('button', { name: 'Payment Received', exact: true }).click();
  await expect(driver.getByText('Confirmed', { exact: true }).first()).toBeVisible();

  console.log('[operational] passenger confirmed');
  await passenger.reload();
  await expect(passenger.getByText('Booking Confirmed', { exact: true })).toBeVisible();

  console.log('[operational] close empty seats');
  await driver.getByRole('button', { name: /Close \d+ Empty Seats? & Go/ }).click();
  await driver.getByRole('button', { name: 'Confirm & Close', exact: true }).click();
  await expect(driver.getByText('All seats accounted for — Ready to Start Trip', { exact: true })).toBeVisible();

  console.log('[operational] start trip');
  await driver.getByRole('button', { name: /Start Trip to Dhanbad/ }).click();
  await driver.getByRole('button', { name: 'Start Trip', exact: true }).click();
  await expect(driver.getByText('Trip Progress', { exact: true })).toBeVisible();

  for (let stop = 2; stop <= 6; stop += 1) {
    console.log(`[operational] advance stop ${stop}`);
    await driver.getByRole('button', { name: 'Arrived at Next Stop', exact: true }).click();
    await expect(driver.getByText(`Stop ${stop} of 6`, { exact: true })).toBeVisible();
  }

  console.log('[operational] complete trip');
  await driver.getByRole('button', { name: 'Complete Trip', exact: true }).first().click();
  await expect(driver.getByRole('heading', { name: 'Complete Trip?', exact: true })).toBeVisible();
  await driver.getByRole('button', { name: 'Complete Trip', exact: true }).last().click();
  await expect(driver.getByText('No Active Trip', { exact: true })).toBeVisible();

  console.log('[operational] passenger completed');
  await passenger.reload();
  await expect(passenger.getByText('Trip Completed', { exact: true })).toBeVisible();

  console.log('[operational] restore GD collector');
  await driver.goto('/driver-route-selection');
  await expect(driver.getByRole('heading', { name: 'Where are you now?', exact: true })).toBeVisible();
  await driver.getByRole('button', { name: /Gomoh.*I am here/ }).click();
  await expect(driver.getByText('Going from Gomoh', { exact: true })).toBeVisible();
  await driver.getByRole('button', { name: /Gomoh → Dhanbad/ }).click();
  await expect(driver).toHaveURL(/\/driver-active-car-screen/);
  await expect(driver.getByText('No passenger requests yet', { exact: true })).toBeVisible();
  console.log('[operational] complete');
});
