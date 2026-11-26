// Ticket T05: he runs his day from Today. Start, how did it go, move, drop, undo.
import { expect, test, type Page } from '@playwright/test';
import { card, openBoard } from './helpers.ts';

const TODAY = 'Today';
const TRAY = 'Catch-up tray';
const STACK = "This week's stack";

/** Opens the card sheet by tapping the card's title. */
async function openCard(page: Page, region: string, title: string) {
  await card(page, region, title).getByRole('button', { name: title }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  return sheet;
}

test('To today moves a stack card onto today and the due-soon reminder goes', async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId('alert-due_soon')).toBeVisible();
  await card(page, STACK, 'Pack for the trip').getByRole('button', { name: 'To today' }).click();
  const anyTime = page.getByRole('region', { name: TODAY, exact: true }).getByRole('group', { name: 'Any time today' });
  await expect(anyTime.getByTestId('card').filter({ hasText: 'Pack for the trip' })).toBeVisible();
  await expect(card(page, STACK, 'Pack for the trip')).toHaveCount(0);
  await expect(page.getByTestId('alert-due_soon')).toHaveCount(0);
});

test('Start switches the card that is doing now', async ({ page }) => {
  await openBoard(page);
  const sheet = await openCard(page, TODAY, 'micro:bit: first programs');
  await sheet.getByRole('button', { name: 'Start' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(card(page, TODAY, 'micro:bit: first programs')).toHaveAttribute('data-doing', 'true');
  await expect(card(page, TODAY, 'Outline the winter one-shot')).toHaveAttribute('data-doing', 'false');
  await expect(card(page, TODAY, 'micro:bit: first programs')).toContainText('Doing now · started 10:06 AM');
});

test('Half done sends the leftover to the tray', async ({ page }) => {
  await openBoard(page);
  const sheet = await openCard(page, TODAY, 'Outline the winter one-shot');
  await sheet.getByRole('button', { name: 'How did it go?' }).click();
  const dialog = page.getByRole('dialog', { name: 'How did it go?' });
  await expect(dialog.getByText('Be honest. Half done is still half done.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
  await dialog.getByRole('button', { name: '50%', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '50%', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByTestId('resolve-preview')).toContainText('About 23 min done.');
  await expect(dialog.getByTestId('resolve-preview')).toContainText('25 min left over.');
  await dialog.getByLabel('What got in the way? (optional)').fill('Dinner came early');
  await expect(dialog.getByRole('radio', { name: 'Put it in my Catch-up tray' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Saved. 25 min is in your Catch-up tray.')).toBeVisible();

  const resolved = card(page, TODAY, 'Outline the winter one-shot');
  await expect(resolved).toContainText('50% done');
  const tray = page.getByRole('region', { name: TRAY });
  await expect(tray.getByTestId('card')).toHaveCount(2);
  await expect(card(page, TRAY, 'Outline the winter one-shot')).toContainText('25 min left');
});

test('The leftover can go straight to another day', async ({ page }) => {
  await openBoard(page);
  const sheet = await openCard(page, TODAY, 'Outline the winter one-shot');
  await sheet.getByRole('button', { name: 'How did it go?' }).click();
  const dialog = page.getByRole('dialog', { name: 'How did it go?' });
  await dialog.getByRole('button', { name: '25%', exact: true }).click();
  await dialog.getByRole('radio', { name: 'Give it a new day and time now' }).check();
  await dialog.getByRole('button', { name: 'Tue 22' }).click();
  await expect(dialog.getByRole('button', { name: 'Tue 22' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: TRAY }).getByTestId('card')).toHaveCount(1);
  await expect(card(page, TODAY, 'Outline the winter one-shot')).toContainText('25% done');
});

test('A must-do cannot be let go; he asks a parent', async ({ page }) => {
  await openBoard(page);
  const sheet = await openCard(page, TODAY, 'Outside time');
  await sheet.getByRole('button', { name: 'How did it go?' }).click();
  const dialog = page.getByRole('dialog', { name: 'How did it go?' });
  await dialog.getByRole('button', { name: '0%', exact: true }).click();
  await expect(dialog.getByTestId('resolve-preview')).toContainText('Nothing done this time.');
  const radios = dialog.getByRole('radio');
  await expect(radios).toHaveCount(3);
  await expect(dialog.getByText('Let it go', { exact: true })).toHaveCount(0);
  await dialog.getByRole('radio', { name: 'Ask a parent to let it go' }).check();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Saved. A parent will decide about the rest.')).toBeVisible();
  await expect(card(page, TRAY, 'Outside time')).toContainText('Waiting for a parent to decide');
});

test('Undo reopens a finished card', async ({ page }) => {
  await openBoard(page);
  const sheet = await openCard(page, TODAY, 'Math Academy lesson');
  await expect(sheet).toContainText('done');
  await sheet.getByRole('button', { name: 'Undo' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(card(page, TODAY, 'Math Academy lesson')).toHaveAttribute('data-status', 'open');
});

test('Give it a time puts a tray card on the timeline at the free slot', async ({ page }) => {
  await openBoard(page);
  await card(page, TRAY, 'Mr Math problem set').getByRole('button', { name: 'Give it a time' }).click();
  const sheet = page.getByRole('dialog', { name: 'Mr Math problem set' });
  await expect(sheet.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByText('11:30 AM is free')).toBeVisible();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(card(page, TODAY, 'Mr Math problem set')).toContainText('11:30 AM');
  await expect(page.getByRole('region', { name: TRAY })).toContainText('Nothing left over. Nice.');
});

test('Drop it asks first, then the card is gone', async ({ page }) => {
  await openBoard(page);
  const sheet = await openCard(page, TODAY, 'Help cook dinner');
  await sheet.getByRole('button', { name: 'Drop it' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText('Drop this card?')).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Keep it' })).toBeVisible();
  await confirm.getByRole('button', { name: 'Drop it' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(card(page, TODAY, 'Help cook dinner')).toHaveCount(0);
});

test('Ask to drop a must-do leaves it waiting for a parent', async ({ page }) => {
  await openBoard(page);
  const sheet = await openCard(page, TODAY, 'Outside time');
  await sheet.getByRole('button', { name: 'Ask to drop' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Why should it go? (optional)').fill('It is raining');
  await form.getByRole('button', { name: 'Ask a parent' }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByText('Asked. A parent will decide.')).toBeVisible();
  await expect(card(page, TODAY, 'Outside time')).toContainText('Waiting for a parent to decide');
  const again = await openCard(page, TODAY, 'Outside time');
  await expect(again.getByText('Waiting for a parent to decide.')).toBeVisible();
  await expect(again.getByRole('button', { name: 'Ask to drop' })).toHaveCount(0);
});

test('Edit is offered for his picks, not for must-dos', async ({ page }) => {
  await openBoard(page);
  let sheet = await openCard(page, TODAY, 'Help cook dinner');
  await expect(sheet.getByRole('button', { name: 'Edit' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  sheet = await openCard(page, TODAY, 'Outside time');
  await expect(sheet.getByRole('button', { name: 'Move' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Edit' })).toHaveCount(0);
});

test('Edit saves a new title', async ({ page }) => {
  await openBoard(page);
  const sheet = await openCard(page, TODAY, 'Help cook dinner');
  await sheet.getByRole('button', { name: 'Edit' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Title').fill('Help cook pasta');
  await form.getByLabel('Minutes').fill('20');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toHaveCount(0);
  await expect(card(page, TODAY, 'Help cook pasta')).toContainText('20 min');
});

test('Move a card back to the stack', async ({ page }) => {
  await openBoard(page);
  const sheet = await openCard(page, TODAY, 'micro:bit: first programs');
  await sheet.getByRole('button', { name: 'Move' }).click();
  const form = page.getByRole('dialog');
  await form.getByRole('button', { name: "This week's stack" }).click();
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toHaveCount(0);
  await expect(card(page, STACK, 'micro:bit: first programs')).toBeVisible();
  await expect(card(page, TODAY, 'micro:bit: first programs')).toHaveCount(0);
});

test('The doing-now card has its own How did it go? button', async ({ page }) => {
  await openBoard(page);
  await card(page, TODAY, 'Outline the winter one-shot').getByRole('button', { name: 'How did it go?' }).click();
  const dialog = page.getByRole('dialog', { name: 'How did it go?' });
  await dialog.getByRole('button', { name: '100%', exact: true }).click();
  await expect(dialog.getByTestId('resolve-preview')).toContainText('All 45 min done. Nice work.');
  await expect(dialog.getByLabel('Anything to remember? (optional)')).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'What happens to the time left?' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(card(page, TODAY, 'Outline the winter one-shot')).toHaveAttribute('data-status', 'resolved');
  await expect(page.getByRole('region', { name: TRAY }).getByTestId('card')).toHaveCount(1);
});

test('Everything works by keyboard: open, choose, save, cancel, Escape', async ({ page }) => {
  await openBoard(page);
  const title = card(page, TODAY, 'Outline the winter one-shot').getByRole('button', { name: 'Outline the winter one-shot' });
  await title.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  // Escape closes and focus goes back to the card.
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(title).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(sheet).toBeVisible();
  // Tab to "How did it go?" and open it.
  const howButton = sheet.getByRole('button', { name: 'How did it go?' });
  for (let i = 0; i < 10 && !(await howButton.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(howButton).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'How did it go?' });
  await expect(dialog).toBeVisible();
  // Cancel by keyboard.
  await dialog.getByRole('button', { name: 'Cancel' }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(title).toBeFocused();

  // Choose and save by keyboard.
  await card(page, TODAY, 'Outline the winter one-shot').getByRole('button', { name: 'How did it go?' }).focus();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: '75%', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(dialog.getByRole('button', { name: '75%', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Save' }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(card(page, TODAY, 'Outline the winter one-shot').first()).toContainText('75% done');
});

test('A refused change shows a friendly sentence and the board reloads', async ({ page }) => {
  await openBoard(page);
  // Resolve half; the leftover goes to the tray.
  let sheet = await openCard(page, TODAY, 'micro:bit: first programs');
  await sheet.getByRole('button', { name: 'How did it go?' }).click();
  const dialog = page.getByRole('dialog', { name: 'How did it go?' });
  await dialog.getByRole('button', { name: '50%', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  // Put the leftover on today and start it: now it is in use.
  await card(page, TRAY, 'micro:bit: first programs').getByRole('button', { name: 'Give it a time' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(card(page, TRAY, 'micro:bit: first programs')).toHaveCount(0);
  const leftover = card(page, TODAY, 'micro:bit: first programs').and(page.locator('[data-status="open"]'));
  await leftover.getByRole('button', { name: 'micro:bit: first programs' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
  await expect(leftover).toHaveAttribute('data-doing', 'true');
  // Undo on the original is refused.
  const original = card(page, TODAY, 'micro:bit: first programs').and(page.locator('[data-status="resolved"]'));
  await original.getByRole('button', { name: 'micro:bit: first programs' }).click();
  sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Undo' }).click();
  await expect(sheet.getByRole('alert')).toHaveText('The leftover from this card was already used, so it cannot be reopened.');
  await expect(original).toHaveAttribute('data-status', 'resolved');
  await expect(sheet.getByRole('button', { name: 'Undo' })).toBeEnabled();
});
