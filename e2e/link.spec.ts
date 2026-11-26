// Ticket T03: a browser that is not linked yet shows a pairing code.
import { expect, test } from '@playwright/test';
import { openDemoUnlinked } from './helpers.ts';

const CODE = /^[A-Z2-9]{3}-[A-Z2-9]{3}$/;

test('an unlinked device shows "Link this device" and a code', async ({ page }) => {
  await openDemoUnlinked(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Link this device' })).toBeVisible();
  await expect(page.getByTestId('pair-code')).toHaveText(CODE);
});

test('"New code" shows a different code', async ({ page }) => {
  await openDemoUnlinked(page);
  const shown = page.getByTestId('pair-code');
  await expect(shown).toHaveText(CODE);
  const first = await shown.textContent();
  await page.getByRole('button', { name: 'New code' }).click();
  await expect(shown).toHaveText(CODE);
  await expect(shown).not.toHaveText(first ?? '');
});
