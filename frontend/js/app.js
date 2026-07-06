// DevTools — sidebar menu + i18n + theme
(function () {
  const STORAGE_LANG = "devtools_lang";
  const STORAGE_THEME = "devtools_theme";
  const STORAGE_MENU = "devtools_menu_collapsed";

  let locale = {};
  let currentLang = localStorage.getItem(STORAGE_LANG) || "zh-CN";
  let currentTheme = localStorage.getItem(STORAGE_THEME) || "dark";

  // ── 菜单定义 ──
  const menuItems = [
    { id: "home",     icon: "home",       i18n: "menu.home" },
    { id: "json",     icon: "json",       i18n: "menu.json" },
    { id: "timestamp",icon: "clock",      i18n: "menu.timestamp" },
    { id: "encoder",  icon: "code",       i18n: "menu.encoder" },
    { id: "crypto",   icon: "shield",    i18n: "menu.crypto" },
    { id: "android",  icon: "android",   i18n: "menu.android" },
    { id: "base64",   icon: "lock",       i18n: "menu.base64" },
    { id: "diff",     icon: "diff",       i18n: "menu.diff" },
    { id: "fileinfo", icon: "file",       i18n: "menu.fileinfo" },
    { id: "markdown", icon: "md",         i18n: "menu.markdown" },
    { id: "wishes",   icon: "star",       i18n: "menu.wishes" },
  ];

  const seoMeta = {
    "zh-CN": {
      home: {
        title: "Tools24 在线开发者工具箱 - JSON格式化、URL编码、Base64、时间戳转换",
        description: "Tools24 提供在线 JSON 格式化校验、URL 编码解码、Base64 编码解码、时间戳转换、文本对比、文件 MD5/SHA 校验等开发者工具。"
      },
      json: {
        title: "JSON格式化校验工具 - 在线 JSON Formatter / Viewer | Tools24",
        description: "在线 JSON 格式化、压缩、校验和树形查看工具，支持快速检查 JSON 语法错误并复制格式化结果。"
      },
      timestamp: {
        title: "时间戳转换工具 - Unix Timestamp 在线转换 | Tools24",
        description: "在线时间戳转换工具，支持秒/毫秒时间戳、日期时间、ISO 8601、UTC 和本地时间互转。"
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
        title: "Android 常用速查 - API 版本 透明度 dp/px 对照 | Tools24",
        description: "Android 开发者常用速查：系统版本与 API Level 对应、透明度十六进制、dp/px 转换、屏幕密度参照。"
      }
    },
    en: {
      home: {
        title: "Tools24 Online Developer Toolbox - JSON, URL Encoder, Base64, Timestamp",
        description: "Tools24 provides online developer tools for JSON formatting, URL encoding, Base64, timestamp conversion, text diff and file hash checking."
      },
      json: {
        title: "JSON Formatter and Validator Online | Tools24",
        description: "Format, validate, compact and inspect JSON online with a tree viewer. Runs locally in your browser."
      },
      timestamp: {
        title: "Timestamp Converter Online - Unix Time Converter | Tools24",
        description: "Convert Unix timestamps, milliseconds, datetime, ISO 8601, UTC and local time online."
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
        title: "Android Quick Reference - API Levels Alpha dp/px | Tools24",
        description: "Android developer quick reference: system versions & API levels, alpha transparency hex values, dp/px converter, screen density reference."
      }
    }
  };

  // ── SVG 图标库 ──
  const icons = {
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    json: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/><path d="M8 12h8"/><path d="M12 4v12"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    code: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    diff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    android: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>',
    file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    md: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>',
  };

  // ── locale ──
  async function loadLocale(lang) {
    try {
      const res = await fetch(`/locales/${lang}.json`);
      locale = await res.json();
      window.__locale = locale;
      window.__t = t;
      currentLang = lang;
      localStorage.setItem(STORAGE_LANG, lang);
      document.documentElement.lang = lang;
      applyLocale();
      renderMenu();
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
    list.innerHTML = menuItems
      .map(item => {
        const label = t(item.i18n);
        const hidden = query && !label.toLowerCase().includes(query) ? " hidden" : "";
        const active = item.id === activeMenuId ? " active" : "";
        var lang = currentLang === "en" ? "en" : "zh";
        var href = item.id === "home" ? "/" + lang + "/" : "/" + lang + "/tool/" + item.id;
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
      var lang = currentLang === "en" ? "en" : "zh";
      var path = id === "home" ? "/" + lang + "/" : "/" + lang + "/tool/" + id;
      history.pushState({ menuId: id }, "", path);
    }
    activeMenuId = id;
    updateSeo();
    renderMenu();
  }

  // 浏览器前进/后退
  window.addEventListener("popstate", function (e) {
    var routed = routeFromPath();
    if (routed.lang && routed.lang !== currentLang) {
      currentLang = routed.lang;
      localStorage.setItem(STORAGE_LANG, currentLang);
      document.getElementById("lang-select").value = currentLang;
    }
    activeMenuId = routed.menuId;
    updateSeo();
    renderMenu();
  });

  function routeFromPath() {
    var m = location.pathname.match(/^\/(zh|en)\/tool\/(\w+)$/);
    if (m && menuItems.some(function (item) { return item.id === m[2]; })) return { lang: m[1] === "en" ? "en" : "zh-CN", menuId: m[2] };
    var m2 = location.pathname.match(/^\/(zh|en)\/?$/);
    if (m2) return { lang: m2[1] === "en" ? "en" : "zh-CN", menuId: "home" };
    return { lang: null, menuId: "home" };
  }

  // ── 右侧内容 ──
  function renderContent() {
    const el = document.getElementById("content");
    if (activeMenuId === "home") {
      el.innerHTML = `
        <div class="welcome">
          <div class="welcome-icon">🛠️</div>
          <h2>DevTools</h2>
          <p data-i18n="welcome.desc">开发工具集 — 从左侧菜单选择工具开始使用</p>
        </div>`;
      applyLocale();
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
    if (activeMenuId === "fileinfo" && typeof FileInfoTool !== "undefined") {
      el.innerHTML = "";
      FileInfoTool.init(el);
      return;
    }
    if (activeMenuId === "android" && typeof AndroidTool !== "undefined") {
      el.innerHTML = "";
      AndroidTool.init(el);
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
  const savedCollapsed = localStorage.getItem(STORAGE_MENU) === "1";
  if (savedCollapsed) sidebar.classList.add("collapsed");

  document.getElementById("menu-toggle").addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    localStorage.setItem(STORAGE_MENU, sidebar.classList.contains("collapsed") ? "1" : "0");
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

  document.getElementById("lang-select").addEventListener("change", function () {
    var newLang = this.value;
    var oldPrefix = currentLang === "en" ? "/en" : "/zh";
    var newPrefix = newLang === "en" ? "/en" : "/zh";
    var newPath = location.pathname.replace(/^\/(zh|en)/, newPrefix);
    // ponytail: if URL doesn't have lang prefix yet, build one
    if (newPath === location.pathname) {
      newPath = newPrefix + (location.pathname === "/" ? "/" : location.pathname);
    }
    loadLocale(newLang);
    history.replaceState(history.state, "", newPath);
    updateSeo();
  });

  document.getElementById("theme-select").addEventListener("change", function () {
    applyTheme(this.value);
  });

  // ── init ──
  var routed = routeFromPath();

  // URL 带语言前缀 → 以此为优先
  if (routed.lang) {
    currentLang = routed.lang;
    localStorage.setItem(STORAGE_LANG, currentLang);
  }
  activeMenuId = routed.menuId;

  // 首页无语言前缀 → 补上
  if (!routed.lang && location.pathname === "/") {
    var defaultPrefix = currentLang === "en" ? "/en" : "/zh";
    history.replaceState({ menuId: "home" }, "", defaultPrefix + "/");
  }

  document.getElementById("lang-select").value = currentLang;
  document.getElementById("theme-select").value = currentTheme;

  applyTheme(currentTheme);
  loadLocale(currentLang).then(function () {
    updateSeo();
    renderContent();
  });

  // 访问计数
  (function () {
  var el = document.getElementById("settings-visit-count");
    if (!el) return;
    fetch("/api/visits")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var label = (locale.settings && locale.settings.visitCount) || "访问次数：";
        el.textContent = label + formatCount(d.count);
      })
      .catch(function () {});
  })();

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
