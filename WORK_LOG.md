# 工作日志

## 项目概况

DevTools — 在线开发者工具箱，部署于 [tools24.uk](https://tools24.uk)。  
Flask + 原生 HTML/CSS/JS + Vercel serverless 架构。

## 已完成功能

| 日期 | 功能 | 说明 |
|------|------|------|
| 2026-07-05 | 项目初始化 | 基于 GlobalAssetHistory 架构搭建，Flask 静态托管 + Vercel 部署 |
| 2026-07-05 | 设置面板 | 语言切换（中/英）、深色/浅色双主题，右上角齿轮菜单 |
| 2026-07-05 | 左侧菜单 + JSON 工具 | SPA 菜单布局，JSON 格式化/压缩/树形查看，拖拽分栏 |
| 2026-07-05 | 统计分析 | Google Analytics (G-9GGHE7F51W) + Microsoft Clarity (xhmbupqg3l) + 百度站长验证 |
| 2026-07-05 | 时间戳转换 | 秒/毫秒戳、ISO 8601、RFC 2822、相对时间、实时时钟，支持自动解析 |
| 2026-07-05 | URL 编解码 | 自动识别编码/解码模式，支持手动切换 |
| 2026-07-05 | Base64 编解码 | 文本 + 文件双模式，文件本地处理不上传服务器 |
| 2026-07-05 | 文本对比 | LCS 逐行 diff，新增/删除高亮，行号显示 |
| 2026-07-05 | 文件详情 | 文件名/大小/类型/修改时间、MD5(pure-JS)/SHA-1/SHA-256、Base64 预览、图片/视频尺寸 |
| 2026-07-05 | SEO 优化 | 每个工具独立 meta 标签、canonical、hreflang、sitemap |
| 2026-07-05 | 心愿墙 | 匿名留言、SVG 验证码防刷、管理员回复/删除、频率限制(5 次/10 分钟) |
| 2026-07-06 | Redis 缓存 | Upstash Redis REST 客户端(`dev_tools:`前缀)，访问计数+心愿墙双轨（Redis/本地文件） |
| 2026-07-06 | 设置面板完善 | 访问次数移入设置面板、新增 GitHub 链接、面板贴近设置按钮弹出 |
| 2026-07-06 | Loading 防误点 | 心愿墙提交/回复/删除按钮 loading 状态，文案国际化 |
| 2026-07-06 | 端口调整 | 本地端口 8730 → 8731 |
| 2026-07-06 | 菜单文案 | 「编码转换」→「URL编码转换」 |
| 2026-07-06 | 编码工具增强 | 新增分类标签：URL编码、UTF-8字节、Unicode转义、ASCII/Native、Base64、Base32、Base16 七类互转 |
| 2026-07-06 | Markdown 编辑预览 | 实时预览、上传 .md、下载 HTML/DOC/PDF/MD、左右拖拽分栏 |
| 2026-07-06 | 加解密工具 | AES-GCM/CBC 对称加密 + RSA-OAEP 非对称加密，Web Crypto API 浏览器本地处理 |

## 技术决策

- **无构建步骤**：前端纯 HTML/CSS/JS，无 npm/webpack
- **本地处理**：文件操作不上传服务器，全部浏览器本地完成（FileReader/Blob/crypto.subtle）
- **MD5**：纯 JS 实现（RFC 1321），因为 `crypto.subtle` 不支持 MD5
- **验证码**：SVG 手绘（无 Pillow 依赖），Redis + 本地双轨
- **Redis**：Upstash REST API，优雅降级（未配置 → 本地 JSON 文件）
- **端口**：开发 8731，Vercel 生产环境由 `PORT` 环境变量控制

## 关键配置

| 文件 | 用途 |
|------|------|
| `.env.local` | 本地密钥（WISH_ADMIN_TOKEN、Upstash Redis）|
| `requirements.txt` | Python 依赖（Flask、Flask-Cors、requests）|
| `vercel.json` | Vercel 路由重写规则 |
| `start.sh` | 开发/生产启动脚本 |

## 开发规范（必须遵守）

1. **国际化**：所有用户可见文本使用 `data-i18n` + locale JSON，中英双语
2. **换肤**：所有颜色引用 CSS 自定义属性（`:root` / `[data-theme="light"]`）
3. **SEO**：每个功能页面独立 URL（`/{lang}/tool/{id}`），`history.pushState` 同步
4. **历史记录**：每个工具底部统一 `.history-bar`，localStorage 持久化
5. **本地处理**：文件操作不上传服务器
6. **路由检查**：新增路由需检查 `vercel.json`

## 遗留事项

- Vercel 生产环境需配置环境变量：`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`、`WISH_ADMIN_TOKEN`
- 心愿墙管理 token 需在 `.env.local` 和 Vercel 环境变量中保持同步
