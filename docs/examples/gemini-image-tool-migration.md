# Gemini Image Tools – Logic & Migration Guide

本文档描述本项目中的 **Gemini 画图能力**：**Text-to-Image**（文生图）与 **Edit Image**（图生图/编辑图），便于迁移到其他项目。

---

## 1. 概述

| 能力 | 说明 | 入口 |
|------|------|------|
| **Text-to-Image** | 纯文本 prompt 生成图片，或「参考图 + 文本」生成（如角色图）。 | LLM 工具 `image_generate`、`generate_figure` |
| **Edit Image** | 基于已有 artifact 图片 + 自然语言指令，生成编辑预览；支持将预览写回原图。 | 仅 HTTP API，非 LLM 工具 |

**底层统一**：均通过 `@google/genai`（GoogleGenAI）调用 `ai.models.generateContent()`，使用同一套环境变量（`IMAGE_GEN_*`）。

---

## 2. Text-to-Image

### 2.1 两层结构

- **`image_generate`**（底层）：`lib/acontext-image-generate-tool.ts`  
  - 入参：`prompt`、可选 `size`、`output_dir`。  
  - 可选注入「角色参考图」（从 `public/fonts/<characterId>/` 读取），实现「以某角色为主体的图」。  
  - 调用 Gemini API → 解析 `inlineData` 图片 → 上传到 Acontext Disk → 返回 `artifactPath`。

- **`generate_figure`**（科研图专用封装）：`lib/gemini-image-tool.ts`  
  - 入参：`query`、可选 `aspectRatio`、`imageSize`。  
  - 内部转成 `image_generate` 的 `prompt`/`size`/`output_dir`，**不传** `toolContext`，即不用角色参考图，纯文本生图。  
  - 返回 `artifactPath`、`diskPath`（`disk::/figures/...`）。

### 2.2 依赖与类型

**运行时依赖**：

- `zod`：入参校验与类型推断  
- `@google/genai`：`GoogleGenAI`，调用 `models.generateContent`  
- `@/lib/acontext-integration`：`uploadFileToAcontext`（上传生成图到 Disk）  
- `@/lib/acontext-client`：`getAcontextClient()`（取 publicUrl 等）  
- `@/lib/tool-errors`：`ToolConfigurationError`、`ToolValidationError`、`ToolExecutionError`  
- （可选）`sharp`、`node:fs`、`node:path`：见 `acontext-image-generate-tool.ts`，当前用于角色参考图等）

**image_generate 入参（Zod）**：

```ts
// lib/acontext-image-generate-tool.ts
export const ImageGenerateToolArgsSchema = z.object({
  prompt: z.string().min(1).max(5000),
  size: z.enum(["1K", "2K", "4K"]).optional(),
  output_dir: z.string().max(255).optional(),
});
export type ImageGenerateToolArgs = z.infer<typeof ImageGenerateToolArgsSchema>;
```

- **prompt**：必填，描述要生成的画面。  
- **size**：可选，默认 `"1K"`。仅当模型为 `gemini-3-pro-image-preview` 时生效；`gemini-2.5-flash-image` 等仅支持 `aspectRatio`。  
- **output_dir**：可选，Acontext Disk 内目录，默认 `generated/YYYY-MM-DD`。

**image_generate 返回值**：

```ts
export type ImageGenerateToolResult = {
  artifactPath: string | null;  // 成功时为 Disk 内路径，失败或未返回图为 null
};
```

**generate_figure 入参（Zod）**：

```ts
// lib/gemini-image-tool.ts
export const GenerateFigureToolArgsSchema = z.object({
  query: z.string().min(20).max(2000),
  aspectRatio: z.enum(["16:9", "4:3", "1:1", "3:2", "square"]).optional(),
  imageSize: z.enum(["1K", "2K"]).optional(),
});
```

**generate_figure 返回值**：

```ts
export type GenerateFigureToolResult = {
  artifactPath: string;
  diskPath: string;   // "disk::" + artifactPath，供前端/LLM 引用
  publicUrl?: string;
};
```

### 2.3 Text-to-Image 执行流程（image_generate）

`runImageGenerate(args, diskId?, toolContext?)` 的步骤：

1. **配置校验**  
   - 若缺少 `IMAGE_GEN_API_KEY` 或 `IMAGE_GEN_DEFAULT_MODEL`，抛 `ToolConfigurationError`。

