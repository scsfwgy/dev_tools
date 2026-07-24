# DevTools — 项目上下文

## 产品定位

Tools24 / DevTools 是简洁、快速、注重隐私的在线开发者工具箱，部署于 `https://dev.tools24.uk`。当前提供 45 个公开工具，覆盖数据与编码、文本与文件、安全与网络、计算与效率，以及 Android / Flutter / iOS 开发速查。

域名职责必须严格区分：`dev.tools24.uk` 是本项目的正式站点和 SEO 主域名；`tools24.uk` / `www.tools24.uk` 是 Tools24 聚合门户；`qqq.tools24.uk` 是独立的 QQQ Tools 站点。不得把聚合门户域名用作本项目的 canonical、hreflang、Open Graph URL 或 sitemap 主域名。

首页提供工具搜索，以及“收藏 / 分类 / 推荐”三 Tab；三个 Tab 分别使用 `/{lang}/favorites`、`/{lang}/categories`、`/{lang}/recommended` 状态路由，支持直接访问、刷新以及浏览器前进后退。`/{lang}/` 默认展示分类。分类包含全部、开发调试、编码安全、文本文件、数据计算、开发速查、小游戏和日常效率。推荐 Tab 按投资理财、资源聚合、大模型、科学上网和加密交易分组展示外部资源。收藏仅保存在当前浏览器 `localStorage`。

## 架构

- 后端：Flask 3，应用入口与大部分 API 位于 `backend/app.py`
- API 蓝图：心愿墙位于 `backend/routes/wishes.py`
- 前端：原生 HTML/CSS/JavaScript，无 npm、打包器或构建步骤
- 页面模型：Flask 输出 SEO 壳，前端使用 History API 完成 SPA 导航
- 部署：Vercel serverless，入口 `api/index.py`，区域 `hkg1`
- 本地端口：默认 `8731`，可通过 `PORT` 覆盖
- 缓存：Upstash Redis REST / Vercel KV 可选；未配置时使用安全降级

## 核心文件

- `backend/app.py` — Flask 应用组装、蓝图注册、API noindex 响应头与注册表一致性检查
- `backend/app_settings.py` — 路径、站点主域名、外部服务配置和共享可变状态
- `backend/tool_data.py` — `TOOLS` SEO 数据、`TOOL_REGISTRY` 与 `TOOL_SUBPAGES`
- `backend/routes/site.py` — SEO HTML 壳、页面路由、静态资源、manifest、robots 与 sitemap
- `backend/routes/{stats,translate,area_search,content,wishes}.py` — 各服务端 API
- `frontend/index.html` — SPA 外壳、桌面侧栏、移动端顶部栏和设置面板
- `frontend/404.html` — 独立的双语、双主题 404 页面，兼容 Flask 与 Vercel 静态兜底
- `frontend/js/app.js` — i18n、History 路由、首页三 Tab、收藏、工具分类、推荐外链、菜单状态与工具脚本懒加载
- `frontend/js/*-tool.js` — 各工具的独立全局模块
- `frontend/css/app.css` — 主题变量、公共组件、工具样式和响应式规则
- `frontend/locales/{zh-CN,en}.json` — 全部界面文案
- `backend/tests/` — pytest 自动化测试
- `start.sh` — 虚拟环境、依赖、测试门禁和进程管理
- `vercel.json` — API、SEO、工具与子页面重写规则
- `WORK_LOG.md` — 功能变更、验证范围和技术决策

## 产品交付门禁（强制）

任何会交付给用户的功能新增、修复或重构，在宣布完成前都必须优先通过项目启动脚本验证，不得只运行零散命令或直接执行 `python backend/app.py` 后就交付。

