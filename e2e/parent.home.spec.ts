// Ticket T09: the parent's This week screen, on a phone.
import { expect, test, type Page } from '@playwright/test';
import { card, openDemo, openParent, unlock } from './helpers.ts';

const TODAY = 'Today';

function needsYou(page: Page) {
  return page.getByRole('region', { name: 'Needs you' });
}

async function tile(page: Page, id: string) {
  return page.getByTestId(`tile-${id}`);
}

/** On his board: ask to drop "Outside time" with a reason, then come back to the parent side. */
async function askToDropOutsideTime(page: Page): Promise<void> {
  await page.goto('/');
  await unlock(page);
  await card(page, TODAY, 'Outside time').getByRole('button', { name: 'Outside time' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ask to drop' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Why should it go? (optional)').fill('It is raining');
  await form.getByRole('button', { name: 'Ask a parent' }).click();
  await expect(form).toHaveCount(0);
  await expect(card(page, TODAY, 'Outside time')).toContainText('Waiting for a parent to decide');
  await page.goto('/parent');
  await expect(page.getByRole('heading', { level: 1, name: "Anush's week" })).toBeVisible();
}

test('this week: heading, tiles, what needs a parent, and the tray line', async ({ page }) => {
  await openParent(page);
  await expect(page.getByRole('heading', { level: 1, name: "Anush's week" })).toBeVisible();
  await expect(page.getByText('December 21 to 27')).toBeVisible();
  await expect(await tile(page, 'pct')).toContainText('15%');
  await expect(await tile(page, 'pct')).toContainText('of planned time done');
  await expect(await tile(page, 'closed')).toContainText('0 of 1');
  await expect(await tile(page, 'closed')).toContainText('days closed out');
  await expect(await tile(page, 'must')).toContainText('1 of 3');
  await expect(await tile(page, 'must')).toContainText('must-dos done');
  await expect(needsYou(page)).toContainText('"Pack for the trip" is due Wednesday and is not on a day yet.');
  await expect(needsYou(page)).toContainText('Catch-up tray: 1 card, 30 min. You are alerted at 5 cards.');
  await expect(page.getByTestId('alert-tray')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Load check' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Time by category' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Check-in' })).toBeVisible();
});

test('previous week shows last week numbers', async ({ page }) => {
  await openParent(page);
  await page.getByRole('link', { name: 'Previous week' }).click();
  await expect(page.getByText('December 14 to 20')).toBeVisible();
  await expect(page).toHaveURL(/\/parent\?week=2026-12-14$/);
  await expect(await tile(page, 'pct')).toContainText('90%');
  await expect(await tile(page, 'closed')).toContainText('2 of 2');
  await expect(await tile(page, 'must')).toContainText('4 of 4');
  await page.getByRole('link', { name: 'Next week' }).click();
  await expect(page.getByText('December 21 to 27')).toBeVisible();
});

test('a drop request: Let it go drops the card from his Today', async ({ page }) => {
  await openParent(page);
  await askToDropOutsideTime(page);
  const panel = needsYou(page);
  await expect(panel.getByRole('heading', { name: 'He asked to drop a must-do' })).toBeVisible();
  await expect(panel).toContainText('Outside time');
  await expect(panel).toContainText('"It is raining"');
  await panel.getByRole('button', { name: 'Let it go' }).click();
  await expect(page.getByText('Let go.')).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'He asked to drop a must-do' })).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('region', { name: TODAY, exact: true })).toBeVisible();
  await expect(card(page, TODAY, 'Help cook dinner')).toBeVisible();
  await expect(card(page, TODAY, 'Outside time')).toHaveCount(0);
});

test('a drop request: Keep it leaves the card on his Today, no longer waiting', async ({ page }) => {
  await openParent(page);
  await askToDropOutsideTime(page);
  const panel = needsYou(page);
  await panel.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.getByText('Kept.')).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'He asked to drop a must-do' })).toHaveCount(0);

  await page.goto('/');
  const outside = card(page, TODAY, 'Outside time');
  await expect(outside).toBeVisible();
  await expect(outside).not.toContainText('Waiting for a parent to decide');
});

test('tapping a drop request title opens the card sheet for the parent', async ({ page }) => {
  await openParent(page);
  await askToDropOutsideTime(page);
  await needsYou(page).getByRole('button', { name: 'Outside time' }).click();
  const sheet = page.getByRole('dialog', { name: 'Outside time' });
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('signed out, /parent shows only the sign-in screen', async ({ page }) => {
  await openDemo(page, '/parent?week=2026-12-14');
  await expect(page.getByRole('heading', { level: 1, name: 'Parents' })).toBeVisible();
  await expect(page.getByText('Anush')).toHaveCount(0);
  await expect(page.getByText(/\d+%|\d+ of \d+|Needs you/)).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Parent' })).toHaveCount(0);
});

test('nothing scrolls sideways at phone width', async ({ page }) => {
  await openParent(page);
  await expect(await tile(page, 'pct')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide).toBeLessThanOrEqual(0);
});
