# DevTools

开发工具集 — 在线开发者工具箱。

## 功能

| 工具 | 说明 |
|------|------|
| JSON 工具 | 格式化、压缩、校验，树形折叠查看 |
| 时间戳转换 | 秒/毫秒戳、ISO 8601、RFC 2822、相对时间 |
| URL 编解码 | 自动识别编码/解码模式 |
| Base64 | 文本 + 文件编解码，文件本地处理 |
| 文本对比 | LCS 逐行 diff，新增/删除高亮 |
| 文件详情 | MD5/SHA-1/SHA-256、Base64、图片/视频尺寸 |
| 心愿墙 | 匿名留言，验证码防刷，管理员回复 |

## 项目结构

```
DevTools/
├── api/index.py           # Vercel serverless 入口
├── backend/
│   ├── app.py             # Flask 应用 + SEO 渲染 + 访问计数
│   ├── routes/            # API 蓝图（wishes）
│   └── service/           # cache_store (Upstash Redis) + wishes
├── frontend/
│   ├── index.html         # SPA 入口
│   ├── css/app.css        # 双主题样式
│   ├── js/                # 各工具模块 + app.js
│   └── locales/           # zh-CN / en
├── start.sh               # 开发/生产启动
├── requirements.txt
├── vercel.json
└── CLAUDE.md
```

## 快速开始

```bash
./start.sh start     # 生产模式（后台）
./start.sh debug     # 调试模式（前台）
./start.sh stop      # 停止
./start.sh status    # 状态
```

启动后：`http://127.0.0.1:8731`

## 环境变量

| 变量 | 说明 |
|------|------|
| `UPSTASH_REDIS_REST_URL` | Redis REST URL（可选，启用后访问计数/心愿墙走 Redis） |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST Token |
| `WISH_ADMIN_TOKEN` | 心愿墙管理员 Token（`.env.local`） |

## 技术栈

- **后端**: Python Flask + Upstash Redis REST
- **前端**: 原生 HTML/CSS/JS（无构建步骤）
- **部署**: Vercel serverless
