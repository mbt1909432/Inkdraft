# 编辑器框选 AI 功能设计文档

## 1. 目标与场景

- **核心需求**：用户在编辑器中**框选一段文字**后，能出现**浮动工具栏/菜单**，提供「AI 润色」等基于选中内容的 AI 能力。
- **延伸**：同一交互范式可扩展为多种「选中文本 → 一键操作」能力，并可结合 **Function Calling** 做结构化输出与后续动作。

本文档从产品与交互设计角度描述方案，并给出技术实现要点与可扩展功能建议。

---

## 2. 交互设计

### 2.1 触发方式

| 方式 | 描述 | 优先级 |
|------|------|--------|
| **框选后自动浮现** | 用户用鼠标/触控选中一段文字后，在选区**上方或下方**出现一小型浮动条（Bubble Toolbar） | P0 |
| **右键菜单** | 选中后右键，菜单中增加「AI 润色」「扩写」「翻译」等子菜单 | P1 |
| **快捷键** | 选中后按约定快捷键（如 `Ctrl+Shift+P`）打开同一浮动条 | P1 |

推荐首期实现：**框选后自动浮现**，与常见富文本/文档产品一致，发现性最好。

### 2.2 浮动条形态建议

- **位置**：选区上方约 8–12px，水平居中或略偏上，避免遮挡选区；若上方空间不足则显示在选区下方。
- **样式**：小圆角卡片、轻阴影，与现有主题（亮/暗）一致；可复用 shadcn 的 `Popover`/`Dropdown` 风格。
- **内容**：图标 + 文案的按钮，例如：
  - 润色
  - 扩写 / 缩写
  - 翻译
  - 总结
  - 续写
  - 纠错（可与现有 typo 能力打通）
  - 换风格（正式/口语/简洁等）
- **行为**：点击某项后，浮动条收起，进入 loading（如按钮旋转或全局小 loading），完成后用 AI 结果**替换当前选区**，并可选 toast 提示成功/失败。

### 2.3 无选区时

- 不显示浮动条；若已显示则选区变化或失焦时收起。

---

## 3. 功能清单与扩展建议

### 3.1 首期可上的「选中后操作」

| 功能 | 说明 | 输入 | 输出 |
|------|------|------|------|
| **AI 润色** | 保持原意，优化表达、流畅度 | 选中文本 | 润色后的文本 |
| **扩写** | 适度展开、补充细节 | 选中文本 | 扩写后的文本 |
| **缩写** | 压缩为更短表述 | 选中文本 | 缩写后的文本 |
| **翻译** | 中↔英等（可带目标语言参数） | 选中文本 + 目标语言 | 翻译后的文本 |
| **总结** | 一句话/短摘要 | 选中文本 | 总结文本 |
| **纠错** | 错别字、语法 | 选中文本 | 纠错后的文本（可与现有 typo API 统一） |

### 3.2 后续可扩展

- **续写**：以选区为上下文，在选区后生成一段续写内容（插入而非替换）。
- **换风格**：正式 / 口语 / 简洁 / 文艺等，用 prompt 或单独 endpoint 区分。
- **解释/注释**：对选中句段生成简短解释或注释（可插入为括号或脚注）。
- **引用/参考文献**：根据选中内容生成引用格式（如 APA），或插入为块引用。
- **自定义指令**：浮动条中提供「自定义」入口，用户输入简短指令（如「改成被动语态」），再调用通用「按指令改写」API。

### 3.3 与 Function Calling 的结合

- **为何有用**：LLM 输出若为纯自然段，解析可能不稳定；用 **Tool Call** 让模型输出结构化结果（如 `{ "polished_text": "..." }`），便于前端直接替换选区，并便于扩展（多字段、多语言等）。
- **建议**：
  - 与现有「起稿」类似，为每种操作定义对应的 tool（如 `output_polish`、`output_translate`），参数为结果文本（及可选 meta）。
  - 服务端在 `executeToolCall` 中解析并返回该字段，API 再以 JSON 返回给前端。
- **首期**：可先采用「非流式 + 纯文本返回」快速上线；在需要更复杂输出或流式时再统一改为 Tool Call。

---

## 4. 技术方案概要

### 4.1 编辑器侧（MDXEditor + Lexical）

- 当前栈：**@mdxeditor/editor**（底层 **Lexical**），`MDXEditorCore` 通过 `editorRef` 暴露 `getMarkdown` / `setMarkdown`。
- MDXEditor 对外暴露：
  - `currentSelection$`：当前 Lexical 选区（RangeSelection | null）
  - `activeEditor$` / `rootEditor$`：当前/根 Lexical 编辑器实例
  - `getSelectionAsMarkdown(editor, exportParams)`：将当前选区导出为 Markdown 字符串
  - `getSelectionRectangle(editor)`：选区在视口中的矩形 `{ top, left, width, height }`，用于定位浮动条

**实现思路**：

1. **自定义 MDXEditor 插件（Realm Plugin）**
   - 在 `init` 中通过 `addComposerChild$` 或 `addEditorWrapper$` 注入一个 **React 组件**（浮动条容器）。
   - 该组件内使用 MDXEditor 的 reactive 状态（如 `useCellValue(currentSelection$)`, `useCellValue(activeEditor$)`）：
     - 当 `currentSelection$` 非空且为文本范围时，用 `getSelectionAsMarkdown` 取选中内容，用 `getSelectionRectangle` 取位置。
     - 根据矩形位置用 **固定定位（fixed 或 absolute + 编辑器容器 relative）** 渲染浮动条。

