# DevTools — 项目上下文

## 架构
- 后端：Flask (Python)，蓝图路由
- 前端：原生 HTML/CSS/JS，Flask 直接托管
- 部署：Vercel serverless，入口 `api/index.py`
- 端口：8730

## 关键文件
- `backend/app.py` — Flask 入口，静态文件托管，健康检查
- `start.sh` — 开发/生产启动脚本，venv 管理
- `vercel.json` — Vercel 路由（所有请求 → api/index.py）

## 约定
- 无构建步骤，前端纯 HTML/CSS/JS
- 国际化文件：`frontend/locales/{lang}.json`
- 蓝图在 `app.py` 中注册
- `.env.local` 存放密钥（gitignore）

## 强制要求（后续所有功能必须遵守）
- **国际化**：所有用户可见文本必须使用 `data-i18n` 属性 + locale JSON。必须同时支持中文（`zh-CN`）和英文（`en`）。
- **换肤**：所有颜色必须引用 CSS 自定义属性（见 `app.css` 中的 `:root` / `[data-theme="light"]`）。必须同时支持深色和浅色主题。
- **设置面板**：语言和主题选择器位于右上角齿轮下拉菜单中。后续所有全局偏好设置都放这里。
