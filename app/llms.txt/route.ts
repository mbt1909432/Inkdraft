import { NextResponse } from 'next/server';

export async function GET() {
  const llmsTxt = `# Inkdraft API Documentation

> External API for programmatic document access. Supports Markdown file upload, CRUD operations, and API key authentication.

## Base URL

\`\`\`
https://inkdraft.app
\`\`\`

## Authentication

All API requests require an API key. Include it in the request header:

\`\`\`
Authorization: Bearer sk_your_api_key_here

# Alternative format
X-API-Key: sk_your_api_key_here
\`\`\`

Create and manage API keys at: https://inkdraft.app/settings

## API Endpoints

### POST /api/external/documents

Upload a new document.

**JSON Body:**
\`\`\`json
{
  "title": "Document Title",
  "content": "# Markdown content here",
  "folder_id": "optional-folder-uuid"
}
\`\`\`

**File Upload (multipart/form-data):**
\`\`\`
file: document.md (required)
title: Optional Title
folder_id: optional-folder-uuid
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "Document Title",
    "created_at": "2026-02-28T10:00:00Z",
    "updated_at": "2026-02-28T10:00:00Z"
  }
}
\`\`\`

### GET /api/external/documents

List documents.

**Query Parameters:**
- \`limit\` - Max results (default: 50, max: 100)
- \`folder_id\` - Filter by folder UUID

**Response:**
\`\`\`json
{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "title": "Document Title",
      "parent_folder_id": "folder-uuid",
      "created_at": "2026-02-28T10:00:00Z",
      "updated_at": "2026-02-28T10:00:00Z"
    }
  ]
}
\`\`\`

### GET /api/external/documents/:id

Get a single document with full content.

**Response:**
\`\`\`json
{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "Document Title",
    "content": "# Full markdown content...",
    "parent_folder_id": "folder-uuid",
    "created_at": "2026-02-28T10:00:00Z",
    "updated_at": "2026-02-28T10:00:00Z"
  }
}
\`\`\`

### PUT /api/external/documents/:id

Update a document.

**JSON Body:**
\`\`\`json
{
  "title": "Updated Title",
  "content": "# Updated content"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "Updated Title",
    "updated_at": "2026-02-28T12:00:00Z"
  }
}
\`\`\`

### DELETE /api/external/documents/:id

Delete a document.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Document deleted"
}
\`\`\`

## Error Responses

\`\`\`json
// 401 Unauthorized
{ "error": "Invalid or missing API key" }
{ "error": "API key has expired" }

// 404 Not Found
{ "error": "Document not found" }

// 400 Bad Request
{ "error": "Content is required" }
{ "error": "Content too large (max 10MB)" }

// 500 Internal Server Error
{ "error": "Internal server error" }
\`\`\`

## Limits

- Maximum 10 API keys per user
- Maximum document size: 10MB
- Maximum 100 documents per list request
- Supports .md file upload

## API Key Expiration

API keys can have expiration times:
- Never expires
- 30 days
- 90 days
- 180 days
- 1 year

Expired keys return 401 error.

## Code Examples

### cURL - Upload JSON
\`\`\`bash
curl -X POST https://inkdraft.app/api/external/documents \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "My Doc", "content": "# Hello World"}'
\`\`\`

### cURL - Upload Markdown File
\`\`\`bash
curl -X POST https://inkdraft.app/api/external/documents \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -F "file=@document.md" \\
  -F "title=My Document"
\`\`\`

### cURL - Get Document
\`\`\`bash
curl -X GET "https://inkdraft.app/api/external/documents/DOC_UUID" \\
  -H "Authorization: Bearer sk_your_api_key"
\`\`\`

### cURL - Update Document
\`\`\`bash
curl -X PUT "https://inkdraft.app/api/external/documents/DOC_UUID" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Updated", "content": "# New content"}'
\`\`\`

### cURL - Delete Document
\`\`\`bash
curl -X DELETE "https://inkdraft.app/api/external/documents/DOC_UUID" \\
  -H "Authorization: Bearer sk_your_api_key"
\`\`\`

## JavaScript Example

\`\`\`javascript
const API_KEY = 'sk_your_api_key';
const BASE_URL = 'https://inkdraft.app/api/external/documents';

// Upload document
const response = await fetch(BASE_URL, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'My Document',
    content: '# Hello World\\n\\nThis is my content.',
  }),
});

const data = await response.json();
console.log(data.document.id);
\`\`\`
`;

  return new NextResponse(llmsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
