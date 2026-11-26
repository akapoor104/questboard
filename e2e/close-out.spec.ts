// Ticket T06: close out the day, act on reminders, tick the word, change the theme.
import { expect, test, type Page } from '@playwright/test';
import { card, goToNextDay, openBoard, PIN, resolveOnToday, TODAY_HEADING, typePin } from './helpers.ts';

const TODAY_OPEN = ['Outline the winter one-shot', 'micro:bit: first programs', 'Outside time', 'Help cook dinner'];

function closeOut(page: Page) {
  return page.getByRole('region', { name: 'Close out the day' });
}

/** After a reload: types the PIN if the pad is showing, then waits for this heading. */
async function backToBoard(page: Page, heading: string) {
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText(new RegExp(`^(Hi, Anush|${heading})$`));
  if ((await h1.textContent()) === 'Hi, Anush') await typePin(page, PIN);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

/** Resolves all four open cards of Monday at 100% and closes the day as Good. */
async function closeMonday(page: Page) {
  for (const title of TODAY_OPEN) await resolveOnToday(page, title, '100%');
  const button = closeOut(page).getByRole('button', { name: 'Close out today' });
  await expect(button).toBeEnabled();
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Close out today' });
  await dialog.getByRole('group', { name: 'How was today?' }).getByRole('button', { name: 'Good' }).click();
  await expect(dialog.getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Close the day' }).click();
  await expect(dialog).toHaveCount(0);
}

test('Close out today waits until every card has a percent', async ({ page }) => {
  await openBoard(page);
  await expect(closeOut(page).getByRole('button', { name: 'Close out today' })).toBeDisabled();
  await expect(closeOut(page)).toContainText('4 cards still need a percent.');
});

test('Closing the day keeps the campfire going', async ({ page }) => {
  await openBoard(page);
  await closeMonday(page);
  await expect(page.getByText('Day closed. Campfire: 3 days.')).toBeVisible();
  await expect(page.getByTestId('campfire')).toHaveText('Campfire: 3 days');
  await expect(closeOut(page)).toContainText('Today is closed out.');
  await expect(closeOut(page).getByRole('button', { name: 'Change my note' })).toBeVisible();
});

test('Undo un-closes the day', async ({ page }) => {
  await openBoard(page);
  await closeMonday(page);
  await expect(page.getByTestId('campfire')).toHaveText('Campfire: 3 days');
  await card(page, 'Today', 'Help cook dinner').getByRole('button', { name: 'Help cook dinner' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(closeOut(page)).toContainText('1 card still needs a percent.');
  await expect(page.getByTestId('campfire')).toHaveText('Campfire: 2 days');
});

test("Yesterday's cards can be sorted out the next day", async ({ page }) => {
  await openBoard(page);
  await goToNextDay(page);
  await typePin(page, PIN);
  await expect(page.getByRole('heading', { level: 1, name: 'Tuesday, December 22' })).toBeVisible();
  const reminder = page.getByTestId('alert-unconfirmed');
  await expect(reminder).toHaveText(/4 cards from earlier days still need a percent\./);
  await reminder.getByRole('button', { name: 'Sort them out' }).click();
  const sheet = page.getByRole('dialog', { name: 'Cards that still need a percent' });
  await expect(sheet.getByRole('heading', { name: 'Monday, December 21' })).toBeVisible();
  await sheet.getByTestId('card').filter({ hasText: 'Help cook dinner' }).getByRole('button', { name: 'How did it go?' }).click();
  const dialog = page.getByRole('dialog', { name: 'How did it go?' });
  await dialog.getByRole('button', { name: '100%', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(sheet.getByTestId('card')).toHaveCount(3);
  await expect(reminder).toHaveText(/3 cards from earlier days still need a percent\./);
});

test('An empty day can be closed once the old cards are sorted out', async ({ page }) => {
  await openBoard(page);
  await goToNextDay(page);
  await typePin(page, PIN);
  await page.getByTestId('alert-unconfirmed').getByRole('button', { name: 'Sort them out' }).click();
  const sheet = page.getByRole('dialog', { name: 'Cards that still need a percent' });
  for (let left = 4; left > 0; left -= 1) {
    await expect(sheet.getByTestId('card')).toHaveCount(left);
    await sheet.getByRole('button', { name: 'How did it go?' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'How did it go?' });
    await dialog.getByRole('button', { name: '100%', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
  }
  await expect(sheet.getByText('All sorted. Nice.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByTestId('alert-unconfirmed')).toHaveCount(0);
  await closeOut(page).getByRole('button', { name: 'Close out today' }).click();
  await page.getByRole('dialog', { name: 'Close out today' }).getByRole('button', { name: 'Close the day' }).click();
  await expect(closeOut(page)).toContainText('Today is closed out.');
});

test('The word of the day can be ticked', async ({ page }) => {
  await openBoard(page);
  const word = page.getByRole('region', { name: 'Word of the day' });
  await word.getByRole('button', { name: 'I used it today' }).click();
  const used = word.getByRole('button', { name: 'Used today' });
  await expect(used).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await backToBoard(page, TODAY_HEADING);
  await expect(page.getByRole('region', { name: 'Word of the day' }).getByRole('button', { name: 'Used today' })).toBeVisible();
});

test('Give it a day places a must-do that is due soon', async ({ page }) => {
  await openBoard(page);
  const reminder = page.getByTestId('alert-due_soon');
  await expect(reminder).toContainText('Pack for the trip');
  await reminder.getByRole('button', { name: 'Give it a day' }).click();
  const sheet = page.getByRole('dialog', { name: 'Pack for the trip' });
  await sheet.getByRole('button', { name: 'Tue 22' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(reminder).toHaveCount(0);
});

test('The dark theme stays after a reload', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: 'Anush', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'My profile' });
  await expect(sheet.getByRole('link', { name: 'Parent sign-in' })).toHaveAttribute('href', '/parent');
  await sheet.getByRole('button', { name: 'Dark' }).click();
  await expect(sheet.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await backToBoard(page, TODAY_HEADING);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('A new avatar shows in the top bar', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: 'Anush', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'My profile' });
  await sheet.getByRole('button', { name: 'Rocket' }).click();
  await expect(sheet.getByRole('button', { name: 'Rocket' })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.locator('[aria-pressed="true"]')).toHaveCount(2);   // the avatar and the theme
});
