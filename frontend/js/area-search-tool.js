// Area Search Tool — China 3-level + World country/city cascading lookup
var AreaSearchTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  var _mode = "china";
  var _chinaSel = [null, null, null];   // [{code, name, pinyin}, ...]
  var _worldSel = [null, null];         // [{code, name, cname}, ...]
  var _chinaOpts = [[], [], []];        // cached options per level: L1=provinces, L2=cities, L3=districts
  var _chinaAllCities = [];             // flat list of all cities (for reverse search)
  var _chinaAllDistricts = [];          // flat list of all districts (for reverse search)
  var _worldCountries = [];             // cached country list
  var _worldCitiesCache = {};           // country code -> city list
  var _openDropdown = null;
  var _highlightIdx = -1;
  var _loading = { china: false, world: false };
  var _cachedIntro = { china: "", world: "" };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  // ═══ API ═══
  function fetchJson(url) {
    return fetch(url).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "fail"); return d; }); });
  }

  function loadChinaChildren(parentCode) {
    var url = "/api/area-search/china";
    if (parentCode) url += "?parent=" + parentCode;
    return fetchJson(url).then(function (d) { return d.data; });
  }

  function loadChinaAll(level) {
    return fetchJson("/api/area-search/china/all?level=" + level).then(function (d) { return d.data; });
  }

  function loadChinaAncestors(code) {
    return fetchJson("/api/area-search/china/ancestors?code=" + code).then(function (d) { return d.data; });
  }

  function loadWorldCountries() {
    return fetchJson("/api/area-search/world/countries").then(function (d) { return d.data; });
  }

  function loadWorldCities(countryCode) {
    return fetchJson("/api/area-search/world/cities?country=" + countryCode).then(function (d) { return d.data; });
  }

  function loadWorldAllCities() {
    return fetchJson("/api/area-search/world/all-cities").then(function (d) { return d.data; });
  }

  // ═══ Dropdown ═══
  function filterOpts(options, query) {
    if (!query) return options;
    var q = query.toLowerCase();
    return options.filter(function (opt) {
      if (opt.name.toLowerCase().indexOf(q) !== -1) return true;
      if (opt.cname && opt.cname.toLowerCase().indexOf(q) !== -1) return true;
      if (opt.pinyin && opt.pinyin.toLowerCase().indexOf(q) !== -1) return true;
      return false;
    });
  }

  function ensureDropdownEl(wrapper) {
    var dd = wrapper.querySelector(".as-dropdown");
    if (!dd) {
      dd = document.createElement("div");
      dd.className = "as-dropdown";
      wrapper.appendChild(dd);
    }
    return dd;
  }

  function openDropdownDom(dd, html) {
    closeDropdown();
    dd.innerHTML = html;
    dd.classList.add("open");
    _openDropdown = dd;
  }

  function showDropdown(inputEl, options, levelIdx) {
    var wrapper = inputEl.parentNode;
    var dd = ensureDropdownEl(wrapper);
    if (!options.length) {
      openDropdownDom(dd, '<div class="as-dropdown-empty">' + t("areaSearch.noMatch") + '</div>');
      return;
    }
    _highlightIdx = -1;
    dd.innerHTML = options.map(function (opt, i) {
      var label = _mode === "china" ? opt.name : (opt.cname ? opt.name + " (" + opt.cname + ")" : opt.name);
      var sub = opt.code ? '<small>' + opt.code + '</small>' : "";
      return '<button class="as-dropdown-item" type="button" data-idx="' + i + '">' + escapeHtml(label) + (sub ? ' ' + sub : '') + '</button>';
    }).join("");
    dd.classList.add("open");
    _openDropdown = dd;
    dd.onclick = function (e) {
      var btn = e.target.closest(".as-dropdown-item");
      if (!btn) return;
      var idx = parseInt(btn.dataset.idx);
      selectOption(options[idx], levelIdx);
    };
  }

  function closeDropdown() {
    if (_openDropdown) { _openDropdown.classList.remove("open"); _openDropdown = null; }
    _highlightIdx = -1;
  }

  function levelOpts(levelIdx) {
    if (_mode === "china") {
      if (_chinaOpts[levelIdx].length) return _chinaOpts[levelIdx];
      if (levelIdx === 1 && _chinaAllCities.length) return _chinaAllCities;
      if (levelIdx === 2 && _chinaAllDistricts.length) return _chinaAllDistricts;
      return [];
    }
    if (levelIdx === 0) return _worldCountries;
    // L2: use parent-specific cache first, then all-cities fallback
    var cc = _worldSel[0] && _worldSel[0].code;
    if (cc && _worldCitiesCache[cc] && _worldCitiesCache[cc].length) return _worldCitiesCache[cc];
    if (_worldAllCities.length) return _worldAllCities;
    return _worldCitiesCache[cc] || [];
  }

  function isLoading(levelIdx) {
    if (_mode === "china") return levelIdx === 0 && _loading.china;
    return levelIdx === 0 && _loading.world;
  }

  // ═══ Selection ═══
  function selectOption(opt, levelIdx) {
    closeDropdown();
    if (_mode === "china") {
      if (levelIdx > 0 && opt.parentCode) {
        // Reverse fill: selected a city (idx=1) or district (idx=2) directly
        fillChinaAncestors(opt, levelIdx);
      } else {
        // Forward: selected province or normal cascade
        _chinaSel[levelIdx] = opt;
        clearChinaBelow(levelIdx + 1);
        setChinaInput(levelIdx, opt.name);
        if (levelIdx < 2 && opt.code) loadNextChinaLevel(levelIdx + 1, opt.code);
      }
    } else {
      if (levelIdx === 1 && opt.countryCode) {
        // Reverse fill: city selected from all-cities list → auto-fill country
        _worldSel[0] = { code: opt.countryCode, name: opt.countryName, cname: opt.countryCname };
        _worldSel[1] = { code: opt.code, name: opt.name, cname: opt.cname };
        setWorldInput(0, opt.countryCname || opt.countryName);
        setWorldInput(1, opt.cname || opt.name);
        loadWorldCities(opt.countryCode).then(function (cities) {
          _worldCitiesCache[opt.countryCode] = cities;
        }).catch(function () {});
      } else if (levelIdx === 1 && _worldSel[0] && _worldSel[0].code) {
        // Normal cascade: country already selected
        _worldSel[1] = opt;
        setWorldInput(1, opt.cname || opt.name);
      } else if (levelIdx === 0) {
        _worldSel[0] = opt;
        clearWorldBelow();
        setWorldInput(0, opt.cname || opt.name);
        _worldCitiesCache = {};
        loadWorldCities(opt.code).then(function (cities) {
          _worldCitiesCache[opt.code] = cities;
        }).catch(function () {});
      }
    }
    renderPath();
  }

  function fillChinaAncestors(opt, levelIdx) {
    if (levelIdx === 2 && opt.grandparentCode) {
      _chinaSel[0] = { code: opt.grandparentCode, name: opt.grandparentName, pinyin: opt.grandparentPinyin || "" };
      _chinaSel[1] = { code: opt.parentCode, name: opt.parentName, pinyin: opt.parentPinyin || "" };
      _chinaSel[2] = { code: opt.code, name: opt.name, pinyin: opt.pinyin || "" };
      setChinaInput(0, opt.grandparentName);
      setChinaInput(1, opt.parentName);
      setChinaInput(2, opt.name);
      loadNextChinaLevel(1, opt.grandparentCode);
      loadNextChinaLevel(2, opt.parentCode);
    } else if (levelIdx === 1 && opt.parentCode) {
      _chinaSel[0] = { code: opt.parentCode, name: opt.parentName, pinyin: opt.parentPinyin || "" };
      _chinaSel[1] = { code: opt.code, name: opt.name, pinyin: opt.pinyin || "" };
      _chinaSel[2] = null;
      setChinaInput(0, opt.parentName);
      setChinaInput(1, opt.name);
      clearChinaBelow(2);
      loadNextChinaLevel(1, opt.parentCode);
    }
  }

  function fillWorldAncestors(cityOpt) {
    // cityOpt from world cities API — need to find country
    // world cities have code_full which encodes country, or use the country param
    loadWorldCountries().then(function (countries) {
      // try matching by city's code_full prefix
      var countryCode = cityOpt.code_full ? cityOpt.code_full.substring(0, 3) : "";
      var country = null;
      for (var i = 0; i < countries.length; i++) {
        if (countries[i].code === countryCode) { country = countries[i]; break; }
      }
      if (country) {
        _worldSel[0] = country;
        _worldSel[1] = { code: cityOpt.code, name: cityOpt.name, cname: cityOpt.cname };
        setWorldInput(0, country.cname || country.name);
        setWorldInput(1, cityOpt.cname || cityOpt.name);
        loadWorldCities(country.code).then(function (cities) {
          _worldCitiesCache[country.code] = cities;
        }).catch(function () {});
        renderPath();
      }
    }).catch(function () {});
  }

  function clearChinaBelow(from) {
    for (var i = from; i < 3; i++) {
      _chinaSel[i] = null;
      if (i > 0) _chinaOpts[i] = [];
      var inp = document.getElementById("as-china-l" + (i + 1));
      if (inp) { inp.value = ""; }
    }
  }

  function clearWorldBelow() {
    _worldSel[1] = null;
    var inp = document.getElementById("as-world-l2");
    if (inp) { inp.value = ""; }
  }

  function setChinaInput(levelIdx, value) {
    var input = document.getElementById(["as-china-l1", "as-china-l2", "as-china-l3"][levelIdx]);
    if (input) { input.value = value || ""; input.dataset.selected = "1"; }
  }

  function setWorldInput(levelIdx, value) {
    var input = document.getElementById(["as-world-l1", "as-world-l2"][levelIdx]);
    if (input) { input.value = value || ""; input.dataset.selected = "1"; }
  }

  function loadNextChinaLevel(levelIdx, parentCode) {
    var input = document.getElementById("as-china-l" + (levelIdx + 1));
    if (!input) return;
    loadChinaChildren(parentCode).then(function (children) {
      _chinaOpts[levelIdx] = children;
      if (!_chinaSel[levelIdx]) input.value = "";
    }).catch(function () {});
  }

  // ═══ Restore selections into DOM (after mode-switch rebuild) ═══
  function restoreSelections() {
    if (_mode === "china") {
      for (var i = 0; i < 3; i++) {
        if (_chinaSel[i]) setChinaInput(i, _chinaSel[i].name);
      }
    } else {
      for (var j = 0; j < 2; j++) {
        if (_worldSel[j]) setWorldInput(j, _worldSel[j].cname || _worldSel[j].name);
      }
    }
    renderPath();
  }

  // ═══ Path display ═══
  function copyLine(el) {
    var label = el.querySelector(".as-path-label");
    var text = label ? el.textContent.slice(label.textContent.length).trim() : el.textContent;
    navigator.clipboard.writeText(text).then(function () {
      el.classList.add("copied");
      setTimeout(function () { el.classList.remove("copied"); }, 1200);
    });
  }

  function pathRow(label, text, cls) {
    return '<div class="as-path-line ' + cls + '"><span class="as-path-label">' + escapeHtml(label) + '</span>' + escapeHtml(text) + '</div>';
  }

  function renderPath() {
    var pathEl = document.getElementById("as-path");
    if (!pathEl) return;

    var cn = [], en = [], codes = [];
    var wCn = [], wEn = [], wCodes = [];

    if (_mode === "china") {
      for (var i = 0; i < 3; i++) {
        if (!_chinaSel[i]) break;
        cn.push(_chinaSel[i].name);
        en.push(_chinaSel[i].pinyin || "");
        codes.push(_chinaSel[i].code);
      }
      if (!cn.length) { pathEl.classList.add("as-path-hidden"); return; }
    } else {
      for (var j = 0; j < 2; j++) {
        if (!_worldSel[j]) break;
        wCn.push(_worldSel[j].cname || _worldSel[j].name);
        wEn.push(_worldSel[j].name);
        wCodes.push(_worldSel[j].code);
      }
      if (!wCn.length) { pathEl.classList.add("as-path-hidden"); return; }
    }

    pathEl.classList.remove("as-path-hidden");
    var introHtml = '<button class="as-intro-btn" type="button" id="as-intro-btn">🤖 ' + t("areaSearch.intro") + '</button>';

    if (_mode === "china") {
      pathEl.innerHTML =
        pathRow("中文", cn.join(" "), "as-path-cn") +
        pathRow("拼音", en.join(" "), "as-path-en") +
        pathRow("编码", codes.join(" "), "as-path-code") +
        introHtml;
    } else {
      pathEl.innerHTML =
        pathRow("中文", wCn.join(" "), "as-path-cn") +
        pathRow("English", wEn.join(" "), "as-path-en") +
        pathRow("编码", wCodes.join(" "), "as-path-code") +
        introHtml;
    }
    pathEl.querySelectorAll(".as-path-line").forEach(function (line) {
      line.addEventListener("click", function () { copyLine(line); });
    });
    var introBtn = document.getElementById("as-intro-btn");
    if (introBtn) introBtn.addEventListener("click", doIntro);
    // restore cached intro for this mode
    if (_cachedIntro[_mode]) {
      var cachedEl = document.createElement("div");
      cachedEl.id = "as-intro-result";
      cachedEl.className = "as-intro-result";
      pathEl.appendChild(cachedEl);
      renderIntroHtml(cachedEl, _cachedIntro[_mode]);
    }
  }

  // ═══ AI Intro ═══
  function doIntro() {
    var btn = document.getElementById("as-intro-btn");
    var resultEl = document.getElementById("as-intro-result");
    if (!btn) return;

    // Build region path string
    var pathParts = [];
    if (_mode === "china") {
      for (var i = 0; i < 3; i++) {
        if (_chinaSel[i]) pathParts.push(_chinaSel[i].name);
      }
    } else {
      for (var j = 0; j < 2; j++) {
        if (_worldSel[j]) pathParts.push(_worldSel[j].cname || _worldSel[j].name);
      }
    }
    if (!pathParts.length) return;

    btn.disabled = true;
    var _start = Date.now();
    var _timer = setInterval(function () {
      btn.textContent = "⏳ " + t("areaSearch.introLoading").replace("{s}", Math.round((Date.now() - _start) / 1000));
    }, 200);
    btn.textContent = "⏳ " + t("areaSearch.introLoading").replace("{s}", "0");
    if (!resultEl) {
      resultEl = document.createElement("div");
      resultEl.id = "as-intro-result";
      resultEl.className = "as-intro-result";
      btn.parentNode.appendChild(resultEl);
    }
    resultEl.textContent = "";

    fetch("/api/area-search/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_path: pathParts.join(" "), mode: _mode }),
    })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "fail"); return d; }); })
      .then(function (d) {
        clearInterval(_timer);
        _cachedIntro[_mode] = d.intro;
        renderIntroHtml(resultEl, d.intro);
        btn.disabled = false;
        btn.textContent = "🤖 " + t("areaSearch.intro");
      })
      .catch(function (e) {
        clearInterval(_timer);
        resultEl.innerHTML = '<span style="color:var(--text-muted)">❌ ' + escapeHtml(e.message || "Error") + '</span>';
        btn.disabled = false;
        btn.textContent = "🤖 " + t("areaSearch.intro");
      });
  }

  var MARKED_URL = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";

  function renderIntroHtml(el, text) {
    if (window.marked) {
      el.innerHTML = window.marked.parse(text);
    } else {
      el.textContent = text;
      var s = document.createElement("script");
      s.src = MARKED_URL;
      s.onload = function () { if (window.marked) el.innerHTML = window.marked.parse(text); };
      document.head.appendChild(s);
    }
  }

  // ═══ Switch mode ═══
  function switchMode(mode) {
    if (_mode === mode) return;  // don't rebuild if already on this mode
    _mode = mode;
    closeDropdown();
    var container = document.getElementById("as-container");
    if (!container) return;
    renderModeUi(container);
  }

  function cascadeCol(id, labelKey, placeholder) {
    return '<div class="as-cascade-col"><label class="as-row-label" for="' + id + '">' + t(labelKey) + '</label>' +
      '<div class="as-input-group"><input id="' + id + '" class="as-input" type="text" placeholder="' + placeholder + '" autocomplete="off"></div></div>';
  }

  // ═══ Random ═══
  function randomPick(opts) {
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
  }

  function doRandom() {
    if (_mode === "china") {
      if (!_chinaSel[0] || (_chinaSel[0] && _chinaSel[1] && _chinaSel[2])) {
        // All empty OR all filled → random from top
        clearChinaBelow(0);
        var prov = randomPick(_chinaOpts[0]);
        if (!prov) return;
        selectOption(prov, 0);
        loadChinaChildren(prov.code).then(function (cities) {
          _chinaOpts[1] = cities;
          var city = randomPick(cities);
          if (!city) return;
          selectOption(city, 1);
          loadChinaChildren(city.code).then(function (districts) {
            _chinaOpts[2] = districts;
            var dist = randomPick(districts);
            if (dist) selectOption(dist, 2);
          }).catch(function () {});
        }).catch(function () {});
      } else if (!_chinaSel[1]) {
        var city = randomPick(levelOpts(1));
        if (city) selectOption(city, 1);
      } else if (!_chinaSel[2]) {
        var dist = randomPick(levelOpts(2));
        if (dist) selectOption(dist, 2);
      }
    } else {
      if (!_worldSel[0] || (_worldSel[0] && _worldSel[1])) {
        // All empty OR all filled → random from top
        clearWorldBelow();
        _worldSel[0] = null;
        var country = randomPick(_worldCountries);
        if (!country) return;
        selectOption(country, 0);
        loadWorldCities(country.code).then(function (cities) {
          _worldCitiesCache[country.code] = cities;
          var city = randomPick(cities);
          if (city) selectOption(city, 1);
        }).catch(function () {});
      } else if (!_worldSel[1]) {
        var wcity = randomPick(levelOpts(1));
        if (wcity) selectOption(wcity, 1);
      }
    }
  }

  function renderModeUi(container) {
    var randomBtn = '<button class="as-action-btn" type="button" title="' + t("areaSearch.random") + '">🎲</button>';
    var clearBtn = '<button class="as-action-btn" type="button" title="' + t("areaSearch.clear") + '">✕</button>';
    var btns = '<div class="as-cascade-col as-cascade-btn-col">' + randomBtn + clearBtn + '</div>';
    if (_mode === "china") {
      container.innerHTML = '<div class="as-cascade-row">' +
        cascadeCol("as-china-l1", "areaSearch.province", "…") +
        cascadeCol("as-china-l2", "areaSearch.city", "…") +
        cascadeCol("as-china-l3", "areaSearch.district", "…") +
        btns + '</div>';
    } else {
      container.innerHTML = '<div class="as-cascade-row">' +
        cascadeCol("as-world-l1", "areaSearch.country", "…") +
        cascadeCol("as-world-l2", "areaSearch.worldCity", "…") +
        btns + '</div>';
    }
    bindInputs(container);
    loadInitialData();
    restoreSelections();
    container.querySelector(".as-action-btn[title='" + t("areaSearch.random") + "']").addEventListener("click", doRandom);
    container.querySelector(".as-action-btn[title='" + t("areaSearch.clear") + "']").addEventListener("click", doClear);
  }

  function doClear() {
    closeDropdown();
    _cachedIntro[_mode] = "";
    if (_mode === "china") {
      for (var i = 0; i < 3; i++) { _chinaSel[i] = null; _chinaOpts[i] = i === 0 ? _chinaOpts[0] : []; }
      document.querySelectorAll("#as-china-l1, #as-china-l2, #as-china-l3").forEach(function (inp) { inp.value = ""; });
    } else {
      _worldSel[0] = null; _worldSel[1] = null; _worldCitiesCache = {};
      document.querySelectorAll("#as-world-l1, #as-world-l2").forEach(function (inp) { inp.value = ""; });
    }
    var introEl = document.getElementById("as-intro-result");
    if (introEl) introEl.remove();
    renderPath();
  }

  function bindInputs(container) {
    bindDropdownInput(container.querySelector("#as-china-l1"), 0);
    bindDropdownInput(container.querySelector("#as-china-l2"), 1);
    bindDropdownInput(container.querySelector("#as-china-l3"), 2);
    bindDropdownInput(container.querySelector("#as-world-l1"), 0);
    bindDropdownInput(container.querySelector("#as-world-l2"), 1);
  }

  function bindDropdownInput(input, levelIdx) {
    if (!input) return;

    input.addEventListener("focus", function () {
      input.dataset.selected = "";
      ensureLevelOpts(levelIdx);
      var opts = levelOpts(levelIdx);
      if (!opts.length && isLoading(levelIdx)) {
        var dd = ensureDropdownEl(input.parentNode);
        openDropdownDom(dd, '<div class="as-dropdown-empty">…</div>');
        return;
      }
      showDropdown(input, filterOpts(opts, input.value), levelIdx);
    });

    input.addEventListener("input", function () {
      input.dataset.selected = "";
      ensureLevelOpts(levelIdx);
      var filtered = filterOpts(levelOpts(levelIdx), input.value);
      showDropdown(input, filtered, levelIdx);
      if (_mode === "china") {
        _chinaSel[levelIdx] = null;
        clearChinaBelow(levelIdx + 1);
      } else {
        _worldSel[levelIdx] = null;
      }
      renderPath();
    });

    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (document.activeElement && document.activeElement.closest(".as-dropdown")) return;
        closeDropdown();
      }, 150);
    });

    input.addEventListener("keydown", function (e) {
      var dd = _openDropdown;
      if (!dd) return;
      var items = dd.querySelectorAll(".as-dropdown-item");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        _highlightIdx = Math.min(_highlightIdx + 1, items.length - 1);
        items.forEach(function (item, i) { item.classList.toggle("highlight", i === _highlightIdx); });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        _highlightIdx = Math.max(_highlightIdx - 1, 0);
        items.forEach(function (item, i) { item.classList.toggle("highlight", i === _highlightIdx); });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (_highlightIdx >= 0 && items[_highlightIdx]) items[_highlightIdx].click();
      } else if (e.key === "Escape") {
        closeDropdown();
      }
    });
  }

  // ═══ Lazy-load per-level options ═══
  var _worldAllCities = [];

  function ensureLevelOpts(levelIdx) {
    if (_mode === "china") {
      if (levelIdx === 1 && !_chinaOpts[1].length && !_chinaAllCities.length) {
        loadChinaAll("2").then(function (data) {
          _chinaAllCities = data;
          if (!_chinaOpts[1].length) _chinaOpts[1] = data;
          updatePlaceholder("as-china-l2", t("areaSearch.searchCity"), data);
          refreshIfFocused("as-china-l2", 1);
        }).catch(function () {});
      }
      if (levelIdx === 2 && !_chinaOpts[2].length && !_chinaAllDistricts.length) {
        loadChinaAll("3").then(function (data) {
          _chinaAllDistricts = data;
          if (!_chinaOpts[2].length) _chinaOpts[2] = data;
          updatePlaceholder("as-china-l3", t("areaSearch.searchDistrict"), data);
          refreshIfFocused("as-china-l3", 2);
        }).catch(function () {});
      }
    } else {
      if (levelIdx === 1 && !_worldAllCities.length) {
        loadWorldAllCities().then(function (data) {
          _worldAllCities = data;
          updatePlaceholder("as-world-l2", t("areaSearch.searchWorldCity"), data);
          refreshIfFocused("as-world-l2", 1);
        }).catch(function () {});
      }
    }
  }

  function refreshIfFocused(inputId, levelIdx) {
    var input = document.getElementById(inputId);
    if (!input || document.activeElement !== input) return;
    var filtered = filterOpts(levelOpts(levelIdx), input.value);
    showDropdown(input, filtered, levelIdx);
  }

  // ═══ Initial data ═══
  function loadInitialData() {
    if (_mode === "china" && !_chinaOpts[0].length && !_loading.china) {
      _loading.china = true;
      loadChinaChildren("").then(function (provinces) {
        _chinaOpts[0] = provinces;
        _loading.china = false;
        updatePlaceholder("as-china-l1", t("areaSearch.searchProvince"), provinces);
      }).catch(function () { _loading.china = false; });
    }
    if (_mode === "world" && !_worldCountries.length && !_loading.world) {
      _loading.world = true;
      loadWorldCountries().then(function (countries) {
        _worldCountries = countries;
        _loading.world = false;
        updatePlaceholder("as-world-l1", t("areaSearch.searchCountry"), countries);
      }).catch(function () { _loading.world = false; });
    }
  }

  function updatePlaceholder(inputId, text, data) {
    var input = document.getElementById(inputId);
    if (!input) return;
    input.placeholder = text;
    if (document.activeElement === input) {
      showDropdown(input, filterOpts(data, input.value), 0);
    }
  }

  // ═══ Tabs ═══
  function renderTabs(parent) {
    parent.querySelector(".as-tab-china").className = "as-tab as-tab-china" + (_mode === "china" ? " active" : "");
    parent.querySelector(".as-tab-world").className = "as-tab as-tab-world" + (_mode === "world" ? " active" : "");
  }

  // ═══ Init ═══
  function init(parent) {
    parent.innerHTML =
      '<div class="as-tool">' +
      '<div class="as-tabs">' +
      '<button class="as-tab as-tab-china active" type="button">' + t("areaSearch.china") + '</button>' +
      '<button class="as-tab as-tab-world" type="button">' + t("areaSearch.world") + '</button>' +
      '</div>' +
      '<div id="as-container"></div>' +
      '<div id="as-path" class="as-path"></div>' +
      '</div>';

    renderModeUi(document.getElementById("as-container"));

    var chinaTab = parent.querySelector(".as-tab-china");
    var worldTab = parent.querySelector(".as-tab-world");
    chinaTab.addEventListener("click", function () { switchMode("china"); renderTabs(parent); });
    worldTab.addEventListener("click", function () { switchMode("world"); renderTabs(parent); });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".as-input-group")) closeDropdown();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDropdown();
    });
  }

  return { init: init };
})();
