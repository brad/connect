import { test as base, expect } from '@playwright/test';

export const DEMO_DEVICE = 'deadbeefdeadbeef';
export const PUBLIC_DRIVE = '/5beb9b58bd12b691/0000010a--a51155e496';

// Every test fails on an uncaught error in the page.
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    expect(errors).toEqual([]);
  },
});

export { expect };

export const pathname = (page) => new URL(page.url()).pathname;
export const drives = (page) => page.locator('.DriveEntry');
export const timeline = (page) => page.getByRole('slider', { name: 'Drive timeline' });

// The dashboard has loaded its drive list.
export async function dashboard(page) {
  await expect(drives(page).first()).toBeVisible();
  return drives(page).count();
}

// Open /demo and return where it lands: /demo itself or the demo device.
export async function openDemo(page) {
  await page.goto('/demo');
  const count = await dashboard(page);
  return { home: pathname(page), count };
}

export async function openFirstDrive(page) {
  const { home, count } = await openDemo(page);
  await drives(page).first().click();
  await expect(timeline(page)).toBeVisible();
  return { home, count, drive: pathname(page) };
}

// Drag across the middle of the timeline and wait for the zoomed URL.
export async function dragZoom(page) {
  const box = await timeline(page).boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, y, { steps: 5 });
  await page.mouse.up();
  await expect(page).toHaveURL(/^[^?#]*\/[0-9a-f]{16}\/[^/]+\/\d+\/\d+$/);
  return pathname(page);
}
