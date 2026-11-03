import { defineConfig, devices } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// End-to-end tests: start the real FastAPI server (serving the built frontend) with the
// mock LLM and a throwaway database, then drive it in a real browser.
// Run: npm run build && npm run e2e
const PORT = 8123
const python = process.env.PYTHON ?? 'python'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `"${python}" -m uvicorn app.main:app --app-dir ../backend --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      IGNORE_DOTENV: '1', // never use a real key or database from .env
      LLM_MODE: 'mock',
      MOCK_DELAY_S: '0.2',
      DEMO_MODE: 'false',
      DATABASE_URL: `sqlite:///${join(tmpdir(), `interview-coach-e2e-${Date.now()}.db`).replace(/\\/g, '/')}`,
    },
  },
})
