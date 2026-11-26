// Ticket T04: his Today screen shows the whole demo day, read-only.
import { expect, test } from '@playwright/test';
import { card, openBoard, TODAY_HEADING } from './helpers.ts';

test('the header shows the day, the encouragement, the campfire and the parent note', async ({ page }) => {
  await openBoard(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TODAY_HEADING);
  await expect(page.getByTestId('encouragement')).not.toBeEmpty();
  await expect(page.getByTestId('campfire')).toHaveText('Campfire: 2 days');
  await expect(page.getByText('Proud of how you planned yesterday.')).toBeVisible();
});

test('the Today region has five cards in the right states', async ({ page }) => {
  await openBoard(page);
  const today = page.getByRole('region', { name: 'Today', exact: true });
  await expect(today.getByTestId('card')).toHaveCount(5);
  await expect(card(page, 'Today', 'Math Academy lesson')).toHaveAttribute('data-status', 'resolved');
  await expect(card(page, 'Today', 'Outline the winter one-shot')).toHaveAttribute('data-doing', 'true');
  await expect(today.getByRole('group', { name: 'Any time today' }).getByTestId('card')
    .filter({ hasText: 'Help cook dinner' })).toBeVisible();
  await expect(card(page, 'Today', 'Outside time')).toContainText('Must-do');
});

test('the Catch-up tray holds the leftover and says where it came from', async ({ page }) => {
  await openBoard(page);
  const tray = page.getByRole('region', { name: 'Catch-up tray' });
  await expect(tray.getByTestId('card')).toHaveCount(1);
  const leftover = card(page, 'Catch-up tray', 'Mr Math problem set');
  await expect(leftover).toContainText('30 min left');
  await expect(leftover).toContainText('Play date ran long');
});

test('the stack collapses identical cards', async ({ page }) => {
  await openBoard(page);
  await expect(card(page, "This week's stack", 'Pack for the trip')).toBeVisible();
  const read = card(page, "This week's stack", 'Read for fun');
  await expect(read).toHaveCount(1);
  await expect(read).toContainText('6 more this week');
});

test('the reminders name the must-do that has no day', async ({ page }) => {
  await openBoard(page);
  await expect(page.getByRole('region', { name: 'Reminders' }))
    .toContainText('Must-do due Wednesday: "Pack for the trip" is not on a day yet.');
});

test('the word of the day shows a word and its definition', async ({ page }) => {
  await openBoard(page);
  const word = page.getByRole('region', { name: 'Word of the day' });
  await expect(word).toContainText('dilemma');
  await expect(word.locator('.word-def')).not.toBeEmpty();
});

test('nothing scrolls sideways at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page);
  await expect(page.getByRole('region', { name: 'Today', exact: true }).getByTestId('card')).toHaveCount(5);
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});
