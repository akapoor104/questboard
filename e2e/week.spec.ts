// Ticket T07: he plans a week. Seven days, the focus, the load check, the stack and the Library.
import { expect, test, type Page } from '@playwright/test';
import { card, openDemo, unlock } from './helpers.ts';

const STACK = 'Any day this week';

/** Opens the app on a path, unlocks, and waits for the Week heading. */
async function openWeek(page: Page, path = '/week', heading = 'Week of December 21') {
  await openDemo(page, path);
  await unlock(page).catch(() => undefined);           // the PIN pad leads to the path asked for
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

test('This week: seven days, today marked, five cards on Monday', async ({ page }) => {
  await openDemo(page);
  await unlock(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Week' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 21' })).toBeVisible();
  const monday = page.getByRole('region', { name: 'Monday, December 21' });
  await expect(monday.getByText('Today', { exact: true })).toBeVisible();
  await expect(monday.getByTestId('card')).toHaveCount(5);
  for (const day of ['Tuesday, December 22', 'Wednesday, December 23', 'Sunday, December 27']) {
    await expect(page.getByRole('region', { name: day })).toBeVisible();
  }
});

test('The arrows go a week forward and back; a past week cannot be added to', async ({ page }) => {
  await openWeek(page);
  await page.getByRole('link', { name: 'Next week' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 28' })).toBeVisible();
  await expect(page).toHaveURL(/\/week\/2026-12-28$/);
  await page.getByRole('link', { name: 'Previous week' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 21' })).toBeVisible();
  await page.getByRole('link', { name: 'Previous week' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 14' })).toBeVisible();
  const library = page.getByRole('region', { name: 'Library' });
  await expect(library.getByText('This week is over. Go to this week to add cards.')).toBeVisible();
  const adds = library.getByRole('button', { name: /^Add / });
  await expect(adds.first()).toBeDisabled();
  expect(await adds.evaluateAll((els) => els.every((e) => (e as HTMLButtonElement).disabled))).toBe(true);
  await expect(page.getByRole('button', { name: /^Add a card to/ })).toHaveCount(0);
});

test('The load meter', async ({ page }) => {
  await openWeek(page);
  const meter = page.getByRole('meter', { name: 'Structured time planned' });
  await expect(meter).toHaveAttribute('data-testid', 'load-meter');
  await expect(meter).toHaveAttribute('aria-valuemax', '540');
  const panel = page.getByRole('region', { name: 'Is this week too full?' });
  await expect(panel).toContainText('weekly guide');
  await expect(panel).toContainText('Fun, rest and outdoors do not count.');
});

test('Add from the Library', async ({ page }) => {
  await openWeek(page, '/week#library');
  const library = page.getByRole('region', { name: 'Library' });
  await library.getByRole('button', { name: 'Story & D&D' }).click();
  await expect(library.getByRole('button', { name: 'Story & D&D' })).toHaveAttribute('aria-pressed', 'true');
  const first = library.getByRole('listitem').first();
  const title = (await first.locator('.library-title').textContent()) ?? '';
  expect(title.length).toBeGreaterThan(0);
  await first.getByRole('button', { name: `Add ${title}` }).click();
  await expect(page.getByText("Added to this week's stack")).toBeVisible();
  await expect(card(page, STACK, title)).toHaveCount(1);
});

test('Ten quick adds make ten cards, no more and no fewer', async ({ page }) => {
  await openWeek(page);
  const stack = page.getByRole('region', { name: STACK });
  await expect(stack.getByText('13 cards')).toBeVisible();
  const library = page.getByRole('region', { name: 'Library' });
  await library.getByRole('button', { name: 'Build & Code' }).click();
  // Ten different ideas, each tapped twice in the same instant (before the screen can redraw).
  await library.evaluate((el) => {
    const adds = [...el.querySelectorAll<HTMLButtonElement>('.library-add')].slice(0, 10);
    for (const b of adds) { b.click(); b.click(); }
  });
  await expect(stack.getByText('23 cards')).toBeVisible();
  await expect(library.getByRole('button', { name: /^Add / }).first()).toBeEnabled();
  await page.waitForTimeout(500);
  await expect(stack.getByText('23 cards')).toBeVisible();
});

test('A new card of his own goes to the stack, then to a day', async ({ page }) => {
  await openWeek(page);
  await page.getByRole('button', { name: 'New card' }).click();
  const form = page.getByRole('dialog', { name: 'New card' });
  await form.getByRole('button', { name: 'Add card' }).click();
  await expect(form.getByLabel('Title')).toHaveAttribute('aria-invalid', 'true');
  await form.getByLabel('Title').fill('Paint minis');
  await form.getByLabel('Category').selectOption({ label: 'Fun & Friends' });
  await form.getByLabel('Minutes').fill('45');
  await form.getByRole('button', { name: 'Add card' }).click();
  await expect(form).toHaveCount(0);
  const mine = card(page, STACK, 'Paint minis');
  await expect(mine).toContainText('My pick');

  await mine.getByRole('button', { name: 'Paint minis' }).click();
  const sheet = page.getByRole('dialog', { name: 'Paint minis' });
  await sheet.getByRole('button', { name: 'Move' }).click();
  await expect(sheet.getByRole('button', { name: 'Tue 22' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Wed 23' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(card(page, 'Wednesday, December 23', 'Paint minis')).toHaveCount(1);
  await expect(card(page, STACK, 'Paint minis')).toHaveCount(0);
});

test('The add button on a day makes a card on that day', async ({ page }) => {
  await openWeek(page);
  await page.getByRole('button', { name: 'Add a card to Thursday' }).click();
  const form = page.getByRole('dialog', { name: 'New card' });
  await form.getByLabel('Title').fill('Build a dice tower');
  await form.getByRole('button', { name: 'Add card' }).click();
  await expect(card(page, 'Thursday, December 24', 'Build a dice tower')).toHaveCount(1);
});

test('Focus: add one; with three active the add form gives way', async ({ page }) => {
  await openWeek(page);
  await page.getByRole('button', { name: 'Edit focus' }).click();
  const sheet = page.getByRole('dialog', { name: 'Focus for this week' });
  await expect(sheet.getByText('Agreed at the Sunday check-in. It can change every week.')).toBeVisible();
  await sheet.getByLabel('New focus').fill('Finish my map');
  await sheet.getByRole('button', { name: 'Add focus' }).click();
  await expect(sheet.getByText('Three is plenty. Finish or remove one to add another.')).toBeVisible();
  await expect(sheet.getByLabel('New focus')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Close' }).click();
  const chips = page.getByRole('list', { name: "This week's focus" });
  await expect(chips.getByRole('listitem').filter({ hasText: 'Finish my map' })).toBeVisible();

  // Mark one done (it stays, struck through), remove another: the add form comes back.
  await page.getByRole('button', { name: 'Edit focus' }).click();
  await sheet.getByRole('button', { name: 'Mark done' }).first().click();
  await expect(sheet.getByRole('button', { name: 'Done', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByLabel('New focus')).toBeVisible();
  await sheet.getByRole('button', { name: 'Remove Finish my map' }).click();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(chips.getByRole('listitem')).toHaveCount(2);
  await expect(chips.locator('[data-status="done"]')).toHaveCount(1);
});

test('A date that is not a Monday goes to its Monday', async ({ page }) => {
  await openWeek(page, '/week/2026-12-23');
  await expect(page).toHaveURL(/\/week\/2026-12-21$/);
});
