# Inkdraft

一个现代化的 Markdown 编辑器，支持 AI 辅助写作。

![](docs/screenshot-editor.png)

## 功能特性

### 富文本 Markdown 编辑

- **双模式编辑** - 在富文本（所见即所得）和源码模式之间无缝切换
- **实时大纲** - 自动生成文档目录结构，点击即可跳转
- **智能格式化** - 工具栏支持快速文本格式化（加粗、斜体、下划线、删除线、代码、标题）
- **选中文本工具栏** - 选中文本时自动显示上下文工具栏，支持快速格式化或 AI 操作
- **代码块** - 支持多种编程语言的语法高亮
- **表格与列表** - 完整支持表格、有序和无序列表
- **自动保存** - 每 30 秒自动同步到云端，支持手动 Ctrl+S 保存
- **同步状态** - 可视化显示云端同步状态（已同步、同步中、离线）

### AI 写作助手

- **AI 对话面板** - 专门的对话界面用于写作辅助
  - 询问关于文档的问题
  - 获取写作建议和改进意见
  - 支持多轮对话，具有上下文记忆功能
- **AI 起稿** - 根据标题和说明生成完整的文档草稿
- **文本选中美化** - 选中任意文本后可以：
  - **润色** - 改善写作风格和清晰度
  - **扩写** - 添加更多细节和阐述
  - **缩写** - 总结并缩短内容
  - **修正语法** - 纠正语法和拼写错误
  - **自定义** - 提供您自己的指令
- **上下文记忆** - AI 记住之前的对话，提供连贯的辅助
- **Token 计数器** - 显示估计的 token 使用量，便于上下文感知交互

### 文档管理

- **文件夹组织** - 创建文件夹来组织文档
- **文档置顶** - 将重要文档固定在顶部
- **快速重命名** - 直接从侧边栏重命名文档
- **批量操作** - 选择多个文档进行批量删除
- **搜索与筛选** - 按标题快速查找文档
- **导入 Markdown** - 导入现有 .md 文件，自动检测格式

### 导出选项

- **复制 Markdown** - 一键复制整个文档到剪贴板
- **下载 .md 文件** - 导出为 Markdown 文件
- **导出 Word** - 生成格式正确的 .docx 文件
- **导出 PDF** - 创建保留样式的 PDF

### 用户体验

- **响应式设计** - 在桌面和移动设备上完全可用
- **深色/浅色主题** - 自动跟随系统偏好或手动切换
- **多语言** - 界面支持中文和英文
- **可调整面板** - 拖拽调整侧边栏、大纲和聊天面板的大小
- **键盘快捷键** - Ctrl+S 保存，标准编辑快捷键

### 外部 API

- **RESTful API** - 通过 HTTP 端点进行完整的 CRUD 操作
- **API Key 认证** - 安全访问，支持配置密钥过期时间
- **llms.txt** - 在 `/llms.txt` 提供 LLM 友好的 API 文档

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| UI 组件 | shadcn/ui + Tailwind CSS |
| 编辑器 | MDXEditor + CodeMirror |
| 状态管理 | Zustand |
| 后端 | Supabase (Auth + Database + Realtime) |
| AI 集成 | OpenAI / Anthropic / Google Gemini |

## 快速开始

### 环境要求

- Node.js 18+
- npm / yarn / pnpm
- Supabase 账号

### 安装步骤

1. 克隆项目

```bash
git clone https://github.com/mbt1909432/Inkdraft.git
cd Inkdraft
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

复制 `.env.example` 到 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的Supabase公钥
```

4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 可用命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run start    # 启动生产服务器
npm run lint     # 运行 ESLint
```

## E2E 测试

测试使用 Playwright，运行在 3005 端口：

```bash
npm run dev -- -p 3005    # 在 3005 端口启动开发服务器
npx playwright test       # 运行 E2E 测试
```

## 项目结构

```
├── app/                    # Next.js App Router
│   ├── document/[id]/      # 文档编辑页面
│   ├── documents/          # 文档列表页面
│   ├── settings/           # 设置页面
│   ├── api/                # API 路由
│   │   ├── external/       # 外部 API 端点
│   │   ├── ai/             # AI 相关端点
│   │   └── draft/          # 起稿生成
│   └── llms.txt/           # LLM 友好的 API 文档
├── components/
│   ├── editor/             # 编辑器组件
│   │   ├── MarkdownEditor  # 主编辑器包装器
│   │   ├── EditorToolbar   # 桌面端工具栏
│   │   ├── MobileToolbar   # 移动端工具栏
│   │   ├── SelectionToolbar# 文本选中操作
│   │   └── DraftModal      # AI 起稿对话框
│   ├── chat/               # AI 聊天组件
│   │   ├── ChatPanel       # 主聊天界面
│   │   └── MobileChat      # 移动端聊天对话框
│   ├── sidebar/            # 侧边栏组件
│   │   ├── Sidebar         # 桌面端侧边栏
│   │   ├── MobileSidebar   # 移动端侧边栏
│   │   └── OutlineView     # 文档大纲
│   └── ui/                 # shadcn/ui 组件
├── hooks/                  # 自定义 React Hooks
├── lib/
│   ├── store/              # Zustand 状态管理
│   ├── supabase/           # Supabase 客户端配置
│   ├── export/             # 导出工具
│   └── editor/             # 编辑器工具
├── contexts/               # React 上下文
│   └── LocaleContext       # 国际化提供者
└── public/                 # 静态资源
```

## API 文档

访问 `/llms.txt` 获取 LLM 友好的 API 文档，包括：

- 通过 API Key 认证
- 文档 CRUD 端点：
  - `GET /api/external/documents` - 列出所有文档
  - `POST /api/external/documents` - 创建文档
  - `GET /api/external/documents/[id]` - 获取单个文档
  - `PUT /api/external/documents/[id]` - 更新文档
  - `DELETE /api/external/documents/[id]` - 删除文档

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 许可证

MIT
