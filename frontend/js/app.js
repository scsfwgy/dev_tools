// DevTools — i18n + theme + settings panel
(function () {
  const STORAGE_LANG = "devtools_lang";
  const STORAGE_THEME = "devtools_theme";

  let locale = {};
  let currentLang = localStorage.getItem(STORAGE_LANG) || "zh-CN";
  let currentTheme = localStorage.getItem(STORAGE_THEME) || "dark";

  // ── locale ──
  async function loadLocale(lang) {
    try {
      const res = await fetch(`/locales/${lang}.json`);
      locale = await res.json();
      currentLang = lang;
      localStorage.setItem(STORAGE_LANG, lang);
      document.documentElement.lang = lang;
      applyLocale();
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
    // i18n options in selects
    document.querySelectorAll("[data-i18n-option]").forEach(el => {
      const key = el.getAttribute("data-i18n-option");
      el.textContent = t(key);
    });
  }

  // ── theme ──
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_THEME, theme);
  }

  // ── settings panel ──
  function togglePanel() {
    const panel = document.getElementById("settings-panel");
    const btn = document.getElementById("settings-toggle");
    const open = !panel.classList.contains("hidden");
    if (open) {
      panel.classList.add("hidden");
      btn.classList.remove("open");
    } else {
      panel.classList.remove("hidden");
      btn.classList.add("open");
    }
  }

  function closePanel(e) {
    const panel = document.getElementById("settings-panel");
    const btn = document.getElementById("settings-toggle");
    if (!panel.classList.contains("hidden") && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      panel.classList.add("hidden");
      btn.classList.remove("open");
    }
  }

  // ── init ──
  document.getElementById("settings-toggle").addEventListener("click", togglePanel);
  document.addEventListener("click", closePanel);

  document.getElementById("lang-select").addEventListener("change", function () {
    loadLocale(this.value);
  });

  document.getElementById("theme-select").addEventListener("change", function () {
    applyTheme(this.value);
  });

  // sync selects with stored values
  document.getElementById("lang-select").value = currentLang;
  document.getElementById("theme-select").value = currentTheme;

  applyTheme(currentTheme);
  loadLocale(currentLang);
})();
