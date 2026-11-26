// Ticket T12: his screens pass the automated accessibility check (WCAG 2 A and AA,
// serious and critical findings), in the light and the dark theme, with the card sheet
// and the "How did it go?" dialog open as well. Also: page titles, one h1, the skip link.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { card, openBoard, openDemo, openDemoUnlinked } from './helpers.ts';

async function expectNoSeriousFindings(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  // A readable summary when it fails: rule, impact and the first few elements.
  const summary = serious.map((v) => `${where}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary).toEqual([]);
}

async function setTheme(page: Page, theme: 'Light' | 'Dark') {
  await page.getByRole('button', { name: /^Anush/ }).click();
  const sheet = page.getByRole('dialog', { name: 'My profile' });
  await sheet.getByRole('button', { name: theme, exact: true }).click();
  await expect(sheet.getByRole('button', { name: theme, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase());
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
}

async function checkHisScreens(page: Page, theme: string) {
  await expectNoSeriousFindings(page, `${theme} Today`);

  // The card sheet, then the "How did it go?" dialog, while open.
  await card(page, 'Today', 'micro:bit: first programs').getByRole('button', { name: 'micro:bit: first programs' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expectNoSeriousFindings(page, `${theme} card sheet`);
  await sheet.getByRole('button', { name: 'How did it go?' }).click();
  const resolve = page.getByRole('dialog', { name: 'How did it go?' });
  await expect(resolve).toBeVisible();
  await resolve.getByRole('button', { name: '50%', exact: true }).click();
  await expectNoSeriousFindings(page, `${theme} resolve dialog`);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The profile sheet.
  await page.getByRole('button', { name: /^Anush/ }).click();
  await expect(page.getByRole('dialog', { name: 'My profile' })).toBeVisible();
  await expectNoSeriousFindings(page, `${theme} profile`);
  await page.keyboard.press('Escape');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Week' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 21' })).toBeVisible();
  await expectNoSeriousFindings(page, `${theme} Week`);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Month' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'December 2026' })).toBeVisible();
  await expectNoSeriousFindings(page, `${theme} Month`);
}

test('his screens and sheets have no serious accessibility findings (light)', async ({ page }) => {
  await openBoard(page);
  await checkHisScreens(page, 'light');
});

test('his screens and sheets have no serious accessibility findings (dark)', async ({ page }) => {
  await openBoard(page);
  await setTheme(page, 'Dark');
  await checkHisScreens(page, 'dark');
});

test('the PIN pad, Link this device and Page not found have no serious findings', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Anush' })).toBeVisible();
  await expectNoSeriousFindings(page, 'PIN pad');
  await expect(page).toHaveTitle('Unlock · Questboard');

  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expectNoSeriousFindings(page, 'not found');
});

test('Link this device has no serious findings', async ({ page }) => {
  await openDemoUnlinked(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Link this device' })).toBeVisible();
  await expectNoSeriousFindings(page, 'Link');
  await expect(page).toHaveTitle('Link this device · Questboard');
});

test('each of his screens has one h1 and a title that follows the screen', async ({ page }) => {
  await openBoard(page);
  for (const [path, title] of [['/', 'Today'], ['/week', 'Week'], ['/month', 'Month']] as const) {
    if (path !== '/') await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: title }).click();
    await expect(page).toHaveTitle(`${title} · Questboard`);
    await expect(page.locator('h1')).toHaveCount(1);
  }
});

/** Presses Tab (keyboard only) until `target` has focus. */
async function tabTo(page: Page, target: Locator, max = 300) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Tab never reached the control');
}

test('by keyboard only: resolve a card, then add from the Library', async ({ page }) => {
  await openBoard(page);
  const title = card(page, 'Today', 'micro:bit: first programs').getByRole('button', { name: 'micro:bit: first programs' });
  await tabTo(page, title);
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'micro:bit: first programs' });
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(title).toBeFocused();

  await page.keyboard.press('Enter');
  await tabTo(page, sheet.getByRole('button', { name: 'How did it go?' }));
  await page.keyboard.press('Enter');
  const resolve = page.getByRole('dialog', { name: 'How did it go?' });
  await tabTo(page, resolve.getByRole('button', { name: '100%', exact: true }));
  await page.keyboard.press('Space');
  await tabTo(page, resolve.getByRole('button', { name: 'Save' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card(page, 'Today', 'micro:bit: first programs')).toHaveAttribute('data-status', 'resolved');

  await tabTo(page, page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Week' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Week of December 21' })).toBeVisible();
  const add = page.getByRole('region', { name: 'Library' }).getByRole('button', { name: /^Add / }).first();
  await tabTo(page, add);
  await page.keyboard.press('Enter');
  await expect(page.getByText("Added to this week's stack")).toBeVisible();
});

test('Skip to content is the first stop and moves focus to the page', async ({ page }) => {
  await openBoard(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  // The next Tab lands inside the page, not back in the top bar.
  await page.keyboard.press('Tab');
  const inMain = await page.evaluate(() => document.querySelector('main')?.contains(document.activeElement) ?? false);
  expect(inMain).toBe(true);
});
