// Regex Tool — live JavaScript regular-expression testing, replacement and capture inspection.
var RegexTool = (function () {
  var HISTORY_KEY = "regex_history";
  var MAX_HISTORY = 12;
  var MAX_MATCHES = 1000;

  var COMMON_PATTERNS = [
    { name: "Email", category: "validation", pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", flags: "gi", sample: "Contact dev@example.com or support@tools24.uk", replacement: "[email]", zh: "常见邮箱地址", en: "Common email address" },
    { name: "URL", category: "network", pattern: "https?:\\/\\/[^\\s<]+", flags: "gi", sample: "Docs: https://developer.mozilla.org and http://example.com/api", replacement: "[url]", zh: "HTTP / HTTPS 链接", en: "HTTP or HTTPS URL" },
    { name: "IPv4", category: "network", pattern: "\\b(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}\\b", flags: "g", sample: "Local 127.0.0.1, DNS 8.8.8.8, invalid 999.1.1.1", replacement: "[ip]", zh: "合法 IPv4 地址", en: "Valid IPv4 address" },
    { name: "中国手机号", category: "validation", pattern: "(?<!\\d)1[3-9]\\d{9}(?!\\d)", flags: "g", sample: "联系电话 13800138000，错误号码 12800138000", replacement: "[phone]", zh: "中国大陆 11 位手机号", en: "Mainland China mobile number" },
    { name: "中国身份证", category: "validation", pattern: "(?<!\\d)[1-9]\\d{5}(?:18|19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[0-9Xx](?!\\d)", flags: "g", sample: "示例格式：11010519900101123X", replacement: "[id]", zh: "18 位身份证格式校验，不校验校验位", en: "18-digit Chinese ID format without checksum validation" },
    { name: "邮政编码", category: "validation", pattern: "(?<!\\d)[1-9]\\d{5}(?!\\d)", flags: "g", sample: "北京邮编 100000，上海邮编 200000", replacement: "[postal]", zh: "中国大陆 6 位邮政编码", en: "Six-digit Chinese postal code" },
    { name: "日期 YYYY-MM-DD", category: "validation", pattern: "\\b(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])\\b", flags: "g", sample: "Created 2026-07-10, updated 2026-08-01.", replacement: "$1/$2/$3", zh: "常见年月日格式", en: "Common year-month-day format" },
    { name: "时间 HH:mm:ss", category: "validation", pattern: "\\b(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?\\b", flags: "g", sample: "Start 09:30, finish 18:45:20, invalid 25:00", replacement: "[time]", zh: "24 小时时间，可省略秒", en: "24-hour time with optional seconds" },
    { name: "HEX 颜色", category: "development", pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b", flags: "g", sample: "Primary #58a6ff, text #fff, alpha #58a6ff80", replacement: "[color]", zh: "3、6 或 8 位 HEX 颜色", en: "3, 6 or 8 digit HEX color" },
    { name: "UUID", category: "development", pattern: "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\\b", flags: "g", sample: "ID: 550e8400-e29b-41d4-a716-446655440000", replacement: "[uuid]", zh: "标准 UUID 格式", en: "Standard UUID format" },
    { name: "JWT", category: "development", pattern: "\\beyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b", flags: "g", sample: "Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature", replacement: "[jwt]", zh: "常见三段式 JWT", en: "Common three-part JWT" },
    { name: "语义化版本", category: "development", pattern: "\\bv?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-([0-9A-Za-z.-]+))?(?:\\+([0-9A-Za-z.-]+))?\\b", flags: "g", sample: "Versions: 1.2.3, v2.0.0-beta.1, 3.1.4+build.5", replacement: "[version]", zh: "SemVer 版本号", en: "Semantic version number" },
    { name: "整数", category: "text", pattern: "(?<![\\w.])-?\\d+(?![\\w.])", flags: "g", sample: "Values: 42, -7, 3.14, abc12", replacement: "[integer]", zh: "正负整数", en: "Positive or negative integer" },
    { name: "小数", category: "text", pattern: "(?<![\\w.])-?(?:\\d+\\.\\d+|\\d+)(?![\\w.])", flags: "g", sample: "Values: 42, -7.5, 0.25", replacement: "[number]", zh: "整数或小数", en: "Integer or decimal number" },
    { name: "中文字符", category: "text", pattern: "[\\u4e00-\\u9fff]+", flags: "g", sample: "Tools24 是一个 developer toolbox 开发者工具箱。", replacement: "[中文]", zh: "连续中文字符", en: "Consecutive Chinese characters" },
    { name: "连续空白", category: "text", pattern: "\\s+", flags: "g", sample: "Too    many\tspaces\nnew line", replacement: " ", zh: "空格、Tab 和换行", en: "Spaces, tabs and line breaks" },
    { name: "空白行", category: "text", pattern: "^[ \\t]*\\r?\\n", flags: "gm", sample: "line 1\n\nline 2\n   \nline 3", replacement: "", zh: "删除空白行", en: "Match blank lines" },
    { name: "HTML 标签", category: "development", pattern: "<([A-Za-z][A-Za-z0-9]*)\\b[^>]*>(.*?)<\\/\\1>|<([A-Za-z][A-Za-z0-9]*)\\b[^>]*\\/?>", flags: "gis", sample: "<p>Hello</p><img src=\"x.png\">", replacement: "[tag]", zh: "简单 HTML 标签，不适合完整 HTML 解析", en: "Simple HTML tags; not a full HTML parser" },
    { name: "Markdown 链接", category: "development", pattern: "\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)", flags: "g", sample: "Visit [Tools24](https://tools24.uk) now.", replacement: "$1: $2", zh: "Markdown 链接文本与 URL", en: "Markdown link text and URL" },
    { name: "文件扩展名", category: "development", pattern: "\\.([A-Za-z0-9]+)(?=$|[?#])", flags: "g", sample: "photo.png, archive.tar.gz, /app.js?v=1", replacement: "[ext]", zh: "提取文件或 URL 的末级扩展名", en: "Final file or URL extension" },
  ];

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (error) { return []; }
  }

  function saveHistory(pattern, flags) {
    if (!pattern) return;
    var value = { pattern: pattern, flags: flags };
    var history = loadHistory().filter(function (item) {
      return item.pattern !== pattern || item.flags !== flags;
    });
    history.unshift(value);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    renderHistory();
  }

  function selectedFlags() {
    return Array.prototype.map.call(document.querySelectorAll(".rx-flag:checked"), function (input) {
      return input.value;
    }).join("");
  }

  function applyFlags(flags) {
    document.querySelectorAll(".rx-flag").forEach(function (input) {
      input.checked = flags.indexOf(input.value) !== -1;
    });
  }

  function compile(pattern, flags, forceGlobal) {
    var actualFlags = flags;
    if (forceGlobal && actualFlags.indexOf("g") === -1) actualFlags += "g";
    return new RegExp(pattern, actualFlags);
  }

  function collectMatches(regex, text) {
    var matches = [];
    var match;
    while ((match = regex.exec(text)) !== null && matches.length < MAX_MATCHES) {
      matches.push({
        index: match.index,
        value: match[0],
        captures: Array.prototype.slice.call(match, 1),
        groups: match.groups || null,
      });
      if (match[0] === "") regex.lastIndex += 1;
    }
    return matches;
  }

  function buildHighlight(text, matches) {
    if (!matches.length) return '<span class="rx-empty">' + t("regex.noMatches") + "</span>";
    var output = "";
    var cursor = 0;
    matches.forEach(function (match) {
      if (!match.value || match.index < cursor) return;
      output += escapeHtml(text.slice(cursor, match.index));
      output += '<mark class="rx-match">' + escapeHtml(match.value) + "</mark>";
      cursor = match.index + match.value.length;
    });
    output += escapeHtml(text.slice(cursor));
    return output || '<span class="rx-empty">' + t("regex.zeroLength") + "</span>";
  }

  function buildCaptureRows(matches) {
    var rows = "";
    matches.forEach(function (match, matchIndex) {
      var values = match.captures.map(function (capture, captureIndex) {
        return '<span><b>$' + (captureIndex + 1) + "</b> " + escapeHtml(capture === undefined ? t("regex.unmatched") : capture) + "</span>";
      });
      if (match.groups) {
        Object.keys(match.groups).forEach(function (name) {
          values.push('<span><b>&lt;' + escapeHtml(name) + "&gt;</b> " + escapeHtml(match.groups[name] === undefined ? t("regex.unmatched") : match.groups[name]) + "</span>");
        });
      }
      rows += '<tr><td>#' + (matchIndex + 1) + '</td><td><code>' + escapeHtml(match.value || "∅") + '</code></td><td>' + match.index + '</td><td class="rx-capture-values">' + (values.join("") || "—") + "</td></tr>";
    });
    return rows;
  }

  function evaluate() {
    var pattern = document.getElementById("rx-pattern").value;
    var text = document.getElementById("rx-text").value;
    var replacement = document.getElementById("rx-replacement").value;
    var flags = selectedFlags();
    var status = document.getElementById("rx-status");
    var preview = document.getElementById("rx-highlight");
    var captureBody = document.getElementById("rx-captures-body");
    var replacementOutput = document.getElementById("rx-replacement-output");
    var analysis = document.getElementById("rx-analysis");

    if (!pattern) {
      status.className = "rx-status";
      status.textContent = t("regex.enterPattern");
      preview.innerHTML = '<span class="rx-empty">' + t("regex.previewEmpty") + "</span>";
      captureBody.innerHTML = "";
      replacementOutput.textContent = text;
      analysis.innerHTML = "";
      return;
    }

    try {
      var matches = collectMatches(compile(pattern, flags, true), text);
      status.className = "rx-status is-valid";
      status.textContent = t("regex.valid") + " · " + matches.length + " " + t("regex.matches") + (matches.length >= MAX_MATCHES ? "+" : "");
      preview.innerHTML = buildHighlight(text, matches);
      captureBody.innerHTML = buildCaptureRows(matches);
      replacementOutput.textContent = text.replace(compile(pattern, flags, false), replacement);
      analysis.innerHTML = buildAnalysis(pattern, matches);
    } catch (error) {
      status.className = "rx-status is-error";
      status.textContent = error.message;
      preview.innerHTML = '<span class="rx-error-text">' + escapeHtml(error.message) + "</span>";
      captureBody.innerHTML = "";
      replacementOutput.textContent = "";
      analysis.innerHTML = "";
    }
  }

  function buildAnalysis(pattern, matches) {
    var risks = [];
    if (/\([^)]*[+*][^)]*\)[+*{]/.test(pattern) || /\.\*[+*{]/.test(pattern)) risks.push(t("regex.riskBacktracking"));
    if (/\([^)]*\|[^)]*\)[+*]/.test(pattern)) risks.push(t("regex.riskAmbiguous"));
    var zeroCount = matches.filter(function (match) { return match.value === ""; }).length;
    var parts = [];
    if (pattern[0] === "^" || pattern.slice(-1) === "$") parts.push(t("regex.explainAnchored"));
    if (/\\[bBdDsSwW]/.test(pattern)) parts.push(t("regex.explainClasses"));
    if (/\((?!\?:|\?=|\?!|\?<)/.test(pattern)) parts.push(t("regex.explainCaptures"));
    if (/\(\?<[^=!]/.test(pattern)) parts.push(t("regex.explainNamedCaptures"));
    return '<div class="rx-analysis-card"><strong>' + t("regex.analysis") + '</strong><p>' + (parts.join(" · ") || t("regex.explainLiteral")) + '</p>' + (zeroCount ? '<p class="rx-risk">⚠ ' + t("regex.zeroLengthHint").replace("{count}", zeroCount) + '</p>' : '') + (risks.length ? '<ul class="rx-risk">' + risks.map(function (risk) { return '<li>' + risk + '</li>'; }).join("") + '</ul>' : '<p class="rx-safe">✓ ' + t("regex.noObviousRisk") + '</p>') + '</div>';
  }

  function renderHistory() {
    var container = document.getElementById("rx-history");
    if (!container) return;
    var history = loadHistory();
    if (!history.length) { container.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + "</span>";
    history.forEach(function (item, index) {
      html += '<button class="history-chip" data-index="' + index + '" title="/' + escapeHtml(item.pattern) + "/" + escapeHtml(item.flags) + '">/' + escapeHtml(item.pattern) + "/" + escapeHtml(item.flags) + "</button>";
    });
    container.innerHTML = html;
    container.querySelectorAll(".history-chip").forEach(function (button) {
      button.addEventListener("click", function () {
        var item = history[parseInt(this.dataset.index, 10)];
        document.getElementById("rx-pattern").value = item.pattern;
        applyFlags(item.flags);
        evaluate();
      });
    });
  }

  function isEnglish() {
    return document.documentElement.lang.toLowerCase().indexOf("en") === 0;
  }

  function renderCommonPatterns() {
    var body = document.getElementById("rx-common-body");
    if (!body) return;
    var query = document.getElementById("rx-common-search").value.trim().toLowerCase();
    var category = document.getElementById("rx-common-category").value;
    var rows = "";
    COMMON_PATTERNS.forEach(function (item, index) {
      var searchValue = [item.name, item.pattern, item.zh, item.en, item.category].join(" ").toLowerCase();
      if ((query && searchValue.indexOf(query) === -1) || (category && item.category !== category)) return;
      rows += '<tr data-pattern-index="' + index + '"><td><strong>' + escapeHtml(item.name) + '</strong><br><span class="at-muted">' + t("regex.category." + item.category) + '</span></td><td class="rx-common-pattern" data-copy-pattern="' + index + '"><code>/' + escapeHtml(item.pattern) + '/' + escapeHtml(item.flags) + '</code></td><td>' + escapeHtml(isEnglish() ? item.en : item.zh) + '</td><td><button class="jt-btn rx-use-pattern" data-use-pattern="' + index + '">' + t("regex.usePattern") + "</button></td></tr>";
    });
    body.innerHTML = rows || '<tr><td colspan="4" class="rx-common-empty">' + t("regex.noCommonResults") + "</td></tr>";
  }

  function switchRegexTab(tab) {
    document.querySelectorAll(".b64-tab[data-regex-tab]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.regexTab === tab);
    });
    document.getElementById("rx-tab-tester").classList.toggle("hidden", tab !== "tester");
    document.getElementById("rx-tab-common").classList.toggle("hidden", tab !== "common");
  }

  function useTemplate(index) {
    var template = COMMON_PATTERNS[index];
    switchRegexTab("tester");
    document.getElementById("rx-pattern").value = template.pattern;
    document.getElementById("rx-text").value = template.sample;
    document.getElementById("rx-replacement").value = template.replacement;
    applyFlags(template.flags);
    saveHistory(template.pattern, template.flags);
    evaluate();
  }

  function init(parent) {
    var flagInputs = ["g", "i", "m", "s", "u"].map(function (flag) {
      return '<label class="rx-flag-label"><input class="rx-flag" type="checkbox" value="' + flag + '"' + (flag === "g" ? " checked" : "") + '><span>' + flag + '</span></label>';
    }).join("");

    parent.innerHTML =
      '<div class="b64-tool">' +
      '  <div class="b64-tabs"><button class="b64-tab active" data-regex-tab="tester">' + t("regex.testerTab") + '</button><button class="b64-tab" data-regex-tab="common">' + t("regex.commonTab") + '</button></div>' +
      '  <section id="rx-tab-tester" class="android-section">' +
      '  <div class="platform-topic-note"><strong>' + t("regex.engineTitle") + '</strong> · ' + t("regex.engineNote") + '</div>' +
      '  <div class="rx-pattern-row"><span class="rx-slash">/</span><input id="rx-pattern" class="rx-pattern" spellcheck="false" placeholder="' + t("regex.patternPlaceholder") + '"><span class="rx-slash">/</span><div class="rx-flags">' + flagInputs + '</div></div>' +
      '  <div id="rx-status" class="rx-status">' + t("regex.enterPattern") + '</div>' +
      '  <div class="rx-actions"><button id="rx-share" class="jt-btn">' + t("regex.share") + '</button></div><div id="rx-analysis"></div>' +
      '  <div class="rx-grid"><section class="rx-panel"><h3>' + t("regex.testText") + '</h3><textarea id="rx-text" class="rx-textarea" spellcheck="false" placeholder="' + t("regex.textPlaceholder") + '"></textarea></section>' +
      '  <section class="rx-panel"><h3>' + t("regex.highlight") + '</h3><pre id="rx-highlight" class="rx-highlight"><span class="rx-empty">' + t("regex.previewEmpty") + '</span></pre></section></div>' +
      '  <div class="rx-grid rx-grid-lower"><section class="rx-panel"><h3>' + t("regex.replacement") + '</h3><input id="rx-replacement" class="rx-replacement" spellcheck="false" placeholder="' + t("regex.replacementPlaceholder") + '"><pre id="rx-replacement-output" class="rx-replacement-output"></pre></section>' +
      '  <section class="rx-panel"><h3>' + t("regex.captures") + '</h3><div class="rx-table-wrap"><table class="rx-table"><thead><tr><th>#</th><th>' + t("regex.match") + '</th><th>Index</th><th>Groups</th></tr></thead><tbody id="rx-captures-body"></tbody></table></div></section></div>' +
      '  <div id="rx-history" class="history-bar"></div>' +
      '  </section>' +
      '  <section id="rx-tab-common" class="android-section hidden"><div class="at-search-wrap"><input id="rx-common-search" class="search-input" placeholder="' + t("regex.commonSearch") + '"> <select id="rx-common-category" class="crypto-input" style="width:190px"><option value="">' + t("regex.category.all") + '</option><option value="validation">' + t("regex.category.validation") + '</option><option value="network">' + t("regex.category.network") + '</option><option value="text">' + t("regex.category.text") + '</option><option value="development">' + t("regex.category.development") + '</option></select></div><div class="at-table-wrap"><table class="at-table rx-common-table"><thead><tr><th>' + t("regex.commonName") + '</th><th>' + t("regex.commonPattern") + '</th><th>' + t("regex.commonDescription") + '</th><th></th></tr></thead><tbody id="rx-common-body"></tbody></table></div><div class="at-muted" style="margin-top:12px">' + t("regex.commonNote") + '</div></section>' +
      '</div>';

    document.querySelectorAll(".b64-tab[data-regex-tab]").forEach(function (button) {
      button.addEventListener("click", function () { switchRegexTab(this.dataset.regexTab); });
    });
    ["rx-pattern", "rx-text", "rx-replacement"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", evaluate);
    });
    document.querySelectorAll(".rx-flag").forEach(function (input) { input.addEventListener("change", evaluate); });
    document.getElementById("rx-pattern").addEventListener("blur", function () {
      try {
        if (this.value) {
          compile(this.value, selectedFlags(), false);
          saveHistory(this.value, selectedFlags());
        }
      } catch (error) {}
    });
    document.getElementById("rx-common-search").addEventListener("input", renderCommonPatterns);
    document.getElementById("rx-common-category").addEventListener("change", renderCommonPatterns);
    document.getElementById("rx-share").addEventListener("click", function () { var params = new URLSearchParams({ pattern: document.getElementById("rx-pattern").value, flags: selectedFlags(), text: document.getElementById("rx-text").value }); navigator.clipboard.writeText(location.origin + location.pathname + "?" + params.toString()).then(function () { showCopyToast("✓ " + t("regex.shareCopied")); }); });
    document.getElementById("rx-tab-common").addEventListener("click", function (event) {
      var useButton = event.target.closest("[data-use-pattern]");
      if (useButton) {
        useTemplate(parseInt(useButton.dataset.usePattern, 10));
        return;
      }
      var copyCell = event.target.closest("[data-copy-pattern]");
      if (!copyCell) return;
      var item = COMMON_PATTERNS[parseInt(copyCell.dataset.copyPattern, 10)];
      navigator.clipboard.writeText(item.pattern).then(function () { showCopyToast("✓ " + t("regex.copied")); });
    });
    renderHistory();
    renderCommonPatterns();
    var shared = new URLSearchParams(location.search);
    if (shared.has("pattern")) { document.getElementById("rx-pattern").value = shared.get("pattern"); document.getElementById("rx-text").value = shared.get("text") || ""; setFlags(shared.get("flags") || "g"); evaluate(); }
  }

  return { init: init };
})();
