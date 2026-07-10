// Text Tool — local text cleanup and line-format conversion.
var TextTool = (function () {
  var HISTORY_KEY = "text_tool_history";
  var MAX_HISTORY = 12;
  var activeTab = "cleanup";
  var splitRatio = 0.5;

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function lines(value, keepEmpty) {
    var result = String(value).replace(/\r\n/g, "\n").split("\n");
    return keepEmpty ? result : result.filter(function (line) { return line.trim() !== ""; });
  }

  function quoteSql(value) { return "'" + value.replace(/'/g, "''") + "'"; }

  function transform(action, input) {
    var list;
    switch (action) {
      case "trimLines": return lines(input, true).map(function (line) { return line.trim(); }).join("\n");
      case "removeBlank": return lines(input, false).join("\n");
      case "dedupe":
        var seen = new Set();
        return lines(input, true).filter(function (line) { if (seen.has(line)) return false; seen.add(line); return true; }).join("\n");
      case "sortAsc": return lines(input, true).sort(function (a, b) { return a.localeCompare(b); }).join("\n");
      case "sortDesc": return lines(input, true).sort(function (a, b) { return b.localeCompare(a); }).join("\n");
      case "upper": return input.toUpperCase();
      case "lower": return input.toLowerCase();
      case "reverse": return lines(input, true).reverse().join("\n");
      case "collapseSpaces": return lines(input, true).map(function (line) { return line.replace(/[ \t]+/g, " ").trim(); }).join("\n");
      case "jsonArray": return JSON.stringify(lines(input, false), null, 2);
      case "comma": return lines(input, false).join(", ");
      case "csv": return lines(input, false).map(function (line) { return '"' + line.replace(/"/g, '""') + '"'; }).join(",");
      case "sqlIn": return "(" + lines(input, false).map(quoteSql).join(", ") + ")";
      case "quoted": return lines(input, false).map(function (line) { return JSON.stringify(line); }).join(",\n");
      case "addNumbers": return lines(input, true).map(function (line, index) { return (index + 1) + ". " + line; }).join("\n");
      case "removeNumbers": return lines(input, true).map(function (line) { return line.replace(/^\s*\d+[.):、-]?\s*/, ""); }).join("\n");
      default: return input;
    }
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (error) { return []; }
  }

  function saveHistory(value) {
    var text = value.trim();
    if (!text) return;
    var history = loadHistory().filter(function (item) { return item !== text; });
    history.unshift(text);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    renderHistory();
  }

  function renderHistory() {
    var container = document.getElementById("text-history");
    if (!container) return;
    var history = loadHistory();
    if (!history.length) { container.innerHTML = ""; return; }
    container.innerHTML = '<span class="history-label">' + t("history.label") + '</span>' + history.map(function (item, index) {
      var label = item.replace(/\s+/g, " ").slice(0, 32);
      return '<button class="history-chip" data-index="' + index + '" title="' + escapeHtml(item) + '">' + escapeHtml(label) + '</button>';
    }).join("");
    container.querySelectorAll(".history-chip").forEach(function (button) {
      button.addEventListener("click", function () {
        document.getElementById("text-input").value = history[Number(this.dataset.index)];
        updateStats();
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  function updateStats() {
    var value = document.getElementById("text-input").value;
    var words = value.trim() ? value.trim().split(/\s+/).length : 0;
    var lineCount = value ? lines(value, true).length : 0;
    document.getElementById("text-stats").textContent = t("text.stats")
      .replace("{chars}", value.length)
      .replace("{charsNoSpace}", value.replace(/\s/g, "").length)
      .replace("{lines}", lineCount)
      .replace("{words}", words)
      .replace("{bytes}", new TextEncoder().encode(value).length);
  }

  function toolbarButtons() {
    var actions = activeTab === "cleanup"
      ? ["trimLines", "removeBlank", "dedupe", "sortAsc", "sortDesc", "upper", "lower", "reverse", "collapseSpaces"]
      : ["jsonArray", "comma", "csv", "sqlIn", "quoted", "addNumbers", "removeNumbers"];
    return actions.map(function (action) {
      return '<button class="jt-btn" data-text-action="' + action + '">' + t("text.actions." + action) + '</button>';
    }).join("");
  }

  function renderToolbar() {
    document.getElementById("text-actions").innerHTML = toolbarButtons();
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".b64-tab[data-text-tab]").forEach(function (button) {
      button.className = "b64-tab" + (button.dataset.textTab === tab ? " active" : "");
    });
    renderToolbar();
  }

  function init(parent) {
    parent.innerHTML =
      '<div class="json-tool">' +
      '<div class="b64-tabs"><button class="b64-tab active" data-text-tab="cleanup">' + t("text.cleanupTab") + '</button><button class="b64-tab" data-text-tab="convert">' + t("text.convertTab") + '</button></div>' +
      '<div class="json-toolbar"><div id="text-actions" style="display:flex;gap:8px;flex-wrap:wrap"></div><button id="text-swap" class="jt-btn">' + t("text.swap") + '</button><button id="text-copy" class="jt-btn">' + t("text.copy") + '</button><button id="text-clear" class="jt-btn">' + t("text.clear") + '</button></div>' +
      '<div class="json-panes"><div class="json-pane json-pane-left"><textarea id="text-input" class="jt-editor" placeholder="' + t("text.inputPlaceholder") + '"></textarea></div><div id="text-resizer" class="jt-resizer"></div><div class="json-pane json-pane-right"><textarea id="text-output" class="jt-editor" readonly placeholder="' + t("text.outputPlaceholder") + '"></textarea></div></div>' +
      '<div id="text-stats" class="at-muted" style="padding-top:10px"></div><div id="text-history" class="history-bar"></div></div>';

    var input = document.getElementById("text-input");
    var output = document.getElementById("text-output");
    var leftPane = parent.querySelector(".json-pane-left");
    var rightPane = parent.querySelector(".json-pane-right");
    function applySplit() {
      leftPane.style.flex = "0 0 " + (splitRatio * 100) + "%";
      rightPane.style.flex = "0 0 " + ((1 - splitRatio) * 100) + "%";
    }
    applySplit();
    document.getElementById("text-resizer").addEventListener("mousedown", function (event) {
      event.preventDefault();
      var panes = parent.querySelector(".json-panes");
      var startX = event.clientX;
      var startRatio = splitRatio;
      var width = panes.getBoundingClientRect().width;
      function onMove(moveEvent) { splitRatio = Math.max(0.2, Math.min(0.8, startRatio + (moveEvent.clientX - startX) / width)); applySplit(); }
      function onUp() { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    document.querySelectorAll(".b64-tab[data-text-tab]").forEach(function (button) { button.addEventListener("click", function () { switchTab(this.dataset.textTab); }); });
    document.getElementById("text-actions").addEventListener("click", function (event) {
      var button = event.target.closest("[data-text-action]");
      if (!button) return;
      output.value = transform(button.dataset.textAction, input.value);
      saveHistory(input.value);
    });
    input.addEventListener("input", updateStats);
    document.getElementById("text-swap").addEventListener("click", function () { var value = input.value; input.value = output.value; output.value = value; updateStats(); });
    document.getElementById("text-copy").addEventListener("click", function () { if (output.value) navigator.clipboard.writeText(output.value).then(function () { showCopyToast(t("text.copied")); }); });
    document.getElementById("text-clear").addEventListener("click", function () { input.value = ""; output.value = ""; updateStats(); });
    renderToolbar();
    renderHistory();
    updateStats();
  }

  return { init: init };
})();
