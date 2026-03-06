import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables
// .env.local takes precedence (contains LLM config, API keys)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.test' });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Setup project - authenticate once
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Main tests - use saved auth state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev -- -p 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    // Pass environment variables to the dev server
    env: {
      // Explicitly pass LLM config to the dev server
      OPENAI_LLM_ENDPOINT: process.env.OPENAI_LLM_ENDPOINT || '',
      OPENAI_LLM_API_KEY: process.env.OPENAI_LLM_API_KEY || '',
      OPENAI_LLM_MODEL: process.env.OPENAI_LLM_MODEL || '',
      OPENAI_LLM_MAX_TOKENS: process.env.OPENAI_LLM_MAX_TOKENS || '',
      ACONTEXT_API_KEY: process.env.ACONTEXT_API_KEY || '',
    },
  },
});
