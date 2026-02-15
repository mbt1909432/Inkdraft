# Data Analysis Tool – Logic & Migration Guide

本文档描述本项目中的 **Data Analysis Tool**（`analyze_data`）的完整逻辑，便于迁移到其他项目。

---

## 1. 概述

- **工具名称**: `analyze_data`
- **作用**: 在 Acontext Sandbox 中执行用户/LLM 提供的 Python 代码，生成科研图表（matplotlib/seaborn），并将生成的图片作为 artifact 写回 Acontext Disk。
- **核心文件**: `lib/sandbox-analysis-tool.ts`
- **依赖**: Acontext SDK（Sandbox + Disk）、Zod 校验、统一 tool 错误类型（`lib/tool-errors.ts`）

---

## 2. 依赖与类型

### 2.1 运行时依赖

| 依赖 | 用途 |
|------|------|
| `zod` | 入参运行时校验与类型推断 |
| `@/lib/acontext-client` | `getAcontextClient()`，获取 Acontext 单例 |
| `@/lib/tool-errors` | `ToolConfigurationError`, `ToolValidationError`, `ToolExecutionError` |

### 2.2 入参（Zod Schema）

```ts
// lib/sandbox-analysis-tool.ts
export const AnalyzeDataToolSchema = z.object({
  think: z.string().min(5).max(500),      // 简短描述，用于日志/调试
  python_code: z.string().min(50).max(10000),  // 完整可执行 Python 代码
  output_filename: z.string().optional(),     // 默认 "figure.png"
});
export type AnalyzeDataToolArgs = z.infer<typeof AnalyzeDataToolSchema>;
```

- **think**: 必填，说明在生成什么图（给 LLM 和日志用）。
- **python_code**: 必填，需满足：
  - 导入 matplotlib/seaborn/pandas/numpy 等；
  - 准备数据并画图；
  - 将图保存到 `/workspace/figure.png`（或 `output_filename`）；
  - 建议 `matplotlib.use('Agg')`、`dpi=300`、`bbox_inches='tight'`。
- **output_filename**: 可选，默认 `"figure.png"`，用于多图场景区分文件名。

### 2.3 返回值类型

```ts
export type AnalyzeDataToolResult = {
  success: boolean;           // 是否执行成功（以 Python exit code 为准）
  artifactPath: string;       // Disk 内路径，如 "/figures/2026-02-02/figure.png"
  diskPath: string;           // 前端引用用，如 "disk::/figures/2026-02-02/figure.png"
  stdout: string;
  stderr: string;
  error?: string;             // 失败时
};
```

- 不返回 presigned/public URL，与 `image_generate` 一致；前端用 `diskPath`（或 `disk::` 前缀）再通过自己的 API 换 URL。

---

## 3. 执行流程（核心逻辑）

`executeDataAnalysis(args: unknown, diskId: string)` 的步骤：

1. **校验入参**  
   `AnalyzeDataToolSchema.parse(args)`，失败则抛 `ToolValidationError`（Zod）。

2. **取 Acontext 客户端**  
   `getAcontextClient()`；若为 `null` 则抛 `ToolConfigurationError`。

3. **写脚本到 Disk**  
   - 路径: `/scripts/{dateStr}/script_{timestamp}.py`  
   - 内容: `python_code`，MIME `text/x-python`  
   - API: `acontextClient.disks.artifacts.upsert(diskId, { file: [filename, buffer, mimeType], filePath })`

4. **创建 Sandbox**  
   - `acontextClient.sandboxes.create()`  
   - 每次新建，保证环境干净。

5. **把脚本下载到 Sandbox**  
   - `disks.artifacts.downloadToSandbox(diskId, { filePath, filename, sandboxId, sandboxPath: '/workspace/' })`  
   - 脚本在 Sandbox 内路径: `/workspace/script_{timestamp}.py`。

6. **安装 Python 依赖（可选但推荐）**  
   - 在 Sandbox 内执行: `pip3 install seaborn pandas --quiet`  
   - `sandboxes.execCommand({ sandboxId, command, timeout: 120000 })`  
   - 失败只打 log，不中断流程。

7. **执行 Python**  
   - 命令: `cd /workspace && python3 script_{timestamp}.py`  
   - `execCommand({ sandboxId, command, timeout: 60000 })`  
   - 记录 stdout/stderr 和 exit code。

8. **校验生成文件（Step 4.5）**  
   - 检查 `/workspace/{output_filename}` 是否存在且非空（如 `ls -lh`）；  
   - 若文件存在但大小为 0，仍视为未通过，会走下面的兜底逻辑；  
   - 若不存在或为空，则 `find /workspace -name "*.png" -type f`，若有则用找到的第一个 PNG 作为 `actualFilename`；  
   - 后续上传与返回都用 `actualFilename`。

9. **（可选）Step 4.6**  
   - 打 log 用：`ls -lah /workspace/`、`df -h /workspace/`，便于排查。

10. **上传到 Disk**  
    - 目标路径: `/figures/{dateStr}/{actualFilename}`  
    - API: `disks.artifacts.uploadFromSandbox(diskId, { sandboxId, sandboxPath: '/workspace/', sandboxFilename: actualFilename, filePath: `/figures/${dateStr}/` })`  
    - 其中 `filePath` 传的是**目录**（以 `/` 结尾），最终 artifact 路径 = `filePath + sandboxFilename`。  
    - 失败抛 `ToolExecutionError`。

11. **构造返回值**  
    - `artifactPath = "/figures/{dateStr}/{actualFilename}"`  
    - `diskPath = "disk::" + artifactPath`  
    - 不包含 publicUrl。

