# Chatbot + 文档编辑（Edit Tool）设计文档

## 1. 目标：像 Cursor 一样的局部编辑

- **核心**：对话里 AI 通过 **Edit Tool** 做**局部修改**——只改文档里的一小段，而不是整篇替换。
- **两种操作**：
  1. **替换**：指定「原文片段」和「新内容」，在文档里找到并替换（`old_string` → `new_string`）。
  2. **插入**：指定「在某某内容后面」插入一段（`after_string` + `content`）。
- **可选**：应用前先展示 **diff 预览**，用户确认后再写入文档。

下文只围绕「局部编辑 + 可选 diff」来设计工具和流程。

---

## 2. 工具设计（Tool 怎么设计）

### 2.1 方案概览

用**两个 tool**，语义清晰、模型易学：

| Tool 名称 | 用途 | 主要参数 |
|-----------|------|----------|
| `search_replace` | 把文档中某段原文替换成新内容 | `old_string`, `new_string` |
| `insert_after` | 在某段内容后面插入新内容 | `after_string`, `content` |

也可以合并为一个 tool（用 `type: "replace" | "insert"` 区分），两种都行；下面按**两个 tool** 写，便于和 Cursor 的 `search_replace` 对齐。

---

### 2.2 Tool 1：`search_replace`（替换）

**含义**：在当前文档的 Markdown 全文里，找到与 `old_string` 一致（或首次匹配）的一段，替换为 `new_string`。

**参数（JSON Schema）**：

```json
{
  "type": "object",
  "properties": {
    "old_string": {
      "type": "string",
      "description": "文档中要被替换的原文片段。必须与文档中某段完全一致（包括换行、空格），且建议唯一匹配，否则用首次匹配。"
    },
    "new_string": {
      "type": "string",
      "description": "替换后的新内容（可为空字符串表示删除该段）。"
    }
  },
  "required": ["old_string", "new_string"]
}
```

**前端执行逻辑**：

1. 当前文档全文：`markdown = editorRef.current.getMarkdown()`。
2. 在 `markdown` 中查找 `old_string`：
   - **推荐**：`markdown.indexOf(old_string)`，只替换**第一次**出现（避免误改多处）。
   - 若未找到：返回错误（如 "old_string 未在文档中找到"），不修改文档；可选把错误反馈给模型做重试。
3. 替换：`newMarkdown = markdown.replace(old_string, new_string)`（仅首次）。
4. 若开启 **diff 预览**：先展示 diff（old_string ↔ new_string 或整篇 old/new），用户点「应用」后再 `setMarkdown(newMarkdown)`；否则直接 `setMarkdown(newMarkdown)`。

**给模型的 prompt 说明**（建议写进 system prompt）：

- `old_string` 必须从用户当前文档中**原样复制**一段连续文本（含换行），不要自己编造或改写。
- 尽量选**唯一**的一段（如含标点、小标题等），避免在文中重复出现导致替换错位。
- `new_string` 是替换后的完整内容，保持合法 Markdown。

---

### 2.3 Tool 2：`insert_after`（在某某后面插入）

**含义**：在当前文档中，找到 `after_string` 首次出现的位置，在其**紧接着的后面**插入 `content`（不删除任何内容）。

**参数（JSON Schema）**：

```json
{
  "type": "object",
  "properties": {
    "after_string": {
      "type": "string",
      "description": "文档中某段内容的结尾片段。插入将发生在这段内容之后（紧接其后）。必须与文档中某段完全一致。"
    },
    "content": {
      "type": "string",
      "description": "要插入的 Markdown 内容（通常以换行开头，以便和前后文分隔）。"
    }
  },
  "required": ["after_string", "content"]
}
```

**前端执行逻辑**：

1. `markdown = editorRef.current.getMarkdown()`。
2. `pos = markdown.indexOf(after_string)`；若未找到，返回错误，不修改。
3. `insertIndex = pos + after_string.length`。
4. `newMarkdown = markdown.slice(0, insertIndex) + content + markdown.slice(insertIndex)`。
5. 若开启 diff 预览：展示「在 after_string 后多出一段 content」的 diff，用户确认后再 `setMarkdown(newMarkdown)`；否则直接 `setMarkdown(newMarkdown)`。

