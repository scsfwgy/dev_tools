// Exchange Rate Calculator — searchable multi-currency comparison with dated reference rates.
var ExchangeTool = (function () {
  var HISTORY_KEY = "exchange_history";
  var MAX_HISTORY = 10;
  var COMMON_CODES = ["CNY", "USD", "EUR", "JPY", "KRW", "HKD", "GBP", "AUD", "CAD", "SGD", "CHF", "THB"];
  var COMMON_META = {
    CNY: { symbol: "¥", flag: "🇨🇳" }, USD: { symbol: "$", flag: "🇺🇸" },
    EUR: { symbol: "€", flag: "🇪🇺" }, JPY: { symbol: "¥", flag: "🇯🇵" },
    KRW: { symbol: "₩", flag: "🇰🇷" }, HKD: { symbol: "HK$", flag: "🇭🇰" },
    GBP: { symbol: "£", flag: "🇬🇧" }, AUD: { symbol: "A$", flag: "🇦🇺" },
    CAD: { symbol: "C$", flag: "🇨🇦" }, SGD: { symbol: "S$", flag: "🇸🇬" },
    CHF: { symbol: "CHF", flag: "🇨🇭" }, THB: { symbol: "฿", flag: "🇹🇭" }
  };
  var currencies = COMMON_CODES.map(function (code) {
    return { code: code, name: code, symbol: COMMON_META[code].symbol, flag: COMMON_META[code].flag };
  });
  var rates = null;
  var base = "CNY";
  var targets = ["USD", "HKD", "JPY", "KRW"];
  var parentEl = null;
  var currencyDisplayNames = null;

  function t(key) { return (window.__t && window.__t(key)) || key; }
  function localeName() { return document.documentElement.lang === "en" ? "en-US" : "zh-CN"; }
  function currency(code) { return currencies.find(function (item) { return item.code === code; }); }

  function currencyName(code) {
    var translated = t("exchange.currencies." + code);
    if (translated !== "exchange.currencies." + code) return translated;
    try {
      if (!currencyDisplayNames) currencyDisplayNames = new Intl.DisplayNames([localeName()], { type: "currency" });
      var displayName = currencyDisplayNames.of(code);
      if (displayName && displayName !== code) return displayName;
    } catch (e) {}
    var item = currency(code);
    return item ? item.name : code;
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function parseAmount(raw) {
    var value = String(raw).trim();
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value)) return null;
    var amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 && amount <= 1e15 ? amount : null;
  }

  function formatValue(value) {
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return "0";
    var abs = Math.abs(value);
    if (abs < 0.000001 || abs >= 1e15) return value.toExponential(6);
    return new Intl.NumberFormat(localeName(), {
      maximumFractionDigits: abs < 1 ? 8 : (abs < 100 ? 6 : 2),
      minimumFractionDigits: 0
    }).format(value);
  }

  function sortedCurrencies() {
    return currencies.slice().sort(function (left, right) {
      var leftIndex = COMMON_CODES.indexOf(left.code);
      var rightIndex = COMMON_CODES.indexOf(right.code);
      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }
      return left.code.localeCompare(right.code);
    });
  }

  function pickerMarkup(id, code, excluded, label, addMode) {
    var item = currency(code);
    var content = addMode
      ? '<span class="exchange-picker-add">＋ ' + escapeHtml(label) + '</span>'
      : '<span class="exchange-picker-mark" aria-hidden="true">' + escapeHtml((item && item.flag) || (item && item.symbol) || "¤") + '</span>' +
        '<span class="exchange-picker-code">' + escapeHtml(code) + '</span><span class="exchange-picker-name">' + escapeHtml(currencyName(code)) + '</span>';
    return '<div class="exchange-currency-picker' + (addMode ? " is-add" : "") + '" data-code="' + escapeHtml(code) + '" data-excluded="' + escapeHtml(excluded.join(",")) + '">' +
      '<button' + (id ? ' id="' + id + '"' : "") + ' class="exchange-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="' + escapeHtml(label) + '">' + content + '<span class="exchange-picker-chevron" aria-hidden="true">⌄</span></button>' +
      '<div class="exchange-picker-popover" hidden></div></div>';
  }

  function bindPicker(picker, onSelect) {
    if (!picker) return;
    picker._onCurrencySelect = onSelect;
    picker.querySelector(".exchange-picker-trigger").addEventListener("click", function (event) {
      event.stopPropagation();
      var willOpen = picker.querySelector(".exchange-picker-popover").hidden;
      closePickers();
      if (willOpen) openPicker(picker);
    });
  }

  function openPicker(picker) {
    var popover = picker.querySelector(".exchange-picker-popover");
    popover.hidden = false;
    picker.classList.add("is-open");
    var row = picker.closest(".exchange-result-row");
    if (row) row.classList.add("is-picker-open");
    picker.querySelector(".exchange-picker-trigger").setAttribute("aria-expanded", "true");
    popover.innerHTML = '<div class="exchange-picker-search-wrap"><span aria-hidden="true">⌕</span><input class="exchange-picker-search" type="search" autocomplete="off" placeholder="' + escapeHtml(t("exchange.searchCurrency")) + '" aria-label="' + escapeHtml(t("exchange.searchCurrency")) + '"></div><div class="exchange-picker-list" role="listbox"></div>';
    var search = popover.querySelector(".exchange-picker-search");
    search.addEventListener("input", function () { renderPickerList(picker, this.value); positionPicker(picker); });
    search.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { closePickers(); picker.querySelector(".exchange-picker-trigger").focus(); }
    });
    renderPickerList(picker, "");
    positionPicker(picker);
    search.focus();
  }

  function positionPicker(picker) {
    var trigger = picker.querySelector(".exchange-picker-trigger");
    var popover = picker.querySelector(".exchange-picker-popover");
    var triggerRect = trigger.getBoundingClientRect();
    var popoverRect = popover.getBoundingClientRect();
    var left = Math.max(8, Math.min(triggerRect.left, window.innerWidth - popoverRect.width - 8));
    var top = triggerRect.bottom + 4;
    if (top + popoverRect.height > window.innerHeight - 8 && triggerRect.top > popoverRect.height + 8) {
      top = triggerRect.top - popoverRect.height - 4;
    }
    popover.style.left = left + "px";
    popover.style.top = Math.max(8, top) + "px";
  }

  function renderPickerList(picker, query) {
    var list = picker.querySelector(".exchange-picker-list");
    var selected = picker.dataset.code;
    var excluded = (picker.dataset.excluded || "").split(",").filter(Boolean);
    var normalized = String(query || "").trim().toLocaleLowerCase(localeName());
    var matches = sortedCurrencies().filter(function (item) {
      if (excluded.indexOf(item.code) !== -1 && item.code !== selected) return false;
      if (!normalized) return true;
      var searchText = [item.code, item.name, currencyName(item.code), item.symbol].join(" ").toLocaleLowerCase(localeName());
      return searchText.indexOf(normalized) !== -1;
    });
    if (!matches.length) {
      list.innerHTML = '<div class="exchange-picker-empty">' + escapeHtml(t("exchange.noCurrencyMatch")) + '</div>';
      return;
    }
    function optionMarkup(item) {
      return '<button class="exchange-picker-option' + (item.code === selected ? " is-selected" : "") + '" type="button" role="option" aria-selected="' + (item.code === selected ? "true" : "false") + '" data-code="' + item.code + '">' +
        '<span class="exchange-picker-option-mark" aria-hidden="true">' + escapeHtml(item.flag || item.symbol || "¤") + '</span><strong>' + item.code + '</strong><span>' + escapeHtml(currencyName(item.code)) + '</span><small>' + escapeHtml(item.symbol || item.code) + '</small></button>';
    }
    if (!normalized) {
      var recommended = matches.filter(function (item) { return COMMON_CODES.indexOf(item.code) !== -1; });
      var all = matches.filter(function (item) { return COMMON_CODES.indexOf(item.code) === -1; });
      list.innerHTML = '<div class="exchange-picker-group-label">' + escapeHtml(t("exchange.recommendedCurrencies")) + '</div>' + recommended.map(optionMarkup).join("") +
        (all.length ? '<div class="exchange-picker-group-label">' + escapeHtml(t("exchange.allCurrencies")) + '</div>' + all.map(optionMarkup).join("") : "");
    } else {
      list.innerHTML = matches.map(optionMarkup).join("");
    }
    list.querySelectorAll(".exchange-picker-option").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        var code = this.dataset.code;
        closePickers();
        if (picker._onCurrencySelect) picker._onCurrencySelect(code);
      });
    });
  }

  function closePickers() {
    if (!parentEl) return;
    parentEl.querySelectorAll(".exchange-currency-picker.is-open").forEach(function (picker) {
      picker.classList.remove("is-open");
      var row = picker.closest(".exchange-result-row");
      if (row) row.classList.remove("is-picker-open");
      picker.querySelector(".exchange-picker-trigger").setAttribute("aria-expanded", "false");
      picker.querySelector(".exchange-picker-popover").hidden = true;
    });
  }

  function init(parent) {
    parentEl = parent;
    parent.innerHTML =
      '<div class="b64-tool exchange-tool"><div class="android-section">' +
      '  <div class="at-table-wrap"><table class="at-table exchange-input-table"><tbody><tr>' +
      '    <td><label for="exchange-amount">' + t("exchange.amount") + '</label></td><td><input id="exchange-amount" class="crypto-input" inputmode="decimal" autocomplete="off" value="100"></td>' +
      '    <td><label for="exchange-base">' + t("exchange.baseCurrency") + '</label></td><td><div id="exchange-base-wrap"></div></td>' +
      '    <td><button id="exchange-refresh" class="jt-btn exchange-refresh" type="button" aria-label="' + escapeHtml(t("exchange.refresh")) + '">↻ <span>' + t("exchange.refresh") + '</span></button></td>' +
      '  </tr></tbody></table></div>' +
      '  <div id="exchange-status" class="exchange-status" role="status" aria-live="polite"></div>' +
      '  <div class="exchange-results-head"><h2>' + t("exchange.comparison") + '</h2><div id="exchange-add-wrap"></div></div>' +
      '  <div id="exchange-results" class="exchange-results"></div>' +
      '  <div class="at-doc-refs exchange-note"><strong>' + t("exchange.referenceTitle") + '</strong> · ' + t("exchange.referenceNote") + ' <a href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">Frankfurter</a></div>' +
      '  <div id="exchange-history" class="history-bar"></div>' +
      '</div></div>';

    parent.querySelector("#exchange-amount").addEventListener("input", renderResults);
    parent.querySelector("#exchange-amount").addEventListener("blur", saveCurrentHistory);
    parent.querySelector("#exchange-refresh").addEventListener("click", function () { loadRates(true); });
    parent.addEventListener("click", function (event) { if (!event.target.closest(".exchange-currency-picker")) closePickers(); });
    renderBasePicker();
    renderResults();
    renderHistory();
    loadRates(false);
  }

  function renderBasePicker() {
    var wrap = parentEl.querySelector("#exchange-base-wrap");
    wrap.innerHTML = pickerMarkup("exchange-base", base, [], t("exchange.baseCurrency"), false);
    bindPicker(wrap.querySelector(".exchange-currency-picker"), function (code) {
      var previousBase = base;
      base = code;
      replaceBaseTarget(previousBase);
      renderBasePicker();
      renderResults();
      saveCurrentHistory();
    });
  }

  function loadRates(force) {
    var button = parentEl.querySelector("#exchange-refresh");
    button.disabled = true;
    button.classList.add("is-loading");
    setStatus(t("exchange.loading"), "loading");
    fetch("/api/exchange-rates", { cache: force ? "reload" : "default" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data.ok || !data.rates || !Array.isArray(data.currencies)) throw new Error("Invalid payload");
        rates = data.rates;
        currencies = data.currencies.map(function (item) {
          var common = COMMON_META[item.code] || {};
          return { code: item.code, name: item.name || item.code, symbol: common.symbol || item.symbol || item.code, flag: common.flag || "" };
        }).filter(function (item) { return rates[item.code]; });
        currencyDisplayNames = null;
        targets = targets.filter(function (code, index, list) { return code !== base && currency(code) && list.indexOf(code) === index; });
        if (!currency(base)) base = currency("EUR") ? "EUR" : currencies[0].code;
        if (!targets.length) targets = [sortedCurrencies().find(function (item) { return item.code !== base; }).code];
        setStatus(data.stale ? t("exchange.stale") : t("exchange.updated").replace("{date}", data.date || "—").replace("{count}", currencies.length), data.stale ? "warning" : "ok");
        renderBasePicker();
        renderResults();
      })
      .catch(function () {
        setStatus(t("exchange.loadFailed"), "error");
        renderResults();
      })
      .finally(function () {
        button.disabled = false;
        button.classList.remove("is-loading");
      });
  }

  function converted(amount, target) {
    if (!rates || !rates[base] || !rates[target]) return null;
    return amount * rates[target] / rates[base];
  }

  function renderResults() {
    if (!parentEl) return;
    closePickers();
    var amountInput = parentEl.querySelector("#exchange-amount");
    var amount = parseAmount(amountInput.value);
    amountInput.classList.toggle("is-invalid", amount === null);
    var rows = targets.map(function (code, index) {
      var item = currency(code) || { code: code, name: code, symbol: code };
      var value = amount === null ? null : converted(amount, code);
      var oneRate = converted(1, code);
      var reverseRate = oneRate === null ? null : 1 / oneRate;
      var rateMarkup = oneRate === null
        ? escapeHtml(t("exchange.waiting"))
        : '<span>1 ' + escapeHtml(base) + ' = ' + escapeHtml(formatValue(oneRate)) + ' ' + escapeHtml(code) + '</span>' +
          '<span class="exchange-rate-reverse">' + escapeHtml(formatValue(reverseRate)) + ' ' + escapeHtml(base) + ' = 1 ' + escapeHtml(code) + '</span>';
      var excluded = [base].concat(targets.filter(function (_target, targetIndex) { return targetIndex !== index; }));
      return '<tr class="exchange-result-row" data-index="' + index + '">' +
        '<td class="exchange-result-currency">' + pickerMarkup("", code, excluded, t("exchange.targetCurrency"), false) + '</td>' +
        '<td class="exchange-rate-line">' + rateMarkup + '</td>' +
        '<td class="exchange-result-value"><strong>' + (value === null ? "—" : escapeHtml(formatValue(value))) + '</strong><span>' + escapeHtml(item.symbol) + " · " + code + '</span></td>' +
        '<td class="exchange-result-actions"><button class="jt-btn exchange-copy" type="button"' + (value === null ? " disabled" : "") + '>' + t("exchange.copy") + '</button><button class="jt-btn exchange-remove" type="button" aria-label="' + escapeHtml(t("exchange.removeCurrency")) + '"' + (targets.length === 1 ? " disabled" : "") + '>×</button></td>' +
      '</tr>';
    }).join("");
    parentEl.querySelector("#exchange-results").innerHTML = '<div class="at-table-wrap"><table class="at-table exchange-table"><thead><tr><th>' + t("exchange.currency") + '</th><th>' + t("exchange.rate") + '</th><th>' + t("exchange.result") + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    renderAddPicker();
    bindResults();
  }

  function renderAddPicker() {
    var wrap = parentEl.querySelector("#exchange-add-wrap");
    var excluded = [base].concat(targets);
    wrap.innerHTML = pickerMarkup("exchange-add", "", excluded, t("exchange.addCurrency"), true);
    var picker = wrap.querySelector(".exchange-currency-picker");
    var trigger = picker.querySelector(".exchange-picker-trigger");
    trigger.disabled = excluded.length >= currencies.length;
    bindPicker(picker, function (code) {
      if (!currency(code) || code === base || targets.indexOf(code) !== -1) return;
      targets.push(code);
      renderResults();
      saveCurrentHistory();
    });
  }

  function bindResults() {
    parentEl.querySelectorAll(".exchange-result-row").forEach(function (row) {
      var index = Number(row.dataset.index);
      bindPicker(row.querySelector(".exchange-currency-picker"), function (code) {
        if (!currency(code) || code === base || targets.indexOf(code) !== -1) return;
        targets[index] = code;
        renderResults();
        saveCurrentHistory();
      });
      row.querySelector(".exchange-remove").addEventListener("click", function () {
        if (targets.length <= 1) return;
        targets.splice(index, 1);
        renderResults();
        saveCurrentHistory();
      });
      row.querySelector(".exchange-copy").addEventListener("click", function () { copyResult(index); });
    });
  }

  function replaceBaseTarget(previousBase) {
    var index = targets.indexOf(base);
    if (index === -1) return;
    var replacement = previousBase !== base && targets.indexOf(previousBase) === -1 ? currency(previousBase) : null;
    if (!replacement) replacement = sortedCurrencies().find(function (item) { return item.code !== base && targets.indexOf(item.code) === -1; });
    if (replacement) targets[index] = replacement.code;
    else targets.splice(index, 1);
  }

  function copyResult(index) {
    var amount = parseAmount(parentEl.querySelector("#exchange-amount").value);
    var code = targets[index];
    var value = amount === null ? null : converted(amount, code);
    if (value === null || !navigator.clipboard) return;
    var text = formatValue(amount) + " " + base + " = " + formatValue(value) + " " + code;
    navigator.clipboard.writeText(text).then(function () {
      if (window.showCopyToast) window.showCopyToast(t("exchange.copied"));
    }).catch(function () { setStatus(t("exchange.copyFailed"), "error"); });
  }

  function setStatus(message, type) {
    var status = parentEl && parentEl.querySelector("#exchange-status");
    if (!status) return;
    status.className = "exchange-status" + (type ? " is-" + type : "");
    status.textContent = message;
  }

  function loadHistory() {
    try {
      var history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      return Array.isArray(history) ? history.slice(0, MAX_HISTORY) : [];
    } catch (e) { return []; }
  }

  function saveCurrentHistory() {
    if (!parentEl) return;
    var raw = parentEl.querySelector("#exchange-amount").value.trim();
    if (parseAmount(raw) === null) return;
    var entry = { amount: raw, base: base, targets: targets.slice() };
    var history = loadHistory().filter(function (item) {
      return !(item.amount === entry.amount && item.base === entry.base && JSON.stringify(item.targets) === JSON.stringify(entry.targets));
    });
    history.unshift(entry);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY))); } catch (e) {}
    renderHistory();
  }

  function renderHistory() {
    var container = parentEl && parentEl.querySelector("#exchange-history");
    if (!container) return;
    var history = loadHistory();
    if (!history.length) { container.innerHTML = ""; return; }
    container.innerHTML = '<span class="history-label">' + t("history.label") + '</span>' + history.map(function (item, index) {
      var label = item.amount + " " + item.base + " → " + item.targets.join(" / ");
      return '<button class="history-chip" data-index="' + index + '" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</button>';
    }).join("");
    container.querySelectorAll(".history-chip").forEach(function (button) {
      button.addEventListener("click", function () {
        var item = history[Number(this.dataset.index)];
        if (!item || !currency(item.base)) return;
        base = item.base;
        targets = item.targets.filter(function (code, index, list) { return code !== base && currency(code) && list.indexOf(code) === index; });
        if (!targets.length) targets = [sortedCurrencies().find(function (entry) { return entry.code !== base; }).code];
        parentEl.querySelector("#exchange-amount").value = item.amount;
        renderBasePicker();
        renderResults();
      });
    });
  }

  return { init: init };
})();
