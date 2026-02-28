# API Key 使用指南

## 概述

API Key 功能允许外部程序通过 API 访问你的文档，无需浏览器登录。适用于：
- CLI 工具上传文档
- 自动化脚本
- 第三方集成

## 快速开始

### 1. 创建 API Key

1. 登录 Inkdraft
2. 点击左侧边栏底部的 **设置**
3. 在 API Keys 区域点击 **Create Key**
4. 输入名称（如 "我的CLI工具"）
5. **立即复制保存** - 密钥只显示一次！

### 2. 使用 API Key

```bash
# 设置环境变量（推荐）
export INKDRAFT_API_KEY="sk_your_api_key_here"

# 或直接在命令中使用
curl -X POST https://your-domain.com/api/external/documents \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "content": "# Hello"}'
```

## API 端点

### 上传文档

**POST** `/api/external/documents`

**JSON 方式：**
```bash
curl -X POST https://your-domain.com/api/external/documents \
  -H "Authorization: Bearer $INKDRAFT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "我的文档",
    "content": "# 标题\n\n这是内容。",
    "folder_id": "可选-文件夹UUID"
  }'
```

**文件上传方式：**
```bash
curl -X POST https://your-domain.com/api/external/documents \
  -H "Authorization: Bearer $INKDRAFT_API_KEY" \
  -F "file=@document.md" \
  -F "title=可选标题" \
  -F "folder_id=可选文件夹UUID"
```

**响应：**
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "我的文档",
    "created_at": "2026-02-28T10:00:00Z",
    "updated_at": "2026-02-28T10:00:00Z"
  }
}
```

### 列出文档

**GET** `/api/external/documents`

```bash
# 列出所有文档
curl -X GET "https://your-domain.com/api/external/documents" \
  -H "Authorization: Bearer $INKDRAFT_API_KEY"

# 限制数量
curl -X GET "https://your-domain.com/api/external/documents?limit=10" \
  -H "Authorization: Bearer $INKDRAFT_API_KEY"

# 按文件夹筛选
curl -X GET "https://your-domain.com/api/external/documents?folder_id=uuid" \
  -H "Authorization: Bearer $INKDRAFT_API_KEY"
```

**响应：**
```json
{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "title": "文档标题",
      "folder_id": "folder-uuid",
      "created_at": "2026-02-28T10:00:00Z",
      "updated_at": "2026-02-28T10:00:00Z"
    }
  ]
}
```

## 认证方式

支持两种 Header 格式：

```bash
# Bearer Token（推荐）
Authorization: Bearer sk_xxx

# X-API-Key
X-API-Key: sk_xxx
```

## 错误处理

| 状态码 | 说明 |
|--------|------|
| 401 | API Key 无效或缺失 |
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

**错误响应格式：**
```json
{
  "error": "Invalid or missing API key..."
}
```

## 限制

- 每个用户最多 10 个 API Key
- 单个文档最大 10MB
- 列表请求最多返回 100 条

## Python 示例

```python
import os
import requests

API_KEY = os.environ.get('INKDRAFT_API_KEY')
BASE_URL = 'https://your-domain.com'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# 上传文档
response = requests.post(
    f'{BASE_URL}/api/external/documents',
    headers=headers,
    json={
        'title': 'Python 生成的文档',
        'content': '# Hello from Python\n\nThis was uploaded via API.'
    }
)
print(response.json())

# 列出文档
response = requests.get(
    f'{BASE_URL}/api/external/documents',
    headers=headers
)
for doc in response.json()['documents']:
    print(f"- {doc['title']} ({doc['id']})")
```

## 安全建议

1. **不要硬编码 API Key** - 使用环境变量
2. **定期轮换密钥** - 删除旧的，创建新的
3. **使用描述性名称** - 便于追踪用途
4. **不再使用时删除** - 减少安全风险

## 数据库设置

首次使用前需要运行迁移：

```bash
# 在 Supabase SQL Editor 中运行
# 或使用 Supabase CLI
supabase db push
```

迁移文件位置：`supabase/migrations/20260228_api_keys.sql`
