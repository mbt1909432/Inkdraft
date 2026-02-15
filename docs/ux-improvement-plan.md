# Inkdraft UX 改进计划

基于 UI/UX Pro Max 规则分析，按优先级列出改进项。

## 1. Accessibility (CRITICAL) - 关键改进

### 1.1 缺少 aria-label 的按钮

**问题**：部分按钮缺少 aria-label，屏幕阅读器无法识别

**位置**：`components/sidebar/Sidebar.tsx`

```tsx
// 当前代码（第 167-179 行）
<button
  onClick={() => setActiveFolderId(null)}
  className={cn(...)}
>
  <FileText className="h-4 w-4" />
  <span>{t('sidebar.allDocuments')}</span>
</button>

// 改进后
<button
  onClick={() => setActiveFolderId(null)}
  className={cn(...)}
  aria-label={t('sidebar.allDocuments')}
  aria-pressed={activeFolderId === null}
>
```

### 1.2 文件夹展开按钮缺少 aria-expanded

**位置**：`components/sidebar/Sidebar.tsx` 第 267 行

```tsx
// 当前代码
<button onClick={() => setIsOpen(!isOpen)} className="p-0.5">

// 改进后
<button
  onClick={() => setIsOpen(!isOpen)}
  className="p-0.5"
  aria-label={isOpen ? t('folder.collapse') : t('folder.expand')}
  aria-expanded={isOpen}
>
```

### 1.3 搜索框缺少 label 关联

**位置**：`components/sidebar/Sidebar.tsx` 第 138-143 行

```tsx
// 当前代码
<Input
  placeholder={t('sidebar.searchDocuments')}
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="pl-8"
/>

// 改进后
<div className="relative">
  <label htmlFor="document-search" className="sr-only">
    {t('sidebar.searchDocuments')}
  </label>
  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
  <Input
    id="document-search"
    placeholder={t('sidebar.searchDocuments')}
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-8"
  />
</div>
```

---

## 2. Touch & Interaction (CRITICAL) - 关键改进

### 2.1 触摸目标尺寸不足

**问题**：部分按钮/点击区域小于 44x44px 的最小触摸目标

**位置**：`components/sidebar/Sidebar.tsx`

```tsx
// 当前代码 - 文件夹展开按钮太小
<button onClick={() => setIsOpen(!isOpen)} className="p-0.5">

// 改进后 - 增加触摸区域
<button
  onClick={() => setIsOpen(!isOpen)}
  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
>
```

### 2.2 文档列表项缺少 cursor-pointer

**位置**：`components/sidebar/DocumentList.tsx` 第 136 行

```tsx
// 当前已经有 cursor-pointer，确认正确
className={cn(
  'group flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer hover:bg-accent transition-colors',
  ...
)}
```
✅ 已正确实现

### 2.3 创建文档按钮加载状态

**位置**：`components/sidebar/Sidebar.tsx` 第 148-158 行

```tsx
// 当前代码
<Button
  variant="outline"
  size="sm"
  className="flex-1"
  onClick={handleCreateDocument}
  disabled={isCreating}
>
  <Plus className="h-4 w-4 mr-1" />
  {t('sidebar.newDoc')}
</Button>

// 改进后 - 显示加载状态
<Button
  variant="outline"
  size="sm"
  className="flex-1"
  onClick={handleCreateDocument}
  disabled={isCreating}
>
  {isCreating ? (
    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
  ) : (
    <Plus className="h-4 w-4 mr-1" />
  )}
  {isCreating ? t('sidebar.creating') : t('sidebar.newDoc')}
</Button>
```

---

## 3. Layout & Responsive (HIGH) - 高优先级

### 3.1 移动端侧边栏改进

**问题**：移动端侧边栏没有覆盖屏幕，影响编辑体验

**改进方案**：添加移动端抽屉模式

```tsx
// 在 Sidebar.tsx 中添加移动端检测
import { useMediaQuery } from '@/hooks/useMediaQuery';

// 在组件内
const isMobile = useMediaQuery('(max-width: 768px)');

// 移动端使用 Sheet/Drawer 组件
{isMobile && sidebarOpen && (
  <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
    <SheetContent side="left" className="w-80">
      {/* Sidebar content */}
    </SheetContent>
  </Sheet>
)}
```

### 3.2 工具栏响应式优化

**问题**：小屏幕上工具栏按钮过多，布局拥挤

**改进方案**：将次要操作收入下拉菜单

