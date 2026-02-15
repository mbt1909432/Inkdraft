# 部署后「Document not found」排查

上线后登录出现「Document not found / This document doesn't exist or you don't have access to it」，而本地正常，可按下面步骤排查。

## 0. 控制台出现「invalid input syntax for type uuid」/ 22P02

若控制台里看到 `id: "%%drp:id:xxx%%"` 或类似占位符，说明当前文档 ID **不是有效 UUID**（可能是占位符、缓存或外部注入的链接）。应用已做如下处理：

- **文档页**：若 URL 中的 `[id]` 不是合法 UUID，会直接跳转到 `/documents`，不再请求 Supabase。
- **getDocument**：若传入的 id 不是合法 UUID，会直接返回 `null`，不发起请求，避免 PostgreSQL 报 22P02。

若仍出现 22P02，请检查是否有其他地方（书签、外部链接、文档内容里的链接）使用了占位符或错误格式的文档 ID。

---

## 0.5 请求 `/auth/v1/user` 返回 403 Forbidden

若控制台或 Network 里看到 **`/auth/v1/user` 返回 403**，说明 Supabase Auth **拒绝了「获取当前用户」的请求**，常见原因：

1. **Site URL 与生产域名不一致**  
   - [Supabase Dashboard](https://supabase.com/dashboard) → 你的项目 → **Authentication** → **URL Configuration**  
   - **Site URL** 必须填成你的**生产环境首页**，例如：`https://你的域名.com` 或 `https://xxx.vercel.app`  
   - 不能是 `http://localhost:3000`，否则从生产域名发起的请求会被拒绝（403）。

2. **Redirect URLs 未包含生产回调**  
   - 同上 → **Redirect URLs** 中要有：`https://你的域名.com/auth/callback`（或你的实际生产域名 + `/auth/callback`）  
   - 否则登录回调可能失败，后续带 Session 的请求也可能被拒。

3. **生产环境用了错误的 Supabase 配置**  
   - 确认部署平台（如 Vercel）的环境变量里：  
     - `NEXT_PUBLIC_SUPABASE_URL` = 当前 Supabase 项目的 URL  
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = 该项目的 anon/public key  
   - 若填成别的项目或旧 key，也会出现 403。

改完 **Site URL / Redirect URLs / 环境变量** 后，清掉浏览器里该站点的 Cookie 再重新登录试一次。

**若出现 /documents 与 /login 来回跳**：多半是 403 未解决 → `/documents` 拿不到 user 就跳到 `/login`，登录或回调又回到 `/documents`，再次 403 又跳 `/login`。应用已改为用 `router.replace('/login')` 并避免重复跳转；根本解决仍是修正 Site URL 并清 Cookie 后重新登录。

---

## 1. 确认 Supabase 生产环境回调地址

登录依赖 OAuth 回调，Session 通过 Cookie 写入。**生产域名必须加入 Supabase 白名单**：

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard) → 你的项目
2. **Authentication** → **URL Configuration**
3. 在 **Redirect URLs** 中增加你的生产地址，例如：
   - `https://你的域名.com/auth/callback`
   - `https://xxx.vercel.app/auth/callback`
4. **Site URL** 建议设为生产首页，如：`https://你的域名.com`

未配置时，登录后可能拿不到 Session，文档请求会因无用户而返回「查无文档」。

## 2. 用 ?debug=1 看控制台

在**文档页**地址后加 `?debug=1`，例如：

- `https://你的域名.com/document/某个id?debug=1`

打开浏览器**开发者工具 → Console**，会多出两条日志：

- `[document] init`：当前 `documentId`、是否有用户、`userId` 前几位、当前 `origin`
- `[document] load result`：是否查到文档、文档列表数量、前几条文档 id

据此可判断：

- `hasUser: false` → 未登录或 Session 未写入，重点检查上面的 Redirect URLs 和 Cookie
- `docFound: false` 且 `documentsCount: 0` → 可能是 RLS 或 Session 导致查不到任何文档
- `docFound: false` 但 `documentsCount > 0` → 该文档可能不存在或无权访问

## 3. 行为说明：自动跳回文档列表

当「当前文档不存在或无权限」时，应用会**自动跳转到 `/documents`**，不再停留在「Document not found」页：

- 当前文档 id 不在你的文档列表里（过期链接、别的账号的文档等）→ 跳转
- 文档列表为空（例如新环境、新账号）→ 跳转

只有「文档列表里有这个 id，但单条查询却失败」的异常情况才会继续显示「Document not found」。

## 4. 服务端 / Supabase 错误日志

文档加载失败且**不是**「查无此文档」(PGRST116) 时，会在控制台打出完整 Supabase 错误，例如：

```
Error fetching document: { id: '...', code: '...', message: '...' }
```

可根据 `code` / `message` 查 [Supabase 文档](https://supabase.com/docs) 或检查 RLS 策略、网络。

## 5. 检查清单

| 项目 | 说明 |
|------|------|
| Redirect URLs | 生产域名下的 `/auth/callback` 已加入 Supabase |
| Site URL | 与生产首页一致 |
| 环境变量 | 生产环境已配置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Cookie | 生产为 HTTPS，浏览器中能看到 Supabase 相关 Cookie |
| 同一项目 | 本地和生产使用同一 Supabase 项目（不要混用不同项目的 key） |
