# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js + Supabase starter kit with cookie-based authentication. It uses the App Router, Tailwind CSS, and shadcn/ui components.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## E2E Testing

Playwright tests use port **3005** to avoid conflicts with other development servers.

### Test Environment Setup

Create `.env.test` with test credentials:
```bash
TEST_USER_EMAIL=your-test-email@example.com
TEST_USER_PASSWORD=your-test-password
```

### Running Tests

```bash
npm run dev -- -p 3005    # Start dev server on port 3005 for testing
npx playwright test       # Run E2E tests (requires server on port 3005)
```

**Important**: Always run tests on port 3005, not 3000.

See `tests/README.md` for detailed test documentation.

### Test Structure

```
tests/
├── api/           # API endpoint tests
├── e2e/           # End-to-end UI tests
├── ui/            # UI component tests
├── fixtures/      # Test fixtures (users, documents)
├── pages/         # Page Object Models
├── scripts/       # Manual test scripts
└── auth.setup.ts  # Authentication setup
```

### Page Objects

Use Page Objects for stable, maintainable tests:

```typescript
import { ChatPanel, DocumentPage } from '@/tests/pages';

const documentPage = new DocumentPage(page);
const chatPanel = new ChatPanel(page);

await documentPage.goto(documentId);
await chatPanel.sendAndWaitForResponse('Hello AI');
```

### Test IDs

Key components have `data-testid` attributes:
- `chat-panel`, `chat-input`, `chat-send-button`
- `image-upload-input`, `image-upload-button`

## Environment Setup

Copy `.env.example` to `.env.local` and configure:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/publishable key

## Architecture

### Supabase Client Pattern

Three distinct clients exist for different contexts. **Never reuse clients across contexts**:

1. **Browser Client** (`lib/supabase/client.ts`) - For Client Components
   ```tsx
   import { createClient } from "@/lib/supabase/client";
   const supabase = createClient();
   ```

2. **Server Client** (`lib/supabase/server.ts`) - For Server Components, Route Handlers, Server Actions
   ```tsx
   import { createClient } from "@/lib/supabase/server";
   const supabase = await createClient();
   ```

3. **Proxy/Middleware** (`lib/supabase/proxy.ts`) - Used by `proxy.ts` for session refresh and auth protection

### Route Structure

- `/` - Public landing page
- `/auth/*` - Authentication flows (login, sign-up, password reset)
- `/protected/*` - Auth-protected routes with shared layout

### Authentication Flow

- The `proxy.ts` middleware runs on all routes except static assets
- Unauthenticated users accessing protected routes are redirected to `/auth/login`
- Session cookies are automatically refreshed by the proxy

### UI Components

- shadcn/ui components in `components/ui/`
- Use `cn()` from `lib/utils` for conditional class merging
- Theme switching via `next-themes` (ThemeProvider in root layout)

### MDXEditor Styling Notes

**Important**: This project does NOT use `@tailwindcss/typography` plugin. The `.prose` class in `globals.css` only defines color variables, not actual typography styles.

When modifying MDXEditor styles:

1. **Heading sizes must be explicit**: Add font-size rules for h1-h6 in `.markdown-editor-wrapper .prose` with `!important` to override MDXEditor defaults
2. **Dropdown menus use Radix UI portals**: BlockTypeSelect and other dropdowns render at `<body>` level via portals, not inside `.markdown-editor-wrapper`. Use global selectors like `[data-radix-select-content]` in `globals.css`, not nested selectors
3. **CSS specificity**: MDXEditor has internal styles that may override yours. Always use `!important` for critical overrides in the editor wrapper
4. **Key CSS selectors for dropdowns**:
   - `[data-radix-popper-content-wrapper]` - Portal container
   - `[data-radix-select-content]` - Dropdown content
   - `[data-radix-select-item]` - Dropdown items
   - `[data-radix-select-trigger]` - Trigger button

## Development Guidelines

### Internationalization (i18n)

This project supports Chinese (zh) and English (en). When adding new UI text:

1. **Always add translations to both locale files**:
   - `locales/zh.json` - Chinese translations
   - `locales/en.json` - English translations

2. **Use the translation hook in components**:
   ```tsx
   import { useTranslations } from '@/contexts/LocaleContext';
   const t = useTranslations();
   // Usage: t('namespace.key')
   ```

3. **Translation key structure**:
   ```json
   {
     "namespace": {
       "key": "value",
       "nested": {
           "deepKey": "value"
         }
       }
     }
   }
   ```

4. **For interpolation, use string replace**:
   ```tsx
   // In translation file: "message": "Hello {name}"
   t('message').replace('{name}', userName)
   ```

### Adding New Features Checklist

When implementing a new feature, remember to:

- [ ] Add translations to `locales/zh.json` and `locales/en.json`
- [ ] Update E2E tests if UI changes significantly
- [ ] Consider both desktop and mobile responsiveness
- [ ] Use existing components from `components/ui/` when possible
- [ ] Follow the existing code patterns in the codebase

### PDF Processing

PDF parsing is done client-side using `pdfjs-dist`:

- Worker file: `public/pdf.worker.min.mjs` (must be served from same origin)
- Parser: `lib/pdf/parser.ts` - uses dynamic import to avoid SSR issues
- Supports text extraction (markdown output) and image rendering (for scanned PDFs)

### AI Chat Context

When users upload files (PDF, images) in chat:

- Uploaded file content is labeled as `[用户上传的文件: filename]` to distinguish from current document
- AI is instructed via system prompt to NOT search for `after_string`/`old_string` in uploaded content
- Text-based PDFs: content extracted and included in message
- Image-based PDFs: pages converted to images for vision analysis

### OpenAI SDK Streaming + Tools Bug

**IMPORTANT**: When using OpenAI SDK with `stream: true` AND `tools` together, **DO NOT pass `max_tokens` parameter**.

```typescript
// ❌ WRONG - will cause "max_output_tokens: 0" error with some API providers
const stream = await client.chat.completions.create({
  model,
  messages,
  max_tokens: 30000,  // This causes the bug!
  tools,
  stream: true,
});

// ✅ CORRECT - omit max_tokens when streaming with tools
const stream = await client.chat.completions.create({
  model,
  messages,
  // max_tokens removed
  tools,
  stream: true,
});
```

**Root cause**: OpenAI SDK (v5/v6) has a compatibility issue with some API providers (like openai-next.com). When `stream: true` + `tools` + `max_tokens` are all present, the SDK or provider internally sets `max_output_tokens` to 0, causing the error:

```
400 Invalid 'max_output_tokens': integer below minimum value. Expected a value >= 16, but got 0 instead.
```

**Affected file**: `app/api/ai/chat-acontext/route.ts`

**Test scripts for debugging**:
- `test-llm.mjs` - Basic LLM connectivity test (non-streaming)
- `test-stream.mjs` - Streaming test without tools
- `test-stream-tools.mjs` - Streaming test with tools (reproduces the bug)
- `test-sdk-methods.mjs` - Tests different SDK methods