```tsx
// 在 EditorToolbar.tsx 中
// 将 Pin、Outline、Theme 等次要操作放入 "更多" 菜单
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" className="md:hidden">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {/* 移动端显示的次要操作 */}
    <DropdownMenuItem onClick={toggleOutline}>
      {outlineOpen ? t('editor.hideOutline') : t('editor.showOutline')}
    </DropdownMenuItem>
    <DropdownMenuItem onClick={onTogglePin}>
      {currentDocument.is_pinned ? t('editor.unpin') : t('editor.pin')}
    </DropdownMenuItem>
    {/* ... */}
  </DropdownMenuContent>
</DropdownMenu>
```

---

## 4. Loading States (HIGH) - 高优先级

### 4.1 文档加载骨架屏

**问题**：文档加载时只显示 "Loading..."，用户体验差

**位置**：`app/document/[id]/page.tsx`

```tsx
// 当前代码
if (isLoading) {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    </div>
  );
}

// 改进后 - 使用骨架屏
if (isLoading) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r border-border p-4 space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-8">
        <Skeleton className="h-8 w-1/3 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    </div>
  );
}
```

### 4.2 空状态改进

**问题**：空文档列表显示过于简单

**位置**：`components/sidebar/DocumentList.tsx`

```tsx
// 当前代码
if (sortedDocuments.length === 0) {
  return (
    <div className="text-sm text-muted-foreground text-center py-4">
      No documents yet
    </div>
  );
}

// 改进后 - 添加引导
if (sortedDocuments.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground mb-2">
        {searchQuery ? t('documentList.noSearchResults') : t('documentList.noDocuments')}
      </p>
      {!searchQuery && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateDocument}
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('sidebar.newDoc')}
        </Button>
      )}
    </div>
  );
}
```

---

## 5. Animation & Transitions (MEDIUM) - 中优先级

### 5.1 侧边栏切换动画

**问题**：侧边栏打开/关闭没有过渡动画

```tsx
// 在 Sidebar.tsx 中添加过渡
<aside
  className={cn(
    'flex flex-col h-screen bg-background border-r border-border w-full min-w-0',
    'transition-all duration-300 ease-in-out'  // 添加过渡
  )}
  style={{
    width: sidebarOpen ? sidebarWidth : 0,
    opacity: sidebarOpen ? 1 : 0,
  }}
>
```

### 5.2 文档列表项进入动画

```tsx
// 在 DocumentList.tsx 中添加 staggered 动画
<ul className="space-y-0.5">
  {sortedDocuments.map((doc, index) => (
    <li
      key={doc.id}
      className="animate-slide-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <DocumentItem ... />
    </li>
  ))}
</ul>
```

---

## 6. Typography (MEDIUM) - 中优先级

### 6.1 文档标题可编辑指示

**问题**：用户不知道标题可以点击编辑

```tsx
// 在 DocumentItem 中添加悬停效果
<span
  className="truncate group-hover:text-primary transition-colors"
  title={document.title}  // 添加完整标题的 tooltip
>
  {document.title}
</span>
```

### 6.2 字体优化

**问题**：中文环境下字体可能不一致

```css
/* 在 globals.css 中添加 */
body {
  font-family: var(--font-sans), "PingFang SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## 7. Error Handling (HIGH) - 高优先级

### 7.1 错误 Toast 组件

**问题**：错误使用 alert()，体验差

**改进**：使用 Toast 组件

```tsx
// 创建 Toast context
// components/ui/toast.tsx
import { toast } from 'sonner';

// 使用示例
toast.error(t('editor.draftFailed'), {
  description: error.message,
  action: {
    label: t('common.retry'),
    onClick: () => handleRetry(),
  },
});
```

### 7.2 网络错误状态

**问题**：WebSocket 断开时没有明显提示

```tsx
// 在 EditorToolbar 中添加更明显的离线指示
{syncStatus === 'offline' && (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
    <WifiOff className="h-4 w-4" />
    <span>{t('editor.offlineWarning')}</span>
  </div>
)}
```

---

## 实施优先级

| 优先级 | 改进项 | 预计工作量 |
|--------|--------|-----------|
| P0 | 触摸目标尺寸、aria-label | 1-2小时 |
| P0 | 错误处理改用 Toast | 2小时 |
| P1 | 加载骨架屏 | 2小时 |
| P1 | 空状态改进 | 1小时 |
| P2 | 移动端侧边栏抽屉 | 3小时 |
| P2 | 工具栏响应式优化 | 2小时 |
| P3 | 动画过渡 | 1小时 |
| P3 | 字体优化 | 0.5小时 |

---

## 下一步行动

1. 先实施 P0 优先级的改进
2. 创建 Toast 组件替换 alert
3. 添加骨架屏组件
4. 改进移动端体验