12. **清理 Sandbox（finally）**  
    - `acontextClient.sandboxes.kill(sandbox.sandbox_id)`，无论成功失败都执行。

错误处理约定：

- Zod 校验失败 → `ToolValidationError`  
- 无 Acontext 客户端 → `ToolConfigurationError`  
- 上传失败或其他执行错误 → `ToolExecutionError`  
- 其它未知错误包装为 `ToolExecutionError`。

---

## 4. 与 LLM 的对接（OpenAI Function Calling）

### 4.1 Tool Schema（给 OpenAI）

由 `getSandboxAnalysisToolSchema()` 返回，用于 `tools` 数组：

- `name`: `"analyze_data"`
- `description`: 说明用途、必须保存到 `/workspace/figure.png`（或 `output_filename`）、只返回 artifactPath、回复中用 `disk::` 引用图等。
- `parameters`: 对应上面的 `think`、`python_code`、`output_filename`（required: `["think", "python_code"]`）。

### 4.2 路由与执行（本项目中）

- **注册 schema 的路由**: `app/api/chatbot/route.ts`、`app/api/canvas-chat/route.ts` 把 `getSandboxAnalysisToolSchema()` 加入 `availableTools`，并把 `acontextDiskId` 传给流式/非流式 completion；`app/api/tools/route.ts` 也会暴露该 schema。
- **执行入口**: `lib/openai-client.ts` 的 `executeToolCall()`：
  - 若 `isAnalyzeDataToolName(name)` 为 true，则要求有 `diskId`，否则抛错（当前实现为普通 `Error("Disk ID is required for analyze_data tool")`，非 `ToolConfigurationError`）；
  - 调用 `executeDataAnalysis(args, diskId)`，`args` 来自 `JSON.parse(toolCall.function.arguments)`。

即：**调用 analyze_data 时，必须传入当前会话的 Acontext Disk ID（diskId）**，脚本写入 Disk、图也写回同一 Disk。

---

## 5. 环境与配置

- **Acontext**:  
  - `ACONTEXT_API_KEY`、可选 `ACONTEXT_BASE_URL`  
  - 由 `getAcontextClient()` 读取；未配置时 client 为 `null`，analyze_data 会报配置错误。

- **无额外环境变量**：超时、路径规则均在代码中写死（如 60s 执行、120s pip、`/scripts/`、`/figures/`）。

---

## 6. 迁移到其他项目时的清单

1. **复制/抽离文件**  
   - `lib/sandbox-analysis-tool.ts`（含 schema、`getSandboxAnalysisToolSchema`、`isAnalyzeDataToolName`、`executeDataAnalysis`）。  
   - `lib/tool-errors.ts`（或在你项目中实现同名的 `ToolConfigurationError` / `ToolValidationError` / `ToolExecutionError`，保证 sandbox-analysis-tool 的 catch 逻辑一致）。

2. **依赖**  
   - 安装 `zod`、`@acontext/acontext`（或你使用的 Acontext SDK 包名/API 一致版本）。  
   - 实现或移植 `getAcontextClient()`，保证返回的 client 有：  
     - `disks.artifacts.upsert`  
     - `disks.artifacts.downloadToSandbox`  
     - `disks.artifacts.uploadFromSandbox`  
     - `sandboxes.create`、`sandboxes.execCommand`、`sandboxes.kill`  
   - 若 SDK 接口名不同，在 `executeDataAnalysis` 内做一层适配即可。

3. **入参/返回值**  
   - 保持 `AnalyzeDataToolSchema` 与 `AnalyzeDataToolResult` 不变，或只做兼容扩展，这样 LLM 的 schema 与现有说明可以复用。  
   - 若你不需要 `diskPath` 或 `disk::` 约定，可只保留 `artifactPath`，前端按自己规则解析。

4. **在 LLM 调用链中注册**  
   - 把 `getSandboxAnalysisToolSchema()` 加入你的 `tools` 数组。  
   - 在“执行 tool call”的分发逻辑里：若 `name === "analyze_data"`，则从当前请求/会话中取 **Disk ID**，调用 `executeDataAnalysis(JSON.parse(arguments), diskId)`，将返回值序列化后作为该 tool call 的 result 塞回对话。

5. **Disk ID 从哪来**  
   - 本项目：会话与 Acontext 一一对应，`acontextDiskId` 在会话创建或请求时已有，由 `chatbot/route.ts`、`canvas-chat/route.ts` 传给 `chatCompletionStream` / `chatCompletion`，再在 `executeToolCall` 中作为 `diskId` 使用。  
   - 迁移项目：只要在调用 LLM completion 并处理 tool_calls 的地方，能拿到“当前用户/会话对应的 Acontext Disk ID”，传入 `executeDataAnalysis(..., diskId)` 即可。

6. **可选调整**  
   - 超时：修改 `execCommand` 的 `timeout`（当前执行 60s、pip 120s）。  
   - 路径：修改 `/scripts/`、`/figures/`、日期格式等常量。  
   - 依赖安装：可改为预置镜像或其它安装方式，逻辑仍在 Step 3.5 处。

7. **前端/展示**  
   - 若沿用 `diskPath`（`disk::/figures/...`），需在你的前端或 API 中提供“从 disk + path 解析出可访问 URL”的逻辑（本项目通过 `/api/acontext/artifacts/public-url` 等）。  
   - 若你改用其它存储，可在 `executeDataAnalysis` 上传完成后，再写一层“从 artifact 生成你系统的 URL”并可选地放到 result 的扩展字段里。

按上述清单即可把 Data Analysis Tool 的逻辑与集成方式完整迁移到新项目；核心就是：**Acontext Sandbox 执行 Python → 图写回 Acontext Disk → 返回 artifact 路径与 disk 引用**。
