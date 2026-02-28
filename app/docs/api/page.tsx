'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Book, Key, Upload, List, Code, FileText, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations, useLocale } from '@/contexts/LocaleContext';

export default function ApiDocsPage() {
  const t = useTranslations();
  const { locale } = useLocale();

  const text = {
    title: locale === 'zh' ? 'API 文档' : 'API Documentation',
    subtitle: locale === 'zh' ? '外部 API 用于编程访问文档' : 'External API for programmatic document access',
    auth: locale === 'zh' ? '认证' : 'Authentication',
    authDesc: locale === 'zh'
      ? '所有 API 请求都需要使用 API 密钥进行认证。您可以在 设置 页面创建和管理 API 密钥。'
      : 'All API requests require authentication using an API key. You can create and manage API keys in the Settings page.',
    authHeader: locale === 'zh' ? '在请求头中包含您的 API 密钥：' : 'Include your API key in the request header:',
    uploadDoc: locale === 'zh' ? '上传文档' : 'Upload Document',
    jsonBody: locale === 'zh' ? '方式 1: JSON 请求体' : 'Option 1: JSON Body',
    fileUpload: locale === 'zh' ? '方式 2: 文件上传' : 'Option 2: File Upload',
    response: locale === 'zh' ? '响应' : 'Response',
    listDocs: locale === 'zh' ? '列出文档' : 'List Documents',
    queryParams: locale === 'zh' ? '查询参数' : 'Query Parameters',
    getDoc: locale === 'zh' ? '获取单个文档' : 'Get Document',
    updateDoc: locale === 'zh' ? '更新文档' : 'Update Document',
    deleteDoc: locale === 'zh' ? '删除文档' : 'Delete Document',
    errorResponses: locale === 'zh' ? '错误响应' : 'Error Responses',
    limits: locale === 'zh' ? '限制' : 'Limits',
    limitsList: locale === 'zh' ? [
      '每个用户最多 10 个 API 密钥',
      '最大文档大小: 10MB',
      '每次列表请求最多 100 个文档',
      '支持 .md 文件上传',
    ] : [
      'Maximum 10 API keys per user',
      'Maximum document size: 10MB',
      'Maximum 100 documents per list request',
      'Supports .md file upload',
    ],
    expiration: locale === 'zh' ? '过期时间' : 'Expiration',
    expirationDesc: locale === 'zh'
      ? 'API 密钥可以设置过期时间（30天、90天、180天、1年 或 永不过期）。过期的密钥将无法使用。'
      : 'API keys can have expiration times (30, 90, 180 days, 1 year, or never). Expired keys cannot be used.',
  };

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
              {text.title}
            </h1>
            <p className="text-muted-foreground">
              {text.subtitle}
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Overview */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Key className="h-5 w-5" />
              {text.auth}
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <p className="text-sm">
                {text.authDesc}
              </p>
              <p className="text-sm font-medium">{text.authHeader}</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`Authorization: Bearer sk_your_api_key_here

# Alternative format
X-API-Key: sk_your_api_key_here`}
              </pre>
              <p className="text-sm font-medium">{text.expiration}</p>
              <p className="text-sm text-muted-foreground">{text.expirationDesc}</p>
            </div>
          </section>

          {/* Upload Document */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {text.uploadDoc}
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <code className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-sm">POST</code>
                <code className="text-sm">/api/external/documents</code>
              </div>

              <p className="text-sm font-medium">{text.jsonBody}</p>
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

              <p className="text-sm font-medium">{text.fileUpload}</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`curl -X POST https://your-domain.com/api/external/documents \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -F "file=@document.md" \\
  -F "title=Optional Title" \\
  -F "folder_id=optional-folder-uuid"`}
              </pre>

              <p className="text-sm font-medium">{text.response}</p>
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
              {text.listDocs}
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <code className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-sm">GET</code>
                <code className="text-sm">/api/external/documents</code>
              </div>

              <p className="text-sm font-medium">{text.queryParams}</p>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li><code>limit</code> - {locale === 'zh' ? '最大结果数 (默认: 50, 最大: 100)' : 'Max results (default: 50, max: 100)'}</li>
                <li><code>folder_id</code> - {locale === 'zh' ? '按文件夹 UUID 过滤' : 'Filter by folder UUID'}</li>
              </ul>

              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`curl -X GET "https://your-domain.com/api/external/documents?limit=10" \\
  -H "Authorization: Bearer sk_your_api_key"`}
              </pre>

              <p className="text-sm font-medium">{text.response}</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`{
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
}`}
              </pre>
            </div>
          </section>

          {/* Get Single Document */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {text.getDoc}
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <code className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-sm">GET</code>
                <code className="text-sm">/api/external/documents/:id</code>
              </div>

              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`curl -X GET "https://your-domain.com/api/external/documents/DOCUMENT_UUID" \\
  -H "Authorization: Bearer sk_your_api_key"`}
              </pre>

              <p className="text-sm font-medium">{text.response}</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "Document Title",
    "content": "# Hello\\n\\nDocument content here...",
    "parent_folder_id": "folder-uuid",
    "created_at": "2026-02-28T10:00:00Z",
    "updated_at": "2026-02-28T10:00:00Z"
  }
}`}
              </pre>
            </div>
          </section>

          {/* Update Document */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {text.updateDoc}
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <code className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded text-sm">PUT</code>
                <code className="text-sm">/api/external/documents/:id</code>
              </div>

              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`curl -X PUT "https://your-domain.com/api/external/documents/DOCUMENT_UUID" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Updated Title",
    "content": "# Updated Content\\n\\nNew content here..."
  }'`}
              </pre>

              <p className="text-sm font-medium">{text.response}</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "Updated Title",
    "updated_at": "2026-02-28T12:00:00Z"
  }
}`}
              </pre>
            </div>
          </section>

          {/* Delete Document */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {text.deleteDoc}
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <code className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-sm">DELETE</code>
                <code className="text-sm">/api/external/documents/:id</code>
              </div>

              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`curl -X DELETE "https://your-domain.com/api/external/documents/DOCUMENT_UUID" \\
  -H "Authorization: Bearer sk_your_api_key"`}
              </pre>

              <p className="text-sm font-medium">{text.response}</p>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "message": "Document deleted"
}`}
              </pre>
            </div>
          </section>

          {/* Error Handling */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Code className="h-5 w-5" />
              {text.errorResponses}
            </h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
{`// 401 Unauthorized
{ "error": "Invalid or missing API key..." }
{ "error": "API key has expired" }

// 404 Not Found
{ "error": "Document not found" }
{ "error": "Folder not found" }

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
            <h2 className="text-xl font-semibold mb-4">{text.limits}</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {text.limitsList.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
