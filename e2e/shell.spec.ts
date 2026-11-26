// Ticket T02: the app shell routes to the right place in demo mode.
import { expect, test } from '@playwright/test';
import { openDemo } from './helpers.ts';

test('the board opens on the PIN screen with the Demo chip', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Anush' })).toBeVisible();
  await expect(page.getByTestId('demo-badge')).toHaveText('Demo');
});

test('an unknown path says so and leads back to the board', async ({ page }) => {
  await openDemo(page, '/nope');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to the board' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Anush' })).toBeVisible();
});
