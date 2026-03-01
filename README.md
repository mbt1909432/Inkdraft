# Inkdraft

A modern Markdown editor with AI-powered writing assistance.

[中文文档](README.zh.md) | English

![](docs/screenshot-editor.png)

## Features

### Rich Markdown Editing

- **Dual Mode Editing** - Switch seamlessly between rich text (WYSIWYG) and source code mode
- **Live Outline** - Auto-generated document table of contents with click-to-navigate
- **Smart Formatting** - Toolbar for quick text formatting (bold, italic, underline, strikethrough, code, headings)
- **Selection Toolbar** - Context-aware toolbar appears when text is selected for quick formatting or AI actions
- **Code Blocks** - Syntax highlighting for multiple programming languages
- **Tables & Lists** - Full support for tables, ordered and unordered lists
- **Auto Save** - Automatic cloud sync every 30 seconds with manual Ctrl+S support
- **Sync Status** - Visual indicator showing cloud sync state (synced, syncing, offline)

### AI Writing Assistant

- **AI Chat Panel** - Dedicated chat interface for writing assistance
  - Ask questions about your document
  - Get writing suggestions and improvements
  - Multi-turn conversations with context memory
- **AI Draft Generation** - Generate complete document drafts from title and instructions
- **Text Selection Actions** - Select any text and:
  - **Polish** - Improve writing style and clarity
  - **Expand** - Add more detail and elaboration
  - **Condense** - Summarize and shorten
  - **Fix Grammar** - Correct grammar and spelling errors
  - **Custom** - Provide your own instruction
- **Context Memory** - AI remembers previous conversations for coherent assistance
- **Token Counter** - Shows estimated token usage for context-aware interactions

### Document Management

- **Folder Organization** - Create folders to organize documents
- **Document Pinning** - Pin important documents to the top
- **Quick Rename** - Rename documents directly from the sidebar
- **Batch Operations** - Select multiple documents for batch delete
- **Search & Filter** - Quickly find documents by title
- **Import Markdown** - Import existing .md files with automatic format detection

### Export Options

- **Copy Markdown** - One-click copy entire document to clipboard
- **Download as .md** - Export as Markdown file
- **Export to Word** - Generate .docx file with proper formatting
- **Export to PDF** - Create PDF with preserved styling

### User Experience

- **Responsive Design** - Fully functional on desktop and mobile devices
- **Dark/Light Theme** - Auto-follow system preference or manual toggle
- **Multi-language** - Interface available in English and Chinese
- **Resizable Panels** - Drag to resize sidebar, outline, and chat panels
- **Keyboard Shortcuts** - Ctrl+S to save, standard editing shortcuts

### External API

- **RESTful API** - Full CRUD operations via HTTP endpoints
- **API Key Authentication** - Secure access with configurable key expiration
- **llms.txt** - LLM-friendly API documentation at `/llms.txt`

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router) |
| UI Components | shadcn/ui + Tailwind CSS |
| Editor | MDXEditor + CodeMirror |
| State Management | Zustand |
| Backend | Supabase (Auth + Database + Realtime) |
| AI Integration | OpenAI / Anthropic / Google Gemini |

## Quick Start

### Requirements

- Node.js 18+
- npm / yarn / pnpm
- Supabase account

### Installation

1. Clone the repository

```bash
git clone https://github.com/mbt1909432/Inkdraft.git
cd Inkdraft
```

2. Install dependencies

```bash
npm install
```

3. Configure environment variables

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

4. Start development server

```bash
npm run dev
```

Visit http://localhost:3000

## Available Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## E2E Testing

Tests use Playwright on port 3005:

```bash
npm run dev -- -p 3005    # Start dev server on port 3005
npx playwright test       # Run E2E tests
```

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── document/[id]/      # Document editor page
│   ├── documents/          # Document list page
│   ├── settings/           # Settings page
│   ├── api/                # API routes
│   │   ├── external/       # External API endpoints
│   │   ├── ai/             # AI-related endpoints
│   │   └── draft/          # Draft generation
│   └── llms.txt/           # LLM-friendly API docs
├── components/
│   ├── editor/             # Editor components
│   │   ├── MarkdownEditor  # Main editor wrapper
│   │   ├── EditorToolbar   # Desktop toolbar
│   │   ├── MobileToolbar   # Mobile toolbar
│   │   ├── SelectionToolbar# Text selection actions
│   │   └── DraftModal      # AI draft dialog
│   ├── chat/               # AI chat components
│   │   ├── ChatPanel       # Main chat interface
│   │   └── MobileChat      # Mobile chat dialog
│   ├── sidebar/            # Sidebar components
│   │   ├── Sidebar         # Desktop sidebar
│   │   ├── MobileSidebar   # Mobile sidebar
│   │   └── OutlineView     # Document outline
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Custom React hooks
├── lib/
│   ├── store/              # Zustand state management
│   ├── supabase/           # Supabase client configs
│   ├── export/             # Export utilities
│   └── editor/             # Editor utilities
├── contexts/               # React contexts
│   └── LocaleContext       # i18n provider
└── public/                 # Static assets
```

## API Documentation

Access the LLM-friendly API documentation at `/llms.txt` which includes:

- Authentication via API Key
- Document CRUD endpoints:
  - `GET /api/external/documents` - List all documents
  - `POST /api/external/documents` - Create document
  - `GET /api/external/documents/[id]` - Get single document
  - `PUT /api/external/documents/[id]` - Update document
  - `DELETE /api/external/documents/[id]` - Delete document

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
