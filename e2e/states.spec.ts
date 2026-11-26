// Ticket T12: every screen has its empty and error states.
import { expect, test } from '@playwright/test';
import { openBoard, PIN, typePin } from './helpers.ts';

test('empty: eight weeks on, nothing is planned and every screen says what to do next', async ({ page }) => {
  await openBoard(page);
  await page.clock.setFixedTime(new Date('2027-02-15T18:06:00Z'));
  await page.reload();
  await typePin(page, PIN);
  await expect(page.getByRole('heading', { level: 1, name: 'Monday, February 15' })).toBeVisible();

  await expect(page.getByText('Nothing planned yet. Pick a card from your stack.')).toBeVisible();
  await expect(page.getByText('Your stack is empty. Add cards from the Library.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Week' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week of February 15' })).toBeVisible();
  for (const day of ['Monday, February 15', 'Tuesday, February 16', 'Wednesday, February 17', 'Thursday, February 18',
    'Friday, February 19', 'Saturday, February 20', 'Sunday, February 21']) {
    await expect(page.getByRole('region', { name: day })).toBeVisible();
  }
  await expect(page.getByTestId('error-panel')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Month' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'February 2027' })).toBeVisible();
  await expect(page.getByTestId('stat-finished')).toContainText('0');
  await expect(page.getByTestId('stat-partial')).toContainText('0');
  await expect(page.getByTestId('stat-missed')).toContainText('0');
  await expect(page.getByTestId('stat-time')).toContainText('0 min');
  await expect(page.getByTestId('error-panel')).toHaveCount(0);
});

test('error: the error panel says what happened and offers Try again', async ({ page }) => {
  await page.goto('/_error');
  const panel = page.getByTestId('error-panel');
  await expect(panel.getByRole('alert')).toHaveText('No connection. Check the internet and try again.');
  await expect(panel.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Try again' })).toBeEnabled();
});
