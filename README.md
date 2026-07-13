# DevTools / Tools24

简洁、快速、注重隐私的在线开发者工具箱，线上地址：[dev.tools24.uk](https://dev.tools24.uk)。

> `dev.tools24.uk` 是本项目的开发者工具站；`tools24.uk` / `www.tools24.uk` 是 Tools24 聚合门户，用于导航到 Dev Tools、QQQ Tools 等独立子站，两者不是同一个站点。

项目采用 Flask + 原生 HTML/CSS/JavaScript，无前端构建步骤。大多数工具完全在浏览器本地运行；需要服务端或混合处理的工具会在侧栏和工具卡片中明确标记。

## 主要特性

- 31 个开发、文件处理、计算、效率和移动开发速查工具
- 中英文界面、深色/浅色主题
- 首页搜索，以及“收藏 / 分类 / 推荐”三 Tab；无收藏时默认进入分类
- 桌面端三级侧栏；移动端顶部栏 + 抽屉导航
- 工具脚本按需加载，每个公开工具拥有独立 SEO URL
- 文件、图片、编解码和加解密等操作优先在浏览器本地完成
- Upstash Redis / Vercel KV 可选接入，并提供本地降级存储
- pytest 自动化测试作为启动与重启前置门禁

## 工具列表

| 分类 | 工具 |
|------|------|
| 数据与编码 | JSON 工具、代码格式化、时间戳转换、单位换算、正则测试、HTTP 速查、编码转换、Base64、JWT 工具 |
| 文本与文件 | 文本对比、文本处理、Markdown 编辑、文件详情、图片处理、文件转换 |
| 安全与网络 | AES/RSA 加解密、二维码、Curl 工具、Git 命令、终端命令、地区搜索 |
| 移动开发 | Android 常用与 Compose、Flutter Widgets/CLI/Packages、iOS SwiftUI/UIKit/Xcode/Info.plist |
| 计算与效率 | 个税计算、房贷计算、专注力训练、设备信息、AI 指令、翻译、内容生成 |

心愿墙通过设置面板进入，不参与公开工具索引。

## 处理模式

| 标识 | 含义 | 示例 |
|------|------|------|
| 本地 | 数据只在当前浏览器处理 | JSON、图片、文件转换、JWT、加解密 |
| 混合 | 页面本地运行，但部分信息请求服务端 | 设备信息（IP）、地区搜索（检索与 AI 介绍） |
| 云端 | 输入会发送到服务端完成处理 | 翻译、内容生成、心愿墙 |

## 项目结构

```text
DevTools/
├── api/index.py                 # Vercel serverless 入口
├── backend/
│   ├── app.py                   # Flask 应用组装、蓝图注册与启动检查
│   ├── app_settings.py          # 路径、站点地址、环境配置和共享状态
│   ├── tool_data.py             # 工具注册表、SEO 元数据与专题子页面
│   ├── routes/                  # 页面、SEO、统计、翻译、地区、内容及心愿墙 API
│   ├── service/                 # Redis REST、本地降级存储与心愿墙服务
│   └── tests/                   # pytest 测试套件
├── frontend/
│   ├── index.html               # SPA 外壳、侧栏与移动端导航
│   ├── 404.html                 # 双语、双主题的独立未找到页面
│   ├── css/app.css              # 全局组件及深浅主题
│   ├── js/app.js                # 路由、首页、菜单、i18n 与脚本懒加载
│   ├── js/*-tool.js             # 各工具模块
│   └── locales/                 # zh-CN.json / en.json
├── WORK_LOG.md                  # 功能与技术决策记录
├── CLAUDE.md                    # AI 编码上下文与强制约定
├── start.sh                     # 测试、启动、停止与状态管理
├── requirements.txt
└── vercel.json
```

## 本地运行

要求：Python 3.10+、`curl`，以及 macOS/Linux 常见命令行环境。

```bash
./start.sh test       # 创建虚拟环境、安装依赖并运行测试
./start.sh debug      # 测试通过后以前台调试模式启动
./start.sh start      # 测试通过后在后台启动
./start.sh restart    # 测试通过后重启
./start.sh status     # 查看运行状态
./start.sh stop       # 停止后台服务
```

启动后访问：<http://127.0.0.1:8731/zh/>

## 环境变量

本地变量可放在不会提交的 `.env.local` 中。

| 变量 | 必需 | 说明 |
|------|------|------|
| `UPSTASH_REDIS_REST_URL` | 否 | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | 否 | Upstash Redis REST Token |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | 否 | Vercel KV 兼容变量，可替代 Upstash 变量 |
| `WISH_ADMIN_TOKEN` | 生产建议 | 心愿墙管理、工具统计管理视图的鉴权 Token |
| `DEV_TOOLS_DEEPSEEK_API_KEY` | 翻译与地区 AI 介绍必需 | DeepSeek 接口密钥 |
| `SITE_URL` | 否 | 覆盖 SEO 主域名，默认 `https://dev.tools24.uk` |
| `SEO_LAST_MODIFIED` | 否 | 覆盖 sitemap 的最后修改日期 |
| `HOST` / `PORT` / `FLASK_DEBUG` | 否 | Flask 监听地址、端口和调试开关 |

未配置 Redis/KV 时，访问计数和心愿墙可使用本地降级存储；serverless 环境应配置远程存储。

## 路由与部署

- 首页：`/{zh|en}/`
- 工具页：`/{zh|en}/tool/{id}`
- 可索引子页面：`/{zh|en}/{converter|flutter|android|ios}/{subpage}`
- API、SEO 页面和 SPA 路由由 Vercel 重写到 `api/index.py`

工具清单、处理模式、脚本路径和索引状态统一维护在 `backend/tool_data.py` 的 `TOOL_REGISTRY` 中；中英文 SEO 数据位于同文件的 `TOOLS`，专题子页面位于 `TOOL_SUBPAGES`。应用启动时会检查公开工具注册表与 SEO 数据是否一致。

## 站点域名

| 域名 | 职责 |
|------|------|
| `https://dev.tools24.uk` | 本项目 Dev Tools 的正式站点与 SEO 主域名 |
| `https://tools24.uk` / `https://www.tools24.uk` | Tools24 聚合门户，不是本项目的 canonical 域名 |
| `https://qqq.tools24.uk` | 独立的 QQQ Tools 站点 |

页面 canonical、Open Graph URL、hreflang、sitemap 及前端 manifest 的站点地址都应保持为 `https://dev.tools24.uk`。

生产部署对带版本号的 CSS/JavaScript 使用长期不可变缓存；语言包、工具 manifest 和公开 HTML 使用 CDN 缓存与 `stale-while-revalidate`。Google Analytics 与 Microsoft Clarity 会在页面加载完成后的空闲阶段再加载，避免阻塞首屏。

## 测试

```bash
./start.sh test
# 或
PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests -q
```

测试会隔离真实 Redis、外部 API、访问计数和心愿墙持久化数据。
