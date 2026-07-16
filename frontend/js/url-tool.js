// URL parser and query editor — local browser processing only.
var UrlTool = (function () {
  var HISTORY_KEY = "devtools_url_history";
  var container;
  var currentUrl = null;
  var params = [];
  function t(key) { return (window.__t && window.__t(key)) || key; }
  function byId(id) { return container.querySelector("#" + id); }
  function escapeHtml(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function parseUrl(raw) {
    var value = String(raw || "").trim();
    if (!value) throw new Error("empty");
    if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = "https://" + value;
    return new URL(value);
  }
  function normalizeUrl(raw, sortQuery) {
    var url = raw instanceof URL ? new URL(raw.href) : parseUrl(raw);
    if (sortQuery) url.searchParams.sort();
    return url.href;
  }
  function loadHistory() { try { var value = JSON.parse(localStorage.getItem(HISTORY_KEY)); return Array.isArray(value) ? value.slice(0, 8) : []; } catch (error) { return []; } }
  function saveHistory(value) {
    var list = [value].concat(loadHistory()).filter(function (item, index, source) { return source.indexOf(item) === index; }).slice(0, 8);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (error) { /* storage unavailable */ }
  }
  function hasSensitiveValues(url) {
    if (url.username || url.password) return true;
    return Array.from(url.searchParams.keys()).some(function (key) {
      return /(?:token|secret|password|passwd|api[_-]?key|auth|signature|session|credential)/i.test(key);
    });
  }
  function renderHistory() {
    var bar = byId("url-history");
    var list = loadHistory();
    bar.innerHTML = list.length ? '<span class="history-label">' + t("url.history") + '</span>' + list.map(function (value) {
      return '<button type="button" class="history-item" data-url-history="' + escapeHtml(value) + '">' + escapeHtml(value) + '</button>';
    }).join("") : "";
    bar.querySelectorAll("[data-url-history]").forEach(function (button) {
      button.addEventListener("click", function () { byId("url-input").value = this.dataset.urlHistory; parseAndRender(); });
    });
  }
  function detailRows(url) {
    return [
      [t("url.protocol"), url.protocol], [t("url.origin"), url.origin], [t("url.username"), url.username || "—"],
      [t("url.password"), url.password ? "••••••" : "—"], [t("url.host"), url.host], [t("url.hostname"), url.hostname],
      [t("url.port"), url.port || t("url.defaultPort")], [t("url.pathname"), url.pathname],
      [t("url.search"), url.search || "—"], [t("url.hash"), url.hash || "—"]
    ];
  }
  function rebuild() {
    if (!currentUrl) return;
    currentUrl.search = "";
    var values = params.slice();
    if (byId("url-sort").checked) values.sort(function (a, b) { return a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]); });
    values.forEach(function (pair) { currentUrl.searchParams.append(pair[0], pair[1]); });
    byId("url-normalized").value = currentUrl.href;
    byId("url-details").innerHTML = detailRows(currentUrl).map(function (row) { return '<div class="local-detail-row"><span>' + row[0] + '</span><code>' + escapeHtml(row[1]) + '</code></div>'; }).join("");
  }
  function renderParams() {
    var body = byId("url-param-list");
    body.innerHTML = params.length ? params.map(function (pair, index) {
      return '<div class="url-param-row"><label><span class="sr-only">' + t("url.key") + '</span><input type="text" data-param-key="' + index + '" value="' + escapeHtml(pair[0]) + '" placeholder="' + t("url.key") + '"></label>' +
        '<label><span class="sr-only">' + t("url.value") + '</span><input type="text" data-param-value="' + index + '" value="' + escapeHtml(pair[1]) + '" placeholder="' + t("url.value") + '"></label>' +
        '<button type="button" class="url-remove" data-param-remove="' + index + '" aria-label="' + t("url.remove") + '">×</button></div>';
    }).join("") : '<p class="local-empty">' + t("url.noParams") + '</p>';
    body.querySelectorAll("[data-param-key], [data-param-value]").forEach(function (input) {
      input.addEventListener("input", function () {
        var index = Number(this.dataset.paramKey !== undefined ? this.dataset.paramKey : this.dataset.paramValue);
        params[index][this.dataset.paramKey !== undefined ? 0 : 1] = this.value;
        rebuild();
      });
    });
    body.querySelectorAll("[data-param-remove]").forEach(function (button) {
      button.addEventListener("click", function () { params.splice(Number(this.dataset.paramRemove), 1); renderParams(); rebuild(); });
    });
  }
  function setStatus(message, error) { var status = byId("url-status"); status.textContent = message; status.classList.toggle("is-error", Boolean(error)); }
  function parseAndRender() {
    try {
      currentUrl = parseUrl(byId("url-input").value);
      params = Array.from(currentUrl.searchParams.entries());
      renderParams(); rebuild();
      byId("url-results").hidden = false;
      byId("url-output-panel").hidden = false;
      setStatus(t("url.valid"), false);
      if (!hasSensitiveValues(currentUrl)) saveHistory(currentUrl.href);
      renderHistory();
    } catch (error) {
      currentUrl = null; params = []; byId("url-results").hidden = true; byId("url-output-panel").hidden = true; setStatus(t("url.invalid"), true);
    }
  }
  function init(parent) {
    container = parent;
    container.innerHTML = '<div class="local-tool url-tool"><p class="tool-intro">' + t("url.intro") + '</p>' +
      '<section class="tool-panel"><label class="tool-field"><span>' + t("url.inputLabel") + '</span><textarea id="url-input" rows="3" placeholder="https://example.com/path?tag=dev&tag=tools#section" spellcheck="false"></textarea></label>' +
      '<div class="tool-actions"><button id="url-parse" class="local-primary" type="button">' + t("url.parse") + '</button><button id="url-example" type="button">' + t("url.example") + '</button></div><p id="url-status" class="local-status" role="status" aria-live="polite"></p></section>' +
      '<div id="url-results" class="local-tool-grid" hidden><section class="tool-panel"><h2>' + t("url.components") + '</h2><div id="url-details" class="local-detail-list"></div></section>' +
      '<section class="tool-panel"><div class="local-panel-heading"><h2>' + t("url.parameters") + '</h2><label class="local-check"><input id="url-sort" type="checkbox"> <span>' + t("url.sort") + '</span></label></div><div id="url-param-list"></div><button id="url-add" type="button">' + t("url.add") + '</button></section></div>' +
      '<section id="url-output-panel" class="tool-panel" hidden><label class="tool-field"><span>' + t("url.normalized") + '</span><textarea id="url-normalized" class="local-code-output" rows="3" readonly></textarea></label><button id="url-copy" type="button">' + t("url.copy") + '</button></section>' +
      '<div id="url-history" class="history-bar"></div></div>';
    byId("url-parse").addEventListener("click", parseAndRender);
    byId("url-example").addEventListener("click", function () { byId("url-input").value = "https://user:secret@example.com:8443/api/items?tag=dev&tag=tools&page=2#result"; parseAndRender(); });
    byId("url-sort").addEventListener("change", rebuild);
    byId("url-add").addEventListener("click", function () { params.push(["", ""]); renderParams(); rebuild(); var fields = byId("url-param-list").querySelectorAll("input"); if (fields.length) fields[fields.length - 2].focus(); });
    byId("url-copy").addEventListener("click", function () { navigator.clipboard.writeText(byId("url-normalized").value).then(function () { showCopyToast(t("url.copied")); }).catch(function () {}); });
    renderHistory();
  }
  return { init: init, parseUrl: parseUrl, normalizeUrl: normalizeUrl };
})();
