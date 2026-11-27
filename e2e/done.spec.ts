// One tap to finish a card: "Done" records 100 % without the "How did it go?" form.
import { expect, test } from '@playwright/test';
import { card, goToNextDay, openBoard, PIN, typePin } from './helpers.ts';

const TODAY = 'Today';
const TRAY = 'Catch-up tray';

test('Done on the card that is doing now finishes it in one tap, and Undo opens it again', async ({ page }) => {
  await openBoard(page);
  const trayCards = page.getByRole('region', { name: TRAY }).getByTestId('card');
  const before = await trayCards.count();
  const doing = card(page, TODAY, 'Outline the winter one-shot');
  await expect(doing).toHaveAttribute('data-doing', 'true');

  await doing.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Done. Nice work.')).toBeVisible();
  await expect(card(page, TODAY, 'Outline the winter one-shot')).toHaveAttribute('data-status', 'resolved');
  await expect(card(page, TODAY, 'Outline the winter one-shot')).toContainText('done');
  await expect(trayCards).toHaveCount(before);           // nothing left over

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await expect(card(page, TODAY, 'Outline the winter one-shot')).toHaveAttribute('data-status', 'open');
});

test('Done in the card sheet is the first, main button and closes the sheet', async ({ page }) => {
  await openBoard(page);
  await card(page, TODAY, 'micro:bit: first programs').getByRole('button', { name: 'micro:bit: first programs' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'micro:bit: first programs' });
  const buttons = sheet.getByRole('button').filter({ hasNotText: /^$/ });
  await expect(sheet.getByRole('button', { name: 'Done', exact: true })).toHaveClass(/btn-primary/);
  await expect(buttons.filter({ hasText: /^(Start|Done|How did it go\?)$/ })).toHaveText(['Start', 'Done', 'How did it go?']);
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(card(page, TODAY, 'micro:bit: first programs')).toHaveAttribute('data-status', 'resolved');
});

test('Done works in the list of cards that still need a percent', async ({ page }) => {
  await openBoard(page);
  await goToNextDay(page);
  await typePin(page, PIN);
  await page.getByTestId('alert-unconfirmed').getByRole('button', { name: 'Sort them out' }).click();
  const sheet = page.getByRole('dialog', { name: 'Cards that still need a percent' });
  const n = await sheet.getByTestId('card').count();
  await sheet.getByTestId('card').filter({ hasText: 'Help cook dinner' }).getByRole('button', { name: 'Done', exact: true }).click();
  await expect(sheet.getByTestId('card')).toHaveCount(n - 1);
  await expect(page.getByText('Done. Nice work.')).toBeVisible();
  // Yesterday's card: he may still undo it.
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
});
