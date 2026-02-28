'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Book, Key, Upload, List, Code } from 'lucide-react';
import Link from 'next/link';

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Book className="h-6 w-6" />
              API Documentation
            </h1>
            <p className="text-muted-foreground">
              External API for programmatic document access
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Overview */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Key className="h-5 w-5" />
              Authentication
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <p className="text-sm">
                All API requests require authentication using an API key. You can create and manage
                API keys in the <Link href="/settings" className="text-primary underline">Settings</Link> page.
              </p>
              <p className="text-sm font-medium">Include your API key in the request header:</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`Authorization: Bearer sk_your_api_key_here

# Alternative format
X-API-Key: sk_your_api_key_here`}
              </pre>
            </div>
          </section>

          {/* Upload Document */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Document
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <code className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-sm">POST</code>
                <code className="text-sm">/api/external/documents</code>
              </div>

              <p className="text-sm font-medium">Option 1: JSON Body</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`curl -X POST https://your-domain.com/api/external/documents \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My Document",
    "content": "# Hello World\\n\\nThis is my document content.",
    "folder_id": "optional-folder-uuid"
  }'`}
              </pre>

              <p className="text-sm font-medium">Option 2: File Upload</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`curl -X POST https://your-domain.com/api/external/documents \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -F "file=@document.md" \\
  -F "title=Optional Title" \\
  -F "folder_id=optional-folder-uuid"`}
              </pre>

              <p className="text-sm font-medium">Response</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "My Document",
    "created_at": "2026-02-28T10:00:00Z",
    "updated_at": "2026-02-28T10:00:00Z"
  }
}`}
              </pre>
            </div>
          </section>

          {/* List Documents */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <List className="h-5 w-5" />
              List Documents
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <code className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-sm">GET</code>
                <code className="text-sm">/api/external/documents</code>
              </div>

              <p className="text-sm font-medium">Query Parameters</p>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li><code>limit</code> - Max results (default: 50, max: 100)</li>
                <li><code>folder_id</code> - Filter by folder UUID</li>
              </ul>

              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`curl -X GET "https://your-domain.com/api/external/documents?limit=10" \\
  -H "Authorization: Bearer sk_your_api_key"`}
              </pre>

              <p className="text-sm font-medium">Response</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "title": "Document Title",
      "folder_id": "folder-uuid",
      "created_at": "2026-02-28T10:00:00Z",
      "updated_at": "2026-02-28T10:00:00Z"
    }
  ]
}`}
              </pre>
            </div>
          </section>

          {/* Error Handling */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Code className="h-5 w-5" />
              Error Responses
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`// 401 Unauthorized
{ "error": "Invalid or missing API key..." }

// 400 Bad Request
{ "error": "Content is required" }
{ "error": "Content too large (max 10MB)" }

// 500 Internal Server Error
{ "error": "Internal server error" }`}
              </pre>
            </div>
          </section>

          {/* Limits */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Limits</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Maximum 10 API keys per user</li>
              <li>Maximum document size: 10MB</li>
              <li>Maximum 100 documents per list request</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
