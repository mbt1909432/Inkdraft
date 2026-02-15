# Inkdraft 移动端适配计划

## 当前布局分析

### 1. 文档编辑页 (`/document/[id]`)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Sidebar 256px] │ [Toolbar + Editor] │ [Outline 192px] │ [Chat] │
│                 │                     │                  │        │
│ - 文档列表      │ EditorToolbar       │ - 标题大纲       │ AI对话  │
│ - 文件夹        │ MarkdownEditor      │                  │        │
└─────────────────────────────────────────────────────────────────┘
```

**问题**：
- 3-4 列布局在 375px 屏幕上不可行
- 固定宽度的侧边栏会占用过多空间
- 工具栏按钮在小屏幕上溢出

### 2. 文档列表页 (`/documents`)

```
┌───────────────────────────────────────┐
│ [Sidebar 256px] │ [Document List]    │
│                 │                     │
│ - 文档列表      │ - 欢迎信息          │
│ - 文件夹        │ - 文档卡片          │
└───────────────────────────────────────┘
```

**问题**：
- 侧边栏占用一半宽度
- 文档列表空间不足

---

## 移动端目标布局

### 目标断点

| 断点 | 宽度范围 | 设备 |
|------|----------|------|
| xs | 0-374px | 小型手机 |
| sm | 375px-639px | 标准手机 |
| md | 640px-767px | 大手机/小平板 |
| lg | 768px+ | 平板/桌面 |

### 文档编辑页 - 移动端布局

```
┌─────────────────────────┐
│ [Toolbar - 精简版]      │
│ [Markdown Editor]       │
│                         │
│                         │
└─────────────────────────┘

底部操作栏:
┌─────────────────────────┐
│ 📄 │ 📋 │ 💬 │ ⚡ │ ⋯ │
└─────────────────────────┘

侧边栏/大纲/聊天 → 底部抽屉/全屏模态
```

### 文档列表页 - 移动端布局

```
┌─────────────────────────┐
│ [Header + 搜索]         │
│ [文档卡片列表]          │
│                         │
│                         │
│        [+ 新建]         │
└─────────────────────────┘

侧边栏 → 左滑抽屉
```

---

## 详细实施计划

### Phase 1: 基础设施 (P0)

#### 1.1 安装 Sheet 组件 (shadcn/ui)

```bash
npx shadcn@latest add sheet
```

#### 1.2 创建 useMediaQuery Hook

```typescript
// hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

// 预定义断点
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
```

#### 1.3 移动端检测与状态管理

```typescript
// lib/store/mobile-store.ts (新增)
import { create } from 'zustand';

interface MobileStore {
  sidebarSheetOpen: boolean;
  outlineSheetOpen: boolean;
  chatSheetOpen: boolean;
  moreMenuOpen: boolean;

  setSidebarSheetOpen: (open: boolean) => void;
  setOutlineSheetOpen: (open: boolean) => void;
  setChatSheetOpen: (open: boolean) => void;
  setMoreMenuOpen: (open: boolean) => void;
}

export const useMobileStore = create<MobileStore>((set) => ({
  sidebarSheetOpen: false,
  outlineSheetOpen: false,
  chatSheetOpen: false,
  moreMenuOpen: false,

  setSidebarSheetOpen: (open) => set({ sidebarSheetOpen: open }),
  setOutlineSheetOpen: (open) => set({ outlineSheetOpen: open }),
  setChatSheetOpen: (open) => set({ chatSheetOpen: open }),
  setMoreMenuOpen: (open) => set({ moreMenuOpen: open }),
}));
```

---

### Phase 2: 侧边栏移动端适配 (P0)

#### 2.1 创建 MobileSidebar 组件

```typescript
// components/sidebar/MobileSidebar.tsx
'use client';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMobileStore } from '@/lib/store/mobile-store';

interface MobileSidebarProps {
  // 与 Sidebar 相同的 props
  onCreateDocument?: (folderId?: string | null) => Promise<void>;
  onCreateFolder?: (parentId?: string | null) => Promise<void>;
  // ...
}

