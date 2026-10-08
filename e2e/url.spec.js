import {
  DEMO_DEVICE, PUBLIC_DRIVE, dashboard, dragZoom, drives, expect, openDemo, openFirstDrive, pathname, test, timeline,
} from './fixtures';

// What a URL shows, and what reloads and the browser's own history do to it.
// Everything runs against the /demo device, so no account is needed.

const close = (page) => page.getByRole('button', { name: 'Close' }).first().click();

test('/demo opens the demo device and its drives', async ({ page }) => {
  const { home, count } = await openDemo(page);
  expect(['/demo', `/${DEMO_DEVICE}`]).toContain(home);
  expect(count).toBeGreaterThan(0);
});

test('a drive opens at its own URL and survives a reload', async ({ page }) => {
  const { drive } = await openFirstDrive(page);
  expect(drive).toMatch(new RegExp(`^/${DEMO_DEVICE}/[^/]+$`));
  await page.reload();
  await expect(timeline(page)).toBeVisible();
  expect(pathname(page)).toBe(drive);
});

test('zooming writes the range to the URL and survives a reload', async ({ page }) => {
  await openFirstDrive(page);
  const zoomed = await dragZoom(page);
  await page.reload();
  await expect(timeline(page)).toBeVisible();
  expect(pathname(page)).toBe(zoomed);
});

test('Go Back zooms out to the whole drive', async ({ page }) => {
  const { drive } = await openFirstDrive(page);
  await dragZoom(page);
  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page).toHaveURL(drive);
  await expect(timeline(page)).toBeVisible();
});

test('browser back and forward walk dashboard, drive and zoom', async ({ page }) => {
  const { home, drive } = await openFirstDrive(page);
  const zoomed = await dragZoom(page);

  await page.goBack();
  await expect(page).toHaveURL(drive);
  await expect(timeline(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(home);
  await dashboard(page);

  await page.goForward();
  await expect(page).toHaveURL(drive);
  await expect(timeline(page)).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(zoomed);
});

test('closing a drive returns to the full drive list', async ({ page }) => {
  const { count } = await openFirstDrive(page);
  await close(page);
  await expect(timeline(page)).toBeHidden();
  await expect(drives(page)).toHaveCount(count);
});

// https://github.com/commaai/connect/issues/532: only the linked drive is listed
test('a drive opened from a link closes to the full drive list', async ({ page }) => {
  test.fail(true, '#532');
  const { count, drive } = await openFirstDrive(page);
  await page.goto(drive);
  await expect(timeline(page)).toBeVisible();
  await close(page);
  await expect(timeline(page)).toBeHidden();
  await expect(drives(page)).toHaveCount(count);
});

test('a public drive opens without signing in', async ({ page }) => {
  await page.goto(PUBLIC_DRIVE);
  await expect(timeline(page)).toBeVisible();
  expect(pathname(page)).toBe(PUBLIC_DRIVE);
});
