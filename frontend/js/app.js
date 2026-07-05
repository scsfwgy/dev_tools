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
    { id: "diff",     icon: "diff",       i18n: "menu.diff" },
  ];

  // ── SVG 图标库 ──
  const icons = {
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    json: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/><path d="M8 12h8"/><path d="M12 4v12"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    code: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    diff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
  };

  // ── locale ──
  async function loadLocale(lang) {
    try {
      const res = await fetch(`/locales/${lang}.json`);
      locale = await res.json();
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
        return `<button class="menu-item${active}${hidden}" data-id="${item.id}" title="${label}">
          ${icons[item.icon]}<span>${label}</span>
        </button>`;
      }).join("");

    // bind clicks
    list.querySelectorAll(".menu-item").forEach(btn => {
      btn.addEventListener("click", () => selectMenu(btn.dataset.id));
    });

    // render content if needed
    renderContent();
  }

  function selectMenu(id, pushState) {
    if (pushState !== false) {
      var lang = currentLang === "en" ? "en" : "zh";
      var path = id === "home" ? "/" + lang + "/" : "/" + lang + "/tool/" + id;
      var title = (id === "home" ? "DevTools" : t("menu." + id) + " - DevTools");
      history.pushState({ menuId: id }, title, path);
      document.title = title;
    }
    activeMenuId = id;
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
    updateTitle();
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
    updateTitle();
    renderContent();
  });

  function updateTitle() {
    if (activeMenuId === "home") {
      document.title = "DevTools";
    } else {
      document.title = t("menu." + activeMenuId) + " - DevTools";
    }
  }
})();
