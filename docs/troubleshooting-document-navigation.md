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

### 3. 关键发现

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

### 4. 占位符分析

`%%drp:id:xxx%%` 格式的占位符：
- `drp` 可能代表 "document reference placeholder" 或其他含义
- 每次返回的占位符值都不同（不是固定的脏数据）
- 项目代码中没有生成这种占位符的逻辑

### 5. 根本原因（推测）

`useParams()` 在生产环境返回错误值的可能原因：

1. **浏览器扩展干扰**：某些浏览器扩展（翻译插件、密码管理器等）可能修改了页面状态
2. **Next.js / React 19 bug**：在某些特定情况下 `useParams()` 可能返回缓存的错误值
3. **并发渲染问题**：React 19 的并发模式可能导致状态不一致

## 解决方案

### Workaround：直接从 URL 解析 ID

绕过 `useParams()`，直接从 `window.location.pathname` 解析文档 ID：

```typescript
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

### 额外修复：过滤无效文档 ID

在 `DocumentList` 组件中过滤掉 ID 无效的文档，防止侧边栏显示假文档：

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validDocuments = documents.filter((doc) => UUID_REGEX.test(doc.id));
```

## 涉及的文件

| 文件 | 修改内容 |
|------|----------|
| `app/document/[id]/page.tsx` | 从 URL 直接解析 ID，绕过 useParams() |
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

## 待进一步调查

1. 为什么 `useParams()` 会返回占位符值？
2. 占位符 `%%drp:id:xxx%%` 是从哪里来的？
3. 为什么只有生产环境有问题，本地开发环境正常？

## 参考资料

- [Next.js useParams() 文档](https://nextjs.org/docs/app/api-reference/functions/use-params)
- [Supabase Auth URL Configuration](https://supabase.com/docs/guides/auth/redirect-urls)
