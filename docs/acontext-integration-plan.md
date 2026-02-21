# Acontext Chat 集成计划

## 背景

当前 Inkdraft 的 AI Chat 功能存在以下限制：

1. **无对话历史持久化** - 刷新页面后对话丢失
2. **无跨设备同步** - 换设备无法继续对话
3. **Token 无法监控** - 长对话可能超出 context 限制
4. **无文件操作能力** - AI 无法操作用户文档

Acontext SDK 可以解决这些问题。

## 架构设计

### 当前架构
```
ChatPanel (React State) → /api/ai/chat-stream → OpenAI API
         ↓
    messages[] (内存)
```

### 目标架构
```
ChatPanel → /api/ai/chat → Acontext Session → OpenAI API
    ↓              ↓              ↓
  UI 渲染    session/disk 管理   消息持久化
```

### 存储分层

| 层 | 内容 | 技术 |
|---|------|------|
| Acontext Sessions | 对话消息、上下文、Token 统计 | Acontext SDK |
| Acontext Disk | 生成的文件、图片 | Acontext SDK |
| Supabase | 用户认证、Session ID 映射 | 现有 |
| 本地 State | 临时 UI 状态 | React |

## 集成功能

### Phase 1: 消息持久化 (P0)

**目标**: 对话历史永久保存，刷新/换设备可继续

**改动**:
1. 添加 `@acontext/acontext` 依赖
2. 新增 `lib/acontext/client.ts` - Acontext 客户端封装
3. 新增 `lib/acontext/session.ts` - Session 管理
4. 修改 `/api/ai/chat-stream` - 使用 Acontext 存储消息
5. 修改 `ChatPanel` - 支持加载历史对话

**数据流**:
```ts
// 创建新对话
const session = await acontext.sessions.create({ user: userId });
const disk = await acontext.disks.create();

// 存储消息
await acontext.sessions.storeMessage(session.id, {
  role: "user",
  content: "帮我改简历"
});

// 加载历史
const messages = await acontext.sessions.getMessages(session.id);
```

### Phase 2: Token 监控 + Context 压缩 (P1)

**目标**: 监控对话 Token，超过阈值自动压缩

**改动**:
1. 在 API 返回 Token 统计
2. 前端显示 Token 使用量
3. 超过 80K tokens 时触发压缩策略

**压缩策略**:
```ts
const strategies = [
  { type: "remove_tool_result", params: { keep_recent_n_tool_results: 5 } },
  { type: "remove_tool_call_params", params: { keep_recent_n_tool_calls: 10 } }
];

const messages = await acontext.sessions.getMessages(sessionId, {
  editStrategies: strategies
});
```

### Phase 3: 文档操作工具 (P2)

**目标**: AI 可以直接操作用户的 Markdown 文档

**新增工具**:
| 工具 | 功能 |
|------|------|
| `read_current_document` | 读取当前编辑的文档 |
| `save_document_version` | 保存文档版本到 Disk |
| `export_to_pdf` | 导出为 PDF |
| `generate_image` | 生成图片插入文档 |

**实现**:
```ts
// 自定义工具
const documentTools = [
  {
    type: "function",
    function: {
      name: "read_current_document",
      description: "Read the current document being edited",
      parameters: { type: "object", properties: {} }
    }
  }
];

// 工具执行
async function executeDocumentTool(name: string, args: any, context: DocumentContext) {
  switch (name) {
    case "read_current_document":
      return { content: context.currentDocument };
    case "save_document_version":
      await acontext.disks.artifacts.upsert(context.diskId, {
        file: new FileUpload(args.filename, Buffer.from(args.content)),
        file_path: "/versions/"
      });
      return { saved: true, path: `/versions/${args.filename}` };
  }
}
```

### Phase 4: Python Sandbox (P3)

**目标**: AI 可以执行 Python 代码进行数据分析

**用例**:
- 用户上传 CSV，AI 分析数据生成图表
- 自动统计文档字数、段落数
- 生成数据可视化

**实现**:
```ts
const sandbox = await acontext.sandboxes.create();

const result = await SANDBOX_TOOLS.execute_tool(ctx, "bash_execution_sandbox", {
  command: "python3 analyze.py data.csv",
  timeout: 30
});

await acontext.sandboxes.kill(sandbox.sandbox_id); // 清理
```

## 文件结构

```
lib/
├── acontext/
│   ├── client.ts       # Acontext 客户端初始化
│   ├── session.ts      # Session 管理 (create, get, delete)
│   ├── disk.ts         # Disk 操作 (upload, download, list)
│   └── types.ts        # 类型定义
├── ai/
│   ├── chat-edit.ts    # 现有 - 文档编辑
│   └── chat-acontext.ts # 新增 - Acontext 集成版本
app/
├── api/
│   └── ai/
│       ├── chat-stream.ts    # 现有 SSE
│       └── chat-acontext.ts  # 新增 Acontext 版本
components/
└── chat/
    ├── ChatPanel.tsx   # 主组件 - 添加历史加载
    ├── ChatHistory.tsx # 新增 - 历史对话列表
    └── TokenCounter.tsx # 新增 - Token 显示
```

## 环境变量

```env
# .env.local
ACONTEXT_API_KEY=your_api_key
ACONTEXT_BASE_URL=https://api.acontext.com/api/v1  # 可选
```

## 数据库变更

```sql
-- 存储用户与 Acontext Session 的映射
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  acontext_session_id TEXT NOT NULL,
  acontext_disk_id TEXT NOT NULL,
  document_id UUID REFERENCES documents,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 迁移策略

### 渐进式迁移

1. **阶段 1**: 新增 `/api/ai/chat-acontext` 路由，保持现有 `/chat-stream` 不变
2. **阶段 2**: ChatPanel 添加开关，用户可选择使用 Acontext 版本
3. **阶段 3**: 验证稳定后，默认使用 Acontext 版本
4. **阶段 4**: 删除旧代码

### 后向兼容

- 旧对话继续使用内存存储
- 新对话自动使用 Acontext
- 用户可以手动迁移旧对话

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| Acontext API 不可用 | Chat 功能中断 | Fallback 到内存存储 |
| Token 超限 | 对话失败 | 自动压缩 + 提前警告 |
| 数据迁移丢失 | 用户体验差 | 渐进式迁移 + 用户确认 |

## 时间估算

| Phase | 内容 | 复杂度 |
|-------|------|--------|
| Phase 1 | 消息持久化 | 中 |
| Phase 2 | Token 监控 | 低 |
| Phase 3 | 文档工具 | 中 |
| Phase 4 | Python Sandbox | 高 |

## 下一步

1. 安装 `@acontext/acontext` 包
2. 配置 `ACONTEXT_API_KEY`
3. 实现 Phase 1 消息持久化
4. 测试跨设备同步

---

**分支**: `feature/acontext-chat-integration`
**创建时间**: 2026-02-21
