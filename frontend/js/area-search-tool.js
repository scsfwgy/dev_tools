// Area Search Tool — China 3-level + World country/city cascading lookup
var AreaSearchTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  var _mode = "china";
  var _chinaSel = [null, null, null];   // [{code, name, pinyin}, ...]
  var _worldSel = [null, null];         // [{code, name, cname}, ...]
  var _chinaOpts = [[], [], []];        // cached options per level: L1=provinces, L2=cities, L3=districts
  var _worldCountries = [];             // cached country list
  var _worldCitiesCache = {};           // country code -> city list
  var _openDropdown = null;
  var _openDropdownInput = null;
  var _highlightIdx = -1;
  var _loading = { china: false, world: false };
  var _cachedIntro = {};
  var _searchTimers = {};
  var _searchRequestId = 0;
  var _documentListenersBound = false;

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

  function searchChina(level, query) {
    return fetchJson("/api/area-search/china/search?level=" + level + "&limit=30&q=" + encodeURIComponent(query)).then(function (d) { return d.data; });
  }

  function loadWorldCountries() {
    return fetchJson("/api/area-search/world/countries").then(function (d) { return d.data; });
  }

  function loadWorldCities(countryCode) {
    return fetchJson("/api/area-search/world/cities?country=" + countryCode).then(function (d) { return d.data; });
  }

  function searchWorldCities(query) {
    return fetchJson("/api/area-search/world/search?limit=30&q=" + encodeURIComponent(query)).then(function (d) { return d.data; });
  }

  function showStatus(message, isError) {
    var status = document.getElementById("as-status");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("as-status-error", Boolean(isError));
    status.classList.toggle("as-status-hidden", !message);
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
      dd.setAttribute("role", "listbox");
      wrapper.appendChild(dd);
    }
    return dd;
  }

  function openDropdownDom(dd, html, input) {
    closeDropdown();
    dd.innerHTML = html;
    dd.classList.add("open");
    _openDropdown = dd;
    _openDropdownInput = input || null;
    if (input) {
      if (!dd.id) dd.id = input.id + "-listbox";
      input.setAttribute("aria-controls", dd.id);
      input.setAttribute("aria-expanded", "true");
    }
  }

  function optionContext(opt) {
    if (_mode === "china") {
      return [opt.grandparentName, opt.parentName].filter(Boolean).join(" / ");
    }
    return opt.countryCname || opt.countryName || "";
  }

  function showDropdown(inputEl, options, levelIdx) {
    var wrapper = inputEl.parentNode;
    var dd = ensureDropdownEl(wrapper);
    if (!options.length) {
      openDropdownDom(dd, '<div class="as-dropdown-empty">' + t("areaSearch.noMatch") + '</div>', inputEl);
      return;
    }
    _highlightIdx = -1;
    dd.innerHTML = options.slice(0, 50).map(function (opt, i) {
      var label = _mode === "china" ? opt.name : (opt.cname ? opt.name + " (" + opt.cname + ")" : opt.name);
      var context = optionContext(opt);
      return '<button class="as-dropdown-item" type="button" role="option" id="' + inputEl.id + '-option-' + i + '" data-idx="' + i + '"><span>' + escapeHtml(label) + '</span>' +
        (context ? '<small class="as-dropdown-context">' + escapeHtml(context) + '</small>' : '') +
        (opt.code ? '<code>' + escapeHtml(opt.code) + '</code>' : '') + '</button>';
    }).join("") + (options.length > 50 ? '<div class="as-dropdown-empty">' + t("areaSearch.resultLimited") + '</div>' : '');
    dd.classList.add("open");
    _openDropdown = dd;
    _openDropdownInput = inputEl;
    if (!dd.id) dd.id = inputEl.id + "-listbox";
    inputEl.setAttribute("aria-controls", dd.id);
    inputEl.setAttribute("aria-expanded", "true");
    dd.onclick = function (e) {
      var btn = e.target.closest(".as-dropdown-item");
      if (!btn) return;
      var idx = parseInt(btn.dataset.idx);
      selectOption(options[idx], levelIdx);
    };
  }

  function closeDropdown() {
    if (_openDropdown) { _openDropdown.classList.remove("open"); _openDropdown = null; }
    if (_openDropdownInput) {
      _openDropdownInput.setAttribute("aria-expanded", "false");
      _openDropdownInput.removeAttribute("aria-activedescendant");
      _openDropdownInput = null;
    }
    _highlightIdx = -1;
  }

  function levelOpts(levelIdx) {
    if (_mode === "china") {
      if (_chinaOpts[levelIdx].length) return _chinaOpts[levelIdx];
      return [];
    }
    if (levelIdx === 0) return _worldCountries;
    var cc = _worldSel[0] && _worldSel[0].code;
    if (cc && _worldCitiesCache[cc] && _worldCitiesCache[cc].length) return _worldCitiesCache[cc];
    return _worldCitiesCache[cc] || [];
  }

  function isLoading(levelIdx) {
    if (_mode === "china") return levelIdx === 0 && _loading.china;
    return levelIdx === 0 && _loading.world;
  }

  // ═══ Selection ═══
  function selectOption(opt, levelIdx) {
    closeDropdown();
    showStatus("", false);
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
    }).catch(function () { showStatus(t("areaSearch.loadFailed"), true); });
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
    var text = el.dataset.copy || "";
    navigator.clipboard.writeText(text).then(function () {
      el.classList.add("copied");
      if (window.showCopyToast) window.showCopyToast(t("areaSearch.copied"));
      setTimeout(function () { el.classList.remove("copied"); }, 1200);
    }).catch(function () { showStatus(t("areaSearch.copyFailed"), true); });
  }

  function pathRow(label, text, cls) {
    return '<button class="as-path-line ' + cls + '" type="button" data-copy="' + escapeHtml(text) + '"><span class="as-path-label">' + escapeHtml(label) + '</span><span>' + escapeHtml(text) + '</span><span class="as-copy-icon" aria-hidden="true">⧉</span></button>';
  }

  function currentSelection() {
    var selected = _mode === "china" ? _chinaSel : _worldSel;
    var items = selected.filter(Boolean);
    return {
      key: _mode + ":" + items.map(function (item) { return item.code; }).join("/"),
      codes: items.map(function (item) { return item.code; }),
      path: items.map(function (item) { return _mode === "china" ? item.name : (item.cname || item.name); }).join(" ")
    };
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
    var titleHtml = '<div class="as-result-title">' + t("areaSearch.selectedPath") + '</div>';

    if (_mode === "china") {
      pathEl.innerHTML =
        titleHtml +
        pathRow(t("areaSearch.pathChinese"), cn.join(" "), "as-path-cn") +
        pathRow(t("areaSearch.pathInitials"), en.join(" "), "as-path-en") +
        pathRow(t("areaSearch.pathCode"), codes.join(" "), "as-path-code") +
        introHtml;
    } else {
      pathEl.innerHTML =
        titleHtml +
        pathRow(t("areaSearch.pathChinese"), wCn.join(" "), "as-path-cn") +
        pathRow(t("areaSearch.pathEnglish"), wEn.join(" "), "as-path-en") +
        pathRow(t("areaSearch.pathDatasetCode"), wCodes.join(" "), "as-path-code") +
        introHtml;
    }
    pathEl.querySelectorAll(".as-path-line").forEach(function (line) {
      line.addEventListener("click", function () { copyLine(line); });
    });
    var introBtn = document.getElementById("as-intro-btn");
    if (introBtn) introBtn.addEventListener("click", doIntro);
    var selection = currentSelection();
    if (_cachedIntro[selection.key]) {
      var cachedEl = document.createElement("div");
      cachedEl.id = "as-intro-result";
      cachedEl.className = "as-intro-result";
      pathEl.appendChild(cachedEl);
      renderIntroText(cachedEl, _cachedIntro[selection.key]);
    }
  }

  // ═══ AI Intro ═══
  function doIntro() {
    var btn = document.getElementById("as-intro-btn");
    var resultEl = document.getElementById("as-intro-result");
    if (!btn) return;

    var selection = currentSelection();
    if (!selection.codes.length) return;

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
      body: JSON.stringify({ codes: selection.codes, mode: _mode }),
    })
      .then(function (r) { return r.json().then(function (d) {
        if (!r.ok) {
          var error = new Error(d.error || "fail");
          error.retryAfter = d.retry_after || 0;
          throw error;
        }
        return d;
      }); })
      .then(function (d) {
        clearInterval(_timer);
        _cachedIntro[selection.key] = d.intro;
        renderIntroText(resultEl, d.intro);
        btn.disabled = false;
        btn.textContent = "🤖 " + t("areaSearch.intro");
      })
      .catch(function (e) {
        clearInterval(_timer);
        var errorKey = "areaSearch.errors." + (e.message || "unknown");
        var errorMessage = t(errorKey);
        if (e.message === "rate_limited") {
          errorMessage = errorMessage.replace("{minutes}", String(Math.max(1, Math.ceil(e.retryAfter / 60))));
        }
        resultEl.textContent = "❌ " + (errorMessage === errorKey ? t("areaSearch.errors.unknown") : errorMessage);
        btn.disabled = false;
        btn.textContent = "🤖 " + t("areaSearch.intro");
      });
  }

  function renderIntroText(el, text) {
    var lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
    var html = [];
    var listType = "";

    function closeList() {
      if (listType) html.push("</" + listType + ">");
      listType = "";
    }

    function inlineMarkdown(value) {
      return escapeHtml(value)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/__([^_]+)__/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    }

    lines.forEach(function (line) {
      var heading = line.match(/^(#{1,3})\s+(.+)$/);
      var unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      var ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (heading) {
        closeList();
        var level = heading[1].length;
        html.push("<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">");
      } else if (unordered || ordered) {
        var nextListType = unordered ? "ul" : "ol";
        if (listType !== nextListType) {
          closeList();
          listType = nextListType;
          html.push("<" + listType + ">");
        }
        html.push("<li>" + inlineMarkdown((unordered || ordered)[1]) + "</li>");
      } else if (line.trim()) {
        closeList();
        html.push("<p>" + inlineMarkdown(line.trim()) + "</p>");
      } else {
        closeList();
      }
    });
    closeList();
    el.innerHTML = html.join("");
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
      '<div class="as-input-group"><input id="' + id + '" class="as-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" placeholder="' + placeholder + '" autocomplete="off"></div></div>';
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
    var randomBtn = '<button class="as-action-btn" type="button" title="' + t("areaSearch.random") + '" aria-label="' + t("areaSearch.random") + '">🎲</button>';
    var clearBtn = '<button class="as-action-btn" type="button" title="' + t("areaSearch.clear") + '" aria-label="' + t("areaSearch.clear") + '">✕</button>';
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
      var opts = levelOpts(levelIdx);
      if (!opts.length && (isLoading(levelIdx) || levelIdx === 0)) {
        var dd = ensureDropdownEl(input.parentNode);
        openDropdownDom(dd, '<div class="as-dropdown-empty">' + t("areaSearch.loading") + '</div>', input);
        return;
      }
      if (!opts.length) {
        var emptyDropdown = ensureDropdownEl(input.parentNode);
        openDropdownDom(emptyDropdown, '<div class="as-dropdown-empty">' + t("areaSearch.typeToSearch") + '</div>', input);
        return;
      }
      showDropdown(input, filterOpts(opts, input.value), levelIdx);
    });

    input.addEventListener("input", function () {
      input.dataset.selected = "";
      if (_mode === "china") {
        _chinaSel[levelIdx] = null;
        clearChinaBelow(levelIdx + 1);
      } else {
        _worldSel[levelIdx] = null;
      }
      renderPath();
      var query = input.value.trim();
      var opts = levelOpts(levelIdx);
      var needsRemote = _mode === "china"
        ? (levelIdx === 1 && !_chinaSel[0]) || (levelIdx === 2 && !_chinaSel[1])
        : levelIdx === 1 && !_worldSel[0];
      if (needsRemote) {
        if (!query) {
          var dd = ensureDropdownEl(input.parentNode);
          openDropdownDom(dd, '<div class="as-dropdown-empty">' + t("areaSearch.typeToSearch") + '</div>', input);
          return;
        }
        scheduleRemoteSearch(input, levelIdx, query);
      } else {
        showDropdown(input, filterOpts(opts, query), levelIdx);
      }
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
        items.forEach(function (item, i) { item.classList.toggle("highlight", i === _highlightIdx); item.setAttribute("aria-selected", String(i === _highlightIdx)); });
        if (items[_highlightIdx]) input.setAttribute("aria-activedescendant", items[_highlightIdx].id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        _highlightIdx = Math.max(_highlightIdx - 1, 0);
        items.forEach(function (item, i) { item.classList.toggle("highlight", i === _highlightIdx); item.setAttribute("aria-selected", String(i === _highlightIdx)); });
        if (items[_highlightIdx]) input.setAttribute("aria-activedescendant", items[_highlightIdx].id);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (_highlightIdx >= 0 && items[_highlightIdx]) items[_highlightIdx].click();
      } else if (e.key === "Escape") {
        closeDropdown();
      }
    });
  }

  function scheduleRemoteSearch(input, levelIdx, query) {
    clearTimeout(_searchTimers[input.id]);
    var requestId = ++_searchRequestId;
    _searchTimers[input.id] = setTimeout(function () {
      showStatus(t("areaSearch.searching"), false);
      var request = _mode === "china" ? searchChina(String(levelIdx + 1), query) : searchWorldCities(query);
      request.then(function (data) {
        if (requestId !== _searchRequestId || document.activeElement !== input || input.value.trim() !== query) return;
        showStatus("", false);
        showDropdown(input, data, levelIdx);
      }).catch(function () {
        if (requestId !== _searchRequestId) return;
        showStatus(t("areaSearch.loadFailed"), true);
        var dd = ensureDropdownEl(input.parentNode);
        openDropdownDom(dd, '<div class="as-dropdown-empty">' + t("areaSearch.loadFailed") + '</div>', input);
      });
    }, 220);
  }

  // ═══ Initial data ═══
  function loadInitialData() {
    if (_mode === "china" && !_chinaOpts[0].length && !_loading.china) {
      _loading.china = true;
      loadChinaChildren("").then(function (provinces) {
        _chinaOpts[0] = provinces;
        _loading.china = false;
        updatePlaceholder("as-china-l1", t("areaSearch.searchProvince"), provinces);
      }).catch(function () { _loading.china = false; showStatus(t("areaSearch.loadFailed"), true); });
    }
    if (_mode === "world" && !_worldCountries.length && !_loading.world) {
      _loading.world = true;
      loadWorldCountries().then(function (countries) {
        _worldCountries = countries;
        _loading.world = false;
        updatePlaceholder("as-world-l1", t("areaSearch.searchCountry"), countries);
      }).catch(function () { _loading.world = false; showStatus(t("areaSearch.loadFailed"), true); });
    }
  }

  function updatePlaceholder(inputId, text, data) {
    var input = document.getElementById(inputId);
    if (!input) return;
    input.placeholder = text;
    if (document.activeElement === input) {
      var levelIdx = inputId.indexOf("l3") !== -1 ? 2 : (inputId.indexOf("l2") !== -1 ? 1 : 0);
      showDropdown(input, filterOpts(data, input.value), levelIdx);
    }
  }

  // ═══ Tabs ═══
  function renderTabs(parent) {
    var chinaTab = parent.querySelector(".as-tab-china");
    var worldTab = parent.querySelector(".as-tab-world");
    chinaTab.className = "as-tab as-tab-china" + (_mode === "china" ? " active" : "");
    worldTab.className = "as-tab as-tab-world" + (_mode === "world" ? " active" : "");
    chinaTab.setAttribute("aria-selected", String(_mode === "china"));
    worldTab.setAttribute("aria-selected", String(_mode === "world"));
    chinaTab.tabIndex = _mode === "china" ? 0 : -1;
    worldTab.tabIndex = _mode === "world" ? 0 : -1;
  }

  // ═══ Init ═══
  function init(parent) {
    parent.innerHTML =
      '<div class="as-tool">' +
      '<div class="as-tabs" role="tablist" aria-label="' + t("areaSearch.modeLabel") + '">' +
      '<button class="as-tab as-tab-china active" type="button" role="tab" aria-selected="true">' + t("areaSearch.china") + '</button>' +
      '<button class="as-tab as-tab-world" type="button" role="tab" aria-selected="false" tabindex="-1">' + t("areaSearch.world") + '</button>' +
      '</div>' +
      '<p class="as-data-note">' + t("areaSearch.dataNote") + '</p>' +
      '<div id="as-container"></div>' +
      '<div id="as-status" class="as-status as-status-hidden" role="status" aria-live="polite"></div>' +
      '<div id="as-path" class="as-path"></div>' +
      '</div>';

    renderModeUi(document.getElementById("as-container"));

    var chinaTab = parent.querySelector(".as-tab-china");
    var worldTab = parent.querySelector(".as-tab-world");
    chinaTab.addEventListener("click", function () { switchMode("china"); renderTabs(parent); });
    worldTab.addEventListener("click", function () { switchMode("world"); renderTabs(parent); });

    if (!_documentListenersBound) {
      document.addEventListener("click", function (e) {
        if (!e.target.closest(".as-input-group")) closeDropdown();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeDropdown();
      });
      _documentListenersBound = true;
    }
  }

  return { init: init };
})();
