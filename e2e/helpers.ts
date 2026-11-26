// Shared steps for the browser tests. Every test runs in demo mode with the clock
// frozen, so the board always looks the same:
//
//   It is Monday, December 21, 2026, 10:06 AM in Los Angeles. Anush's PIN is 1234.
//   Today has five cards: "Math Academy lesson" (9:00, done), "Outline the winter
//   one-shot" (10:00, in progress), "micro:bit: first programs" (11:00), "Outside time"
//   (1:00 PM, must-do) and "Help cook dinner" (any time). The Catch-up tray holds
//   "Mr Math problem set" (30 min left). The campfire is at 2 days. The must-do
//   "Pack for the trip" is due Wednesday and has no day yet. This week's stack holds
//   13 cards: "Read for fun" x 7, "Music practice" x 4, "Plan the break together" and
//   "Pack for the trip" (all must-dos). The word of the day is "dilemma".
//
// That state is built by createDemoConnection() in src/api/demo.ts and is checked by
// tests/unit/demo.test.ts, so it is safe to rely on.
import { expect, type Page } from '@playwright/test';

export const NOW = '2026-12-21T18:06:00Z';
export const TODAY_HEADING = 'Monday, December 21';
export const PIN = '1234';

/** Opens the app in a fresh demo with the clock frozen. Call this instead of page.goto(). */
export async function openDemo(page: Page, path = '/'): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto(path);
}

/** Like openDemo(), but this browser is not linked yet: the app shows "Link this device". */
export async function openDemoUnlinked(page: Page, path = '/'): Promise<void> {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('qb-demo-state')) window.localStorage.setItem('qb-demo-start', 'unlinked');
  });
  await openDemo(page, path);
}

/** Types a PIN on the PIN pad. The pad submits by itself after the fourth digit. */
export async function typePin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) await page.getByRole('button', { name: digit, exact: true }).click();
}

/** From the PIN pad to his Today screen. */
export async function unlock(page: Page): Promise<void> {
  await typePin(page, PIN);
  await expect(page.getByRole('heading', { level: 1, name: TODAY_HEADING })).toBeVisible();
}

/** Opens the app, unlocks, and lands on Today. */
export async function openBoard(page: Page): Promise<void> {
  await openDemo(page);
  await unlock(page);
}

/** Opens the parent side in demo mode (no Google account needed there). */
export async function openParent(page: Page, path = '/parent'): Promise<void> {
  await openDemo(page, path);
  await page.getByRole('button', { name: 'Enter as demo parent' }).click();
  await expect(page.getByRole('navigation', { name: 'Parent' })).toBeVisible();
}

/** The card with this title inside a region of the page (for example the "Today" or "Catch-up tray" section). */
export function card(page: Page, region: string, title: string) {
  return page.getByRole('region', { name: region }).getByTestId('card').filter({ hasText: title });
}
