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

```bash
npm run dev -- -p 3005    # Start dev server on port 3005 for testing
npx playwright test       # Run E2E tests (requires server on port 3005)
```

**Important**: Always run tests on port 3005, not 3000.

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