2. **入参校验**  
   - `ImageGenerateToolArgsSchema.parse(args)`，失败抛 `ToolValidationError`。

3. **可选：角色参考图**  
   - 若传入 `toolContext.characterId`（格式 `character1`～`character8`），从 `public/fonts/<characterId>/` 下查找 `reference.png` 等；若找到则作为第一 part（`inlineData`）+ 增强 prompt 调用 Gemini；否则纯文本 `contents: prompt`。

4. **模型能力判断**  
   - 若 `model` 包含 `gemini-3-pro-image`，则传 `config.imageConfig = { aspectRatio, imageSize }`；否则仅传 `aspectRatio`（如 16:9）。

5. **调用 Gemini**  
   - `ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl } })`（`baseUrl` 来自 `IMAGE_GEN_BASE_URL`）。  
   - `ai.models.generateContent({ model, contents, config })`，超时 `IMAGE_GEN_TIMEOUT_MS`（默认 120_000）。

6. **解析响应**  
   - 从 `response.candidates[0].content.parts` 中取 `inlineData`（base64 图）和可选 text；只取第一张图。

7. **上传到 Acontext Disk**  
   - 使用 `uploadFileToAcontext(filename, buf, mimeType, diskId)`，路径形如 `generated/YYYY-MM-DD/image_<ts>_<rand>_1.<ext>`（或 `output_dir` 指定目录）。  
   - 返回 `{ artifactPath }`（无图则 `artifactPath: null`）。

错误约定：配置缺失 → `ToolConfigurationError`；校验失败 → `ToolValidationError`；SDK/网络/上游失败 → `ToolExecutionError`。

### 2.4 generate_figure 的调用链

- `runGenerateFigure(args, diskId?, toolContext?)`：  
  - 校验 `GenerateFigureToolArgsSchema`。  
  - 将 `aspectRatio` 拼进 prompt 前缀（如 "Create in 16:9 widescreen landscape format. " + query）。  
  - 设置 `output_dir = figures/YYYY-MM-DD`。  
  - 调用 `runImageGenerate({ prompt: enhancedPrompt, size, output_dir }, diskId, undefined)`（**不传 toolContext**，保证纯文本生图）。  
  - 若 `artifactPath` 为空则抛 `ToolExecutionError`；否则返回 `{ artifactPath, diskPath: "disk::" + artifactPath }`。

### 2.5 与 LLM 的对接（Text-to-Image）

- **Tool Schema**  
  - `image_generate`：`getImageGenerateToolSchema`（`lib/acontext-image-generate-tool.ts`）。  
  - `generate_figure`：`getGenerateFigureToolSchema`（`lib/gemini-image-tool.ts`）。  
- **路由与执行**  
  - `app/api/chatbot/route.ts`、`app/api/canvas-chat/route.ts` 等将上述 schema 加入 `availableTools`，并把 `acontextDiskId` 传给 completion。  
  - `lib/openai-client.ts` 的 `executeToolCall()`：根据 `name` 分支，若 `isImageGenerateToolName(name)` 则 `runImageGenerate(args, diskId, toolContext)`；若 `isGenerateFigureToolName(name)` 则 `runGenerateFigure(args, diskId, toolContext)`。  
  - `args` 来自 `JSON.parse(toolCall.function.arguments)`。  
- 调用 text-to-image 时需传入当前会话的 **diskId**（与 data-analysis 一致），生成图写入同一 Disk。

---

## 3. Edit Image

Edit Image **不是** LLM 工具，仅由服务端 HTTP API 调用，用于「在原图基础上按自然语言指令生成预览 → 可选将预览写回原图」。

### 3.1 核心文件与依赖

- **核心文件**：`lib/acontext-image-edit.ts`  
- **依赖**：  
  - `@google/genai`：`GoogleGenAI`，`generateContent`  
  - `@/lib/acontext-client`：`getAcontextClient()`  
  - `@/lib/acontext-integration`：`getAcontextArtifactContent`、`uploadFileToAcontext`、`deleteAcontextArtifact`

### 3.2 类型

**预览（生成编辑图）**：

