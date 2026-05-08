import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    // E2E build uses the deterministic MSAL stub from
    // src/auth/msalInstance.e2eStub.ts. Dummy MSAL config values are
    // required so the bundle compiles; the stub does not consume them.
    env: {
      MSAL_E2E_STUB: 'true',
      MSAL_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
      MSAL_AUTHORITY: 'https://login.microsoftonline.com/test',
      MSAL_API_SCOPE: 'api://test/access',
      API_BASE_URL: 'http://localhost:9999',
      INDEXER_REMOTE_URL: 'http://localhost:9998',
    },
  },
});
