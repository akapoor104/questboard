// Ticket T16: drag and drop. A card dragged from the stack onto a day lands there; one dragged
// onto Today's timeline gets that time. A plain click still opens the card sheet.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { card, openBoard, openDemo, unlock } from './helpers.ts';

const STACK = 'Any day this week';

async function openWeek(page: Page) {
  await openDemo(page, '/week');
  await unlock(page).catch(() => undefined);           // the PIN pad leads to the path asked for
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 21' })).toBeVisible();
}

/** Presses on `from` near its top-left corner, moves in small steps to (x, y), and lets go. */
async function dragTo(page: Page, from: Locator, x: number, y: number) {
  const box = await from.boundingBox();
  if (!box) throw new Error('nothing to drag');
  await page.mouse.move(box.x + 24, box.y + 6);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

test('Week: a card dragged from the stack onto Wednesday is listed there', async ({ page }) => {
  await openWeek(page);
  await expect(page.getByText('Drag a card onto a day, or tap it to choose a day and time.')).toBeVisible();
  const wednesday = page.getByRole('region', { name: 'Wednesday, December 23' });
  const target = await wednesday.boundingBox();
  if (!target) throw new Error('no Wednesday');
  await dragTo(page, card(page, STACK, 'Pack for the trip'), target.x + target.width / 2, target.y + target.height / 2);
  await expect(card(page, 'Wednesday, December 23', 'Pack for the trip')).toBeVisible();
  await expect(card(page, STACK, 'Pack for the trip')).toHaveCount(0);
  await expect(page.getByText('Moved to Wednesday.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);           // the drop did not also open the sheet
});

test('Today: a card dragged onto the timeline near 5 PM gets that time', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2200 });       // the card and 5 PM on one screen
  await openBoard(page);
  const today = page.getByRole('region', { name: 'Today', exact: true });
  const anyTime = today.getByRole('group', { name: 'Any time today' });
  const five = await today.locator('.dayline-hour').filter({ hasText: /^5 PM$/ }).boundingBox();
  if (!five) throw new Error('no 5 PM line');
  // The tile is held 6px below its top, so this puts its top on the 5 PM line.
  await dragTo(page, anyTime.getByTestId('card').filter({ hasText: 'Help cook dinner' }), five.x + five.width / 2, five.y + 6);
  await expect(anyTime.getByTestId('card').filter({ hasText: 'Help cook dinner' })).toHaveCount(0);
  const moved = card(page, 'Today', 'Help cook dinner');
  await expect(moved).toHaveCount(1);
  await expect(moved).toContainText(/(4:45|5:00|5:15) PM/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('A plain click on a card still opens the card sheet, on Today and on Week', async ({ page }) => {
  await openBoard(page);
  await card(page, 'Today', 'Help cook dinner').getByRole('button', { name: 'Help cook dinner' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Week' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 21' })).toBeVisible();
  await card(page, STACK, 'Pack for the trip').getByRole('button', { name: 'Pack for the trip' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('A click that wobbles a few pixels is still a click, not a drag', async ({ page }) => {
  await openWeek(page);
  const box = await card(page, STACK, 'Pack for the trip').boundingBox();
  if (!box) throw new Error('no card');
  await page.mouse.move(box.x + 24, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 28, box.y + 13);
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(card(page, STACK, 'Pack for the trip')).toHaveCount(1);
});

test('Draggable cards tell keyboard users about Move', async ({ page }) => {
  await openWeek(page);
  await expect(card(page, STACK, 'Pack for the trip').getByRole('button', { name: 'Pack for the trip' }))
    .toHaveAccessibleDescription('Press Enter for options, including Move.');
});

test('Escape during a drag puts the card back', async ({ page }) => {
  await openWeek(page);
  const wednesday = await page.getByRole('region', { name: 'Wednesday, December 23' }).boundingBox();
  const box = await card(page, STACK, 'Pack for the trip').boundingBox();
  if (!wednesday || !box) throw new Error('missing');
  await page.mouse.move(box.x + 24, box.y + 6);
  await page.mouse.down();
  await page.mouse.move(wednesday.x + 40, wednesday.y + 40, { steps: 8 });
  await expect(page.locator('.cardtile-ghost')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.cardtile-ghost')).toHaveCount(0);
  await page.mouse.up();
  await expect(card(page, STACK, 'Pack for the trip')).toHaveCount(1);
  await expect(card(page, 'Wednesday, December 23', 'Pack for the trip')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
