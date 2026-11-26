// Ticket T10: the parent's Must-dos screen, on a phone.
import { expect, test, type Page } from '@playwright/test';
import { card, openParent, unlock } from './helpers.ts';

const STACK = "This week's stack";

function row(page: Page, title: string) {
  return page.getByTestId('mustdo-row').filter({ hasText: title });
}

/** Fills the "Add a must-do" form and leaves it ready to send. */
async function fillMustDo(page: Page, title: string, category: string, minutes: string, times: string) {
  await page.getByRole('button', { name: 'Add a must-do' }).click();
  const form = page.getByRole('dialog', { name: 'Add a must-do' });
  await form.getByLabel('Title').fill(title);
  await form.getByLabel('Category').selectOption({ label: category });
  await form.getByLabel('Minutes').fill(minutes);
  await form.getByLabel('How many times this week?').selectOption(times);
  return form;
}

/** Leaves the parent side for his board (Today), unlocked. */
async function toBoard(page: Page) {
  await page.goto('/');
  await unlock(page);
}

test('the week, its must-dos, days off and the note panel', async ({ page }) => {
  await openParent(page, '/parent/plan');
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 21' })).toBeVisible();
  await expect(page.getByText('You set the must-dos. Anush plans everything else.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Focus areas (up to three)' })).toBeVisible();
  await expect(row(page, 'Read for fun')).toContainText('30 min, 7 times');
  await expect(row(page, 'Read for fun')).toContainText('0 placed, 7 to place');
  await expect(page.getByRole('heading', { name: 'Days off' })).toBeVisible();
  await expect(page.getByText('On Rest and Away days the campfire is safe.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A note he will see' })).toBeVisible();
});

test('add a must-do: it shows here and in his stack, and he can only ask to drop it', async ({ page }) => {
  await openParent(page, '/parent/plan');
  const form = await fillMustDo(page, 'Tidy desk', 'Home & Helping', '10', '2');
  await form.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByText('Added. Anush will see it on his board.')).toBeVisible();
  await expect(row(page, 'Tidy desk')).toContainText('2 times');
  await expect(row(page, 'Tidy desk')).toContainText('0 placed, 2 to place');

  await toBoard(page);
  const tidy = card(page, STACK, 'Tidy desk');
  await expect(tidy).toHaveCount(1);
  await expect(tidy).toContainText('Must-do');
  await expect(tidy).toContainText('1 more this week');

  await tidy.getByRole('button', { name: 'Tidy desk' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Tidy desk' });
  await expect(sheet.getByRole('button', { name: 'Ask to drop' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Drop it' })).toHaveCount(0);
});

test('seven times makes exactly seven cards, even when Add is pressed twice', async ({ page }) => {
  await openParent(page, '/parent/plan');
  const form = await fillMustDo(page, 'Feed the fish', 'Home & Helping', '5', '7');
  // Two presses in the same tick: before React can re-render the button as busy.
  await form.getByRole('button', { name: 'Add', exact: true }).evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect(form).toHaveCount(0);
  await expect(row(page, 'Feed the fish')).toContainText('7 times');
  await expect(row(page, 'Feed the fish')).toContainText('0 placed, 7 to place');

  await toBoard(page);
  await expect(card(page, STACK, 'Feed the fish')).toContainText('6 more this week');
});

test('the title can come from the Library, and a bad form is not sent', async ({ page }) => {
  await openParent(page, '/parent/plan');
  await page.getByRole('button', { name: 'Add a must-do' }).click();
  const form = page.getByRole('dialog', { name: 'Add a must-do' });
  await form.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(form.getByText('Give it a short title.')).toBeVisible();
  await expect(form.getByLabel('Title')).toBeFocused();

  await form.getByRole('button', { name: 'Pick from the Library' }).click();
  await expect(form.getByRole('button', { name: 'Back to the must-do' })).toBeFocused();
  await form.getByRole('button', { name: 'Back to the must-do' }).click();
  await expect(form.getByRole('button', { name: 'Pick from the Library' })).toBeFocused();
  await form.getByRole('button', { name: 'Pick from the Library' }).click();
  const pick = form.getByRole('button', { name: /^Pick / }).first();
  const name = (await pick.getAttribute('aria-label'))!.slice('Pick '.length);
  await pick.click();
  await expect(form.getByLabel('Title')).toHaveValue(name);
  await expect(form.getByLabel('Title')).toBeFocused();
  await form.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(row(page, name)).toContainText('once');
});

test('remove one, then all that are still open', async ({ page }) => {
  await openParent(page, '/parent/plan');
  await row(page, 'Read for fun').getByRole('button').click();
  const sheet = page.getByRole('dialog', { name: 'Read for fun' });
  await sheet.getByRole('button', { name: 'Remove one' }).click();
  await expect(row(page, 'Read for fun')).toContainText('6 times');
  await expect(sheet).toContainText('6 times');

  await expect(sheet.getByRole('button', { name: 'Remove one' })).toBeFocused();

  await sheet.getByRole('button', { name: 'Remove all that are still open' }).click();
  await expect(sheet.getByRole('button', { name: 'Remove them' })).toBeFocused();
  await sheet.getByRole('button', { name: 'Remove them' }).click();
  await expect(row(page, 'Read for fun')).toHaveCount(0);
  await expect(sheet).toHaveCount(0);
});

test('days off: Thursday through Rest to Away, and his week shows it', async ({ page }) => {
  await openParent(page, '/parent/plan');
  await page.getByRole('button', { name: 'Thursday: no mark' }).click();
  await expect(page.getByRole('button', { name: 'Thursday: Rest day' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Thursday: Away' })).toBeFocused();

  await toBoard(page);
  await page.goto('/week');
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 21' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Thursday, December 24' })).toContainText('Away');
});

test('a note for today replaces the one he sees', async ({ page }) => {
  await openParent(page, '/parent/plan');
  const note = page.getByLabel('Note for today');
  await expect(note).toHaveValue('Proud of how you planned yesterday.');
  await page.getByRole('button', { name: 'Tomorrow' }).click();
  await expect(page.getByLabel('Note for tomorrow')).toHaveValue('');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await note.fill('Have fun at D&D');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved. He will see it today.')).toBeVisible();

  await toBoard(page);
  await expect(page.getByText('Have fun at D&D')).toBeVisible();
  await expect(page.getByText('Proud of how you planned yesterday.')).toHaveCount(0);
});
