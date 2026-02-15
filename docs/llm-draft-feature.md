# LLM 起稿功能实施文档

## 1. 目标与范围

- **功能名称**：起稿（Draft with LLM）
- **行为**：用户点击「起稿」后，由 LLM 根据当前文档标题/可选说明生成 Markdown 正文，通过 **Tool Call** 输出结构化内容，并写入当前文档展示。
- **参考实现**：`docs/examples/llm-openai-client-minimal`（Chat + Streaming + Tool Call）。

## 2. 参考示例要点

| 文件 | 用途 |
|------|------|
| `types.ts` | `ChatMessage`、`LLMConfig`、`ToolInvocation` |
| `config.ts` | `getLLMConfig()` 从环境变量读取 |
| `openai-client.ts` | `createOpenAIClient`、`chatCompletion` / `chatCompletionStream`、`executeToolCall`、示例 tool schema |

- 环境变量：`OPENAI_LLM_ENDPOINT`、`OPENAI_LLM_API_KEY`、`OPENAI_LLM_MODEL`、`OPENAI_LLM_TEMPERATURE`、`OPENAI_LLM_MAX_TOKENS`（与现有 typo 纠错复用）。
- 依赖：`openai`（若尚未安装则 `npm install openai`）。

## 3. 架构与数据流

```
[用户点击「起稿」]
       ↓
[可选：弹窗输入「主题/补充说明」]
       ↓
[调用 API Route 或 Server Action]
       ↓
[LLM Chat：system + user 消息，带 tools]
       ↓
[Model 调用 tool：output_draft(markdown: string)]
       ↓
[服务端执行 tool，收集 markdown]
       ↓
[返回 markdown 给前端]
       ↓
[前端：document store updateCurrentContent(markdown) 或 editorRef.setMarkdown]
       ↓
[编辑器展示生成内容]
```

- **Tool Call 设计**：定义单一 tool，例如 `output_draft`，参数为 `{ markdown: string }`。模型在生成完正文后调用该 tool 输出整段 Markdown，避免在流式文本里再解析。
- **服务端执行**：在 `executeToolCall` 中识别 `output_draft`，仅把参数中的 `markdown` 作为结果返回；由调用方（API 或 Server Action）收集该结果并返回给前端。

## 4. 技术方案

### 4.1 目录与职责

- **`lib/llm/`**（新建）
  - `types.ts`：从示例拷贝并保持与示例一致（或与现有 `lib/ai` 共用类型时做轻量适配）。
  - `config.ts`：从示例拷贝，与现有 `.env` 中 `OPENAI_LLM_*` 一致。
  - `openai-client.ts`：从示例拷贝；**新增** tool `output_draft`（见下），在 `executeToolCall` 中处理该 tool，返回 `args.markdown`。
- **`lib/llm/tools/draft.ts`**（新建，可选）
  - 定义 `OUTPUT_DRAFT_SCHEMA` 与执行逻辑的封装，供 `openai-client` 调用。
- **API Route**（推荐）
  - `app/api/draft/route.ts`：接收 `{ title?: string, instruction?: string }`，构造 system/user 消息，调用 `chatCompletion`（或 `chatCompletionStream`），传入 `[OUTPUT_DRAFT_SCHEMA]`，收集 `output_draft` 的 `markdown`，以 JSON `{ markdown: string }` 返回；错误时返回 4xx/5xx + 错误信息。
- **前端**
  - **起稿按钮**：在 `EditorToolbar` 中增加「起稿」按钮（可配图标，如 PenLine / Sparkles）。
  - **交互**：点击后可选弹出简单对话框（输入「主题或补充说明」），再发请求；或直接按当前文档标题起稿。
  - **状态**：loading 时按钮 disabled 或显示 loading；成功后将返回的 `markdown` 写入当前文档（见下）；失败则 toast 提示。

### 4.2 Tool 定义（output_draft）

- **名称**：`output_draft`
- **描述**：用于输出最终起稿的完整 Markdown 正文。模型在生成完内容后必须调用此 tool，将整段 Markdown 放入 `markdown` 参数。
- **参数**：
  - `markdown`（string，必填）：完整 Markdown 文本。
- **执行**：服务端不写库、不写文件，仅把 `args.markdown` 作为 tool 结果返回，由 API 收集后返回给前端。

### 4.3 强制执行 Tool Call（tool_choice）

起稿场景下必须让模型**一定调用** `output_draft`，不能只回复一段纯文本。做法是用 OpenAI 的 **`tool_choice`** 指定「必须调用某个 function」。

- **`tool_choice: "auto"`**（示例默认）：模型可自行决定是否用 tool，可能只返回文本。
- **强制执行**：传 `tool_choice` 为对象，指定必须调用的 function 名：

```ts
// 强制模型调用 output_draft
tool_choice: {
  type: "function",
  function: { name: "output_draft" },
}
```

**实现方式建议：**

1. **在 openai-client 中支持可选「强制 tool」**
   - 为 `chatCompletion` / `chatCompletionStream` 增加可选参数，例如：
     - `forcedToolName?: string`，或
     - `toolChoice?: "auto" | "required" | { type: "function"; function: { name: string } }`
   - 当传入 `forcedToolName: "output_draft"` 时，在请求里设置：
     - `params.tool_choice = { type: "function", function: { name: "output_draft" } }`
   - 不传则保持 `tool_choice: "auto"`（与示例兼容）。

