# Word 导出功能说明与已知问题

## 1. 功能概述

- **入口**：编辑器工具栏「下载」→「Word 文档 (.docx)」
- **行为**：将当前文档的 Markdown 内容（含 base64 内嵌图片）导出为 `.docx`，在服务端生成后返回下载。
- **依赖**：`docx`、`sharp`（服务端图片解码与缩放）。

## 2. 架构与数据流

```
[用户点击「下载」→「Word 文档」]
       ↓
[前端] 当前文档 content + title
       ↓
POST /api/export/word  { title, content }
       ↓
[服务端] markdown-to-docx-server
  - 提取 data:image/...;base64 图片 → 占位符 <<<DOCX_IMG_0>>>
  - 按行解析：标题 / 列表 / 引用 / 正文 / 图片占位
  - 图片解码 → Buffer，大图用 sharp 缩为 JPEG
  - 按原图比例算显示尺寸（长边 400px）
  - 生成 docx（Packer.toBuffer）→ 返回二进制
       ↓
[前端] 接收 blob，触发下载
```

| 模块 | 说明 |
|------|------|
| `lib/export/markdown-to-docx.ts` | 客户端：请求 `/api/export/word`，用返回 blob 触发下载 |
| `app/api/export/word/route.ts` | 接口：读 body（request.text() + JSON.parse），调 `buildWordBuffer`，返回 docx |
| `lib/export/markdown-to-docx-server.ts` | 服务端：占位符替换、解析块、图片 Buffer、sharp 缩放、docx 构建 |

## 3. 已知问题与解决记录

### 3.1 图片在 Word 中不显示（浏览器端生成失败）

- **现象**：在浏览器里用 docx 的 `Packer.toBlob` + `ImageRun` 导出时，图片未写入 docx（docx 体积很小、无图）。
- **原因**：docx 在浏览器环境下对图片的写入/zip 处理存在兼容性问题，图片未正确嵌入。
- **解决**：改为**服务端生成**。由 `POST /api/export/word` 在 Node 下用 `Packer.toBuffer` + `Buffer` 图片生成 docx，前端只发 content、接收 blob 并下载。

### 3.2 图片在标题行内时未被嵌入

- **现象**：占位符出现在标题里（如 `## <<<DOCX_IMG_0>>>引言`），导出后只有「引言」标题，没有图片。
- **原因**：标题分支只做了 `replace(PLACEHOLDER_RE, '')` 得到纯文字并输出一个标题段落，没有为占位符生成图片段落。
- **解决**：在标题分支中，若 `headingContent` 包含占位符，在输出标题段落后，用 `PLACEHOLDER_RE.exec(headingContent)` 遍历占位符，对每个占位符再 `push` 一个仅含对应 `ImageRun` 的段落。

### 3.3 占位符原文出现在 Word 中

- **现象**：导出的 Word 里出现 `<<<DOCX_IMG_0>>>` 或 `<<<DOCXIMG0>>>` 等文字。
- **原因**：  
  1）在 `segmentsToChildren` 里，从「文本」片段生成 `TextRun` 时未去掉占位符；  
  2）存在无下划线等变体（如 `<<<DOCXIMG0>>>`），原正则未匹配，未被剥离。
- **解决**：  
  1）所有输出到正文的文本（标题、列表、引用、普通段落、`segmentsToChildren` 中的文本片段）统一用占位符剥离正则去掉占位符；  
  2）增加宽松的剥离正则 `STRIP_PLACEHOLDER_RE = /<<<DOCX_?IMG_?\d*\s*>>>/g`，对所有「要写入文档的字符串」做一次替换，避免任何变体漏网。

### 3.4 图片被压扁（比例失真）

- **现象**：Word 里图片被固定为 240×180，竖图/横图比例错误。
- **原因**：所有图片统一使用 `transformation: { width: 240, height: 180 }`，未按原图比例计算。
- **解决**：用 sharp 读图片 `metadata` 得到宽高，按「长边 400px、短边按比例」计算 `width/height`，再传给 `ImageRun` 的 `transformation`。

### 3.5 标题为浅蓝色

- **现象**：导出的 Word 中标题为模板默认的浅蓝色。
- **原因**：使用 docx 默认标题样式，继承主题色。
- **解决**：所有含文字的段落（含各级标题、列表、引用、正文）统一加上 `run: { color: '000000' }`（黑色），通过常量 `BLACK_RUN` 统一传入。

### 3.6 大图导致 docx 生成异常或体积过大

- **现象**：base64 很大的图（如 2.5MB）在服务端解码后直接嵌入，可能导致 docx 异常或文件过大。
- **解决**：解码后若 buffer 大于 800KB，用 sharp 缩放到最长边 1200px 并转为 JPEG 85% 质量后再嵌入，既控制体积又保证兼容性。

## 4. 占位符与正则

- **占位符格式**：`<<<DOCX_IMG_0>>>`、`<<<DOCX_IMG_1>>>` …（仅服务端使用，不写回前端）。
- **匹配占位符（解析用）**：`PLACEHOLDER_RE = /<<<DOCX_IMG_(\d+)>>>/g`，用于 `splitLineWithPlaceholders` 和标题内图片索引。
- **剥离占位符（输出用）**：`STRIP_PLACEHOLDER_RE = /<<<DOCX_?IMG_?\d*\s*>>>/g`，用于所有会写入文档的字符串，避免占位符或变体出现在最终 Word 中。

## 5. 配置与限制

- **请求体大小**：Markdown 可能含大段 base64，需允许较大 body。已在 `next.config` 中设置 `experimental.serverActions.bodySizeLimit: "50mb"`（与 Server Actions 共用）；Route Handler 若仍有限制，可考虑用 `request.text()` 读取原始 body 再 `JSON.parse`（当前已采用）。
- **依赖**：服务端需安装 `sharp`（图片尺寸读取与缩放），否则大图不缩放、直接嵌入，可能失败或体积过大。

## 6. 小结

| 问题 | 处理方式 |
|------|----------|
| 浏览器端图片不写入 docx | 改为服务端 Node 生成 docx |
| 标题行内图片被忽略 | 标题分支内检测占位符并补发图片段落 |
| 占位符出现在 Word 中 | 所有输出文本用 STRIP_PLACEHOLDER_RE 剥离 |
| 图片比例失真 | 用 sharp metadata 算比例，长边 400px |
| 标题为浅蓝色 | 段落统一加 run: { color: '000000' } |
| 大图体积/兼容 | 超过 800KB 用 sharp 缩为 JPEG 再嵌入 |

以上逻辑均实现在 `lib/export/markdown-to-docx-server.ts` 与 `app/api/export/word/route.ts` 中。
