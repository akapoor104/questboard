// The first browser test (ticket T03). It was written before the screens existed,
// from the wording in docs/05-design.md. Later tickets add their own files next to it.
import { expect, test } from '@playwright/test';
import { PIN, TODAY_HEADING, openDemo, typePin, unlock } from './helpers.ts';

test('the demo opens on the PIN pad and 1234 opens his board', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Anush' })).toBeVisible();
  await unlock(page);
  await expect(page.getByText('Demo', { exact: true })).toBeVisible();
});

test('a wrong PIN says how many tries are left and does not open the board', async ({ page }) => {
  await openDemo(page);
  await typePin(page, '9999');
  await expect(page.getByRole('alert')).toContainText('4 tries left');
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Anush' })).toBeVisible();
});

test('locking the board brings the PIN pad back', async ({ page }) => {
  await openDemo(page);
  await unlock(page);
  await page.getByRole('button', { name: 'Lock my board' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Anush' })).toBeVisible();
});

test('five wrong PINs lock the pad', async ({ page }) => {
  await openDemo(page);
  for (let i = 0; i < 5; i++) await typePin(page, '9999');
  await expect(page.getByRole('alert')).toContainText('Too many tries.');
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeDisabled();
});

test('typing the PIN on the keyboard opens his board', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Anush' })).toBeVisible();
  await page.keyboard.type(PIN);
  await expect(page.getByRole('heading', { level: 1, name: TODAY_HEADING })).toBeVisible();
});