**给模型的 prompt 说明**：

- `after_string` 必须是文档中**真实存在**的一段结尾（例如某段最后一句、某小标题整行），原样复制。
- `content` 若需要换行与上下文分隔，应以 `\n\n` 或 `\n` 开头。

---

### 2.4 一次对话里多次编辑（可选）

- 若模型在一次回复里调用**多个** `search_replace` / `insert_after`，前端有两种策略：
  - **顺序应用**：按 tool call 顺序依次在「当前文档」上执行；每次执行后文档变化，下一次的查找基于新文档。注意：若多个 tool 针对同一份「旧文档」写的，顺序应用可能导致后面的 `old_string`/`after_string` 找不到了，需要模型按「从后往前」或「一次只改一处」来设计，或前端只执行第一个 edit（简单）。
  - **合并为一次 setMarkdown**：先把所有替换/插入在内存里算出一个 newMarkdown，再一次性 setMarkdown（需要定义好顺序和冲突处理，实现稍复杂）。
- **建议首版**：一次只处理**一个** edit tool call（或只执行第一个），避免顺序和冲突问题；多改多处时由用户多轮对话触发多次 edit。

---

## 3. Diff 预览（可选）

- **目的**：在把 edit 真正写入文档前，让用户看到「会改哪里」再点「应用」或「拒绝」。
- **实现思路**：
  - **局部 diff**：只对本次修改的片段展示 old / new 对比（例如并排或 inline diff），其余文档不变。
  - **全文 diff**：展示「应用前全文」和「应用后全文」的 diff（可用 diff 库如 `diff` npm 包生成 unified diff 或高亮片段）。
- **流程**：前端收到 tool call → 在内存中算出 `newMarkdown` → 弹出/展开 diff 预览 UI → 用户点「应用」→ `setMarkdown(newMarkdown)`；点「取消」则丢弃本次 edit，可把结果反馈给对话（如「用户拒绝了编辑」）以便模型后续回复。

---

## 4. 后端 API 与调用方式

- **请求**：例如 `POST /api/ai/chat`，body 含 `messages`、`documentMarkdown`（当前全文）、可选 `selectionMarkdown`（当前选区）、`documentId`。
- **响应**：与现有 LLM 调用一致；若模型发出 tool call，则返回里带 `tool_calls`，例如：
  - `name: "search_replace"`, `arguments: { "old_string": "...", "new_string": "..." }`
  - `name: "insert_after"`, `arguments: { "after_string": "...", "content": "..." }`
- **Tool 定义**：在 OpenAI（或当前 LLM）的 `tools` 里注册上述两个 tool 的 name + description + parameters（即上面两段 JSON Schema）；system prompt 中写明何时用 `search_replace`、何时用 `insert_after`，以及 `old_string`/`after_string` 必须从文档原样复制等规则。

---

## 5. 小结：工具怎么设计

1. **两个 tool**：  
   - **`search_replace`**：`old_string`（原文片段）+ `new_string`（新内容）；前端在全文里**首次匹配**并替换，再 `setMarkdown`。  
   - **`insert_after`**：`after_string`（某段结尾）+ `content`（要插入的内容）；前端在 `after_string` 后插入，再 `setMarkdown`。

2. **匹配规则**：  
   - 一律用**字符串精确匹配**（`indexOf` + 首次出现），不自动忽略空白或做模糊匹配，避免误改；模型负责从文档里复制出唯一、准确的片段。

3. **可选 diff 预览**：  
   - 先算出 `newMarkdown`，再在 UI 中展示 diff，用户确认后再写入文档；拒绝则不写入并可反馈给对话。

4. **首版实现建议**：  
   - 一次回复只处理一个 edit（或只执行第一个 tool call）；多轮对话可多次 edit。  
   - 未找到 `old_string`/`after_string` 时明确报错，不静默跳过。

按这个设计，工具语义清晰、前端好实现、行为接近 Cursor 的局部编辑；diff 预览作为可选增强即可。
