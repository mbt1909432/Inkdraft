# Inkdraft

一个现代化的 Markdown 编辑器，支持 AI 辅助写作。

## 功能特性

### 核心编辑功能
- **Markdown 编辑器** - 基于 MDXEditor，支持富文本和源码模式切换
- **实时大纲** - 自动生成文档目录结构
- **自动保存** - 自动同步到云端，支持手动 Ctrl+S 保存
- **文档管理** - 支持文件夹分类、置顶、重命名、批量删除
- **导入导出** - 支持 .md 文件导入，可导出为 Markdown / Word / PDF

### AI 辅助功能
- **AI 对话助手** - 与 AI 对话，获取写作建议
- **AI 起稿** - 根据标题和说明自动生成文档草稿
- **文字润色** - 选中文字后使用 AI 进行润色、扩写、缩写等
- **上下文记忆** - AI 记住对话上下文，提供连贯的写作辅助

### 用户体验
- **响应式设计** - 支持桌面端和移动端
- **深色/浅色主题** - 自动跟随系统或手动切换
- **多语言支持** - 支持中文和英文
- **实时同步状态** - 显示云端同步状态

### 外部 API
- **RESTful API** - 通过 API Key 访问文档 CRUD 接口
- **llms.txt** - 提供 LLM 友好的 API 文档

## 技术栈

- **前端框架**: Next.js 15 (App Router)
- **UI 组件**: shadcn/ui + Tailwind CSS
- **编辑器**: MDXEditor + CodeMirror
- **后端服务**: Supabase (Auth + Database + Realtime)
- **AI 集成**: 支持 OpenAI / Anthropic / Google 等多模型

## 快速开始

### 环境要求

- Node.js 18+
- npm / yarn / pnpm

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

复制 `.env.example` 到 `.env.local` 并填写：

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
│   ├── api/                # API 路由
│   └── ...
├── components/
│   ├── editor/             # 编辑器组件
│   ├── chat/               # AI 对话组件
│   ├── sidebar/            # 侧边栏组件
│   └── ui/                 # shadcn/ui 组件
├── hooks/                  # 自定义 Hooks
├── lib/
│   ├── store/              # Zustand 状态管理
│   ├── supabase/           # Supabase 客户端
│   └── ...
└── public/                 # 静态资源
```

## 外部 API 文档

访问 `/llms.txt` 获取 LLM 友好的 API 文档，包含：
- 认证方式 (API Key)
- 文档 CRUD 接口
- 请求/响应格式

## License

MIT
