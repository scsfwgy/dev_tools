# DevTools — 项目上下文

## 架构
- 后端：Flask (Python)，蓝图路由
- 前端：原生 HTML/CSS/JS，Flask 直接托管
- 部署：Vercel serverless，入口 `api/index.py`
- 端口：8730
- 缓存：Upstash Redis REST（可选），`service/cache_store.py`

## 关键文件
- `backend/app.py` — Flask 入口，静态文件托管，SEO 渲染，访问计数
- `start.sh` — 开发/生产启动脚本，venv 管理
- `vercel.json` — Vercel 路由（所有请求 → api/index.py）

## 约定
- 无构建步骤，前端纯 HTML/CSS/JS
- 国际化：`frontend/locales/{lang}.json`
- 蓝图在 `app.py` 中注册
- `.env.local` 存放密钥（gitignore）

## 强制要求
- **国际化**：所有用户可见文本使用 `data-i18n` + locale JSON，中英双语。新功能必须同步更新两个 locale 文件。
- **换肤**：所有颜色引用 CSS 自定义属性（`:root` / `[data-theme="light"]`），深色+浅色双主题。
- **设置面板**：语言/主题选择器在右上角齿轮菜单。
- **SEO**：每个功能页面独立 URL（`/{lang}/tool/{id}`），`history.pushState` 同步。
- **路由检查**：新增路由需检查 vercel.json。
- **历史记录**：每个工具在底部有统一 `.history-bar`，localStorage 持久化。
- **本地处理**：文件相关操作不上传服务器，全部浏览器本地完成。
