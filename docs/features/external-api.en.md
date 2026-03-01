# External API - Agent Integration

Inkdraft provides standard RESTful APIs for external Agents (Claude Code, OpenAI Agents, etc.) to directly manipulate documents.

## Authentication

### Create API Key
1. Go to **Settings** → **API Keys**
2. Click **Create New Key**
3. Set name and expiration
4. Save the generated key (shown only once)

### Use API Key
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://your-instance/api/external/documents
```

## API Endpoints

### List Documents
```http
GET /api/external/documents
```

Response:
```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "Document Title",
      "content": "# Content\n\n...",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Document
```http
POST /api/external/documents
Content-Type: application/json

{
  "title": "New Document",
  "content": "# Content\n\nThis is the body..."
}
```

Response:
```json
{
  "document": {
    "id": "uuid",
    "title": "New Document",
    "content": "# Content\n\nThis is the body...",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Get Single Document
```http
GET /api/external/documents/[id]
```

### Update Document
```http
PUT /api/external/documents/[id]
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content"
}
```

### Delete Document
```http
DELETE /api/external/documents/[id]
```

## Use Cases

### Claude Code Integration
```python
# Claude Code can directly manipulate your documents
import requests

def update_document(doc_id, content):
    response = requests.put(
        f"https://your-instance/api/external/documents/{doc_id}",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={"content": content}
    )
    return response.json()
```

### Automation Workflows
- CI/CD pipelines auto-update documentation
- Scheduled report generation
- Multi-system data synchronization

### Multi-Agent Collaboration
- Agent A generates draft
- Agent B reviews and edits
- Agent C formats output
- All write to the same document

## llms.txt

Inkdraft provides LLM-friendly API documentation:

```
GET /llms.txt
```

Returns plain-text API docs optimized for LLMs:
- All API endpoints
- Request/Response formats
- Authentication methods
- Usage examples

## Security

### API Key Management
- Key shown only once - save securely
- Configurable expiration (7d, 30d, 90d, never)
- Revoke anytime

### Access Control
- API Key bound to user account
- Only access own documents
- All operations logged

## Error Handling

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 401 | Unauthorized (invalid/expired key) |
| 404 | Document not found |
| 500 | Server error |
