// Ticket T11: the parent's Settings screen, on a phone.
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openParent, PIN, TODAY_HEADING, typePin, unlock } from './helpers.ts';

const SETTINGS = '/parent/settings';

function devices(page: Page) {
  return page.getByRole('region', { name: 'Linked devices' });
}

function linkPanel(page: Page) {
  return page.getByRole('region', { name: 'Link a new device' });
}

/** Removes "This browser" from the linked devices, confirming in the dialog. */
async function removeThisBrowser(page: Page) {
  await devices(page).getByTestId('device-row').filter({ hasText: 'This browser' })
    .getByRole('button', { name: 'Remove' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this device?' });
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Device removed.')).toBeVisible();
  await expect(devices(page).getByTestId('device-row')).toHaveCount(0);
}

/** On "/", reads the six-character code the Link screen shows. */
async function readPairCode(page: Page): Promise<string> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Link this device' })).toBeVisible();
  await expect(page.getByText('This device was removed.')).toBeVisible();
  const code = page.getByTestId('pair-code');
  await expect(code).toHaveText(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  return (await code.textContent())!.replace('-', '');
}

/** Back in Settings, links the device that shows this code. */
async function linkWithCode(page: Page, code: string, kind: 'His device' | 'Display only') {
  await page.goto(SETTINGS);
  const panel = linkPanel(page);
  await panel.getByLabel('Code').fill(code.toLowerCase());
  await expect(panel.getByLabel('Code')).toHaveValue(`${code.slice(0, 3)}-${code.slice(3)}`);
  await panel.getByRole('radio', { name: kind }).check();
  await panel.getByRole('button', { name: 'Link' }).click();
  await expect(page.getByText('Device linked.')).toBeVisible();
  await expect(panel.getByLabel('Code')).toHaveValue('');
  await expect(devices(page).getByTestId('device-row')).toHaveCount(1);
}

test('the screen: devices, PIN, parents, key, backup, family', async ({ page }) => {
  await openParent(page, SETTINGS);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByText('Signed in with Google as parent@demo.local')).toBeVisible();
  const row = devices(page).getByTestId('device-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('This browser');
  await expect(row).toContainText('His board, locked');
  await expect(page.getByRole('heading', { name: "Anush's PIN" })).toBeVisible();
  await expect(page.getByText('Set. Changing it locks all his devices.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Parents' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekly e-mail and Drive backup' })).toBeVisible();
  await expect(page.getByTestId('token-status')).toHaveText('No key yet');
  await expect(page.getByRole('heading', { name: 'Backup and moving' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Family' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset the demo' })).toBeVisible();
});

test('change the PIN: the old one stops working, the new one opens the board', async ({ page }) => {
  await openParent(page, SETTINGS);
  await page.getByRole('button', { name: 'Change' }).click();
  await page.getByLabel('New PIN (4 digits)').fill('4321');
  await page.getByLabel('Type it again').fill('4320');
  await page.getByRole('button', { name: 'Save PIN' }).click();
  await expect(page.getByText('The two PINs are not the same.')).toBeVisible();
  await page.getByLabel('Type it again').fill('4321');
  await page.getByRole('button', { name: 'Save PIN' }).click();
  await expect(page.getByText('PIN changed. His devices are locked.')).toBeVisible();
  await expect(page.getByLabel('New PIN (4 digits)')).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Anush' })).toBeVisible();
  await typePin(page, PIN);
  await expect(page.getByText(/That PIN did not match\./)).toBeVisible();
  await typePin(page, '4321');
  await expect(page.getByRole('heading', { level: 1, name: TODAY_HEADING })).toBeVisible();
});

test('remove this browser, then link it again as his device', async ({ page }) => {
  await openParent(page, SETTINGS);
  await removeThisBrowser(page);
  const code = await readPairCode(page);
  await linkWithCode(page, code, 'His device');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Anush' })).toBeVisible();
  await unlock(page);
});

test('link it as a display: display only', async ({ page }) => {
  await openParent(page, SETTINGS);
  await removeThisBrowser(page);
  const code = await readPairCode(page);
  await linkWithCode(page, code, 'Display only');
  await expect(devices(page).getByTestId('device-row'))
    .toContainText('Display only, no PIN, cannot change anything');
  await page.goto('/');
  await expect(page.getByText('This screen is display only.')).toBeVisible();
});

test('a wrong code keeps the form and says so', async ({ page }) => {
  await openParent(page, SETTINGS);
  const panel = linkPanel(page);
  await panel.getByLabel('Code').fill('AAAAAA');
  await panel.getByRole('button', { name: 'Link' }).click();
  await expect(panel.getByRole('alert')).toContainText('That code did not work.');
  await expect(panel.getByLabel('Code')).toHaveValue('AAA-AAA');
});

test('a new automation key is shown once', async ({ page }) => {
  await openParent(page, SETTINGS);
  await page.getByRole('button', { name: 'New key' }).click();
  await expect(page.getByTestId('token-value')).toHaveValue(/^[0-9a-f]{64}$/);
  await expect(page.getByTestId('token-status')).toHaveText('Key created');
  await expect(page.getByText('This replaces the old key. It is shown only once.')).toBeVisible();
  const first = await page.getByTestId('token-value').inputValue();

  // A second key asks first, and replaces the first.
  await page.getByRole('button', { name: 'New key' }).click();
  await page.getByRole('dialog', { name: 'Make a new key?' }).getByRole('button', { name: 'Make a new key' }).click();
  await expect(page.getByTestId('token-value')).not.toHaveValue(first);
  await expect(page.getByTestId('token-value')).toHaveValue(/^[0-9a-f]{64}$/);

  // Leaving the screen forgets it; it is never stored in the browser.
  const second = await page.getByTestId('token-value').inputValue();
  const stored = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
  expect(stored.includes(first)).toBe(false);
  expect(stored.includes(second)).toBe(false);
  await page.getByRole('link', { name: 'This week' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByTestId('token-status')).toHaveText('Key created');
  await expect(page.getByTestId('token-value')).toHaveCount(0);
});

test('download a backup and restore it', async ({ page }) => {
  await openParent(page, SETTINGS);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download a backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('questboard-backup-2026-12-21.json');
  const file = await download.path();
  const doc = JSON.parse(await readFile(file, 'utf8')) as { version: number; tables: { cards: unknown[] } };
  expect(doc.version).toBe(1);
  expect(doc.tables.cards.length).toBeGreaterThan(0);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Restore from a backup' }).click(),
  ]);
  await chooser.setFiles(file);
  const dialog = page.getByRole('dialog', { name: 'Restore from a backup' });
  await expect(dialog.getByTestId('backup-summary')).toContainText(`${doc.tables.cards.length} cards`);
  await expect(dialog.getByText('This replaces everything on the board.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Restore' })).toBeDisabled();
  await dialog.getByLabel('Type RESTORE to confirm').fill('RESTORE');
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Board restored.')).toBeVisible();
  await expect(devices(page).getByTestId('device-row')).toContainText('This browser');

  await page.goto('/');
  await unlock(page);
  await expect(page.getByRole('region', { name: 'Today', exact: true }).getByTestId('card')).toHaveCount(5);
});

test('a file that is not a backup changes nothing', async ({ page }) => {
  await openParent(page, SETTINGS);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Restore from a backup' }).click(),
  ]);
  await chooser.setFiles({ name: 'hello.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByText('That file is not a Questboard backup.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('family: a lower tray alert shows on This week', async ({ page }) => {
  await openParent(page, SETTINGS);
  const family = page.getByRole('region', { name: 'Family' });
  await expect(family.getByLabel('Family name')).toHaveValue('Demo family');
  await family.getByLabel('Day starts').fill('22:00');
  await family.getByRole('button', { name: 'Save' }).click();
  await expect(family.getByRole('alert')).toHaveText('The day has to start before it ends.');
  await family.getByLabel('Day starts').fill('08:00');

  await family.getByLabel('Alert me when the tray holds (cards)').fill('1');
  await family.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(family.getByLabel('Alert me when the tray holds (cards)')).toHaveValue('1');

  await page.getByRole('link', { name: 'This week' }).click();
  const tray = page.getByTestId('alert-tray');
  await expect(tray).toHaveText('Catch-up tray: 1 card, 30 min. You are alerted at 1 card.');
  await expect(tray).toHaveCSS('font-weight', '700');
  await expect(tray.locator('svg')).toHaveCount(1);
  await expect(page.getByText('Nothing needs you right now.')).toHaveCount(0);
});

test('parents: add an address; your own cannot be removed', async ({ page }) => {
  await openParent(page, SETTINGS);
  const parents = page.getByRole('region', { name: 'Parents' });
  await expect(parents).toContainText('1 Google account allowed');
  await parents.getByRole('button', { name: 'Edit' }).click();
  await expect(parents.getByRole('button', { name: 'Remove parent@demo.local' })).toHaveCount(0);
  await parents.getByLabel("Add a parent's Google address").fill('grandma example.com');
  await parents.getByRole('button', { name: 'Add' }).click();
  await expect(parents.getByRole('alert')).toBeVisible();
  await parents.getByLabel("Add a parent's Google address").fill('Grandma@Example.com');
  await parents.getByRole('button', { name: 'Add' }).click();
  await parents.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Parents saved.')).toBeVisible();
  const list = parents.getByRole('list', { name: 'Parent accounts' });
  await expect(list).toContainText('grandma@example.com');
  await expect(list).toContainText('Not signed in yet');
  await expect(parents).toContainText('2 Google accounts allowed');

  await parents.getByRole('button', { name: 'Edit' }).click();
  await expect(parents.getByRole('button', { name: 'Remove grandma@example.com' })).toBeVisible();
  await expect(parents.getByRole('button', { name: 'Remove parent@demo.local' })).toHaveCount(0);
});

test('reset the demo: back to the PIN pad and the starting board', async ({ page }) => {
  await openParent(page, SETTINGS);
  await removeThisBrowser(page);
  await page.getByRole('button', { name: 'Reset the demo' }).click();
  await page.getByRole('dialog', { name: 'Reset the demo?' }).getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible();
  await unlock(page);
  await expect(page.getByRole('region', { name: 'Today', exact: true }).getByTestId('card')).toHaveCount(5);
});
