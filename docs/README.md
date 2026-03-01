# Inkdraft 功能文档

![](screenshot-editor-chat.png)

Inkdraft 是一款**支持 AI Agent 可控的 Markdown 编辑器**，让「写文档 + 写代码 + 跑分析」在一处优雅完成。

[English](README.en.md) | 中文

---

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
- 双模式编辑（富文本/源码）
- 实时大纲导航
- 智能格式化工具栏
- 自动保存与同步

### [🤖 AI 对话助手](features/ai-chat.md)
- Agent 直接修改文档
- 文字润色、扩写、缩写
- 上下文记忆
- 代码执行能力

### [📁 文档管理](features/documents-list.md)
- 文件夹组织
- 搜索筛选
- 批量操作
- 导入导出

### [📱 移动端](features/mobile.md)
- 触控优化编辑
- AI 起稿功能
- 底部导航栏
- 离线支持

### [🔌 外部 API](features/external-api.md)
- RESTful API 接口
- API Key 认证
- 文档 CRUD 操作
- llms.txt 文档

---

## 快速开始

```bash
# 克隆项目
git clone https://github.com/mbt1909432/Inkdraft.git
cd Inkdraft

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入 Supabase 配置

# 启动
npm run dev
```

访问 http://localhost:3000

---

## 技术栈

| 技术 | 用途 |
|------|------|
| Next.js 15 | 框架 |
| MDXEditor | 编辑器 |
| shadcn/ui | UI 组件 |
| Supabase | 后端服务 |
| Acontext SDK | 代码执行 |

---

## 适合谁？

- **技术文档写作者** - 编写技术文档、产品文档
- **数据分析师** - 代码分析与报告生成
- **Agent 开发者** - 接入 AI Agent 能力

---

## 相关链接

- [GitHub 仓库](https://github.com/mbt1909432/Inkdraft)
- [Acontext SDK](https://github.com/mbt1909432/acontext)
- [问题反馈](https://github.com/mbt1909432/Inkdraft/issues)