```ts
export type ImageEditPreviewArgs = {
  artifactPath: string;   // 原图在 Acontext Disk 中的路径（可带或不带前导 /）
  prompt: string;         // 自然语言编辑指令
  diskId?: string;
};

export type ImageEditPreviewResult = {
  previewArtifactPath: string;  // 预览图在 Disk 中的路径（同盘下 _preview/ 子目录）
  publicUrl: string;
  mimeType: string;
};
```

**应用预览（写回原图）**：

```ts
export type ImageEditApplyArgs = {
  originalArtifactPath: string;
  previewArtifactPath: string;
  diskId?: string;
  deletePreviewAfterApply?: boolean;  // 默认 true，应用后删除预览 artifact
};

export type ImageEditApplyResult = {
  finalArtifactPath: string;
  publicUrl: string;
  mimeType: string;
};
```

### 3.3 执行流程

**createImageEditPreview(args)**：

1. 校验 `artifactPath`、`prompt` 非空。  
2. 使用 `getAcontextArtifactContent(artifactPath, diskId)` 读取原图 Buffer 与 mimeType。  
3. 读取 `IMAGE_GEN_API_KEY`、`IMAGE_GEN_BASE_URL`、`IMAGE_GEN_DEFAULT_MODEL`、`IMAGE_GEN_TIMEOUT_MS`（与 text-to-image 相同）。  
4. `GoogleGenAI` 初始化方式同 image_generate。  
5. 调用 `ai.models.generateContent`：  
   - `contents.parts`: `[{ inlineData: { mimeType, data: base64 } }, { text: enhancedPrompt }]`。  
   - `enhancedPrompt` 前缀为固定说明（保留主体、构图一致等）+ 用户 `prompt`。  
   - `config.imageConfig.aspectRatio: "16:9"`（当前写死）。  
6. 从 `candidates[0].content.parts` 中取第一张 `inlineData` 图。  
7. 预览保存路径：原路径所在目录下的 `_preview/<basename>__edit_<ts>.<ext>`，例如 `generated/2026-01-28/_preview/image_xxx__edit_1738xxx.png`。  
8. `uploadFileToAcontext(previewPath, outBuf, mimeType, diskId)` 上传预览。  
9. 通过 `getPresignedPublicUrl(diskId, previewArtifactPath)` 得到 `publicUrl`，返回 `{ previewArtifactPath, publicUrl, mimeType }`。

**applyImageEditPreview(args)**：

1. 用 `getAcontextArtifactContent(previewArtifactPath, diskId)` 读取预览图。  
2. 使用 `uploadFileToAcontext(originalArtifactPath, preview.content, preview.mimeType, diskId)` 覆盖原图。  
3. 若 `deletePreviewAfterApply !== false`，则 `deleteAcontextArtifact(previewArtifactPath, diskId)`。  
4. 返回 `{ finalArtifactPath, publicUrl, mimeType }`（基于原路径）。

### 3.4 HTTP API 路由（本项目）

- **POST /api/acontext/artifacts/image-edit/preview**  
  - Body: `{ artifactPath, prompt, diskId? }`  
  - 调用 `createImageEditPreview`，返回 `{ success, previewArtifactPath, publicUrl, mimeType }`。

- **POST /api/acontext/artifacts/image-edit/apply**  
  - Body: `{ originalArtifactPath, previewArtifactPath, diskId?, deletePreviewAfterApply? }`  
  - 调用 `applyImageEditPreview`，返回 `{ success, finalArtifactPath, publicUrl, mimeType }`。

---

## 4. 环境与配置

以下变量 **同时用于 Text-to-Image 与 Edit Image**：

| 变量 | 必填 | 说明 |
|------|------|------|
| `IMAGE_GEN_API_KEY` | 是 | Gemini/兼容端点的 API Key |
| `IMAGE_GEN_DEFAULT_MODEL` | 是 | 模型名，如 `gemini-3-pro-image-preview`、`gemini-2.5-flash-image` |
| `IMAGE_GEN_BASE_URL` | 否 | 覆盖默认端点（如 `https://api.openai-next.com`） |
| `IMAGE_GEN_TIMEOUT_MS` | 否 | 超时毫秒，默认 120_000 |

- Text-to-image 的 `aspectRatio`、`imageSize`、`output_dir` 等在代码中写死或由工具参数传入。  
- Edit image 的 `aspectRatio` 当前在 `lib/acontext-image-edit.ts` 中写死为 `"16:9"`。

---

## 5. 迁移到其他项目时的清单

