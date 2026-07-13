// Code Compare Tool — local line/character diff with file import and comparison options.
var DiffTool = (function () {
  var HISTORY_KEY = "diff_history";
  var MAX_HISTORY = 20;
  var MAX_FILE_BYTES = 2 * 1024 * 1024;
  var MAX_LINES = 5000;
  var MAX_MATRIX_CELLS = 4000000;
  var lastComparison = null;

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function saveHistory(left, right) {
    var entry = JSON.stringify({ l: left, r: right });
    var list = loadHistory();
    var idx = list.indexOf(entry);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(entry);
    if (list.length > MAX_HISTORY) list.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }

  function init(parent) {
    parent.innerHTML =
      '<div class="diff-tool">' +
      '  <div class="diff-toolbar">' +
      '    <button id="diff-run" class="jt-btn jt-btn-primary">' + t("diff.compare") + '</button>' +
      '    <button id="diff-swap" class="jt-btn">' + t("diff.swap") + '</button>' +
      '    <button id="diff-clear" class="jt-btn">' + t("diff.clear") + '</button>' +
      '    <label class="diff-option"><input id="diff-ignore-space" type="checkbox"> ' + t("diff.ignoreWhitespace") + '</label>' +
      '    <label class="diff-option"><input id="diff-ignore-case" type="checkbox"> ' + t("diff.ignoreCase") + '</label>' +
      '    <label class="diff-view-label">' + t("diff.view") +
      '      <select id="diff-view" class="diff-view-select"><option value="side">' + t("diff.sideBySide") + '</option><option value="inline">' + t("diff.inline") + '</option></select>' +
      '    </label>' +
      '    <span id="diff-msg" class="jt-msg" aria-live="polite"></span>' +
      '  </div>' +
      '  <div class="diff-panes">' +
      renderInputPane("left", "original", "pasteOriginal") +
      renderInputPane("right", "modified", "pasteModified") +
      '  </div>' +
      '  <div id="diff-result" class="diff-result"></div>' +
      '  <div id="diff-history" class="history-bar"></div>' +
      '</div>';

    document.getElementById("diff-run").addEventListener("click", runDiff);
    document.getElementById("diff-swap").addEventListener("click", swap);
    document.getElementById("diff-clear").addEventListener("click", clearAll);
    document.getElementById("diff-view").addEventListener("change", rerenderLastComparison);
    document.getElementById("diff-ignore-space").addEventListener("change", runDiff);
    document.getElementById("diff-ignore-case").addEventListener("change", runDiff);
    document.getElementById("diff-left").addEventListener("blur", maybeSave);
    document.getElementById("diff-right").addEventListener("blur", maybeSave);
    bindFileInput("left");
    bindFileInput("right");
    renderHistory();
  }

  function renderInputPane(side, labelKey, placeholderKey) {
    return '    <div class="diff-pane">' +
      '      <div class="diff-pane-heading"><span class="diff-pane-label">' + t("diff." + labelKey) + '</span>' +
      '        <label class="diff-file-button">' + t("diff.importFile") + '<input id="diff-' + side + '-file" type="file" hidden></label></div>' +
      '      <span id="diff-' + side + '-name" class="diff-file-name"></span>' +
      '      <textarea id="diff-' + side + '" class="diff-textarea" spellcheck="false" placeholder="' + t("diff." + placeholderKey) + '"></textarea>' +
      '    </div>';
  }

  function bindFileInput(side) {
    document.getElementById("diff-" + side + "-file").addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        setMsg(t("diff.fileTooLarge"), true);
        this.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        document.getElementById("diff-" + side).value = String(reader.result || "");
        document.getElementById("diff-" + side + "-name").textContent = file.name;
        runDiff();
      };
      reader.onerror = function () { setMsg(t("diff.fileReadError"), true); };
      reader.readAsText(file);
    });
  }

  function getLeft() { return document.getElementById("diff-left").value; }
  function getRight() { return document.getElementById("diff-right").value; }
  function getOptions() {
    return {
      ignoreWhitespace: document.getElementById("diff-ignore-space").checked,
      ignoreCase: document.getElementById("diff-ignore-case").checked,
    };
  }

  function normalizeLine(line, options) {
    var normalized = line;
    if (options.ignoreWhitespace) normalized = normalized.replace(/\s+/g, " ").trim();
    if (options.ignoreCase) normalized = normalized.toLocaleLowerCase();
    return normalized;
  }

  function maybeSave() {
    var left = getLeft(), right = getRight();
    if (left || right) { saveHistory(left, right); renderHistory(); }
  }

  function runDiff() {
    var left = getLeft(), right = getRight();
    if (!left && !right) {
      document.getElementById("diff-result").innerHTML = "";
      lastComparison = null;
      setMsg("", false);
      return;
    }
    saveHistory(left, right);
    renderHistory();

    var options = getOptions();
    var leftLines = left.split("\n"), rightLines = right.split("\n");
    if (leftLines.length > MAX_LINES || rightLines.length > MAX_LINES || leftLines.length * rightLines.length > MAX_MATRIX_CELLS) {
      document.getElementById("diff-result").innerHTML = "";
      lastComparison = null;
      setMsg(t("diff.comparisonTooLarge"), true);
      return;
    }
    var result = diffLines(leftLines, rightLines, options);
    var rows = alignRows(result);
    var changed = rows.some(function (row) { return !row.equal; });
    lastComparison = { rows: rows, options: options };

    if (!changed) {
      document.getElementById("diff-result").innerHTML = '<div class="diff-empty">' + t("diff.identical") + '</div>';
      setMsg(t("diff.noChanges"), false);
      return;
    }
    rerenderLastComparison();
  }

  function diffLines(left, right, options) {
    var m = left.length, n = right.length;
    var leftKeys = left.map(function (line) { return normalizeLine(line, options); });
    var rightKeys = right.map(function (line) { return normalizeLine(line, options); });
    var dp = new Array(m + 1);
    var i, j;
    for (i = 0; i <= m; i++) {
      dp[i] = new Uint32Array(n + 1);
    }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        dp[i][j] = leftKeys[i - 1] === rightKeys[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    var reversed = [];
    i = m; j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && leftKeys[i - 1] === rightKeys[j - 1]) {
        reversed.push({ type: "equal", left: left[i - 1], right: right[j - 1], lineL: i, lineR: j });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        reversed.push({ type: "add", text: right[j - 1], lineR: j });
        j--;
      } else {
        reversed.push({ type: "remove", text: left[i - 1], lineL: i });
        i--;
      }
    }
    return reversed.reverse();
  }

  function alignRows(result) {
    var rows = [];
    var i = 0;
    while (i < result.length) {
      if (result[i].type === "equal") {
        rows.push({ equal: true, left: result[i].left, right: result[i].right, lineL: result[i].lineL, lineR: result[i].lineR });
        i++;
        continue;
      }
      var removed = [], added = [];
      while (i < result.length && result[i].type !== "equal") {
        if (result[i].type === "remove") removed.push(result[i]);
        else added.push(result[i]);
        i++;
      }
      var count = Math.max(removed.length, added.length);
      for (var k = 0; k < count; k++) {
        rows.push({
          equal: false,
          left: removed[k] ? removed[k].text : null,
          right: added[k] ? added[k].text : null,
          lineL: removed[k] ? removed[k].lineL : "",
          lineR: added[k] ? added[k].lineR : "",
        });
      }
    }
    return rows;
  }

  function rerenderLastComparison() {
    if (!lastComparison) return;
    var view = document.getElementById("diff-view").value;
    var rows = lastComparison.rows;
    document.getElementById("diff-result").innerHTML = view === "inline" ? renderInline(rows) : renderSideBySide(rows);
    var added = rows.filter(function (row) { return row.right !== null && !row.equal; }).length;
    var removed = rows.filter(function (row) { return row.left !== null && !row.equal; }).length;
    setMsg(t("diff.summary").replace("{a}", added).replace("{r}", removed), false);
  }

  function renderSideBySide(rows) {
    var html = '<div class="diff-output diff-output-side"><div class="diff-side-header"><span>' + t("diff.original") + '</span><span>' + t("diff.modified") + '</span></div>';
    rows.forEach(function (row) {
      var highlighted = highlightPair(row.left, row.right);
      html += '<div class="diff-side-row">' +
        renderSideCell(row.lineL, highlighted.left, row.equal ? "diff-eq" : (row.left === null ? "diff-blank" : "diff-rm"), row.left === null ? "" : "- ") +
        renderSideCell(row.lineR, highlighted.right, row.equal ? "diff-eq" : (row.right === null ? "diff-blank" : "diff-add"), row.right === null ? "" : "+ ") +
        '</div>';
    });
    return html + '</div>';
  }

  function renderSideCell(lineNumber, content, className, prefix) {
    return '<div class="diff-side-cell ' + className + '"><span class="diff-ln">' + lineNumber + '</span><span class="diff-txt">' + prefix + content + '</span></div>';
  }

  function renderInline(rows) {
    var html = '<div class="diff-output">';
    rows.forEach(function (row) {
      var highlighted = highlightPair(row.left, row.right);
      if (row.equal) {
        html += renderInlineLine(row.lineL, row.lineR, highlighted.left, "diff-eq", "  ");
      } else {
        if (row.left !== null) html += renderInlineLine(row.lineL, "", highlighted.left, "diff-rm", "- ");
        if (row.right !== null) html += renderInlineLine("", row.lineR, highlighted.right, "diff-add", "+ ");
      }
    });
    return html + '</div>';
  }

  function renderInlineLine(lineL, lineR, content, className, prefix) {
    return '<div class="diff-line ' + className + '"><span class="diff-ln">' + lineL + '</span><span class="diff-ln">' + lineR + '</span><span class="diff-txt">' + prefix + content + '</span></div>';
  }

  function highlightPair(left, right) {
    if (left === null || right === null || left.length > 500 || right.length > 500) {
      return { left: left === null ? "" : esc(left), right: right === null ? "" : esc(right) };
    }
    var m = left.length, n = right.length;
    var dp = new Array(m + 1);
    var i, j;
    for (i = 0; i <= m; i++) dp[i] = new Uint16Array(n + 1);
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) dp[i][j] = left[i - 1] === right[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
    var leftParts = [], rightParts = [];
    i = m; j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
        leftParts.push(esc(left[i - 1])); rightParts.push(esc(right[j - 1])); i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        rightParts.push('<mark class="diff-char-add">' + esc(right[j - 1]) + '</mark>'); j--;
      } else {
        leftParts.push('<mark class="diff-char-rm">' + esc(left[i - 1]) + '</mark>'); i--;
      }
    }
    return { left: leftParts.reverse().join(""), right: rightParts.reverse().join("") };
  }

  function swap() {
    var left = getLeft(), right = getRight();
    document.getElementById("diff-left").value = right;
    document.getElementById("diff-right").value = left;
    var leftName = document.getElementById("diff-left-name").textContent;
    document.getElementById("diff-left-name").textContent = document.getElementById("diff-right-name").textContent;
    document.getElementById("diff-right-name").textContent = leftName;
    runDiff();
  }

  function clearAll() {
    ["left", "right"].forEach(function (side) {
      document.getElementById("diff-" + side).value = "";
      document.getElementById("diff-" + side + "-name").textContent = "";
      document.getElementById("diff-" + side + "-file").value = "";
    });
    document.getElementById("diff-result").innerHTML = "";
    lastComparison = null;
    setMsg("", false);
  }

  function setMsg(message, isError) {
    var el = document.getElementById("diff-msg");
    if (!el) return;
    el.textContent = message;
    el.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  function esc(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }

  function renderHistory() {
    var list = loadHistory();
    var el = document.getElementById("diff-history");
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + '</span>';
    list.forEach(function (item, index) {
      try {
        var data = JSON.parse(item);
        var label = (data.l || "").substring(0, 40).replace(/\n/g, " ") || t("diff.emptyInput");
        html += '<button class="history-chip" data-idx="' + index + '">' + esc(label) + '</button>';
      } catch (e) {}
    });
    el.innerHTML = html;
    el.querySelectorAll(".history-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        try {
          var data = JSON.parse(list[parseInt(this.dataset.idx, 10)]);
          document.getElementById("diff-left").value = data.l || "";
          document.getElementById("diff-right").value = data.r || "";
          runDiff();
        } catch (e) {}
      });
    });
  }

  return {
    init: init,
    _test: { normalizeLine: normalizeLine, diffLines: diffLines, alignRows: alignRows, highlightPair: highlightPair },
  };
})();
