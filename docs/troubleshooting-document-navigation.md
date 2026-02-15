# 文档导航问题排查记录

## 问题现象

在生产环境 (Vercel) 中，点击文档或创建新文档后，页面会自动跳转回 `/documents` 列表页，无法正常进入文档编辑页面。

**表现**：
- 直接访问文档 URL（如 `/document/xxx-xxx-xxx`）可以正常工作
- 从 `/documents` 页面点击文档，或点击 "New Doc" 后创建文档，会跳转回列表页
- 本地开发环境没有这个问题

## 排查过程

### 1. 初步怀疑：Supabase 认证问题

最初怀疑是 Supabase Site URL / Redirect URLs 配置问题，导致 `getUser()` 返回 403。

**解决方案尝试**：在 Supabase Dashboard 配置正确的 URL。
- Site URL: `https://inkdraftmarkdowneditor.vercel.app`
- Redirect URLs: 添加生产域名和 localhost

**结果**：认证问题解决了，但文档导航问题仍然存在。

### 2. 添加调试日志

在关键位置添加 console.log 追踪问题：

```typescript
// document/[id]/page.tsx
console.log('[document] render', {
  url: window.location.href,
  paramsId: documentId,
});
```

### 3. 关键发现 #1：useParams() 返回错误值

通过日志发现了一个极其异常的行为：

```
[handleCreateDocument] Navigating to: /document/528f19bd-1ad5-4dcb-8b42-6a86604f9d28
[document] render {
  url: 'https://inkdraftmarkdowneditor.vercel.app/document/528f19bd-1ad5-4dcb-8b42-6a86604f9d28',
  paramsId: '%%drp:id:97bb514379b37%%',  // ← 完全不匹配！
}
```

**问题本质**：
- `router.push('/document/正确的UUID')` 被正确调用
- 浏览器地址栏 URL 是正确的
- 但 `useParams()` 返回了完全不同的占位符值 `%%drp:id:xxx%%`

### 4. 关键发现 #2：客户端导航不触发页面更新

即使修复了 `useParams()` 问题（直接从 URL 解析 ID），又发现新问题：

- URL 变成了正确的文档地址
- 但页面内容没有更新，还是显示 `/documents` 列表页
- 浏览器没有刷新，Next.js 客户端路由没有正确触发页面切换

### 5. 占位符分析

`%%drp:id:xxx%%` 格式的占位符：
- `drp` 可能代表 "document reference placeholder" 或其他含义
- 每次返回的占位符值都不同（不是固定的脏数据）
- 项目代码中没有生成这种占位符的逻辑

### 6. 根本原因（推测）

客户端路由出现问题的可能原因：

1. **浏览器扩展干扰**：某些浏览器扩展（翻译插件、密码管理器等）可能修改了页面状态
2. **Next.js / React 19 bug**：在某些特定情况下客户端路由可能失效
3. **并发渲染问题**：React 19 的并发模式可能导致状态不一致
4. **缓存问题**：Next.js 路由缓存可能返回了错误的数据

## 最终解决方案

### 修复 1：直接从 URL 解析 ID

绕过 `useParams()`，直接从 `window.location.pathname` 解析文档 ID：

```typescript
// app/document/[id]/page.tsx
const documentId = useMemo(() => {
  if (typeof window === 'undefined') {
    return params.id as string; // SSR fallback
  }
  const pathname = window.location.pathname;
  const match = pathname.match(/\/document\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  if (match) {
    return match[1];
  }
  return params.id as string; // Fallback
}, [params.id]);
```

### 修复 2：使用 window.location.href 替代 router.push()

用完整页面跳转替代客户端导航：

```typescript
// 修改前（有问题）
const handleCreateDocument = async (folderId?: string | null) => {
  const doc = await createNewDocument(folderId);
  router.push(`/document/${doc.id}`);  // 客户端导航
};

// 修改后（正常工作）
const handleCreateDocument = async (folderId?: string | null) => {
  const doc = await createNewDocument(folderId);
  window.location.href = `/document/${doc.id}`;  // 完整页面跳转
};
```

### 修复 3：过滤无效文档 ID

在 `DocumentList` 组件中过滤掉 ID 无效的文档，防止侧边栏显示假文档：

```typescript
// components/sidebar/DocumentList.tsx
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validDocuments = useMemo(
  () => documents.filter((doc) => UUID_REGEX.test(doc.id)),
  [documents]
);
```

## 涉及的文件

| 文件 | 修改内容 |
|------|----------|
| `app/document/[id]/page.tsx` | 从 URL 直接解析 ID；使用 window.location.href |
| `app/documents/page.tsx` | 使用 window.location.href 替代 router.push |
| `components/sidebar/DocumentList.tsx` | 过滤无效 ID 的文档 |

## 部署配置

### Supabase URL 配置

在 Supabase Dashboard → Authentication → URL Configuration 中配置：

**Site URL**:
```
https://inkdraftmarkdowneditor.vercel.app
```

**Redirect URLs**:
```
https://inkdraftmarkdowneditor.vercel.app
https://inkdraftmarkdowneditor.vercel.app/auth/callback
http://localhost:3000
http://localhost:3000/auth/callback
https://*.vercel.app
```

## 经验总结

### 遇到类似问题的排查思路

1. **添加日志**：在关键位置添加 console.log，追踪数据流
2. **对比 URL 和 params**：检查 `window.location.href` 和 `useParams()` 是否一致
3. **区分客户端/服务端**：判断是 SSR 还是客户端导航有问题
4. **尝试完整刷新**：用 `window.location.href` 替代客户端路由测试

### Next.js 客户端路由问题的通用 workaround

如果遇到 `router.push()` 或 `router.replace()` 不正常工作：

```typescript
// 方案 1：强制完整页面跳转
window.location.href = '/target-path';

// 方案 2：先跳转再刷新
router.push('/target-path');
window.location.reload();

// 方案 3：使用 router.refresh() + router.push
await router.refresh();
router.push('/target-path');
```

### 权衡

使用 `window.location.href` 的缺点：
- 失去了 SPA 的无刷新体验
- 页面会完全重新加载
- 状态会丢失（但本项目中状态存储在 Zustand + localStorage，影响不大）

优点：
- 100% 可靠
- 绕过 Next.js 客户端路由的潜在 bug
- 调试更简单

## 待进一步调查

1. 为什么 `useParams()` 会返回占位符值？
2. 占位符 `%%drp:id:xxx%%` 是从哪里来的？
3. 为什么只有生产环境有问题，本地开发环境正常？
4. 是否是特定浏览器或浏览器扩展导致的问题？

## 参考资料

- [Next.js useParams() 文档](https://nextjs.org/docs/app/api-reference/functions/use-params)
- [Next.js useRouter() 文档](https://nextjs.org/docs/app/api-reference/functions/use-router)
- [Supabase Auth URL Configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Next.js Client-side Navigation](https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating)