### 5.1 Text-to-Image（文生图）

1. **复制/抽离文件**  
   - `lib/acontext-image-generate-tool.ts`（schema、`getImageGenerateToolSchema`、`isImageGenerateToolName`、`runImageGenerate`）。  
   - 若需要「科研图」专用入口：`lib/gemini-image-tool.ts`（schema、`getGenerateFigureToolSchema`、`isGenerateFigureToolName`、`runGenerateFigure`）。  
   - `lib/tool-errors.ts`（或实现同名错误类）。

2. **依赖**  
   - 安装 `zod`、`@google/genai`。  
   - 实现或移植：  
     - `uploadFileToAcontext(filename, content, mimeType, diskId?)`（或你项目的「上传到会话存储」等价 API）；  
     - `getAcontextClient()`（若仍用 Acontext Disk）。  
   - 若不用 Acontext，可在 `runImageGenerate` 内将「上传」改为写入你自己的存储，并返回你系统的路径格式。

3. **配置**  
   - 提供 `IMAGE_GEN_API_KEY`、`IMAGE_GEN_DEFAULT_MODEL`；可选 `IMAGE_GEN_BASE_URL`、`IMAGE_GEN_TIMEOUT_MS`。

4. **在 LLM 调用链中注册**  
   - 将 `getImageGenerateToolSchema()` 和/或 `getGenerateFigureToolSchema()` 加入 `tools`。  
   - 在 executeToolCall 中：根据 `name` 调用 `runImageGenerate(args, diskId, toolContext)` 或 `runGenerateFigure(args, diskId, toolContext)`，并传入当前会话的 **diskId**（或你项目中的等价会话存储 ID）。

5. **可选调整**  
   - 角色参考图：若不需要，可删除 `tryLoadCharacterReferenceInlineData` 及相关逻辑。  
   - 模型差异：`gemini-3-pro-image-preview` 支持 `imageSize`（1K/2K/4K）；`gemini-2.5-flash-image` 等仅支持 `aspectRatio`，已在代码中按模型名分支。  
   - 输出目录、默认比例、超时等可在各自文件内改常量或从配置读取。

### 5.2 Edit Image（编辑图）

1. **复制/抽离文件**  
   - `lib/acontext-image-edit.ts`（`createImageEditPreview`、`applyImageEditPreview` 及类型）。  
   - 依赖的 `getAcontextArtifactContent`、`uploadFileToAcontext`、`deleteAcontextArtifact`（`lib/acontext-integration.ts`）及 `getAcontextClient()`；若你不用 Acontext，需实现「按路径读图」「按路径写/覆盖」「按路径删除」的等价接口。

2. **配置**  
   - 与 Text-to-Image 相同：`IMAGE_GEN_*` 四个变量。

3. **API 路由**  
   - 若沿用当前设计：实现等价于 `POST .../image-edit/preview` 和 `POST .../image-edit/apply` 的两个接口，请求/响应体与上文 3.4 一致或兼容。  
   - 若你无 Acontext：  
     - preview：从你的存储按 `artifactPath` 取原图 → 调 Gemini → 将结果存为「预览」并返回可访问 URL 或你系统的路径。  
     - apply：从「预览」读取内容 → 覆盖「原图」路径 → 可选删除预览。

4. **路径与存储约定**  
   - 当前预览路径为原图所在目录下的 `_preview/<basename>__edit_<timestamp>.<ext>`；迁移时可保留或改为你自己项目的命名规则。  
   - `artifactPath` 支持带或不带前导 `/`，内部会做 `normalizeArtifactPath`。

### 5.3 前端/展示

- Text-to-image 返回的 `artifactPath` 或 `diskPath`（`disk::/figures/...`）需在你前端或 API 中解析为可访问 URL（本项目通过 `/api/acontext/artifacts/public-url` 等）。  
- Edit image 的 `createImageEditPreview` 已返回 `publicUrl`，可直接展示；若你改用自建存储，可在返回中提供你系统的 URL 或 path。

---

按上述清单即可将 **Gemini 文生图（text-to-image）** 与 **图编辑（edit image）** 的逻辑与集成方式迁移到新项目；核心是：**同一套 `@google/genai` + `IMAGE_GEN_*` 配置，文生图走 LLM 工具 + Disk 上传，编辑图走 HTTP API + 读/写/删 Disk（或等价存储）**。
