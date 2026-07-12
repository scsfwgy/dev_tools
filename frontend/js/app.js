// DevTools — sidebar menu + i18n + theme
(function () {
  const STORAGE_LANG = "devtools_lang";
  const STORAGE_THEME = "devtools_theme";
  const STORAGE_MENU = "devtools_menu_collapsed";
  const STORAGE_FAVORITES = "devtools_favorites";
  let siteUrl = "https://www.tools24.uk";

  let locale = {};
  let currentLang = localStorage.getItem(STORAGE_LANG) || "zh-CN";
  let currentTheme = localStorage.getItem(STORAGE_THEME) || "dark";
  let globalStats = {};  // {tool_id: count} from Redis, refreshed on load
  let visitCountValue = null;
  let visitCountUnavailable = false;
  var _clockTimer = null;

  function loadFavorites() {
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_FAVORITES));
      if (!Array.isArray(stored)) return [];
      return stored.filter(function (toolId, index) {
        return stored.indexOf(toolId) === index && menuItems.some(function (item) {
          return item.id === toolId && item.id !== "home" && !item.hidden;
        });
      });
    } catch (e) {
      return [];
    }
  }
  function toggleFavorite(toolId) {
    var favorites = loadFavorites();
    var index = favorites.indexOf(toolId);
    if (index === -1) favorites.push(toolId);
    else favorites.splice(index, 1);
    localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(favorites));
    renderMenu();
    showCopyToast(t(index === -1 ? "welcome.favoriteAdded" : "welcome.favoriteRemoved"));
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
  let menuItems = [];

  let toolScripts = {};
  const toolScriptPromises = {};

  function loadToolScript(toolId) {
    var config = toolScripts[toolId];
    if (!config || window[config[0]]) return Promise.resolve();
    if (toolScriptPromises[toolId]) return toolScriptPromises[toolId];
    toolScriptPromises[toolId] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = config[1];
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Failed to load " + config[1])); };
      document.head.appendChild(script);
    });
    return toolScriptPromises[toolId];
  }

  let seoMeta = {};

  function loadToolManifest() {
    return fetch("/api/tool-manifest")
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (manifest) {
        siteUrl = manifest.siteUrl;
        menuItems = [{ id: "home", icon: "home", i18n: "menu.home", processing: "local" }].concat(
          manifest.tools.map(function (tool) {
            return { id: tool.id, icon: tool.icon, i18n: tool.i18n, processing: tool.processing, hidden: tool.hidden, indexable: tool.indexable };
          })
        );
        toolScripts = {};
        seoMeta = { "zh-CN": { home: manifest.homeSeo["zh-CN"] }, en: { home: manifest.homeSeo.en } };
        manifest.tools.forEach(function (tool) {
          if (tool.script && tool.global) toolScripts[tool.id] = [tool.global, tool.script];
          if (tool.seo) {
            seoMeta["zh-CN"][tool.id] = tool.seo["zh-CN"];
            seoMeta.en[tool.id] = tool.seo.en;
          }
        });
      });
  }

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
    flutter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 3 19 3 11 15"/><polyline points="5 13 11 21 19 9"/><polyline points="5 13 19 3"/></svg>',
    ios: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>',
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
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    "map-pin": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
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
    document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
      const key = el.getAttribute("data-i18n-aria-label");
      el.setAttribute("aria-label", t(key));
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
    var favorites = loadFavorites();
    list.innerHTML = items
      .map(item => {
        const label = t(item.i18n);
        const hidden = query && !label.toLowerCase().includes(query) ? " hidden" : "";
        const active = item.id === activeMenuId ? " active" : "";
        var href = buildPathForMenu(item.id, currentLang);
        var favoriteButton = item.id === "home" ? "" : '<button class="menu-favorite' + (favorites.indexOf(item.id) !== -1 ? ' active' : '') + '" type="button" data-favorite-id="' + item.id + '" title="' + t(favorites.indexOf(item.id) !== -1 ? "welcome.removeFavorite" : "welcome.addFavorite") + '" aria-label="' + t(favorites.indexOf(item.id) !== -1 ? "welcome.removeFavorite" : "welcome.addFavorite") + '">' + icons.star + '</button>';
        var processingIndicator = item.processing === "server"
          ? '<span class="menu-processing menu-processing-server" title="' + (currentLang === "en" ? "Uses server processing" : "使用服务端处理") + '">' + (currentLang === "en" ? "Cloud" : "云端") + '</span>'
          : item.processing === "hybrid"
            ? '<span class="menu-processing menu-processing-hybrid" title="' + (currentLang === "en" ? "Uses hybrid processing" : "使用混合处理") + '">' + (currentLang === "en" ? "Hybrid" : "混合") + '</span>'
            : "";
        return `<a class="menu-item${active}${hidden}" href="${href}" data-id="${item.id}" title="${label}">
          ${icons[item.icon]}<span class="menu-label">${label}</span>${processingIndicator}${favoriteButton}
        </a>`;
      }).join("");

    // bind clicks
    list.querySelectorAll(".menu-item").forEach(link => {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        selectMenu(this.dataset.id);
      });
    });
    list.querySelectorAll(".menu-favorite").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(this.dataset.favoriteId);
      });
    });

    // render content if needed
    renderContent();
  }

  function selectMenu(id, pushState) {
    closeMobileMenu();
    window.__toolSubpage = null;
    if (pushState !== false) {
      history.pushState({ menuId: id }, "", buildPathForMenu(id, currentLang));
    }
    activeMenuId = id;
    postGlobalClick(id);
    updateSeo();
    renderMenu();
  }

  // 浏览器前进/后退
  window.addEventListener("popstate", function () {
    var routed = routeFromPath();
    activeMenuId = routed.menuId;
    window.__toolSubpage = routed.subpage || null;
    if (routed.lang) {
      applyLanguageAndRender(routed.lang);
      return;
    }
    updateSeo();
    renderMenu();
    renderVisitCount();
  });

  function routeFromPath() {
    var subpageMatch = location.pathname.match(/^\/(zh|en)\/(converter|flutter|android|ios)\/([\w-]+)$/);
    if (subpageMatch) return { lang: prefixToLocale(subpageMatch[1]), menuId: subpageMatch[2], subpage: subpageMatch[3] };
    var m = location.pathname.match(/^\/(zh|en)\/tool\/([\w-]+)$/);
    if (m) return { lang: prefixToLocale(m[1]), menuId: m[2] };
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
    if (activeMenuId !== "home") {
      var headerToolId = activeMenuId;
      setTimeout(function () { renderToolPageHeader(el, headerToolId); }, 0);
    }
    if (activeMenuId === "home") {
      var favoriteIds = loadFavorites();
      var homeState = { tab: favoriteIds.length ? "favorites" : "categories", category: "all", query: "" };
      el.innerHTML = `
        <div class="home-page">
          <header class="home-hero">
            <div class="home-mark" aria-hidden="true">${icons.code}</div>
            <div>
              <h1>DevTools</h1>
              <p data-i18n="welcome.desc">简单、快速、注重隐私的开发工具集</p>
            </div>
          </header>
          <label class="home-search" for="home-search">
            <span class="home-search-icon" aria-hidden="true">${icons.search || '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'}</span>
            <input id="home-search" type="search" data-i18n-placeholder="welcome.searchPlaceholder" placeholder="搜索工具，例如 JSON、时间戳、Base64…" autocomplete="off">
            <kbd>/</kbd>
          </label>
          <div class="home-trust-row">
            <span class="home-trust-local" data-i18n="welcome.localFirst">✓ 默认本地处理</span>
            <a href="https://github.com/scsfwgy/dev_tools" target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg><span data-i18n="welcome.openSource">代码开源</span></a>
          </div>
          <div class="home-tabs" role="tablist" aria-label="${t("welcome.homeSections")}">
            <button class="home-tab" type="button" role="tab" data-home-tab="favorites" aria-controls="home-tab-panel">
              <span data-i18n="welcome.favorites">${t("welcome.favorites")}</span><span class="home-tab-count">${favoriteIds.length}</span>
            </button>
            <button class="home-tab" type="button" role="tab" data-home-tab="categories" aria-controls="home-tab-panel" data-i18n="welcome.categories">${t("welcome.categories")}</button>
            <button class="home-tab" type="button" role="tab" data-home-tab="recommended" aria-controls="home-tab-panel" data-i18n="welcome.recommended">${t("welcome.recommended")}</button>
          </div>
          <section id="home-tab-panel" class="home-tab-panel" role="tabpanel"></section>
        </div>`;
      renderHomePanel(el, homeState);
      var homeSearch = document.getElementById("home-search");
      homeSearch.addEventListener("input", function () {
        homeState.query = this.value;
        if (homeState.query.trim()) {
          homeState.tab = "categories";
          homeState.category = "all";
        }
        renderHomePanel(el, homeState);
      });
      homeSearch.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          var firstResult = el.querySelector("#home-tab-panel .home-tool-card");
          if (firstResult) selectMenu(firstResult.dataset.id);
        }
      });
      el.querySelectorAll(".home-tab").forEach(function (tabButton) {
        tabButton.addEventListener("click", function () {
          homeState.tab = this.dataset.homeTab;
          homeState.query = "";
          homeSearch.value = "";
          renderHomePanel(el, homeState);
        });
        tabButton.addEventListener("keydown", function (event) {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          var tabButtons = Array.from(el.querySelectorAll(".home-tab"));
          var currentIndex = tabButtons.indexOf(this);
          var delta = event.key === "ArrowRight" ? 1 : -1;
          var nextIndex = (currentIndex + delta + tabButtons.length) % tabButtons.length;
          tabButtons[nextIndex].click();
          tabButtons[nextIndex].focus();
        });
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
    var scriptConfig = toolScripts[activeMenuId];
    if (scriptConfig && !window[scriptConfig[0]]) {
      var loadingToolId = activeMenuId;
      el.innerHTML = '<div class="content-loader"><div class="content-skel-icon"></div><div class="content-skel-bar" style="width:160px;height:22px;margin:0 auto 10px"></div></div>';
      loadToolScript(loadingToolId).then(function () {
        if (activeMenuId === loadingToolId) renderContent();
      }).catch(function () {
        if (activeMenuId === loadingToolId) el.innerHTML = '<div class="tool-placeholder"><h3>' + (currentLang === "en" ? "Failed to load tool" : "工具加载失败") + '</h3></div>';
      });
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
    if (activeMenuId === "image" && typeof ImageTool !== "undefined") {
      el.innerHTML = "";
      ImageTool.init(el);
      return;
    }
    if (activeMenuId === "converter" && typeof ConverterTool !== "undefined") {
      el.innerHTML = "";
      ConverterTool.init(el);
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
    if (activeMenuId === "flutter" && typeof FlutterTool !== "undefined") {
      el.innerHTML = "";
      FlutterTool.init(el);
      return;
    }
    if (activeMenuId === "ios" && typeof IosTool !== "undefined") {
      el.innerHTML = "";
      IosTool.init(el);
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
    if (activeMenuId === "content" && typeof ContentTool !== "undefined") {
      el.innerHTML = "";
      ContentTool.init(el);
      return;
    }
    if (activeMenuId === "jwt" && typeof JwtTool !== "undefined") {
      el.innerHTML = "";
      JwtTool.init(el);
      return;
    }
    if (activeMenuId === "wishes" && typeof WishTool !== "undefined") {
      el.innerHTML = "";
      WishTool.init(el);
      return;
    }
    if (activeMenuId === "area-search" && typeof AreaSearchTool !== "undefined") {
      el.innerHTML = "";
      AreaSearchTool.init(el);
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

  var HOME_CATEGORIES = [
    { id: "all", tools: [] },
    { id: "files", tools: ["image", "converter", "fileinfo", "markdown", "diff", "text", "content"] },
    { id: "conversion", tools: ["timestamp", "unitconvert", "tax", "mortgage"] },
    { id: "data", tools: ["json", "format", "regex", "http", "jwt"] },
    { id: "encoding", tools: ["encoder", "base64", "crypto", "qrcode"] },
    { id: "mobile", tools: ["android", "flutter", "ios"] },
    { id: "reference", tools: ["git", "terminal", "ai", "curl"] },
    { id: "services", tools: ["device", "translate", "area-search"] }
  ];

  var HOME_RECOMMENDATIONS = [
    {
      id: "investing",
      items: [
        { titleKey: "welcome.recommendations.items.xiaohongshu.title", descriptionKey: "welcome.recommendations.items.xiaohongshu.description", domain: "xiaohongshu.com", url: "https://www.xiaohongshu.com/user/profile/64e95bd60000000001005b74" },
        { titleKey: "welcome.recommendations.items.svscholarX.title", descriptionKey: "welcome.recommendations.items.svscholarX.description", domain: "x.com", url: "https://x.com/SVScholar" },
        { titleKey: "welcome.recommendations.items.bilibili.title", descriptionKey: "welcome.recommendations.items.bilibili.description", domain: "bilibili.com", url: "https://space.bilibili.com/491004348" },
        { titleKey: "welcome.recommendations.items.qqqValue.title", descriptionKey: "welcome.recommendations.items.qqqValue.description", domain: "qqq.tools24.uk", url: "https://qqq.tools24.uk/zh/knowledge/value-investing" },
        { titleKey: "welcome.recommendations.items.qqqBuyStocks.title", descriptionKey: "welcome.recommendations.items.qqqBuyStocks.description", domain: "qqq.tools24.uk", url: "https://qqq.tools24.uk/zh/knowledge/how-to-buy-us-stocks" }
      ]
    },
    {
      id: "resources",
      items: [
        { titleKey: "welcome.recommendations.items.fmhy.title", descriptionKey: "welcome.recommendations.items.fmhy.description", domain: "fmhy.net", url: "https://fmhy.net" }
      ]
    },
    {
      id: "llm",
      items: [
        { titleKey: "welcome.recommendations.items.llmToken.title", descriptionKey: "welcome.recommendations.items.llmToken.description", domain: "llm-token.cn", url: "https://llm-token.cn/r/INVF008434B" }
      ]
    },
    {
      id: "connectivity",
      items: [
        { titleKey: "welcome.recommendations.items.ytoo.title", descriptionKey: "welcome.recommendations.items.ytoo.description", domain: "y-too.net", url: "https://y-too.net/aff.php?aff=4974" },
        { titleKey: "welcome.recommendations.items.flzt.title", descriptionKey: "welcome.recommendations.items.flzt.description", domain: "flzt.org", url: "https://flzt.org/auth/register?invite_code=KpRiKFdc" }
      ]
    },
    {
      id: "crypto",
      items: [
        { titleKey: "welcome.recommendations.items.binance.title", descriptionKey: "welcome.recommendations.items.binance.description", domain: "binance.com", url: "https://www.binance.com/register?ref=JZTZUS" },
        { titleKey: "welcome.recommendations.items.binanceMirror.title", descriptionKey: "welcome.recommendations.items.binanceMirror.description", domain: "bsmkweb.cc", url: "https://www.bsmkweb.cc/register?ref=JZTZUS" },
        { titleKey: "welcome.recommendations.items.bitget.title", descriptionKey: "welcome.recommendations.items.bitget.description", domain: "bitget.com", url: "https://www.bitget.com/zh-CN/referral/register?clacCode=SUWT96JK" },
        { titleKey: "welcome.recommendations.items.bitgetMirror.title", descriptionKey: "welcome.recommendations.items.bitgetMirror.description", domain: "hdmune.cn", url: "https://www.hdmune.cn/zh-CN/referral/register?clacCode=SUWT96JK" },
        { titleKey: "welcome.recommendations.items.bit.title", descriptionKey: "welcome.recommendations.items.bit.description", domain: "bit.bshareweb.com", url: "https://bit.bshareweb.com/newRegister/cn?invite_code=WACZ2R" }
      ]
    }
  ];

  function allHomeTools() {
    return menuItems.filter(function (item) { return item.id !== "home" && !item.hidden; });
  }

  function homeToolCard(item) {
    var hintKey = "welcome.toolHints." + item.id;
    var hint = t(hintKey);
    if (hint === hintKey) hint = t("welcome.toolHintFallback");
    var processingKey = "welcome.processing." + (item.processing || "local");
    return '<a class="home-tool-card" href="' + buildPathForMenu(item.id, currentLang) + '" data-id="' + item.id + '">' +
      '<span class="home-tool-icon">' + icons[item.icon] + '</span>' +
      '<span class="home-tool-copy"><strong>' + t(item.i18n) + '</strong><small>' + hint + '</small></span>' +
      '<span class="home-tool-processing home-tool-processing-' + (item.processing || "local") + '">' + t(processingKey) + '</span>' +
      '</a>';
  }

  var HOME_LINK_COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  var HOME_LINK_CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  function homeRecommendationCard(item) {
    var title = t(item.titleKey);
    return '<article class="home-link-card">' +
      '<span class="home-link-icon" aria-hidden="true">' + (icons.link || icons.search || "↗") + '</span>' +
      '<a class="home-link-main" href="' + item.url + '" target="_blank" rel="noopener noreferrer">' +
        '<strong>' + title + '</strong><small>' + t(item.descriptionKey) + '</small><span class="home-link-domain">' + item.domain + '</span>' +
      '</a>' +
      '<span class="home-link-actions">' +
        '<span class="home-link-action" aria-hidden="true">' + t("welcome.recommendations.open") + '</span>' +
        '<button class="home-link-copy-btn" type="button" data-url="' + item.url + '" aria-label="' + t("welcome.recommendations.copyLink") + '" title="' + t("welcome.recommendations.copyLink") + '">' + HOME_LINK_COPY_ICON + '</button>' +
      '</span>' +
      '</article>';
  }

  function legacyCopyText(text, done) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      done();
    } catch (e) { /* clipboard unavailable */ }
  }

  function bindHomeLinkCards(container) {
    container.querySelectorAll(".home-link-copy-btn").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var url = this.getAttribute("data-url");
        var markCopied = function () {
          button.innerHTML = HOME_LINK_CHECK_ICON;
          button.classList.add("is-copied");
          button.setAttribute("aria-label", t("welcome.copied"));
          setTimeout(function () {
            button.innerHTML = HOME_LINK_COPY_ICON;
            button.classList.remove("is-copied");
            button.setAttribute("aria-label", t("welcome.recommendations.copyLink"));
          }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(markCopied).catch(function () { legacyCopyText(url, markCopied); });
        } else {
          legacyCopyText(url, markCopied);
        }
      });
    });
  }

  function bindHomeToolCards(container) {
    container.querySelectorAll(".home-tool-card").forEach(function (card) {
      card.addEventListener("click", function (event) {
        event.preventDefault();
        selectMenu(this.dataset.id);
      });
    });
  }

  function renderHomePanel(container, state) {
    var panel = container.querySelector("#home-tab-panel");
    if (!panel) return;
    container.querySelectorAll(".home-tab").forEach(function (button) {
      var selected = button.dataset.homeTab === state.tab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });

    if (state.tab === "favorites") {
      var favoriteTools = loadFavorites().map(function (toolId) {
        return menuItems.find(function (item) { return item.id === toolId; });
      }).filter(Boolean);
      panel.innerHTML = favoriteTools.length
        ? '<div class="home-tool-grid">' + favoriteTools.map(homeToolCard).join("") + '</div>'
        : '<div class="home-empty-state"><span aria-hidden="true">' + icons.star + '</span><strong>' + t("welcome.favoritesEmptyTitle") + '</strong><p>' + t("welcome.favoritesEmpty") + '</p></div>';
      bindHomeToolCards(panel);
      return;
    }

    if (state.tab === "recommended") {
      panel.innerHTML = HOME_RECOMMENDATIONS.map(function (group) {
        return '<section class="home-section">' +
          '<div class="home-section-heading"><h2>' + t("welcome.recommendations.groups." + group.id) + '</h2><span>' + group.items.length + '</span></div>' +
          '<div class="home-link-grid">' + group.items.map(homeRecommendationCard).join("") + '</div>' +
          '</section>';
      }).join("");
      bindHomeLinkCards(panel);
      return;
    }

    var normalized = state.query.trim().toLowerCase();
    var category = HOME_CATEGORIES.find(function (item) { return item.id === state.category; }) || HOME_CATEGORIES[0];
    var tools = allHomeTools().filter(function (item) {
      var categoryMatch = category.id === "all" || category.tools.indexOf(item.id) !== -1;
      var queryMatch = !normalized || t(item.i18n).toLowerCase().includes(normalized) || item.id.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
    var categoryButtons = HOME_CATEGORIES.map(function (item) {
      var active = item.id === category.id ? " active" : "";
      return '<button class="home-category' + active + '" type="button" data-home-category="' + item.id + '" aria-pressed="' + String(item.id === category.id) + '">' + t("welcome.category." + item.id) + '</button>';
    }).join("");
    panel.innerHTML = '<div class="home-categories" aria-label="' + t("welcome.categoryFilter") + '">' + categoryButtons + '</div>' +
      '<div class="home-section-heading"><h2>' + (normalized ? t("welcome.searchResults") : t("welcome.category." + category.id)) + '</h2><span>' + tools.length + '</span></div>' +
      (tools.length ? '<div class="home-tool-grid">' + tools.map(homeToolCard).join("") + '</div>' : '<div class="home-search-empty">' + t("welcome.noSearchResults") + '</div>');
    panel.querySelectorAll(".home-category").forEach(function (button) {
      button.addEventListener("click", function () {
        state.category = this.dataset.homeCategory;
        renderHomePanel(container, state);
      });
    });
    bindHomeToolCards(panel);
  }

  function renderToolPageHeader(container, toolId) {
    if (activeMenuId !== toolId || container.querySelector(".tool-page-header")) return;
    var tool = menuItems.find(function (item) { return item.id === toolId; });
    if (!tool || !tool.processing) return;
    var iconsByMode = { local: "✓", hybrid: "◐", server: "↗" };
    var processingLabel = t("toolHeader.processing." + tool.processing);
    container.insertAdjacentHTML("afterbegin", '<header class="tool-page-header"><h1>' + t(tool.i18n) + '</h1><div class="privacy-badge privacy-badge-runtime privacy-badge-' + tool.processing + '"><span aria-hidden="true">' + iconsByMode[tool.processing] + '</span>' + processingLabel + '</div></header>');
  }

  // ── 菜单折叠 ──
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menu-toggle");
  const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
  const sidebarScrim = document.getElementById("sidebar-scrim");
  const mobileMenuQuery = window.matchMedia("(max-width: 760px)");
  function normalizeMenuState(value) {
    if (value === "1" || value === "compact") return "compact";
    if (value === "immersive") return "immersive";
    return "expanded";
  }
  function applySidebarState(state) {
    sidebar.classList.remove("collapsed", "immersive");
    if (!mobileMenuQuery.matches && state === "compact") sidebar.classList.add("collapsed");
    if (!mobileMenuQuery.matches && state === "immersive") sidebar.classList.add("immersive");
    sidebar.dataset.state = state;
    localStorage.setItem(STORAGE_MENU, state);
    var label = state === "expanded" ? t("menu.collapseMenu") : (state === "compact" ? t("menu.immersiveMenu") : t("menu.expandMenu"));
    menuToggle.title = label;
    menuToggle.setAttribute("aria-label", label);
    if (state === "immersive") document.getElementById("settings-panel").classList.add("hidden");
  }
  applySidebarState(normalizeMenuState(localStorage.getItem(STORAGE_MENU)));

  menuToggle.addEventListener("click", function () {
    if (mobileMenuQuery.matches) {
      closeMobileMenu();
      return;
    }
    var current = sidebar.dataset.state || "expanded";
    applySidebarState(current === "expanded" ? "compact" : (current === "compact" ? "immersive" : "expanded"));
  });

  function setMobileMenu(open) {
    sidebar.classList.toggle("mobile-open", open);
    sidebarScrim.classList.toggle("visible", open);
    mobileMenuToggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("mobile-menu-open", open);
  }

  function closeMobileMenu() {
    setMobileMenu(false);
  }

  mobileMenuToggle.addEventListener("click", function () {
    setMobileMenu(!sidebar.classList.contains("mobile-open"));
  });
  sidebarScrim.addEventListener("click", closeMobileMenu);
  mobileMenuQuery.addEventListener("change", function () {
    closeMobileMenu();
    applySidebarState(sidebar.dataset.state || "expanded");
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMobileMenu();
    if (event.key === "/" && activeMenuId === "home" && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      var homeSearch = document.getElementById("home-search");
      if (homeSearch) {
        event.preventDefault();
        homeSearch.focus();
      }
    }
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
  window.__toolSubpage = routed.subpage || null;

  // 首页无语言前缀 → 补上
  if (!routed.lang && location.pathname === "/") {
    history.replaceState({ menuId: "home" }, "", buildPathForMenu("home", currentLang));
  }

  document.getElementById("lang-select").value = currentLang;
  document.getElementById("theme-select").value = currentTheme;

  applyTheme(currentTheme);

  // fetch manifest, locale and global stats in parallel → render once (no flash)
  var manifestReady = loadToolManifest();
  var localeReady = loadLocale(currentLang);
  var statsReady = fetch("/api/tool-stats")
    .then(function (r) { return r.json(); })
    .then(function (d) { globalStats = d; })
    .catch(function () {});

  Promise.all([manifestReady, localeReady, statsReady]).then(function () {
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
    if (window.__toolSubpage) return;
    var lang = currentLang === "en" ? "en" : "zh-CN";
    var prefix = currentLang === "en" ? "en" : "zh";
    var pageKey = activeMenuId || "home";
    var meta = (seoMeta[lang] && seoMeta[lang][pageKey]) || seoMeta["zh-CN"].home;
    var path = pageKey === "home" ? "/" + prefix + "/" : "/" + prefix + "/tool/" + pageKey;
    var canonical = siteUrl + path;
    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", canonical);
    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);
    setLink("canonical", canonical);
    setAlternate("zh-CN", siteUrl + "/zh" + (pageKey === "home" ? "/" : "/tool/" + pageKey));
    setAlternate("en", siteUrl + "/en" + (pageKey === "home" ? "/" : "/tool/" + pageKey));
    setAlternate("x-default", siteUrl + "/zh" + (pageKey === "home" ? "/" : "/tool/" + pageKey));
    updateStructuredData(meta, canonical, lang);
  }

  function updateStructuredData(meta, canonical, lang) {
    var element = document.querySelector('script[type="application/ld+json"]');
    if (!element) return;
    element.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: meta.title.replace(/\s*[|-].*$/, ""),
      url: canonical,
      description: meta.description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      inLanguage: lang,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
    });
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
