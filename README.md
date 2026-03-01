# Inkdraft

An **Agent-Controllable Markdown Editor** that enables seamless "document writing + code execution + data analysis" in one elegant interface.

[中文](README.zh.md) | English

## Screenshots

### Editor with AI Chat

![](docs/screenshot-editor-chat.png)

### Document List

![](docs/screenshot-documents.png)

### Mobile

![](docs/screenshot-mobile.png)

> 📖 **[View Full Documentation](docs/README.en.md)** - Detailed feature descriptions

## Why Inkdraft?

Traditional editors treat AI as a suggestion tool. Inkdraft goes further — **the AI Agent can directly modify your documents**, not just give advice.

### Agent Directly "Gets Hands Dirty"

The biggest differentiator: the application itself has an embedded Agent that can directly manipulate document content:

| Action | What Agent Can Do |
|--------|-------------------|
| **Create** | Add paragraphs, generate examples, auto-continue content |
| **Delete** | Remove redundant content, batch clean formatting issues |
| **Modify** | Polish copy, rewrite paragraphs, change writing style |
| **Query** | Quick retrieval, summarization, and comparison in long documents |

For users, this means writing and having the Agent **actually edit the document** in one place — no more copying text back and forth between windows.

### Built-in Acontext SDK: Write Docs + Run Code

The editor has built-in [Acontext SDK](https://github.com/mbt1909432/acontext), providing secure code execution sandbox capabilities. Users can:

- **Run Python code** for data processing and analysis
- **Write results back** to the current document (charts, tables, conclusions)
- **Generate reports with code** instead of manually moving results around

The entire process completes in one interface — no switching between local environments, Notebooks, and BI tools.

### From Traditional App to True Agent App

This application is no longer a traditional "App". By connecting to LLM's text and tool APIs, it has evolved into a genuine **Agent App**:

**Internal Agent:**
- Directly serves real users
- Handles document editing, data analysis, content generation
- Acts like a "collaborative partner embedded in the editor"

**External API Capability:**
- Exposes standard API interfaces
- Allows other Agents (Claude Code, OpenAI Agents, etc.) to connect as "callers"
- Third-party Agents can polish, generate content, and automatically write results back to the editor

## Core Features

### Rich Markdown Editing

- **Dual Mode Editing** - Switch seamlessly between rich text (WYSIWYG) and source code mode
- **Live Outline** - Auto-generated document table of contents with click-to-navigate
- **Smart Formatting** - Toolbar for quick text formatting (bold, italic, underline, strikethrough, code, headings)
- **Selection Toolbar** - Context-aware toolbar appears when text is selected for quick formatting or AI actions
- **Code Blocks** - Syntax highlighting for multiple programming languages
- **Tables & Lists** - Full support for tables, ordered and unordered lists
- **Auto Save** - Automatic cloud sync every 30 seconds with manual Ctrl+S support
- **Sync Status** - Visual indicator showing cloud sync state (synced, syncing, offline)

### AI Agent Capabilities

- **AI Chat Panel** - Dedicated chat interface with embedded Agent
  - Ask questions about your document
  - Get writing suggestions and improvements
  - Multi-turn conversations with context memory
- **Direct Document Manipulation** - Agent can add, delete, modify content directly
- **AI Draft Generation** - Generate complete document drafts from title and instructions
- **Text Selection Actions** - Select any text and:
  - **Polish** - Improve writing style and clarity
  - **Expand** - Add more detail and elaboration
  - **Condense** - Summarize and shorten
  - **Fix Grammar** - Correct grammar and spelling errors
  - **Custom** - Provide your own instruction
- **Context Memory** - Agent remembers previous conversations for coherent assistance
- **Code Execution** - Run Python code via Acontext SDK and insert results into documents

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

### External Agent API

Inkdraft exposes RESTful APIs for external Agents to connect:

- **Authentication** - API Key based with configurable expiration
- **Document CRUD** - Full Create, Read, Update, Delete operations
- **llms.txt** - LLM-friendly API documentation at `/llms.txt`

```bash
# Example: External Agent creating a document
curl -X POST https://your-instance/api/external/documents \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Doc", "content": "# Hello\n\nCreated by Agent"}'
```

### User Experience

- **Responsive Design** - Fully functional on desktop and mobile devices
- **Dark/Light Theme** - Auto-follow system preference or manual toggle
- **Multi-language** - Interface available in English and Chinese
- **Resizable Panels** - Drag to resize sidebar, outline, and chat panels
- **Keyboard Shortcuts** - Ctrl+S to save, standard editing shortcuts

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router) |
| UI Components | shadcn/ui + Tailwind CSS |
| Editor | MDXEditor + CodeMirror |
| State Management | Zustand |
| Backend | Supabase (Auth + Database + Realtime) |
| AI Integration | OpenAI / Anthropic / Google Gemini |
| Code Execution | Acontext SDK |

## Who Is This For?

Inkdraft is perfect for:

- **Technical Writers** - Teams frequently writing technical docs, product docs, solution docs
- **Data Analysts** - Those switching between "code → conclusions → reports"
- **Agent Developers** - Developers wanting to connect their Agent capabilities to a visual editor

If you're working on AI Agents, data analysis, or knowledge management tools, we hope Inkdraft provides some inspiration!

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
│   ├── settings/           # Settings page (API Keys)
│   ├── api/
│   │   ├── external/       # External Agent API endpoints
│   │   ├── ai/             # AI-related endpoints
│   │   └── draft/          # Draft generation
│   └── llms.txt/           # LLM-friendly API docs
├── components/
│   ├── editor/             # Editor components
│   ├── chat/               # AI chat + Agent interface
│   ├── sidebar/            # Sidebar components
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── store/              # Zustand state management
│   ├── supabase/           # Supabase clients
│   └── export/             # Export utilities
└── contexts/               # React contexts (i18n)
```

## API Documentation

Access the LLM-friendly API documentation at `/llms.txt`:

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
