// Ticket T12: the parent screens pass the automated accessibility check (WCAG 2 A and AA,
// serious and critical findings) on a phone, with their sheets open as well. Parent
// screens are always light, so they are checked again after he picks the dark theme.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { card, openDemo, openParent, PIN, typePin, unlock } from './helpers.ts';

async function expectNoSeriousFindings(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = serious.map((v) => `${where}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary).toEqual([]);
}

function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Parent' }).getByRole('link', { name });
}

/** On his board: ask to drop "Outside time", so the parent has a card to open. */
async function askToDropOutsideTime(page: Page) {
  await page.goto('/');
  await unlock(page);
  await card(page, 'Today', 'Outside time').getByRole('button', { name: 'Outside time' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ask to drop' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ask a parent' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function checkParentScreens(page: Page, label: string) {
  await expect(page.getByRole('heading', { level: 1, name: "Anush's week" })).toBeVisible();
  await expect(page).toHaveTitle('Parents · Questboard');
  await expect(page.locator('h1')).toHaveCount(1);
  await expectNoSeriousFindings(page, `${label} This week`);

  // The card sheet for the drop request, and the "How did it go?" dialog from it.
  await page.getByRole('region', { name: 'Needs you' }).getByRole('button', { name: 'Outside time' }).click();
  const sheet = page.getByRole('dialog', { name: 'Outside time' });
  await expect(sheet).toBeVisible();
  await expectNoSeriousFindings(page, `${label} card sheet`);
  await sheet.getByRole('button', { name: 'How did it go?' }).click();
  const resolve = page.getByRole('dialog', { name: 'How did it go?' });
  await expect(resolve).toBeVisible();
  await resolve.getByRole('button', { name: '25%', exact: true }).click();
  await expectNoSeriousFindings(page, `${label} resolve dialog`);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await tab(page, 'Must-dos').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 21' })).toBeVisible();
  await expect(page).toHaveTitle('Must-dos · Questboard');
  await expect(page.locator('h1')).toHaveCount(1);
  await expectNoSeriousFindings(page, `${label} Must-dos`);
  await page.getByRole('button', { name: 'Add a must-do' }).click();
  await expect(page.getByRole('dialog', { name: 'Add a must-do' })).toBeVisible();
  await expectNoSeriousFindings(page, `${label} add a must-do`);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await tab(page, 'Settings').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page).toHaveTitle('Settings · Questboard');
  await expect(page.locator('h1')).toHaveCount(1);
  await expectNoSeriousFindings(page, `${label} Settings`);
}

test('the parent screens and sheets have no serious accessibility findings', async ({ page }) => {
  await openParent(page);
  await askToDropOutsideTime(page);
  await page.goto('/parent');
  await checkParentScreens(page, 'light');
});

test('they stay light and pass when his board is dark', async ({ page }) => {
  await openParent(page);
  await askToDropOutsideTime(page);
  await page.getByRole('button', { name: /^Anush/ }).click();
  await page.getByRole('dialog', { name: 'My profile' }).getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/parent');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await checkParentScreens(page, 'after dark');
});

test('the sign-in screen has no serious findings', async ({ page }) => {
  await openDemo(page, '/parent');
  await expect(page.getByRole('heading', { level: 1, name: 'Parents' })).toBeVisible();
  await expect(page).toHaveTitle('Parent sign-in · Questboard');
  await expectNoSeriousFindings(page, 'sign-in');
});

/** Presses Tab (keyboard only) until `target` has focus. */
async function tabTo(page: Page, target: Locator, max = 300) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Tab never reached the control');
}

test('by keyboard only: add a must-do', async ({ page }) => {
  await openParent(page, '/parent/plan');
  await tabTo(page, page.getByRole('button', { name: 'Add a must-do' }));
  await page.keyboard.press('Enter');
  const form = page.getByRole('dialog', { name: 'Add a must-do' });
  await tabTo(page, form.getByLabel('Title'));
  await page.keyboard.type('Tidy desk');
  await tabTo(page, form.getByLabel('Minutes'));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('10');
  await tabTo(page, form.getByRole('button', { name: 'Add', exact: true }));
  await page.keyboard.press('Enter');
  await expect(form).toHaveCount(0);
  await expect(page.getByText('Added. Anush will see it on his board.')).toBeVisible();
  await expect(page.getByTestId('mustdo-row').filter({ hasText: 'Tidy desk' })).toHaveCount(1);
});

test('by keyboard only: remove this browser, then link it again', async ({ page }) => {
  await openParent(page, '/parent/settings');
  const devices = page.getByRole('region', { name: 'Linked devices' });
  await tabTo(page, devices.getByRole('button', { name: 'Remove' }));
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('dialog', { name: 'Remove this device?' });
  await tabTo(page, confirm.getByRole('button', { name: 'Remove', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Device removed.')).toBeVisible();

  await page.goto('/');
  const shown = page.getByTestId('pair-code');
  await expect(shown).toHaveText(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  const code = (await shown.textContent())!.replace('-', '');

  await page.goto('/parent/settings');
  const panel = page.getByRole('region', { name: 'Link a new device' });
  await tabTo(page, panel.getByLabel('Code'));
  await page.keyboard.type(code);
  await tabTo(page, panel.getByRole('button', { name: 'Link' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Device linked.')).toBeVisible();
  await page.goto('/');
  await typePin(page, PIN);
  await expect(page.getByRole('heading', { level: 1, name: 'Monday, December 21' })).toBeVisible();
});

test('Skip to content is the first stop on the parent side', async ({ page }) => {
  await openParent(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
