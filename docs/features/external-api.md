# External API - 外部 Agent 接口

Inkdraft 提供标准的 RESTful API，允许外部 Agent（如 Claude Code、OpenAI Agent 等）直接操作文档。

## 认证方式

### 创建 API Key
1. 进入 **Settings** → **API Keys**
2. 点击 **创建新密钥**
3. 设置名称和过期时间
4. 保存生成的密钥（只显示一次）

### 使用 API Key
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://your-instance/api/external/documents
```

## API 端点

### 获取文档列表
```http
GET /api/external/documents
```

响应：
```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "文档标题",
      "content": "# 文档内容\n\n...",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 创建文档
```http
POST /api/external/documents
Content-Type: application/json

{
  "title": "新文档标题",
  "content": "# 文档内容\n\n这是正文..."
}
```

响应：
```json
{
  "document": {
    "id": "uuid",
    "title": "新文档标题",
    "content": "# 文档内容\n\n这是正文...",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 获取单个文档
```http
GET /api/external/documents/[id]
```

### 更新文档
```http
PUT /api/external/documents/[id]
Content-Type: application/json

{
  "title": "更新后的标题",
  "content": "更新后的内容"
}
```

### 删除文档
```http
DELETE /api/external/documents/[id]
```

## 使用场景

### Claude Code 集成
```python
# Claude Code 可以直接操作你的文档
import requests

def update_document(doc_id, content):
    response = requests.put(
        f"https://your-instance/api/external/documents/{doc_id}",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={"content": content}
    )
    return response.json()
```

### 自动化工作流
- CI/CD 流程自动更新文档
- 定时生成报告并写入文档
- 其他 Agent 定期同步数据

### 多 Agent 协作
- Agent A 生成草稿
- Agent B 审核修改
- Agent C 格式化输出
- 所有操作直接写入同一文档

## llms.txt

Inkdraft 提供了 LLM 友好的 API 文档：

```
GET /llms.txt
```

返回纯文本格式的 API 文档，专门为 LLM 优化，包含：
- 所有 API 端点
- 请求/响应格式
- 认证方式
- 使用示例

## 安全性

### API Key 管理
- 密钥只显示一次，请妥善保存
- 支持设置过期时间（7天、30天、90天、永不过期）
- 可以随时撤销密钥

### 权限控制
- API Key 绑定到用户账户
- 只能访问该用户的文档
- 所有操作都有日志记录

## 错误处理

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 401 | 未授权（API Key 无效或过期） |
| 404 | 文档不存在 |
| 500 | 服务器错误 |
