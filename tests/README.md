# Test Directory Structure

This directory contains all tests for the Inkdraft Markdown Editor project.

## Quick Start

```bash
# 1. Start dev server on port 3005
npm run dev -- -p 3005

# 2. Run tests
npx playwright test
```

## Environment Setup

Create a `.env.test` file in the project root with your test credentials:

```bash
# .env.test - Test user credentials for E2E tests
# Use your own Supabase test account credentials
TEST_USER_EMAIL=your-email@example.com
TEST_USER_PASSWORD=your-password
```

**Note**:
- Use your own Supabase account credentials for testing
- Tests use port **3005** to avoid conflicts with the default dev server
- Never commit real credentials to the repository

## Directory Structure

```
tests/
├── api/                    # API endpoint tests (Playwright)
│   ├── api-key.spec.ts     # API key authentication and CRUD operations
│   ├── disk-files.spec.ts  # Disk file operations (list, delete)
│   └── images.spec.ts      # Image upload and proxy tests
│
├── e2e/                    # End-to-end UI tests (Playwright)
│   ├── document-flow.spec.ts    # Document creation and editing flows
│   ├── image-export.spec.ts     # Image export functionality
│   ├── multimodal-chat.spec.ts  # Multimodal chat with images
│   ├── quiz.spec.ts             # AI quiz generation and evaluation
│   └── sandbox.spec.ts          # Acontext sandbox integration
│
├── fixtures/               # Test fixtures and utilities
│   └── test-fixtures.ts    # Common fixtures (testUser, testDocument)
│
├── pages/                  # Page Object Models
│   ├── LoginPage.ts        # Login page object
│   ├── DocumentPage.ts     # Document editor page object
│   ├── ChatPanel.ts        # Chat panel page object
│   └── index.ts            # Re-exports all page objects
│
├── scripts/                # Utility scripts for manual testing
│   ├── test-path.mjs       # Test Acontext artifact paths
│   ├── test-sandbox.mjs    # Test sandbox creation and commands
│   └── test-streaming.mjs  # Test streaming chat endpoint
│
├── ui/                     # UI component tests (Playwright)
│   ├── editor.spec.ts      # Editor UI components
│   └── export.spec.ts      # Export functionality
│
├── auth.setup.ts           # Authentication setup for Playwright
└── README.md               # This file
```

## Running Tests

### All Tests
```bash
# Start dev server first
npm run dev -- -p 3005

# Run all tests
npx playwright test
```

### Specific Test Categories
```bash
# API tests only
npx playwright test tests/api/

# E2E tests only
npx playwright test tests/e2e/

# UI tests only
npx playwright test tests/ui/

# Single test file
npx playwright test tests/e2e/multimodal-chat.spec.ts

# Run with headed browser (for debugging)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug
```

### Utility Scripts
```bash
# Test streaming endpoint (requires dev server running)
node tests/scripts/test-streaming.mjs

# Test sandbox functionality
node tests/scripts/test-sandbox.mjs

# Test Acontext paths
node tests/scripts/test-path.mjs
```

## Test Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Playwright config | `playwright.config.ts` | Main configuration file |
| Test port | **3005** | Avoids conflict with dev server (3000) |
| Auth state | `playwright/.auth/user.json` | Saved authentication state |
| Env file | `.env.test` | Test environment variables |

## Using Page Objects

```typescript
import { LoginPage, DocumentPage, ChatPanel } from '@/tests/pages';

test('chat with AI', async ({ page }) => {
  // Login
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password');

  // Navigate to document
  const documentPage = new DocumentPage(page);
  await documentPage.goto('doc-id');
  await documentPage.waitForEditor();

  // Use chat
  const chatPanel = new ChatPanel(page);
  await chatPanel.sendAndWaitForResponse('Hello AI');
});
```

## Using Test Fixtures

```typescript
import { test, expect } from '@/tests/fixtures/test-fixtures';

test('document operations', async ({ testUser, testDocument }) => {
  // testUser and testDocument are automatically provided
  console.log(testUser.email);        // From TEST_USER_EMAIL env
  console.log(testDocument.id);        // Auto-created and cleaned up
});
```

## Adding New Tests

1. **API tests**: Add to `tests/api/` for endpoint testing
2. **E2E tests**: Add to `tests/e2e/` for full user flow testing
3. **UI tests**: Add to `tests/ui/` for component testing
4. **Page Objects**: Add to `tests/pages/` for reusable UI interactions
5. **Fixtures**: Add to `tests/fixtures/` for shared test data

## Best Practices

- Use Page Objects for stable, maintainable selectors
- Use `data-testid` attributes for test selectors
- Clean up test data in `afterAll` hooks
- Use `waitForResponse` instead of `waitForTimeout`
- Keep tests independent - each test should run in isolation
