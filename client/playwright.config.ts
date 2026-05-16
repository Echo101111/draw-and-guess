import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  expect: { timeout: 15000 },
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
    bypassCSP: true,
    launchOptions: {
      args: ['--proxy-server=direct://', '--proxy-bypass-list=*'],
    },
  },
  webServer: [
    {
      command: 'pnpm --filter server dev',
      port: 3000,
      timeout: 10000,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm --filter client dev',
      port: 5173,
      timeout: 10000,
      reuseExistingServer: true,
      env: { VITE_SERVER_URL: 'http://localhost:3000' },
    },
  ],
})
