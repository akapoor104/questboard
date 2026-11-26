// Ticket T15: a browser linked as "Display only" shows the kitchen display: read-only,
// dark, no buttons. The demo clock is frozen at 10:06 AM on Monday, December 21.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openDemoUnlinked, TODAY_HEADING } from './helpers.ts';

/** From an unlinked browser to the display screen, through the parent's Settings. */
async function linkAsDisplay(page: Page) {
  await openDemoUnlinked(page, '/');
  await expect(page.getByRole('heading', { name: 'Link this device' })).toBeVisible();
  const code = page.getByTestId('pair-code');
  await expect(code).toHaveText(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  const pair = (await code.textContent())!.replace('-', '');

  await page.goto('/parent/settings');
  await page.getByRole('button', { name: 'Enter as demo parent' }).click();
  await expect(page.getByRole('navigation', { name: 'Parent' })).toBeVisible();
  const panel = page.getByRole('region', { name: 'Link a new device' });
  await panel.getByLabel('Code').fill(pair);
  await panel.getByRole('radio', { name: 'Display only' }).check();
  await panel.getByRole('button', { name: 'Link' }).click();
  await expect(page.getByText('Device linked.')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: TODAY_HEADING })).toBeVisible();
}

test('a display shows now, next and the rest of today, with no buttons', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await linkAsDisplay(page);

  await expect(page.getByRole('heading', { name: 'Now' })).toBeVisible();
  await expect(page.getByTestId('display-now')).toContainText('Outline the winter one-shot');
  await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible();
  await expect(page.getByTestId('display-next')).toContainText('micro:bit: first programs');
  await expect(page.getByTestId('display-next')).toContainText('11:00 AM');
  const rest = page.getByRole('region', { name: 'Rest of today' });
  await expect(rest).toContainText('Outside time');
  await expect(rest).toContainText('Help cook dinner');
  await expect(rest).not.toContainText('Math Academy lesson');          // done already
  await expect(page.getByTestId('display-clock')).toHaveText('10:06 AM');
  await expect(page.getByTestId('campfire')).toHaveText('Campfire: 2 days');
  await expect(page.getByRole('region', { name: 'Word of the day' })).toContainText('dilemma');
  await expect(page.getByText('Display only', { exact: true })).toBeVisible();

  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('link')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(serious).toEqual([]);
  expect(errors).toEqual([]);
});

test('the clock moves and the board refreshes by itself', async ({ page }) => {
  await linkAsDisplay(page);
  await expect(page.getByTestId('display-now')).toContainText('Outline the winter one-shot');
  // From here the clock runs again; one simulated hour later it is past 11:00.
  await page.clock.install({ time: new Date('2026-12-21T18:06:00Z') });
  await page.reload();
  await expect(page.getByTestId('display-clock')).toHaveText('10:06 AM');
  await page.clock.runFor(60_000);
  await expect(page.getByTestId('display-clock')).toHaveText('10:07 AM');
  await page.clock.runFor(60 * 60_000);
  await expect(page.getByTestId('display-clock')).toHaveText('11:07 AM');
  // The started card is still "now"; micro:bit (11:00) has begun, so nothing later is next but Outside time.
  await expect(page.getByTestId('display-next')).toContainText('Outside time');
  await expect(page.getByTestId('display-next')).toContainText('1:00 PM');
  // Past midnight: the date comes from the server (getToday), so it only changes when the data reloads.
  await page.clock.fastForward('14:00:00');
  await page.clock.runFor(60_000);
  await expect(page.getByRole('heading', { level: 1, name: 'Tuesday, December 22' })).toBeVisible();
  await expect(page.getByTestId('display-clock')).toHaveText('1:08 AM');
});