export function MobileSidebar({ ...props }: MobileSidebarProps) {
  const { sidebarSheetOpen, setSidebarSheetOpen } = useMobileStore();

  return (
    <Sheet open={sidebarSheetOpen} onOpenChange={setSidebarSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">打开菜单</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <Sidebar
          {...props}
          onSelectDocument={(id) => {
            props.onSelectDocument?.(id);
            setSidebarSheetOpen(false); // 选择后关闭
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
```

#### 2.2 响应式侧边栏容器

```typescript
// components/sidebar/ResponsiveSidebar.tsx
'use client';

import { useIsMobile } from '@/hooks/useMediaQuery';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';

interface ResponsiveSidebarProps {
  // 同上
}

export function ResponsiveSidebar(props: ResponsiveSidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileSidebar {...props} />;
  }

  return (
    <div className="w-64 shrink-0 overflow-hidden">
      <Sidebar {...props} />
    </div>
  );
}
```

---

### Phase 3: 工具栏移动端适配 (P0)

#### 3.1 创建 MobileToolbar 组件

```typescript
// components/editor/MobileToolbar.tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Save,
  Pin,
  PinOff,
  MoreHorizontal,
  Eye,
  Sparkles,
  Download,
  MessageSquare,
  LogOut,
} from 'lucide-react';
import { useDocumentStore } from '@/lib/store/document-store';

interface MobileToolbarProps {
  onSave?: () => Promise<void>;
  onTogglePin?: () => Promise<void>;
  onDraft?: () => void;
  onOpenChat?: () => void;
  onLogout?: () => void;
}

export function MobileToolbar({
  onSave,
  onTogglePin,
  onDraft,
  onOpenChat,
  onLogout,
}: MobileToolbarProps) {
  const { currentDocument, isSaving, hasUnsavedChanges } = useDocumentStore();

  return (
    <div className="flex items-center gap-1">
      {/* 主要操作 - 始终显示 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSave}
        disabled={isSaving || !hasUnsavedChanges}
        className="relative"
      >
        <Save className="h-5 w-5" />
        {hasUnsavedChanges && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenChat}
      >
        <MessageSquare className="h-5 w-5" />
      </Button>

      {/* 更多操作 - 下拉菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onTogglePin}>
            {currentDocument?.is_pinned ? (
              <>
                <PinOff className="h-4 w-4 mr-2" />
                取消置顶
              </>
            ) : (
              <>
                <Pin className="h-4 w-4 mr-2" />
                置顶文档
              </>
            )}
          </DropdownMenuItem>

          {onDraft && (
            <DropdownMenuItem onClick={onDraft}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI 起稿
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem>
            <Download className="h-4 w-4 mr-2" />
            导出文档
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onLogout} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

#### 3.2 响应式工具栏

```typescript
// components/editor/ResponsiveToolbar.tsx
'use client';

import { useIsMobile } from '@/hooks/useMediaQuery';
import { EditorToolbar } from './EditorToolbar';
import { MobileToolbar } from './MobileToolbar';

export function ResponsiveToolbar(props: EditorToolbarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileToolbar {...props} />;
  }

  return <EditorToolbar {...props} />;
}
```

---

### Phase 4: 大纲和聊天面板移动端适配 (P1)

#### 4.1 移动端大纲 - Bottom Sheet

```typescript
// components/sidebar/MobileOutline.tsx
'use client';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { OutlineView } from './OutlineView';
import { List } from 'lucide-react';
import { useMobileStore } from '@/lib/store/mobile-store';

export function MobileOutline() {
  const { outlineSheetOpen, setOutlineSheetOpen } = useMobileStore();

  return (
    <Sheet open={outlineSheetOpen} onOpenChange={setOutlineSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <List className="h-5 w-5" />
          <span className="sr-only">文档大纲</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[50vh]">
        <div className="h-full overflow-auto">
          <h3 className="font-semibold mb-4">文档大纲</h3>
          <OutlineView className="h-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

#### 4.2 移动端聊天 - 全屏模态

```typescript
// components/chat/MobileChat.tsx
'use client';

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChatPanel } from './ChatPanel';
import { MessageSquare, X } from 'lucide-react';
import { useMobileStore } from '@/lib/store/mobile-store';

interface MobileChatProps {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
}

export function MobileChat({ getMarkdown, setMarkdown }: MobileChatProps) {
  const { chatSheetOpen, setChatSheetOpen } = useMobileStore();

  return (
    <Dialog open={chatSheetOpen} onOpenChange={setChatSheetOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden relative">
          <MessageSquare className="h-5 w-5" />
          <span className="sr-only">AI 助手</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[90vh] max-w-full p-0">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">AI 编辑助手</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChatSheetOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <ChatPanel
            getMarkdown={getMarkdown}
            setMarkdown={setMarkdown}
            onClose={() => setChatSheetOpen(false)}
            className="flex-1 min-h-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Phase 5: 底部导航栏 (P1)

#### 5.1 创建 MobileBottomNav 组件

```typescript
// components/layout/MobileBottomNav.tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  FileText,
  List,
  MessageSquare,
  Sparkles,
  MoreHorizontal,
} from 'lucide-react';
import { useMobileStore } from '@/lib/store/mobile-store';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onDraft?: () => void;
}

export function MobileBottomNav({ onDraft }: MobileBottomNavProps) {
  const {
    sidebarSheetOpen,
    setSidebarSheetOpen,
    outlineSheetOpen,
    setOutlineSheetOpen,
    chatSheetOpen,
    setChatSheetOpen,
  } = useMobileStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t md:hidden">
      <div className="flex items-center justify-around h-14">
        {/* 文档列表 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex-1 h-full rounded-none flex flex-col gap-0.5",
            sidebarSheetOpen && "bg-accent"
          )}
          onClick={() => setSidebarSheetOpen(true)}
        >
          <FileText className="h-5 w-5" />
          <span className="text-xs">文档</span>
        </Button>

        {/* 大纲 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex-1 h-full rounded-none flex flex-col gap-0.5",
            outlineSheetOpen && "bg-accent"
          )}
          onClick={() => setOutlineSheetOpen(true)}
        >
          <List className="h-5 w-5" />
          <span className="text-xs">大纲</span>
        </Button>

        {/* AI 起稿 */}
        {onDraft && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-full rounded-none flex flex-col gap-0.5 text-primary"
            onClick={onDraft}
          >
            <Sparkles className="h-5 w-5" />
            <span className="text-xs">起稿</span>
          </Button>
        )}

        {/* AI 助手 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex-1 h-full rounded-none flex flex-col gap-0.5",
            chatSheetOpen && "bg-accent"
          )}
          onClick={() => setChatSheetOpen(true)}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs">AI</span>
        </Button>
      </div>
    </nav>
  );
}
```

---

### Phase 6: 编辑器区域适配 (P1)

#### 6.1 编辑器高度和间距

```css
/* globals.css - 添加移动端样式 */

/* 移动端编辑器底部留出导航栏空间 */
@media (max-width: 767px) {
  .markdown-editor-wrapper {
    padding-bottom: 60px; /* 底部导航栏高度 */
  }

  /* 移动端隐藏桌面版侧边栏 */
  .sidebar-desktop {
    display: none;
  }

  /* 移动端工具栏精简 */
  .toolbar-desktop-only {
    display: none;
  }
}

/* 触摸优化 */
@media (pointer: coarse) {
  /* 增大可点击区域 */
  .mdxeditor-toolbar button {
    min-width: 44px;
    min-height: 44px;
  }

  /* 防止双击缩放 */
  button, a, [role="button"] {
    touch-action: manipulation;
  }
}
```

#### 6.2 MDXEditor 移动端优化

```typescript
// components/editor/MarkdownEditor.tsx - 添加移动端配置

import { useIsMobile } from '@/hooks/useMediaQuery';

export function MarkdownEditor({ ...props }) {
  const isMobile = useIsMobile();

  const plugins = useMemo(() => [
    // ... 现有插件
    // 移动端精简工具栏
    ...(isMobile ? [
      // 只保留核心功能
      headingsPlugin(),
      listsPlugin(),
      linkPlugin(),
    ] : [
      // 桌面版完整功能
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      // ...
    ])
  ], [isMobile]);

  return (
    <MDXEditor
      // 移动端调整
      contentEditableClassName={cn(
        "prose prose-lg dark:prose-invert",
        isMobile && "prose-base px-4 py-3"  // 移动端更紧凑
      )}
    />
  );
}
```

---

### Phase 7: 文档列表页适配 (P2)

#### 7.1 响应式文档卡片

```typescript
// components/documents/DocumentCard.tsx
export function DocumentCard({ document }: { document: Document }) {
  return (
    <article className="
      border rounded-lg p-4
      hover:bg-accent/50 transition-colors cursor-pointer
      /* 移动端: 全宽, 紧凑间距 */
      /* 平板: 双列 */
      /* 桌面: 三列 */
    ">
      <h3 className="font-medium truncate">{document.title}</h3>
      <p className="text-sm text-muted-foreground mt-1">
        {formatDate(document.last_edited_at)}
      </p>
    </article>
  );
}
```

#### 7.2 响应式文档网格

```tsx
// app/documents/page.tsx
<div className="
  grid gap-4
  grid-cols-1
  sm:grid-cols-2
  lg:grid-cols-3
  xl:grid-cols-4
">
  {documents.map(doc => (
    <DocumentCard key={doc.id} document={doc} />
  ))}
</div>
```

---

## 实施优先级

| 优先级 | 任务 | 预计工作量 |
|--------|------|-----------|
| P0 | useMediaQuery Hook | 0.5h |
| P0 | shadcn Sheet 组件 | 0.5h |
| P0 | MobileSidebar + MobileToolbar | 2h |
| P1 | MobileBottomNav | 1h |
| P1 | MobileOutline + MobileChat | 2h |
| P1 | 编辑器移动端优化 | 1h |
| P2 | 文档列表页适配 | 1h |
| P2 | 全局样式和触摸优化 | 0.5h |

**总计**: 约 8-9 小时

---

## 测试清单

### 设备测试
- [ ] iPhone SE (375px) - 最小尺寸
- [ ] iPhone 14 (390px) - 标准尺寸
- [ ] iPhone 14 Pro Max (430px) - 大屏手机
- [ ] iPad Mini (768px) - 小平板
- [ ] iPad Pro (1024px) - 大平板

### 功能测试
- [ ] 侧边栏打开/关闭
- [ ] 文档选择和导航
- [ ] 工具栏所有按钮可点击
- [ ] AI 起稿功能
- [ ] AI 聊天功能
- [ ] 文档大纲导航
- [ ] 保存和同步
- [ ] 横屏模式

### 触摸测试
- [ ] 所有按钮触摸区域 ≥ 44x44px
- [ ] 无误触
- [ ] 滚动流畅
- [ ] 键盘弹出后布局正常

---

## 文件清单

### 新增文件
```
hooks/
  useMediaQuery.ts          # 媒体查询 Hook

lib/store/
  mobile-store.ts           # 移动端状态管理

components/
  sidebar/
    MobileSidebar.tsx       # 移动端侧边栏
    ResponsiveSidebar.tsx   # 响应式侧边栏
    MobileOutline.tsx       # 移动端大纲
  editor/
    MobileToolbar.tsx       # 移动端工具栏
    ResponsiveToolbar.tsx   # 响应式工具栏
  chat/
    MobileChat.tsx          # 移动端聊天
  layout/
    MobileBottomNav.tsx     # 底部导航栏
```

### 修改文件
```
app/document/[id]/page.tsx  # 集成响应式组件
app/documents/page.tsx      # 文档列表页适配
app/globals.css             # 移动端样式
components/editor/MarkdownEditor.tsx  # 编辑器适配
```
