// Diff Tool — line-by-line text comparison, simple LCS, zero deps.
var DiffTool = (function () {
  var HISTORY_KEY = "diff_history";
  var MAX_HISTORY = 20;

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
      '    <span id="diff-msg" class="jt-msg"></span>' +
      '  </div>' +
      '  <div class="diff-panes">' +
      '    <div class="diff-pane">' +
      '      <div class="diff-pane-label">' + t("diff.original") + '</div>' +
      '      <textarea id="diff-left" class="diff-textarea" placeholder="' + t("diff.pasteOriginal") + '"></textarea>' +
      '    </div>' +
      '    <div class="diff-pane">' +
      '      <div class="diff-pane-label">' + t("diff.modified") + '</div>' +
      '      <textarea id="diff-right" class="diff-textarea" placeholder="' + t("diff.pasteModified") + '"></textarea>' +
      '    </div>' +
      '  </div>' +
      '  <div id="diff-result" class="diff-result"></div>' +
      '  <div id="diff-history" class="history-bar"></div>' +
      '</div>';

    document.getElementById("diff-run").addEventListener("click", runDiff);
    document.getElementById("diff-swap").addEventListener("click", swap);
    document.getElementById("diff-clear").addEventListener("click", clear);

    // save on blur
    document.getElementById("diff-left").addEventListener("blur", maybeSave);
    document.getElementById("diff-right").addEventListener("blur", maybeSave);

    renderHistory();
  }

  function getLeft()  { return document.getElementById("diff-left").value; }
  function getRight() { return document.getElementById("diff-right").value; }

  function maybeSave() {
    var l = getLeft(), r = getRight();
    if (l || r) { saveHistory(l, r); renderHistory(); }
  }

  function runDiff() {
    var left = getLeft(), right = getRight();
    if (!left && !right) { setMsg("", false); return; }
    saveHistory(left, right);
    renderHistory();

    var leftLines = left.split("\n");
    var rightLines = right.split("\n");
    var result = diffLines(leftLines, rightLines);

    var el = document.getElementById("diff-result");
    if (!result.length) {
      el.innerHTML = '<div class="diff-empty">' + t("diff.identical") + '</div>';
      return;
    }

    var added = 0, removed = 0;
    var html = '<div class="diff-output">';
    result.forEach(function (chunk) {
      if (chunk.type === "equal") {
        html += '<div class="diff-line diff-eq"><span class="diff-ln"></span><span class="diff-ln"></span><span class="diff-txt">' + esc(chunk.text) + '</span></div>';
      } else if (chunk.type === "remove") {
        removed++;
        html += '<div class="diff-line diff-rm"><span class="diff-ln">' + chunk.lineL + '</span><span class="diff-ln"></span><span class="diff-txt">- ' + esc(chunk.text) + '</span></div>';
      } else if (chunk.type === "add") {
        added++;
        html += '<div class="diff-line diff-add"><span class="diff-ln"></span><span class="diff-ln">' + chunk.lineR + '</span><span class="diff-txt">+ ' + esc(chunk.text) + '</span></div>';
      }
    });
    html += '</div>';
    el.innerHTML = html;
    setMsg(t("diff.summary").replace("{a}", added).replace("{r}", removed), false);
  }

  // ponytail: simple LCS line diff, O(n*m) — fine for typical text inputs
  function diffLines(a, b) {
    // build LCS table
    var m = a.length, n = b.length;
    var dp = new Array(m + 1);
    for (var i = 0; i <= m; i++) { dp[i] = new Array(n + 1); for (var j = 0; j <= n; j++) dp[i][j] = 0; }

    for (var i = 1; i <= m; i++)
      for (var j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

    // backtrack
    var result = [];
    var i = m, j = n;
    var bufA = [], bufB = [], lineA = m, lineB = n;

    function flush() {
      if (bufA.length) { for (var k = bufA.length-1; k >= 0; k--) result.unshift({ type:"remove", text: bufA[k], lineL: lineA + k + 1 - bufA.length }); bufA = []; }
      if (bufB.length) { for (var k = bufB.length-1; k >= 0; k--) result.unshift({ type:"add",    text: bufB[k], lineR: lineB + k + 1 - bufB.length }); bufB = []; }
    }

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
        flush();
        result.unshift({ type:"equal", text: a[i-1] });
        i--; j--; lineA = i; lineB = j;
      } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
        bufB.push(b[j-1]);
        j--;
      } else {
        bufA.push(a[i-1]);
        i--;
      }
    }
    flush();
    return result;
  }

  function swap() {
    var l = getLeft(), r = getRight();
    document.getElementById("diff-left").value = r;
    document.getElementById("diff-right").value = l;
    runDiff();
  }

  function clear() {
    document.getElementById("diff-left").value = "";
    document.getElementById("diff-right").value = "";
    document.getElementById("diff-result").innerHTML = "";
    setMsg("", false);
  }

  function setMsg(text, isError) {
    var el = document.getElementById("diff-msg");
    if (!el) return;
    el.textContent = text;
    el.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  function esc(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function renderHistory() {
    var list = loadHistory();
    var el = document.getElementById("diff-history");
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + '</span>';
    list.forEach(function (item) {
      try {
        var d = JSON.parse(item);
        var label = (d.l || "").substring(0, 40).replace(/\n/g, " ") || "(empty)";
        html += '<button class="history-chip" title="' + esc(item) + '">' + esc(label) + '</button>';
      } catch (e) {}
    });
    el.innerHTML = html;
    el.querySelectorAll(".history-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        try {
          var d = JSON.parse(this.getAttribute("title"));
          document.getElementById("diff-left").value = d.l || "";
          document.getElementById("diff-right").value = d.r || "";
          runDiff();
        } catch (e) {}
      });
    });
  }

  return { init: init };
})();