1. 服务未运行时执行 `./start.sh start`；服务已经运行时执行 `./start.sh restart`。若当前端口上的进程明确由用户手动管理且本轮没有获准中断，至少执行 `./start.sh test`，并读取当前服务日志完成同等复盘。
2. 启动脚本必须先完成依赖检查与完整测试，再启动服务。观察脚本输出的“本次启动日志”，确认包含 `event=app_start` 和 `/api/health` 的 `event=http_request`，且没有 Traceback、ERROR 或未解释的 WARNING。
3. 使用 `./start.sh logs` 读取最近服务日志；随后用真实浏览器验证本轮涉及的桌面端、移动端、深浅主题和中英文场景，并关注浏览器控制台与失败网络请求。
4. 交付前复盘启动日志和核心业务日志：说明执行了什么、关键请求状态与耗时是否正常、是否存在错误或降级，以及遗留风险。没有完成启动、日志观察和浏览器验证时，不得声称产品已交付完成。

日志不得记录用户正文、翻译内容、密钥、管理员 Token、验证码或完整 IP。允许记录请求 ID、接口路径、状态码、耗时、工具 ID、业务类型、输入长度、缓存命中和降级原因。

## 工具注册与加载

`backend/tool_data.py` 的 `TOOL_REGISTRY` 是工具运行配置的单一事实来源，包含：

- `order`：默认菜单顺序
- `icon`：前端图标键
- `script` / `global`：懒加载脚本及加载完成后的全局对象
- `processing`：`local`、`hybrid` 或 `server`
- `indexable`：是否进入公开工具列表和 sitemap
- `hidden`：可选字段，是否隐藏于普通侧栏

`TOOLS` 保存各工具的中英文 SEO 元数据。所有 `indexable` 工具必须同时存在于 `TOOLS`，应用启动时会检查两者一致性。

## 前端交互现状

- 桌面侧栏支持完整、图标窄栏、沉浸模式三级循环，并持久化状态
- 移动端使用固定顶部栏、遮罩和抽屉菜单，不复用桌面折叠状态
- 设置入口位于侧栏底部，包含语言、主题、GitHub、心愿墙和访问次数
- 首页主搜索按本地化名称及工具 ID 匹配；按 Enter 打开第一项
- 首页搜索输入时自动切换到“分类 / 全部”，清空搜索后可继续切换收藏或分类
- 首页推荐 Tab 展示分组外链卡片，支持整卡新窗口打开和复制链接
- `HOME_CATEGORIES` 必须覆盖全部公开工具，且每个工具只能属于一个分类
- 侧栏与首页通过小型状态徽标区分本地、混合和云端处理
- 所有非首页工具页顶部由 `renderToolPageHeader` 统一注入左对齐标题和完整处理方式说明
- 工具收藏和大部分工具历史记录使用 `localStorage`
- 工具脚本仅在首次访问对应页面时动态加载
- 地区搜索使用服务端限量检索；AI 地区介绍必须由服务端根据地区编码构造路径，并保留缓存、限流和纯文本渲染，不能信任前端提示词或直接注入 HTML

## 路由与 SEO

- 首页：`/{lang}/`
- 首页 Tab：`/{lang}/{favorites|categories|recommended}`（状态路由，canonical 保持首页）
- 工具：`/{lang}/tool/{id}`
- 子页面：`/{lang}/{converter|flutter|android|ios}/{subpage}`
- 语言前缀：中文 `zh`，英文 `en`
- SEO 主域名：`https://dev.tools24.uk`
- 每个公开页面需要独立 title、description、canonical、hreflang 和结构化数据
- `robots.txt`、`sitemap.xml` 和页面 SEO 均由 Flask 生成
- 未匹配页面统一返回 `frontend/404.html`、HTTP 404 与 `noindex,nofollow`；不得改成 200 状态的软 404
- 新增或调整路由时必须同时检查 `vercel.json`

## 强制开发约定

