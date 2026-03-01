# Inkdraft Documentation

![](screenshot-editor-chat.png)

Inkdraft is an **Agent-Controllable Markdown Editor** that enables seamless "document writing + code execution + data analysis" in one elegant interface.

[中文文档](README.md) | English

## Core Features

### Agent Direct Document Control
In traditional editors, AI only gives suggestions. Inkdraft's Agent can **directly CRUD your documents** without copy-paste.

### Built-in Acontext SDK
Run Python code for data analysis right in the editor, with results written directly to the document.

### External Agent Integration
Standard RESTful API allows Claude Code, OpenAI Agents, and others to directly manipulate your documents.

---

## Feature Modules

### [📝 Editor](features/editor.en.md)
Dual-mode editing, live outline, smart formatting, auto-save and more.

![](screenshot-editor.png)

### [🤖 AI Assistant](features/ai-chat.en.md)
Chat with AI, let Agent directly modify documents, polish text, generate content.

![](screenshot-editor-chat.png)

### [📁 Documents List](features/documents-list.en.md)
Folder organization, search & filter, batch operations, import/export.

![](screenshot-documents.png)

### [📱 Mobile](features/mobile.en.md)
Deeply optimized for mobile, fully functional on small screens.

![](screenshot-mobile.png)

### [🔌 External API](features/external-api.en.md)
Standard RESTful API for external Agents to manipulate documents.

---

## Quick Start

### Install
```bash
git clone https://github.com/mbt1909432/Inkdraft.git
cd Inkdraft
npm install
```

### Configure
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-key
```

### Run
```bash
npm run dev
```

Visit http://localhost:3000

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 |
| Editor | MDXEditor + CodeMirror |
| UI | shadcn/ui + Tailwind CSS |
| Backend | Supabase |
| AI | OpenAI / Anthropic / Google Gemini |
| Code Execution | Acontext SDK |

---

## Who Is This For?

- **Technical Writers** - Writing technical docs, product docs frequently
- **Data Analysts** - Switching between "code → conclusions → reports"
- **Agent Developers** - Connecting Agent capabilities to visual editor

---

## Links

- [GitHub Repository](https://github.com/mbt1909432/Inkdraft)
- [Acontext SDK](https://github.com/mbt1909432/acontext)
- [Issue Tracker](https://github.com/mbt1909432/Inkdraft/issues)
