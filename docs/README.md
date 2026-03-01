# Inkdraft 功能文档

![](screenshot-editor-chat.png)

Inkdraft 是一款**支持 AI Agent 可控的 Markdown 编辑器**，让「写文档 + 写代码 + 跑分析」在一处优雅完成。

[English](README.en.md) | 中文

## 核心特性

### Agent 直接操作文档
传统编辑器中 AI 只能给出建议。Inkdraft 的 Agent 可以**直接增删改查你的文档**，无需复制粘贴。

### 内置 Acontext SDK
在编辑器里运行 Python 代码做数据分析，结果直接回写到文档中。

### 外部 Agent 接入
提供标准 RESTful API，让 Claude Code、OpenAI Agent 等可以直接操作你的文档。

---

## 功能模块

### [📝 编辑器](features/editor.md)
双模式编辑、实时大纲、智能格式化、自动保存等核心功能。

![](screenshot-editor.png)

### [🤖 AI 对话助手](features/ai-chat.md)
与 AI 对话，让 Agent 直接修改文档、润色文字、生成内容。

![](screenshot-editor-chat.png)

### [📁 文档管理](features/documents-list.md)
文件夹组织、搜索筛选、批量操作、导入导出。

![](screenshot-documents.png)

### [📱 移动端](features/mobile.md)
针对移动端深度优化，小屏幕也能流畅使用。

![](screenshot-mobile.png)

### [🔌 外部 API](features/external-api.md)
标准 RESTful API，让其他 Agent 接入操作文档。

---

## 快速开始

### 安装
```bash
git clone https://github.com/mbt1909432/Inkdraft.git
cd Inkdraft
npm install
```

### 配置
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-key
```

### 运行
```bash
npm run dev
```

访问 http://localhost:3000

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 |
| 编辑器 | MDXEditor + CodeMirror |
| UI | shadcn/ui + Tailwind CSS |
| 后端 | Supabase |
| AI | OpenAI / Anthropic / Google Gemini |
| 代码执行 | Acontext SDK |

---

## 适合谁？

- **技术文档写作者** - 频繁编写技术文档、产品文档
- **数据分析师** - 在「代码—结论—报告」之间切换
- **Agent 开发者** - 想把 Agent 能力接入可视化编辑器

---

## 相关链接

- [GitHub 仓库](https://github.com/mbt1909432/Inkdraft)
- [Acontext SDK](https://github.com/mbt1909432/acontext)
- [问题反馈](https://github.com/mbt1909432/Inkdraft/issues)