1. **国际化**：所有新增用户可见文本必须进入 `frontend/locales/zh-CN.json` 与 `frontend/locales/en.json`；HTML 静态文本使用 `data-i18n`、`data-i18n-placeholder` 或 `data-i18n-aria-label`。
2. **主题**：新增颜色必须先定义为 `:root` / `[data-theme="light"]` CSS 自定义属性，保证深色与浅色主题可用。
3. **响应式**：桌面侧栏与 `max-width: 760px` 移动抽屉都要验证；交互控件应保持约 44px 的移动触控目标。
4. **隐私标识**：新增工具必须在 `TOOL_REGISTRY.processing` 中准确声明本地、混合或云端处理模式。
5. **本地处理**：文件、图片及敏感文本应优先完全在浏览器处理；不得无提示上传。
6. **懒加载**：新增工具脚本通过 `TOOL_REGISTRY` 注册，不得直接写入 `frontend/index.html`。
7. **SEO**：新增公开工具必须补齐 `TOOLS` 中英文元数据，并确认 sitemap、canonical 与 hreflang。
8. **历史记录**：适合重复操作的工具应复用统一 `.history-bar` 与 `localStorage` 方案。
9. **测试**：所有新功能和行为变更必须同步新增或更新自动化测试；测试不得访问真实 Redis、外部 API 或真实持久化数据。
10. **工作日志**：功能或行为变化必须记录到 `WORK_LOG.md`；无法自动测试时写明原因、范围和替代验证方式。

## 本地开发与验证

要求 Python 3.10+。

```bash
./start.sh test
./start.sh debug
./start.sh start
./start.sh restart
./start.sh status
./start.sh logs
./start.sh stop
```

`start`、`debug` 和 `restart` 都会强制先安装依赖并运行完整 pytest；测试失败时不会启动服务。这些命令不接受额外参数，传入 `--test` 或其他参数必须立即报错。`debug` 必须强制设置 `FLASK_DEBUG=1`、启用自动重载并只监听 `127.0.0.1`，防止交互式调试器暴露到局域网；`start/restart` 必须强制设置 `FLASK_DEBUG=0`。调试模式日志必须同时显示在当前终端并追加到 `logs/server.log`，可以在另一个终端执行 `./start.sh logs` 查看。

修改前端后至少执行：

```bash
node --check frontend/js/app.js
python -m json.tool frontend/locales/zh-CN.json >/dev/null
python -m json.tool frontend/locales/en.json >/dev/null
PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests -q
git diff --check
```

涉及布局时还需要人工检查桌面、`<=760px` 移动端、深色和浅色主题。

## 环境变量

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`（Vercel KV 兼容变量）
- `WISH_ADMIN_TOKEN`
- `DEV_TOOLS_DEEPSEEK_API_KEY`
- `SITE_URL`（SEO 主域名覆盖值，默认 `https://dev.tools24.uk`）
- `SEO_LAST_MODIFIED`
- `REQUEST_LOG`（默认开启结构化 API 请求日志）
- `TELEMETRY_WRITES`（本地默认关闭访问/点击写入；需要本地调试统计时显式设为 `1`）
- `HOST` / `PORT` / `FLASK_DEBUG`

本地密钥放在已忽略的 `.env.local`，不得提交真实密钥。

## 已知部署事项

- Vercel 生产环境应配置 Redis/KV，否则 serverless 实例间无法可靠共享访问计数、工具点击、内容生成和心愿墙数据。
- `WISH_ADMIN_TOKEN` 需要在本地与部署环境保持一致。
- 翻译功能只有配置 `DEV_TOOLS_DEEPSEEK_API_KEY` 后才能正常调用。
- `app_settings.SITE_URL` 与 `frontend/js/app.js` 的默认 `siteUrl` 必须保持为 `https://dev.tools24.uk`，不得指向聚合门户。
- 带版本号的 CSS/JavaScript 使用长期不可变缓存；修改静态文件时必须同步更新对应 URL 的版本参数。
- Google Analytics、Microsoft Clarity、Cloudflare Web Analytics 与 Vercel Web Analytics 只在页面加载完成后的空闲阶段加载，不得恢复为阻塞首屏的同步加载。
