// Ticket T02: the parent side signs in (demo mode), keeps the session, and signs out.
import { expect, test } from '@playwright/test';
import { openDemo } from './helpers.ts';

test('the demo parent signs in and sees the parent navigation', async ({ page }) => {
  await openDemo(page, '/parent');
  await expect(page.getByRole('heading', { level: 1, name: 'Parents' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter as demo parent' }).click();
  const nav = page.getByRole('navigation', { name: 'Parent' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveCount(3);
  await expect(nav.getByRole('link', { name: 'This week' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Must-dos' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: "Anush's week" })).toBeVisible();
});

test('the demo parent stays signed in after a reload, and Sign out ends it', async ({ page }) => {
  await openDemo(page, '/parent');
  await page.getByRole('button', { name: 'Enter as demo parent' }).click();
  await expect(page.getByRole('navigation', { name: 'Parent' })).toBeVisible();
  await page.goto('/parent/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Parents' })).toBeVisible();
});
