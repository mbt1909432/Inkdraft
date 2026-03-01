# Documents List - Document Management

![](../screenshot-documents.png)

The documents list page is the entry point for managing all your documents, with folder organization, search, batch operations, and more.

## Sidebar Features

### Create Document
Click **+ New Document** to create:
- **Blank Document** - Start from scratch
- **From Template** - Use preset templates
- **Import Markdown** - Upload .md files

### Create Folder
Click the folder icon to create folders for organizing documents.

### Document List
- Shows all documents, sorted by update time
- Pinned documents appear at top with 📌 icon
- Click document name to open editor

### Folder Navigation
- Click folder to filter documents in that folder
- Click "All Documents" to show everything
- Supports nested folder structure

## Document Operations

Each document has a **⋯** menu with these options:

| Action | Description |
|--------|-------------|
| **Rename** | Change document title |
| **Pin/Unpin** | Pin document to top of list |
| **Delete** | Move to trash |

### Batch Operations
1. Click **Select** button to enter batch mode
2. Check multiple documents
3. Click **Delete Selected** to batch delete

## Search & Filter

### Quick Search
Type keywords in search box to filter documents in real-time.

### Filter Options
- **All** - Show all documents
- **Recent** - Sort by update time
- **Pinned** - Show only pinned documents

## Import Feature

### Import Markdown Files
1. Click **New Document** → **Import Markdown**
2. Select local .md or .markdown file
3. Content is automatically imported as new document

### Code Block Processing
During import, code blocks are automatically processed:
- Code blocks without language get `markdown` identifier
- Original syntax highlighting is preserved

## Responsive Design

### Desktop
- Sidebar always visible
- Drag to resize width
- Document list and editor side by side

### Mobile
- Sidebar as drawer
- Tap menu icon to open
- Tap document to jump to editor
