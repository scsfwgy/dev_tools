// DevTools — sidebar menu + i18n + theme
(function () {
  const STORAGE_LANG = "devtools_lang";
  const STORAGE_THEME = "devtools_theme";
  const STORAGE_MENU = "devtools_menu_collapsed";
  const STORAGE_CLICKS = "devtools_tool_clicks";

  let locale = {};
  let currentLang = localStorage.getItem(STORAGE_LANG) || "zh-CN";
  let currentTheme = localStorage.getItem(STORAGE_THEME) || "dark";
  let globalStats = {};  // {tool_id: count} from Redis, refreshed on load
  let visitCountValue = null;
  let visitCountUnavailable = false;
  var _clockTimer = null;

  // ── local click tracking ──
  function loadLocalClicks() {
    try { return JSON.parse(localStorage.getItem(STORAGE_CLICKS)) || {}; } catch (e) { return {}; }
  }
  function saveLocalClick(toolId) {
    if (toolId === "home") return;
    var clicks = loadLocalClicks();
    clicks[toolId] = (clicks[toolId] || 0) + 1;
    localStorage.setItem(STORAGE_CLICKS, JSON.stringify(clicks));
  }
  function postGlobalClick(toolId) {
    if (toolId === "home") return;
    fetch("/api/tool-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_id: toolId }),
    }).catch(function () {}); // fire-and-forget
  }

  // ── 菜单定义 ──
  const menuItems = [
    { id: "home",     icon: "home",       i18n: "menu.home" },
    { id: "device",   icon: "console",    i18n: "menu.device" },
    { id: "json",     icon: "json",       i18n: "menu.json" },
    { id: "format",   icon: "code",       i18n: "menu.format" },
    { id: "timestamp",icon: "clock",      i18n: "menu.timestamp" },
    { id: "unitconvert",icon: "ruler",    i18n: "menu.unitconvert" },
    { id: "regex",    icon: "code",       i18n: "menu.regex" },
    { id: "http",     icon: "console",    i18n: "menu.http" },
    { id: "encoder",  icon: "code",       i18n: "menu.encoder" },
    { id: "crypto",   icon: "shield",    i18n: "menu.crypto" },
    { id: "android",  icon: "android",   i18n: "menu.android" },
    { id: "translate",icon: "translate",i18n: "menu.translate" },
    { id: "git",      icon: "git",      i18n: "menu.git" },
    { id: "terminal", icon: "console",  i18n: "menu.terminal" },
    { id: "ai",       icon: "ai",       i18n: "menu.ai" },
    { id: "qrcode",   icon: "qr",        i18n: "menu.qrcode" },
    { id: "curl",     icon: "terminal",  i18n: "menu.curl" },
    { id: "base64",   icon: "lock",       i18n: "menu.base64" },
    { id: "diff",     icon: "diff",       i18n: "menu.diff" },
    { id: "text",     icon: "code",       i18n: "menu.text" },
    { id: "tax",      icon: "dollar",     i18n: "menu.tax" },
    { id: "mortgage", icon: "home",       i18n: "menu.mortgage" },
    { id: "fileinfo", icon: "file",       i18n: "menu.fileinfo" },
    { id: "markdown", icon: "md",         i18n: "menu.markdown" },
    { id: "wishes",   icon: "star",       i18n: "menu.wishes", hidden: true },
  ];

  const seoMeta = {
    "zh-CN": {
      home: {
        title: "Tools24 在线开发者工具箱 - JSON格式化 加解密 QR码 Android参考 Markdown | Tools24",
        description: "Tools24 提供在线 JSON 格式化、编解码转换、加解密(AES/RSA)、二维码生成解析、Markdown 编辑、Android 开发速查、时间戳转换等开发者工具。"
      },
      device: {
        title: "设备信息工具 - 浏览器 平台 时区 IP User-Agent | Tools24",
        description: "查看当前设备和浏览器环境信息：毫秒级时间、IP、平台、语言、时区、浏览器、系统、屏幕、视口、CPU、内存、主题、触控和网络。"
      },
      json: {
        title: "JSON格式化校验工具 - 在线 JSON Formatter / Viewer | Tools24",
        description: "在线 JSON 格式化、压缩、校验和树形查看工具，支持快速检查 JSON 语法错误并复制格式化结果。"
      },
      format: {
        title: "代码格式化工具 - HTML CSS JS TS YAML XML Markdown | Tools24",
        description: "在线代码格式化工具，基于 Prettier 支持 HTML、CSS、SCSS、JavaScript、TypeScript、JSON、YAML、XML、Markdown 等多种语言的智能美化。"
      },
      timestamp: {
        title: "时间戳转换工具 - Unix Timestamp 在线转换 | Tools24",
        description: "在线时间戳转换工具，支持秒/毫秒时间戳、日期时间、ISO 8601、UTC 和本地时间互转。"
      },
      unitconvert: {
        title: "单位换算工具 - 长度 温度 数据存储 压力 能量 燃油经济性 | Tools24",
        description: "在线单位换算工具，提供长度、面积、体积、质量、速度、温度、风力、数据存储、时间、压力、能量、功率、角度、流量、烹饪容量和燃油经济性 16 类实时换算。"
      },
      text: {
        title: "在线文本处理工具 - 去重排序大小写多行转换 | Tools24",
        description: "在线文本处理工具，支持去空行、去重、排序、大小写、空白整理，以及多行转 JSON、CSV、SQL IN 和带引号列表。"
      },
      regex: {
        title: "正则表达式测试工具 - Regex 在线匹配替换 | Tools24",
        description: "在线正则表达式测试工具，支持实时匹配高亮、JavaScript flags、捕获组、命名捕获组、替换预览和常用正则模板。"
      },
      http: {
        title: "HTTP 状态码与 Header 速查 - 请求头响应头 | Tools24",
        description: "HTTP 状态码和 Header 在线速查，覆盖请求头、响应头、缓存、CORS、安全 Header，支持分类搜索和一键复制。"
      },
      tax: {
        title: "工资个税计算器 - 累计预扣 七级税阶明细 | Tools24",
        description: "中国大陆工资个税估算，采用累计预扣法，展示1至12月预扣税额、七级超额累进税阶分档税额，并对比年终奖单独与合并计税。"
      },
      mortgage: {
        title: "房贷计算器 - 等额本息 等额本金 月供对比 | Tools24",
        description: "在线房贷计算器，支持等额本息和等额本金两种还款方式，对比月供、利息总额和还款总额。"
      },
      encoder: {
        title: "在线编码转换工具 - URL编码 Base64 Base32 Base16 Unicode UTF-8 | Tools24",
        description: "在线编码转换工具，支持 URL编解码、Base64、Base32、Base16、Unicode转义、UTF-8字节、ASCII 等七类互转。"
      },
      base64: {
        title: "Base64编码解码工具 - Base64 Encode Decode 在线转换 | Tools24",
        description: "在线 Base64 编码解码工具，支持文本和文件转 Base64、Base64 还原下载文件。"
      },
      diff: {
        title: "文本对比工具 - 在线 Diff / 代码差异比较 | Tools24",
        description: "在线文本对比和代码 Diff 工具，快速比较两段文本的新增、删除和相同内容。"
      },
      fileinfo: {
        title: "文件详情和 MD5/SHA 哈希校验工具 | Tools24",
        description: "在线查看文件大小、类型、图片尺寸、音视频信息，并计算 MD5、SHA-1、SHA-256 和 Base64。"
      },
      markdown: {
        title: "Markdown 在线编辑预览工具 | Tools24",
        description: "在线编辑和预览 Markdown，支持实时渲染，可下载为 HTML、DOC 或 Markdown 文件。"
      },
      crypto: {
        title: "在线加解密工具 - AES RSA 对称非对称加密 | Tools24",
        description: "在线加解密工具，支持 AES-GCM/CBC 对称加密和 RSA-OAEP 非对称加密，基于浏览器 Web Crypto API 本地处理。"
      },
      android: {
        title: "Android 常用速查 - API ADB 权限 Intent Gradle 对照 | Tools24",
        description: "Android 开发者常用速查：API Level、ADB 命令、透明度、dp/px、权限、Intent、Manifest 配置、资源限定符、生命周期和官方文档地址。"
      },
      qrcode: {
        title: "在线二维码生成解析工具 - QR Code Generator Parser | Tools24",
        description: "在线二维码生成和解析工具，支持文本/链接生成二维码图片下载，上传/粘贴二维码图片解析内容。"
      },
      curl: {
        title: "在线 Curl 命令构建转换工具 - Curl Builder Converter | Tools24",
        description: "在线 Curl 工具集：可视化构建 curl 命令、常用示例速查、curl 转 Python/JavaScript/Go/Java 代码。"
      },
      terminal: {
        title: "终端常用命令速查 - Shell 命令参考 Linux 运维 | Tools24",
        description: "终端常用命令速查表，覆盖文件操作、文本处理、进程管理、网络工具、系统信息、权限管理、压缩归档和 Shell 技巧，面向运维人员和终端用户。"
      },
      translate: {
        title: "在线翻译工具 - 中英互译 单词音标 DeepSeek | Tools24",
        description: "基于 DeepSeek 的智能翻译工具，自动检测中英文方向，短词显示音标和词性，长文纯翻译，离开输入框自动翻译。"
      },
      git: {
        title: "Git 常用命令速查 - Git Cheat Sheet 远程地址替换 | Tools24",
        description: "Git 常用命令速查表，覆盖基础操作、分支管理、撤销回退、远程管理、暂存日志、标签子模块和高级操作，支持一键替换远程地址和分支名。"
      },
      ai: {
        title: "AI 指令速查 - Claude Code 与 Codex CLI 对照 | Tools24",
        description: "Claude Code 与 Codex CLI 指令速查，涵盖快速开始、会话管理、自动化、权限安全、MCP、插件和代码审查，并提供常用功能对照。"
      }
    },
    en: {
      home: {
        title: "Tools24 Online Developer Toolbox - JSON Encryption QR Code Android Markdown | Tools24",
        description: "Tools24 provides online developer tools: JSON formatting, codec converter, AES/RSA encryption, QR code generator & parser, Markdown editor, Android dev reference and more."
      },
      device: {
        title: "Device Info - Browser Platform Timezone IP User-Agent | Tools24",
        description: "Inspect current device and browser info including millisecond clock, IP, platform, language, timezone, browser, OS, screen, viewport, CPU, memory, theme, touch and network."
      },
      json: {
        title: "JSON Formatter and Validator Online | Tools24",
        description: "Format, validate, compact and inspect JSON online with a tree viewer. Runs locally in your browser."
      },
      format: {
        title: "Code Formatter - HTML CSS JS TS YAML XML Markdown | Tools24",
        description: "Online code formatter powered by Prettier. Supports HTML, CSS, SCSS, Less, JavaScript, TypeScript, JSON, YAML, XML and Markdown."
      },
      timestamp: {
        title: "Timestamp Converter Online - Unix Time Converter | Tools24",
        description: "Convert Unix timestamps, milliseconds, datetime, ISO 8601, UTC and local time online."
      },
      unitconvert: {
        title: "Unit Converter - Length Temperature Data Pressure Energy Fuel Economy | Tools24",
        description: "Convert 16 categories including length, area, volume, mass, speed, temperature, wind, data storage, time, pressure, energy, power, angle, flow, cooking volume and fuel economy."
      },
      text: {
        title: "Online Text Processing Tool - Dedupe Sort Case Convert | Tools24",
        description: "Process text online with blank-line removal, deduplication, sorting, case conversion, whitespace cleanup and line conversion to JSON, CSV or SQL IN lists."
      },
      regex: {
        title: "Regex Tester Online - Match Capture Replace | Tools24",
        description: "Test JavaScript regular expressions online with live highlighting, flags, capture groups, named groups, replacement preview and common templates."
      },
      http: {
        title: "HTTP Status Codes and Headers Reference | Tools24",
        description: "Search HTTP status codes and headers including requests, responses, caching, CORS and security headers, with examples and one-click copy."
      },
      tax: {
        title: "China IIT Calculator - Cumulative Withholding & Tax Brackets | Tools24",
        description: "China salary IIT estimate using cumulative withholding, with monthly withholding schedule, seven progressive bracket breakdown, and year-end bonus tax comparison."
      },
      mortgage: {
        title: "Mortgage Calculator - Equal Installment vs Equal Principal | Tools24",
        description: "Online mortgage calculator comparing equal installment and equal principal repayment methods side by side."
      },
      encoder: {
        title: "Online Encoding Converter - URL Base64 Base32 Base16 Unicode UTF-8 | Tools24",
        description: "Online encoding converter: URL encode/decode, Base64, Base32, Base16, Unicode escapes, UTF-8 hex bytes, ASCII — all in one tool."
      },
      base64: {
        title: "Base64 Encoder and Decoder Online | Tools24",
        description: "Encode and decode Base64 text online, convert files to Base64 and download decoded files."
      },
      diff: {
        title: "Text Diff Tool Online - Compare Text and Code | Tools24",
        description: "Compare two text snippets online and highlight added, removed and unchanged lines."
      },
      fileinfo: {
        title: "File Info and MD5/SHA Hash Checker Online | Tools24",
        description: "Inspect file size, type, media dimensions and calculate MD5, SHA-1, SHA-256 and Base64 locally."
      },
      markdown: {
        title: "Markdown Formatter and Preview Online | Tools24",
        description: "Write and preview Markdown online with live rendering. Download as HTML, DOC or Markdown file."
      },
      crypto: {
        title: "Online Encryption Tool - AES RSA Symmetric Asymmetric | Tools24",
        description: "Online encryption tool supporting AES-GCM/CBC symmetric and RSA-OAEP asymmetric encryption, powered by browser Web Crypto API."
      },
      android: {
        title: "Android Quick Reference - API ADB Permissions Intent Gradle | Tools24",
        description: "Android developer quick reference: API levels, ADB commands, alpha values, dp/px, permissions, intents, Manifest config, resource qualifiers, lifecycle and official docs."
      },
      qrcode: {
        title: "Online QR Code Generator and Parser | Tools24",
        description: "Generate and parse QR codes online. Create QR codes from text/URLs and decode QR codes from images — all in your browser."
      },
      curl: {
        title: "Online Curl Command Builder and Converter | Tools24",
        description: "Build curl commands visually, browse common curl examples, and convert curl to Python/JavaScript/Go/Java code."
      },
      terminal: {
        title: "Terminal Commands Cheat Sheet - Shell Reference Linux Ops | Tools24",
        description: "Terminal commands quick reference covering file ops, text processing, process management, networking, system info, permissions, archives and shell tips for ops and terminal users."
      },
      translate: {
        title: "Online Translator - CN/EN Translate with Phonetics DeepSeek | Tools24",
        description: "DeepSeek-powered smart translator with auto language detection, word-level phonetics and POS tagging, paragraph-level pure translation. Translates on blur."
      },
      git: {
        title: "Git Cheat Sheet - Git Commands Reference Remote Branch | Tools24",
        description: "Git commands quick reference covering basics, branching, undo, remote management, stash/log, tags/submodules and advanced ops. Includes remote URL and branch name replacement tools."
      },
      ai: {
        title: "AI CLI Reference - Claude Code and Codex Comparison | Tools24",
        description: "Verified Claude Code and Codex CLI reference covering quick start, sessions, automation, permissions, safety, MCP, plugins, code review, and task-by-task comparison."
      }
    }
  };

  // ── SVG 图标库 ──
  const icons = {
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    json: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/><path d="M8 12h8"/><path d="M12 4v12"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    ruler: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/><path d="m7.5 13.5 3 3M10.5 10.5l3 3M13.5 7.5l3 3M16.5 4.5l3 3"/></svg>',
    code: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    diff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    android: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>',
    qr: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="21" y2="14"/><line x1="17.5" y1="14" x2="17.5" y2="21"/><line x1="14" y1="17.5" x2="21" y2="17.5"/></svg>',
    terminal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    console: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="16" rx="2"/><path d="M6 9l2 2-2 2"/><line x1="12" y1="13" x2="16" y2="13"/></svg>',
    ai: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v1.5h.5A2.5 2.5 0 0 1 19 10v1.5a2.5 2.5 0 0 1-2 2.45V14a4 4 0 0 1-4 4h-1.5a2.5 2.5 0 0 1-2.45-2H7.5A2.5 2.5 0 0 1 5 13.5V12a4 4 0 0 1 2.4-3.6"/><circle cx="9" cy="9.5" r="1"/><circle cx="15" cy="9.5" r="1"/><path d="M9 13c.83 1.19 2 1.5 3 1.5s2.17-.31 3-1.5"/></svg>',
    translate: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l4 4-4 4"/><path d="M19 8l-4 4 4 4"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    git: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 8v7"/><path d="M6 16h12"/></svg>',
    file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    md: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>',
    dollar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  };

  function localeToPrefix(lang) {
    return lang === "en" ? "en" : "zh";
  }

  function prefixToLocale(prefix) {
    return prefix === "en" ? "en" : "zh-CN";
  }

  function buildPathForMenu(menuId, lang) {
    var prefix = localeToPrefix(lang || currentLang);
    return menuId === "home" ? "/" + prefix + "/" : "/" + prefix + "/tool/" + menuId;
  }

  function syncLanguageUi(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_LANG, currentLang);
    document.documentElement.lang = currentLang;
    var langSelect = document.getElementById("lang-select");
    if (langSelect) langSelect.value = currentLang;
  }

  function renderVisitCount() {
    var el = document.getElementById("settings-visit-count");
    if (!el) return;
    var label = (locale.settings && locale.settings.visitCount) || "访问次数：";
    if (visitCountValue !== null) {
      el.textContent = label + formatCount(visitCountValue);
      return;
    }
    if (visitCountUnavailable) {
      var unavailable = (locale.settings && locale.settings.visitCountUnavailable) || "暂不可用";
      el.textContent = label + unavailable;
      return;
    }
    el.textContent = label + "⋯";
  }

  async function loadVisitCount() {
    try {
      const res = await fetch("/api/visits");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data || typeof data.count !== "number") throw new Error("Invalid visit count payload");
      visitCountValue = data.count;
      visitCountUnavailable = false;
    } catch (err) {
      visitCountValue = null;
      visitCountUnavailable = true;
      console.warn("Failed to load visit count:", err);
    }
    renderVisitCount();
  }

  async function incrementVisitCount() {
    try {
      const res = await fetch("/api/visits/increment", { method: "POST" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data || typeof data.count !== "number") throw new Error("Invalid visit increment payload");
      visitCountValue = data.count;
      visitCountUnavailable = false;
      renderVisitCount();
      return data.count;
    } catch (err) {
      console.warn("Failed to increment visit count:", err);
      return null;
    }
  }

  async function applyLanguageAndRender(lang, options) {
    options = options || {};
    await loadLocale(lang);
    syncLanguageUi(currentLang);
    if (options.path) {
      history.replaceState(options.state || history.state, "", options.path);
    }
    updateSeo();
    renderMenu();
    renderVisitCount();
  }

  // ── locale ──
  async function loadLocale(lang) {
    try {
      const res = await fetch(`/locales/${lang}.json`);
      locale = await res.json();
      window.__locale = locale;
      window.__t = t;
      syncLanguageUi(lang);
      applyLocale();
      renderVisitCount();
    } catch (e) {
      console.warn("Failed to load locale:", lang, e);
    }
  }

  function t(key) {
    return key.split(".").reduce((o, k) => (o || {})[k], locale) || key;
  }

  function applyLocale() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const text = t(key);
      if (text) el.textContent = text;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.placeholder = t(key);
    });
    if (document.getElementById("sidebar") && document.getElementById("sidebar").dataset.state) {
      applySidebarState(document.getElementById("sidebar").dataset.state);
    }
  }

  // ── theme ──
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_THEME, theme);
  }

  // ── 菜单渲染 ──
  let activeMenuId = "home";

  function renderMenu() {
    const list = document.getElementById("menu-list");
    const query = document.getElementById("menu-search").value.toLowerCase();
    var items = menuItems.filter(function (item) { return !item.hidden; });
    // sort by global click count descending; home always first
    if (Object.keys(globalStats).length) {
      items = items.slice().sort(function (a, b) {
        if (a.id === "home") return -1;
        if (b.id === "home") return 1;
        return (globalStats[b.id] || 0) - (globalStats[a.id] || 0);
      });
    }
    list.innerHTML = items
      .map(item => {
        const label = t(item.i18n);
        const hidden = query && !label.toLowerCase().includes(query) ? " hidden" : "";
        const active = item.id === activeMenuId ? " active" : "";
        var href = buildPathForMenu(item.id, currentLang);
        return `<a class="menu-item${active}${hidden}" href="${href}" data-id="${item.id}" title="${label}">
          ${icons[item.icon]}<span>${label}</span>
        </a>`;
      }).join("");

    // bind clicks
    list.querySelectorAll(".menu-item").forEach(link => {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        selectMenu(this.dataset.id);
      });
    });

    // render content if needed
    renderContent();
  }

  function selectMenu(id, pushState) {
    if (pushState !== false) {
      history.pushState({ menuId: id }, "", buildPathForMenu(id, currentLang));
    }
    activeMenuId = id;
    // track clicks: local + global (fire-and-forget)
    saveLocalClick(id);
    postGlobalClick(id);
    updateSeo();
    renderMenu();
  }

  // 浏览器前进/后退
  window.addEventListener("popstate", function () {
    var routed = routeFromPath();
    activeMenuId = routed.menuId;
    if (routed.lang) {
      applyLanguageAndRender(routed.lang);
      return;
    }
    updateSeo();
    renderMenu();
    renderVisitCount();
  });

  function routeFromPath() {
    var m = location.pathname.match(/^\/(zh|en)\/tool\/(\w+)$/);
    if (m && menuItems.some(function (item) { return item.id === m[2]; })) return { lang: prefixToLocale(m[1]), menuId: m[2] };
    var m2 = location.pathname.match(/^\/(zh|en)\/?$/);
    if (m2) return { lang: prefixToLocale(m2[1]), menuId: "home" };
    return { lang: null, menuId: "home" };
  }

  // ── device info helpers ──
  // ── global copy toast (top-center pill, auto-fade) ──
  function showCopyToast(msg) {
    var toast = document.createElement("div");
    toast.className = "copy-toast";
    toast.textContent = msg || "✓ 已复制";
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add("copy-toast-visible"); }, 10);
    setTimeout(function () { toast.classList.remove("copy-toast-visible"); }, 1800);
    setTimeout(function () { toast.remove(); }, 2200);
  }
  window.showCopyToast = showCopyToast;

  function stopClock() {
    if (_clockTimer) { clearInterval(_clockTimer); _clockTimer = null; }
  }

  function formatNow() {
    var d = new Date();
    var y = d.getFullYear();
    var mon = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    var ss = String(d.getSeconds()).padStart(2, "0");
    var ms = String(d.getMilliseconds()).padStart(3, "0");
    return y + "-" + mon + "-" + day + " " + hh + ":" + mm + ":" + ss + " " + ms;
  }

  function detectBrowser(ua) {
    ua = ua || navigator.userAgent;
    var m;
    if ((m = ua.match(/Edg\/(\S+)/))) return "Edge " + m[1];
    if ((m = ua.match(/Chrome\/(\S+)/))) return "Chrome " + m[1];
    if ((m = ua.match(/Firefox\/(\S+)/))) return "Firefox " + m[1];
    if ((m = ua.match(/Version\/(\S+).*Safari/))) return "Safari " + m[1];
    return "Unknown";
  }

  function detectOS(ua) {
    ua = ua || navigator.userAgent;
    if (/Windows NT/.test(ua)) return "Windows";
    if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return "macOS";
    if (/iPhone|iPad/.test(ua)) return "iOS";
    if (/Android/.test(ua)) return "Android";
    if (/Linux/.test(ua)) return "Linux";
    return "Unknown";
  }

  function tzOffset() {
    var mins = -new Date().getTimezoneOffset();
    var sign = mins >= 0 ? "+" : "-";
    mins = Math.abs(mins);
    return "UTC" + sign + String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
  }

  function fetchClientIp(cb) {
    fetch("/api/ip").then(function (r) { return r.json(); }).then(function (d) { cb(d.ip || "unknown"); }).catch(function () { cb("unknown"); });
  }

  function mountDeviceInfo(el) {
    var ua = navigator.userAgent || "";
    var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "unknown";
    var mem = navigator.deviceMemory ? navigator.deviceMemory + " GB" : "n/a";
    var cpu = navigator.hardwareConcurrency || "n/a";
    var screenInfo = screen.width + "×" + screen.height + " @" + (window.devicePixelRatio || 1) + "x";
    var viewportInfo = window.innerWidth + "×" + window.innerHeight;
    var colorScheme = currentTheme;
    var touchInfo = navigator.maxTouchPoints ? (navigator.maxTouchPoints + " points") : "no";
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var networkInfo = conn ? [conn.effectiveType, conn.downlink ? conn.downlink + "Mb/s" : null, conn.rtt ? conn.rtt + "ms" : null].filter(Boolean).join(" · ") : "n/a";
    var html =
      '<div class="device-info">' +
      '  <h3 data-i18n="welcome.deviceInfo">设备信息</h3>' +
      '  <div class="device-grid">' +
      '    <div><span>' + t("welcome.now") + '</span><strong id="dev-now">' + formatNow() + '</strong></div>' +
      '    <div><span>' + t("welcome.timestamp") + '</span><strong id="dev-ts">' + Date.now() + '</strong></div>' +
      '    <div><span>' + t("welcome.ip") + '</span><strong id="dev-ip">…</strong></div>' +
      '    <div><span>' + t("welcome.platform") + '</span><strong>' + platform + '</strong></div>' +
      '    <div><span>' + t("welcome.language") + '</span><strong>' + (navigator.language || "n/a") + '</strong></div>' +
      '    <div><span>' + t("welcome.timezone") + '</span><strong>' + Intl.DateTimeFormat().resolvedOptions().timeZone + ' (' + tzOffset() + ')</strong></div>' +
      '    <div><span>' + t("welcome.browser") + '</span><strong>' + detectBrowser(ua) + '</strong></div>' +
      '    <div><span>' + t("welcome.os") + '</span><strong>' + detectOS(ua) + '</strong></div>' +
      '    <div><span>' + t("welcome.screen") + '</span><strong>' + screenInfo + '</strong></div>' +
      '    <div><span>' + t("welcome.viewport") + '</span><strong>' + viewportInfo + '</strong></div>' +
      '    <div><span>' + t("welcome.cpu") + '</span><strong>' + cpu + '</strong></div>' +
      '    <div><span>' + t("welcome.memory") + '</span><strong>' + mem + '</strong></div>' +
      '    <div><span>' + t("welcome.colorScheme") + '</span><strong>' + colorScheme + '</strong></div>' +
      '    <div><span>' + t("welcome.touch") + '</span><strong>' + touchInfo + '</strong></div>' +
      '    <div><span>' + t("welcome.network") + '</span><strong>' + networkInfo + '</strong></div>' +
      '  </div>' +
      '  <details class="device-ua"><summary>User-Agent</summary><pre>' + ua.replace(/</g, "&lt;") + '</pre></details>' +
      '</div>';
    el.insertAdjacentHTML("beforeend", html);
    // click-to-copy on each grid item
    el.querySelectorAll(".device-grid div").forEach(function (div) {
      div.addEventListener("click", function () {
        var strong = this.querySelector("strong");
        if (!strong || !strong.textContent || strong.textContent === "…") return;
        var val = strong.textContent;
        navigator.clipboard.writeText(val).then(function () {
          showCopyToast(t("welcome.copied"));
        }).catch(function () {});
      });
    });
    stopClock();
    _clockTimer = setInterval(function () {
      var nowEl = document.getElementById("dev-now");
      if (nowEl) nowEl.textContent = formatNow();
      var tsEl = document.getElementById("dev-ts");
      if (tsEl) tsEl.textContent = Date.now();
    }, 100);
    fetchClientIp(function (ip) {
      var ipEl = document.getElementById("dev-ip");
      if (ipEl) ipEl.textContent = ip;
    });
  }

  // ── 右侧内容 ──
  function renderContent() {
    stopClock();
    const el = document.getElementById("content");
    if (activeMenuId === "home") {
      // build personal top tools from local clicks
      var localClicks = loadLocalClicks();
      var sorted = Object.entries(localClicks).sort(function (a, b) { return b[1] - a[1]; });
      var quickLinks = "";
      if (sorted.length) {
        quickLinks = '<div class="welcome-quick"><h3 data-i18n="welcome.quickLinks">常用工具</h3><div class="welcome-quick-grid">';
        sorted.forEach(function (entry) {
          var item = menuItems.find(function (m) { return m.id === entry[0]; });
          if (!item || item.hidden) return;
          var label = t(item.i18n);
          var href = buildPathForMenu(item.id, currentLang);
          quickLinks += '<a class="welcome-tool-chip" href="' + href + '" data-id="' + item.id + '">' + icons[item.icon] + '<span>' + label + '</span></a>';
        });
        quickLinks += '</div></div>';
      }
      el.innerHTML = `
        <div class="welcome">
          <div class="welcome-icon">🛠️</div>
          <h2>DevTools</h2>
          <p data-i18n="welcome.desc">开发工具集 — 从左侧菜单选择工具开始使用</p>
          ${quickLinks}
        </div>`;
      // bind chip clicks
      el.querySelectorAll(".welcome-tool-chip").forEach(function (chip) {
        chip.addEventListener("click", function (e) { e.preventDefault(); selectMenu(this.dataset.id); });
      });
      applyLocale();
      return;
    }
    if (activeMenuId === "device") {
      el.innerHTML = `
        <div class="welcome">
          <div class="welcome-icon">💻</div>
          <h2 data-i18n="welcome.deviceInfo">设备信息</h2>
          <p data-i18n="welcome.deviceSubtitle">查看当前浏览器与设备环境详情</p>
        </div>`;
      mountDeviceInfo(el);
      applyLocale();
      return;
    }
    if (activeMenuId === "format" && typeof FormatTool !== "undefined") {
      el.innerHTML = "";
      FormatTool.init(el);
      return;
    }
    if (activeMenuId === "json" && typeof JsonTool !== "undefined") {
      el.innerHTML = "";
      JsonTool.init(el);
      return;
    }
    if (activeMenuId === "timestamp" && typeof TimestampTool !== "undefined") {
      el.innerHTML = "";
      TimestampTool.init(el);
      return;
    }
    if (activeMenuId === "unitconvert" && typeof UnitConvertTool !== "undefined") {
      el.innerHTML = "";
      UnitConvertTool.init(el);
      return;
    }
    if (activeMenuId === "regex" && typeof RegexTool !== "undefined") {
      el.innerHTML = "";
      RegexTool.init(el);
      return;
    }
    if (activeMenuId === "http" && typeof HttpTool !== "undefined") {
      el.innerHTML = "";
      HttpTool.init(el);
      return;
    }
    if (activeMenuId === "encoder" && typeof EncoderTool !== "undefined") {
      el.innerHTML = "";
      EncoderTool.init(el);
      return;
    }
    if (activeMenuId === "base64" && typeof Base64Tool !== "undefined") {
      el.innerHTML = "";
      Base64Tool.init(el);
      return;
    }
    if (activeMenuId === "diff" && typeof DiffTool !== "undefined") {
      el.innerHTML = "";
      DiffTool.init(el);
      return;
    }
    if (activeMenuId === "text" && typeof TextTool !== "undefined") {
      el.innerHTML = "";
      TextTool.init(el);
      return;
    }
    if (activeMenuId === "tax" && typeof TaxTool !== "undefined") {
      el.innerHTML = "";
      TaxTool.init(el);
      return;
    }
    if (activeMenuId === "mortgage" && typeof MortgageTool !== "undefined") {
      el.innerHTML = "";
      MortgageTool.init(el);
      return;
    }
    if (activeMenuId === "fileinfo" && typeof FileInfoTool !== "undefined") {
      el.innerHTML = "";
      FileInfoTool.init(el);
      return;
    }
    if (activeMenuId === "git" && typeof GitTool !== "undefined") {
      el.innerHTML = "";
      GitTool.init(el);
      return;
    }
    if (activeMenuId === "translate" && typeof TranslateTool !== "undefined") {
      el.innerHTML = "";
      TranslateTool.init(el);
      return;
    }
    if (activeMenuId === "android" && typeof AndroidTool !== "undefined") {
      el.innerHTML = "";
      AndroidTool.init(el);
      return;
    }
    if (activeMenuId === "ai" && typeof AiTool !== "undefined") {
      el.innerHTML = "";
      AiTool.init(el);
      return;
    }
    if (activeMenuId === "terminal" && typeof TerminalTool !== "undefined") {
      el.innerHTML = "";
      TerminalTool.init(el);
      return;
    }
    if (activeMenuId === "curl" && typeof CurlTool !== "undefined") {
      el.innerHTML = "";
      CurlTool.init(el);
      return;
    }
    if (activeMenuId === "qrcode" && typeof QrcodeTool !== "undefined") {
      el.innerHTML = "";
      QrcodeTool.init(el);
      return;
    }
    if (activeMenuId === "crypto" && typeof CryptoTool !== "undefined") {
      el.innerHTML = "";
      CryptoTool.init(el);
      return;
    }
    if (activeMenuId === "markdown" && typeof MdTool !== "undefined") {
      el.innerHTML = "";
      MdTool.init(el);
      return;
    }
    if (activeMenuId === "wishes" && typeof WishTool !== "undefined") {
      el.innerHTML = "";
      WishTool.init(el);
      return;
    }
    const item = menuItems.find(m => m.id === activeMenuId);
    const label = item ? t(item.i18n) : activeMenuId;
    el.innerHTML = `
      <div class="tool-placeholder">
        ${icons[item.icon]}
        <h3>${label}</h3>
        <p data-i18n="tool.comingSoon">功能开发中...</p>
      </div>`;
    applyLocale();
  }

  // ── 菜单折叠 ──
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menu-toggle");
  function normalizeMenuState(value) {
    if (value === "1" || value === "compact") return "compact";
    if (value === "immersive") return "immersive";
    return "expanded";
  }
  function applySidebarState(state) {
    sidebar.classList.remove("collapsed", "immersive");
    if (state === "compact") sidebar.classList.add("collapsed");
    if (state === "immersive") sidebar.classList.add("immersive");
    sidebar.dataset.state = state;
    localStorage.setItem(STORAGE_MENU, state);
    var label = state === "expanded" ? t("menu.collapseMenu") : (state === "compact" ? t("menu.immersiveMenu") : t("menu.expandMenu"));
    menuToggle.title = label;
    menuToggle.setAttribute("aria-label", label);
    if (state === "immersive") document.getElementById("settings-panel").classList.add("hidden");
  }
  applySidebarState(normalizeMenuState(localStorage.getItem(STORAGE_MENU)));

  menuToggle.addEventListener("click", function () {
    var current = sidebar.dataset.state || "expanded";
    applySidebarState(current === "expanded" ? "compact" : (current === "compact" ? "immersive" : "expanded"));
  });

  // ── 菜单搜索 ──
  document.getElementById("menu-search").addEventListener("input", () => renderMenu());

  // ── 设置面板 ──
  function togglePanel() {
    const panel = document.getElementById("settings-panel");
    panel.classList.toggle("hidden");
  }

  function closePanel(e) {
    const panel = document.getElementById("settings-panel");
    const btn = document.getElementById("settings-toggle");
    if (!panel.classList.contains("hidden") && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      panel.classList.add("hidden");
    }
  }

  document.getElementById("settings-toggle").addEventListener("click", togglePanel);
  document.addEventListener("click", closePanel);

  // wishes link inside settings panel
  var wishesLink = document.getElementById("settings-wishes");
  if (wishesLink) {
    wishesLink.addEventListener("click", function (e) {
      e.preventDefault();
      selectMenu("wishes");
      document.getElementById("settings-panel").classList.add("hidden");
    });
  }

  document.getElementById("lang-select").addEventListener("change", async function () {
    var newLang = this.value;
    var newPath = buildPathForMenu(activeMenuId, newLang);
    await applyLanguageAndRender(newLang, {
      path: newPath,
      state: { menuId: activeMenuId }
    });
  });

  document.getElementById("theme-select").addEventListener("change", function () {
    applyTheme(this.value);
  });

  // ── init ──
  var routed = routeFromPath();

  // URL 带语言前缀 → 以此为优先
  if (routed.lang) {
    syncLanguageUi(routed.lang);
  }
  activeMenuId = routed.menuId;

  // 首页无语言前缀 → 补上
  if (!routed.lang && location.pathname === "/") {
    history.replaceState({ menuId: "home" }, "", buildPathForMenu("home", currentLang));
  }

  document.getElementById("lang-select").value = currentLang;
  document.getElementById("theme-select").value = currentTheme;

  applyTheme(currentTheme);

  // fetch locale + global stats in parallel → render once (no flash)
  var localeReady = loadLocale(currentLang);
  var statsReady = fetch("/api/tool-stats")
    .then(function (r) { return r.json(); })
    .then(function (d) { globalStats = d; })
    .catch(function () {});

  Promise.all([localeReady, statsReady]).then(function () {
    renderMenu();
    updateSeo();
    renderVisitCount();
    incrementVisitCount().finally(function () {
      loadVisitCount();
    });
  });

  function formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 10000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  function updateSeo() {
    var lang = currentLang === "en" ? "en" : "zh-CN";
    var prefix = currentLang === "en" ? "en" : "zh";
    var pageKey = activeMenuId || "home";
    var meta = (seoMeta[lang] && seoMeta[lang][pageKey]) || seoMeta["zh-CN"].home;
    var path = pageKey === "home" ? "/" + prefix + "/" : "/" + prefix + "/tool/" + pageKey;
    var canonical = location.origin + path;
    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", canonical);
    setLink("canonical", canonical);
    setAlternate("zh-CN", location.origin + "/zh" + (pageKey === "home" ? "/" : "/tool/" + pageKey));
    setAlternate("en", location.origin + "/en" + (pageKey === "home" ? "/" : "/tool/" + pageKey));
    setAlternate("x-default", location.origin + "/zh" + (pageKey === "home" ? "/" : "/tool/" + pageKey));
  }

  function setMeta(attr, key, value) {
    var el = document.querySelector('meta[' + attr + '="' + key + '"]');
    if (el) el.setAttribute("content", value);
  }

  function setLink(rel, href) {
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (el) el.setAttribute("href", href);
  }

  function setAlternate(lang, href) {
    var el = document.querySelector('link[rel="alternate"][hreflang="' + lang + '"]');
    if (el) el.setAttribute("href", href);
  }
})();
