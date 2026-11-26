// Ticket T08: the month. Goals, the numbers so far, the calendar and the Sunday check-in.
import { expect, test, type Page } from '@playwright/test';
import { openDemo, PIN, typePin, unlock } from './helpers.ts';

/** Opens the app on a path, unlocks, and waits for the month heading. */
async function openMonth(page: Page, path = '/month', heading = 'December 2026') {
  await openDemo(page, path);
  await unlock(page).catch(() => undefined);           // the PIN pad leads to the path asked for
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

test('This month, and the arrow to the next one', async ({ page }) => {
  await openDemo(page);
  await unlock(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Month' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'December 2026' })).toBeVisible();
  await expect(page.getByText(/days on the board so far\. Here is where the time went\./)).toBeVisible();
  await page.getByRole('link', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'January 2027' })).toBeVisible();
  await expect(page).toHaveURL(/\/month\/2027-01$/);
  // A month that has not started: goals and the calendar, no tiles.
  await expect(page.getByRole('region', { name: 'Goals for the month' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Day by day' })).toBeVisible();
  await expect(page.getByTestId('stat-finished')).toHaveCount(0);
  await page.getByRole('link', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'December 2026' })).toBeVisible();
});

test('The tiles come from the stats', async ({ page }) => {
  await openMonth(page);
  await expect(page.getByTestId('stat-closed')).toContainText('2 of 3');
  await expect(page.getByTestId('stat-closed')).toContainText('days closed out');
  await expect(page.getByTestId('stat-finished')).toContainText('7');
  await expect(page.getByTestId('stat-finished')).toContainText('cards finished');
  await expect(page.getByTestId('stat-partial')).toContainText('1');
  await expect(page.getByTestId('stat-missed')).toContainText('0');
  await expect(page.getByTestId('stat-time')).toContainText('5 h');
  await expect(page.getByTestId('stat-time')).toContainText('spent of 8 h planned');
  const bars = page.getByRole('region', { name: 'Where my time went' });
  await expect(bars.getByRole('listitem').first()).toContainText(' of ');
});

test('The calendar: closed days have a check, today says Today', async ({ page }) => {
  await openMonth(page);
  const grid = page.getByRole('region', { name: 'Day by day' });
  await expect(grid).toContainText('A check means the day was closed out.');
  await expect(grid).toContainText('Darker blue means more time spent that day.');
  const dec20 = grid.getByRole('link', { name: /^December 20:/ });
  await expect(dec20).toHaveAttribute('aria-label', /closed out/);
  await expect(dec20.locator('.daygrid-check svg')).toBeVisible();
  const dec21 = grid.getByRole('link', { name: /^December 21:/ });
  await expect(dec21).toContainText('Today');
  await dec20.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 14' })).toBeVisible();
});

test('Ticking a goal stays ticked', async ({ page }) => {
  await openMonth(page);
  const goals = page.getByRole('region', { name: 'Goals for the month' });
  const goal = goals.getByRole('checkbox', { name: 'Run a one-shot adventure I wrote' });
  await expect(goal).not.toBeChecked();
  await goal.click();
  await expect(goal).toBeChecked();
  await page.getByRole('button', { name: 'Lock my board' }).click();
  await page.reload();
  await typePin(page, PIN);
  await expect(page.getByRole('heading', { level: 1, name: 'December 2026' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Goals for the month' })
    .getByRole('checkbox', { name: 'Run a one-shot adventure I wrote' })).toBeChecked();
});

test('Add a goal', async ({ page }) => {
  await openMonth(page);
  const goals = page.getByRole('region', { name: 'Goals for the month' });
  await goals.getByRole('button', { name: 'Add a goal' }).click();
  await goals.getByLabel('Goal', { exact: true }).fill('Learn three new songs');
  await goals.getByRole('button', { name: 'Save goal' }).click();
  await expect(goals.getByRole('checkbox', { name: 'Learn three new songs' })).toBeVisible();
  await expect(goals.getByRole('button', { name: 'Add a goal' })).toBeVisible();
});

test("Write this week's check-in", async ({ page }) => {
  await openMonth(page);
  const panel = page.getByRole('region', { name: 'Sunday check-in' });
  await panel.getByRole('button', { name: "Write this week's check-in" }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('What worked that I want to keep doing?')).toBeVisible();
  await dialog.getByLabel('Keep').fill('The morning focus block');
  await dialog.getByLabel('Notes').fill('Music before lunch.');
  await dialog.getByRole('button', { name: 'Save check-in' }).click();
  await expect(dialog).toHaveCount(0);
  const keep = panel.locator('.checkin-answer').filter({ has: page.getByText('Keep', { exact: true }) });
  await expect(keep).toContainText('The morning focus block');
  await expect(panel.getByRole('button', { name: "Edit this week's check-in" })).toBeVisible();
  // Editing starts from what was saved, and keeps the fields not touched.
  await panel.getByRole('button', { name: "Edit this week's check-in" }).click();
  await expect(page.getByRole('dialog').getByLabel('Keep')).toHaveValue('The morning focus block');
  await page.getByRole('dialog').getByLabel('Start').fill('Recap right after each session');
  await page.getByRole('dialog').getByRole('button', { name: 'Save check-in' }).click();
  await expect(panel).toContainText('Recap right after each session');
  await expect(keep).toContainText('The morning focus block');
});

test('A bad month in the address goes to this month', async ({ page }) => {
  await openMonth(page, '/month/abc');
  await expect(page).toHaveURL(/\/month$/);
});
