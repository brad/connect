import { defineConfig, devices } from '@playwright/test';

// BASE_URL runs the suite against a deployed build, such as a PR preview.
// Without it, the suite builds the app and serves it locally.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60000,
  expect: { timeout: 20000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: 'bun run build:production && bun run serve --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
  },
});
