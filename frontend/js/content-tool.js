// Content Generator Tool — paste text, get a remote URL that serves raw plain text.
var ContentTool = (function () {
  var MAX_SIZE = 1024; // chars
  var HISTORY_KEY = "content_tool_history";
  var MAX_HISTORY = 8;

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function saveHistory(item) {
    var history = loadHistory().filter(function (h) { return h.id !== item.id; });
    history.unshift(item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function renderHistory(container) {
    var history = loadHistory();
    if (!history.length) { container.innerHTML = ""; return; }
    container.innerHTML =
      '<span class="history-label">' + t("content.history") + '</span>' +
      history.map(function (item, i) {
        var shortUrl = item.url.replace(/^https?:\/\//, "").slice(0, 30);
        return '<button class="history-chip" data-idx="' + i + '" title="' + escapeHtml(item.url) + '">' +
          escapeHtml(shortUrl) + '</button>';
      }).join("");
    container.querySelectorAll(".history-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var h = history[Number(this.dataset.idx)];
        navigator.clipboard.writeText(h.url).then(function () {
          window.showCopyToast && window.showCopyToast("✓ " + t("content.copied"));
        });
      });
    });
  }

  function updateStats() {
    var text = document.getElementById("content-input").value;
    var len = text.length;
    var el = document.getElementById("content-stats");
    el.textContent = len + " / " + MAX_SIZE + " " + t("content.chars");
    el.style.color = len > MAX_SIZE ? "var(--accent-red, #f44336)" : "";
  }

  function init(parent) {
    parent.innerHTML =
      '<div class="b64-tool">' +
      '  <div class="b64-tabs">' +
      '    <button class="b64-tab active" data-tab="create">' + t("content.createTab") + '</button>' +
      '  </div>' +
      '  <section id="content-tab-create">' +
      '    <div class="content-notice">⚠️ ' + t("content.notice") + '</div>' +
      '    <textarea id="content-input" class="b64-textarea" placeholder="' + t("content.placeholder") + '" rows="12" style="min-height:240px;font-family:monospace;font-size:0.85rem;resize:vertical;"></textarea>' +
      '    <div class="content-controls">' +
      '      <span id="content-stats" class="content-stats">0 / ' + MAX_SIZE + ' ' + t("content.chars") + '</span>' +
      '      <button id="content-generate" class="b64-btn b64-btn-primary">' + t("content.generate") + '</button>' +
      '    </div>' +
      '    <div class="content-hint">💡 ' + t("content.terminalHint") + '</div>' +
      '    <div class="content-hint">' + t("content.urlHint") + '</div>' +
      '    <div id="content-result" class="content-result hidden"></div>' +
      '  </section>' +
      '  <div id="content-history" class="history-bar"></div>' +
      '</div>';

    // bind events
    document.getElementById("content-input").addEventListener("input", updateStats);
    document.getElementById("content-generate").addEventListener("click", doGenerate);

    renderHistory(document.getElementById("content-history"));
    updateStats();
  }

  function doGenerate() {
    var text = document.getElementById("content-input").value;
    if (!text.trim()) return;

    if (text.length > MAX_SIZE) {
      var resultEl = document.getElementById("content-result");
      resultEl.className = "content-result content-error";
      resultEl.innerHTML = "❌ " + t("content.tooLarge");
      resultEl.classList.remove("hidden");
      return;
    }

    var btn = document.getElementById("content-generate");
    btn.disabled = true;
    btn.textContent = t("content.generating");

    fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        btn.disabled = false;
        btn.textContent = t("content.generate");

        var resultEl = document.getElementById("content-result");
        if (!data.ok) {
          resultEl.className = "content-result content-error";
          resultEl.innerHTML = "❌ " + escapeHtml(data.error || "Failed");
          resultEl.classList.remove("hidden");
          return;
        }

        var url = data.url;
        var cmds = [
          { cmd: "curl -s " + url + " | bash", note: "Linux / macOS" },
          { cmd: "curl -s " + url + " -o install.sh && bash install.sh", note: t("content.safer") },
          { cmd: "wget -qO- " + url + " | bash", note: "wget" },
          { cmd: "irm " + url + " | iex", note: "PowerShell" },
        ];
        var cmdRows = cmds.map(function (c) {
          return '<div class="content-cmd-row" data-copy="' + escapeHtml(c.cmd) + '">' +
            '<code>' + escapeHtml(c.cmd) + '</code>' +
            '<span class="content-cmd-note">' + escapeHtml(c.note) + '</span>' +
            '<button class="content-cmd-copy" title="' + t("content.copy") + '">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            '</button></div>';
        }).join("");

        resultEl.className = "content-result content-success";
        resultEl.innerHTML =
          '<div class="content-url-box">' +
          '  <input id="content-url-input" class="content-url-input" type="text" value="' + escapeHtml(url) + '" readonly>' +
          '  <button id="content-copy-btn" class="content-url-btn" title="' + t("content.copy") + '">' +
          '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          '  </button>' +
          '  <button id="content-open-btn" class="content-url-btn" title="' + t("content.open") + '">' +
          '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
          '  </button>' +
          '</div>' +
          '<div class="content-cmds-label">⭐ ' + t("content.recommend") + '</div>' +
          '<div class="content-cmds-list">' + cmdRows + '</div>';

        // bind url copy
        document.getElementById("content-copy-btn").addEventListener("click", function () {
          var input = document.getElementById("content-url-input");
          input.select();
          navigator.clipboard.writeText(input.value).then(function () {
            window.showCopyToast && window.showCopyToast("✓ " + t("content.copied"));
          });
        });

        // bind open
        document.getElementById("content-open-btn").addEventListener("click", function () {
          window.open(url, "_blank");
        });

        // bind cmd row click → copy command
        resultEl.querySelectorAll(".content-cmd-row").forEach(function (row) {
          row.addEventListener("click", function () {
            navigator.clipboard.writeText(row.dataset.copy).then(function () {
              window.showCopyToast && window.showCopyToast("✓ " + t("content.copied"));
            });
          });
        });

        // save history
        saveHistory({ id: data.id, url: data.url, text: text.slice(0, 200) });
        renderHistory(document.getElementById("content-history"));
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = t("content.generate");
        var resultEl = document.getElementById("content-result");
        resultEl.className = "content-result content-error";
        resultEl.innerHTML = "❌ " + t("content.error");
        resultEl.classList.remove("hidden");
      });
  }

  return { init: init };
})();