2. **起稿 API 调用时传强制 tool**
   - 在 `app/api/draft/route.ts` 里调用 `chatCompletion(client, messages, config, [OUTPUT_DRAFT_SCHEMA], maxIterations, "output_draft")` 或等价地传 `toolChoice: { type: "function", function: { name: "output_draft" } }`。
   - 这样模型**必须**在一次回复中调用 `output_draft`，否则会报错或不返回；便于后端统一从 tool 结果取 markdown，不做「文本兜底」逻辑。

3. **兼容性**
   - OpenAI 与多数兼容接口都支持上述 `tool_choice` 对象形式；若某代理不支持，可回退为 `tool_choice: "required"`（强制用任意一个 tool），并在提示词里强调「必须且仅调用 output_draft」。

### 4.4 提示词要点（system / user）

- **System**：说明角色为「文档起稿助手」；输出要求为「仅通过调用 `output_draft` 输出正文，不要在其他内容里再输出完整正文」；Markdown 格式要求（标题、列表、段落等）。
- **User**：当前文档标题（必选）+ 用户补充说明（可选）。例如：「请根据以下标题起稿，输出完整 Markdown，并调用 output_draft 传回正文。标题：{title}. 补充说明：{instruction}」

### 4.5 前端写入文档方式

- **推荐**：使用现有 document store：`updateCurrentContent(markdown)`。若当前有选中位置，也可设计为「在光标处插入」；首版可简化为「全文替换」。
- **备选**：若需直接驱动编辑器实例，可通过 ref 调用 `editorRef.current.setMarkdown(markdown)`（需在持有 ref 的父组件中暴露或通过 callback 传入 markdown）。

## 5. 环境与依赖

- **环境变量**（与现有 typo 共用）：  
  `OPENAI_LLM_ENDPOINT`、`OPENAI_LLM_API_KEY`、`OPENAI_LLM_MODEL`、`OPENAI_LLM_TEMPERATURE`、`OPENAI_LLM_MAX_TOKENS`
- **依赖**：若项目尚未安装 `openai`，执行：  
  `npm install openai`

## 6. 实施步骤建议

1. **拷贝并接入 LLM 客户端**
   - 将 `docs/examples/llm-openai-client-minimal` 中的 `types.ts`、`config.ts`、`openai-client.ts` 拷贝到 `lib/llm/`（或按现有结构合并到 `lib/ai`，统一用一套 config）。
   - 在 `openai-client.ts` 中新增 `output_draft` 的 schema 与 `executeToolCall` 分支，返回 `args.markdown`。
2. **实现 API Route**
   - 新增 `app/api/draft/route.ts`：解析 body（title、instruction），构造消息，调用 `chatCompletion`（非流式即可），传入 `[OUTPUT_DRAFT_SCHEMA]` 且 **`tool_choice` 强制为 `output_draft`**（见 4.3），收集 `output_draft` 的 markdown，返回 `{ markdown }`。
3. **前端：起稿按钮与请求**
   - 在 `EditorToolbar` 增加「起稿」按钮；可选：简单 Modal 输入「补充说明」。
   - 调用 `POST /api/draft`，传入当前文档 title 与可选 instruction；loading 与错误用现有 toast/UI 处理。
4. **前端：写入文档**
   - 请求成功后，用 `updateCurrentContent(markdown)`（或约定的插入逻辑）更新 store；编辑器会随 store 更新而刷新内容。
5. **联调与边界**
   - 未配置 LLM 时：起稿按钮可隐藏或 disabled，并提示「请配置 OPENAI_LLM_*」。
   - 模型未调用 tool 或返回空：提示「起稿未返回内容，请重试或补充说明」。

## 7. 文件变更清单

| 操作 | 路径 |
|------|------|
| 新建 | `lib/llm/types.ts`（或复用/合并到 lib/ai） |
| 新建 | `lib/llm/config.ts` |
| 新建 | `lib/llm/openai-client.ts`（含 output_draft tool） |
| 新建 | `app/api/draft/route.ts` |
| 修改 | `components/editor/EditorToolbar.tsx`（起稿按钮、loading、可选 Modal） |
| 修改 | 文档页或持有 store 的父组件：传入 `onDraftComplete(markdown)` 或直接在该处调 `updateCurrentContent`（视数据流而定） |
| 可选 | `.env.example` 中补充 LLM 起稿相关说明 |

## 8. 验收要点

- 点击「起稿」后，在配置好 LLM 的前提下，能根据当前标题（及可选说明）生成 Markdown。
- 生成内容通过 Tool Call `output_draft` 返回，并正确显示在当前文档中。
- 未配置 LLM 或接口报错时，有明确提示且不破坏当前文档内容。

---

以上为「LLM 起稿（Tool Call 输出 Markdown + 文档展示）」的实施文档，可直接按步骤开发；若需先做「仅流式文本、无 tool」的简化版，再在第二步替换为带 `output_draft` 的版本即可。