2. **选区替换**
   - Lexical 中：在 `activeEditor` 的 `update()` 里根据当前 selection 执行「删除选区内容并插入新文本」；若需保留部分格式，可基于现有 selection 的 node 做更细粒度替换。
   - 若仅做「整段纯文本替换」，可用 Lexical 的 `$getSelection()`、`$isRangeSelection`、`insertNodes`/`$insertNodes` 等 API 在 `editor.update()` 中完成。

3. **与现有 editorRef 的配合**
   - 若插件内拿不到 `activeEditor$`，可考虑通过 MDXEditor 的 ref 拿到根 editor（若 API 暴露），再在插件或外层用 `editor.getEditorState().read(...)` 读选区并调用 `getSelectionAsMarkdown` / `getSelectionRectangle`（若这些方法可从包内导入）。

### 4.2 API 设计

- **统一入口（推荐）**：`POST /api/ai/text-action`
  - Body：`{ action: 'polish' | 'expand' | 'shrink' | 'translate' | 'summarize' | 'correct' | ... , text: string, options?: { targetLang?: string } }`
  - Response：`{ text: string }`（或带 `tool_call` 时的结构化字段）
- **鉴权**：与现有 `draft`、`typo-correction` 一致，使用 Supabase 登录态（如 `createClient()` + `getUser()`），未登录返回 401。
- **限流与长度**：与 typo 类似，对 `text.length` 做上限（如 50k 字符）；可选按用户/IP 做简单限流。

### 4.3 前端调用与状态

- 浮动条按钮点击 → 取当前 `getSelectionAsMarkdown(activeEditor)` 作为 `text`，带 `action` 调用 `POST /api/ai/text-action`。
- Loading：按钮或浮动条上 loading，防止重复提交。
- 成功：用返回的 `text` 在 Lexical 中替换当前选区，并收起浮动条。
- 失败：toast 提示错误，保留原选区。

---

## 5. 实现阶段建议

| 阶段 | 内容 |
|------|------|
| **Phase 1** | 框选后浮动条 UI（不含 AI）：仅实现「有选区时在选区上方显示一小条 + 位置随选区变化」，验证 `currentSelection$` / `getSelectionRectangle` 可用性。 |
| **Phase 2** | 接入 1 个 AI 能力（如「润色」）：`POST /api/ai/text-action` + 替换选区，端到端跑通。 |
| **Phase 3** | 扩展更多 action（扩写、缩写、翻译、总结、纠错），浮动条多按钮 + 可选参数（如翻译目标语言）。 |
| **Phase 4** | 可选：Tool Call 结构化输出、流式返回、右键菜单与快捷键。 |

---

## 6. 其他可添加的编辑器功能（与框选互补）

- **Slash 命令**：输入 `/` 弹出命令列表（如「/润色」「/起稿」「/表格」），对当前段落或光标后内容生效。
- **右侧/底部 AI 面板**：选中后可在侧边栏显示「解释」「同义改写」等，不直接改正文，适合学习/审阅场景。
- **引用与参考文献**：选中后「生成引用」插入到文末或当前块。
- **模板与片段**：输入缩写或从浮动条选择「插入模板」，插入预设 Markdown 片段。

---

## 7. 参考与依赖

- 现有 **起稿** 流程与 Tool Call 设计：`docs/llm-draft-feature.md`
- 现有 **typo 纠错** API：`app/api/ai/typo-correction/route.ts`、`lib/ai/typo-correction`
- MDXEditor 导出：`currentSelection$`、`activeEditor$`、`rootEditor$`、`getSelectionAsMarkdown`、`getSelectionRectangle`（见 `node_modules/@mdxeditor/editor/dist/index.d.ts`）
- 链接弹层定位实现参考：`node_modules/@mdxeditor/editor/dist/plugins/link-dialog`（使用 `getSelectionRectangle` 定位对话框）

---

## 8. 总结

- **框选 → 浮动条 → AI 润色等**：通过 MDXEditor 的选区与导出 API 实现「选中即出现工具栏」，再通过统一 `POST /api/ai/text-action` 与 Lexical 选区替换完成闭环。
- **扩展性**：同一套交互可叠加更多 action、Tool Call 与流式输出；并可与右键菜单、快捷键、Slash 命令、侧边栏等组合，形成完整的「编辑器内 AI」体验。

按上述阶段实施，可先交付可用的「框选 + AI 润色」，再逐步迭代更多能力与体验细节。

---

## 9. 实现状态（已实现）

- **浮动条**：`components/editor/SelectionToolbar.tsx` — 框选后选区上方显示浮动工具栏（润色、扩写、缩写、翻译、总结、纠错）。
- **插件**：`components/editor/selectionToolbarPlugin.tsx` — 通过 `addComposerChild$` 注入浮动条组件；已在 `MDXEditorCore.tsx` 中注册。
- **API**：`POST /api/ai/text-action`（`app/api/ai/text-action/route.ts`）— Body：`{ action, text, options? }`，返回 `{ text }`；鉴权与现有 draft/typo 一致。
- **LLM 逻辑**：`lib/ai/text-action.ts` — 使用现有 `OPENAI_LLM_*` 配置，单轮 completion，无 tool call。
- **选区替换**：在 Lexical 的 `editor.update()` 内通过 `$getSelection()` + `$isRangeSelection` + `selection.insertText(result)` 替换选中内容。
