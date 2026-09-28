import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',
  use: { baseURL: 'http://127.0.0.1:5199', trace: 'retain-on-failure' },
  webServer: [
    {
      // dev server: most tests, and the in-browser module imports of src/dev/e2e-api.ts
      command: 'npx vite --host 127.0.0.1 --port 5199 --strictPort',
      url: 'http://127.0.0.1:5199',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
    {
      // production build: the offline / installed-app test needs the real service worker
      command: 'npx vite build && npx vite preview --host 127.0.0.1 --port 5198 --strictPort',
      url: 'http://127.0.0.1:5198',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
