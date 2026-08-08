// JSON Tool — focused formatter, automatic side-by-side comparison, and structured-data conversion.
var JsonTool = (function () {
  var editor, lineNumbers, viewer, viewerGutter, viewerCode;
  var viewMode = "edit";
  var foldModel = {};
  var folded = {};
  var convertRatio = 0.5;
  var compareRatio = 0.5;
  var convertTimer = null;
  var compareTimer = null;
  var compareRunId = 0;
  var compareLeftHl = null;
  var compareRightHl = null;

  // ponytail: conversion and diff engines are shared with the dedicated tools.
  var CONVERTER_URL = "/js/converter-tool.js";
  var DIFF_URL = "/js/diff-tool.js";
  var FORMATS = ["json", "yaml", "csv", "xml"];
  var CONVERT_TARGETS = {
    json: ["yaml", "csv", "xml"],
    yaml: ["json", "csv", "xml"],
    csv: ["json", "yaml", "xml"],
    xml: ["json", "yaml", "csv"]
  };
  var EXAMPLES = {
    api: { status: "ok", data: [{ id: 101, name: "Tools24", active: true }], pagination: { page: 1, total: 1 } },
    config: { app: { name: "DevTools", locale: "zh-CN", theme: "dark" }, features: ["json", "jwt", "image"], debug: false },
    nested: { user: { id: 42, profile: { nickname: "developer", tags: ["web", "mobile"] } }, permissions: { read: true, write: false } }
  };

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function init(parent) {
    parent.innerHTML =
      '<div class="json-tool json-tool-single">' +
      '  <div class="b64-tabs" role="tablist" aria-label="' + t("json.tabGroup") + '">' +
      '    <button id="jt-tab-format" class="b64-tab active" type="button" role="tab" aria-selected="true" aria-controls="jt-pane-format">' + t("json.format") + '</button>' +
      '    <button id="jt-tab-compare" class="b64-tab" type="button" role="tab" aria-selected="false" aria-controls="jt-pane-compare">' + t("json.compare") + '</button>' +
      '    <button id="jt-tab-convert" class="b64-tab" type="button" role="tab" aria-selected="false" aria-controls="jt-pane-convert">' + t("json.convert") + '</button>' +
      '  </div>' +
      '  <div id="jt-pane-format" class="b64-pane" role="tabpanel">' +
      '    <div class="json-toolbar">' +
      '      <button id="jt-format" class="jt-btn jt-btn-primary" type="button">' + t("json.formatBtn") + '</button>' +
      '      <button id="jt-compact" class="jt-btn" type="button">' + t("json.compact") + '</button>' +
      '      <button id="jt-expand-all" class="jt-btn" type="button" disabled>' + t("json.expandAll") + '</button>' +
      '      <button id="jt-collapse-all" class="jt-btn" type="button" disabled>' + t("json.collapseAll") + '</button>' +
      '      <button id="jt-edit" class="jt-btn hidden" type="button">' + t("json.edit") + '</button>' +
      '      <button id="jt-copy" class="jt-btn" type="button">' + t("json.copy") + '</button>' +
      '      <button id="jt-clear" class="jt-btn" type="button">' + t("json.clear") + '</button>' +
      '      <select id="jt-example" class="settings-select jt-example-select" aria-label="' + t("json.loadExample") + '"><option value="">' + t("json.loadExample") + '</option><option value="api">' + t("json.exampleApi") + '</option><option value="config">' + t("json.exampleConfig") + '</option><option value="nested">' + t("json.exampleNested") + '</option></select>' +
      '      <span id="jt-msg" class="jt-msg" aria-live="polite"></span>' +
      '    </div>' +
      '    <div id="jt-edit-shell" class="jt-editor-wrap json-editor-single">' +
      '      <pre id="jt-line-numbers" class="jt-line-numbers" aria-hidden="true">1</pre>' +
      '      <textarea id="jt-editor" class="jt-editor" spellcheck="false" placeholder="' + t("json.placeholder") + '" aria-label="' + t("json.placeholder") + '"></textarea>' +
      '    </div>' +
      '    <div id="jt-view" class="jt-view json-editor-single hidden" tabindex="0" role="region" aria-label="' + t("json.foldedView") + '">' +
      '      <div id="jt-view-gutter" class="jt-view-gutter" aria-hidden="true"></div>' +
      '      <div id="jt-view-code" class="jt-view-code"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div id="jt-pane-compare" class="b64-pane hidden" role="tabpanel">' +
      '    <div class="json-toolbar json-compare-toolbar">' +
      '      <span id="jc-compare-msg" class="jt-msg" aria-live="polite">' + t("json.compareReady") + '</span>' +
      '    </div>' +
      '    <div class="json-panes">' +
      '      <section class="json-pane jt-compare-pane" aria-label="' + t("json.compareLabelLeft") + '">' +
      '        <div class="jt-pane-label">' + t("json.compareLabelLeft") + '</div>' +
      '        <div class="jt-cmp-editor">' +
      '          <div id="jc-left-hl" class="jt-cmp-hl" aria-hidden="true"></div>' +
      '          <textarea id="jc-left" class="jt-cmp-input" spellcheck="false" wrap="off" placeholder="' + t("json.comparePlaceholder") + '"></textarea>' +
      '        </div>' +
      '      </section>' +
      '      <div id="jc-cmp-resizer" class="jt-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-valuemin="20" aria-valuemax="80" aria-valuenow="50" aria-label="' + t("json.resizePanes") + '"></div>' +
      '      <section class="json-pane jt-compare-pane" aria-label="' + t("json.compareLabelRight") + '">' +
      '        <div class="jt-pane-label">' + t("json.compareLabelRight") + '</div>' +
      '        <div class="jt-cmp-editor">' +
      '          <div id="jc-right-hl" class="jt-cmp-hl" aria-hidden="true"></div>' +
      '          <textarea id="jc-right" class="jt-cmp-input" spellcheck="false" wrap="off" placeholder="' + t("json.comparePlaceholder") + '"></textarea>' +
      '        </div>' +
      '      </section>' +
      '    </div>' +
      '  </div>' +
      '  <div id="jt-pane-convert" class="b64-pane hidden" role="tabpanel">' +
      '    <div class="json-toolbar">' +
      '      <select id="jc-from" class="settings-select" aria-label="' + t("json.cvFrom") + '">' + renderFormatOptions() + '</select>' +
      '      <span aria-hidden="true">→</span>' +
      '      <select id="jc-to" class="settings-select" aria-label="' + t("json.cvTo") + '"></select>' +
      '      <button id="jc-convert" class="jt-btn jt-btn-primary" type="button">' + t("json.convertBtn") + '</button>' +
      '      <button id="jc-swap" class="jt-btn" type="button" aria-label="' + t("json.swapDir") + '" title="' + t("json.swapDir") + '">⇄</button>' +
      '      <button id="jc-copy" class="jt-btn" type="button">' + t("json.copy") + '</button>' +
      '      <span id="jc-msg" class="jt-msg" aria-live="polite"></span>' +
      '    </div>' +
      '    <div class="json-panes">' +
      '      <div class="json-pane json-pane-left"><textarea id="jc-input" class="jt-editor" spellcheck="false" placeholder="' + t("json.cvPlaceholder") + '"></textarea></div>' +
      '      <div id="jc-resizer" class="jt-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-valuemin="20" aria-valuemax="80" aria-valuenow="50" aria-label="' + t("json.resizePanes") + '"></div>' +
      '      <div class="json-pane json-pane-right"><textarea id="jc-output" class="jt-editor" readonly spellcheck="false" placeholder="' + t("json.cvOutputPlaceholder") + '"></textarea></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    editor = document.getElementById("jt-editor");
    lineNumbers = document.getElementById("jt-line-numbers");
    viewer = document.getElementById("jt-view");
    viewerGutter = document.getElementById("jt-view-gutter");
    viewerCode = document.getElementById("jt-view-code");

    document.getElementById("jt-tab-format").addEventListener("click", function () { switchTab("format"); });
    document.getElementById("jt-tab-compare").addEventListener("click", function () { switchTab("compare"); });
    document.getElementById("jt-tab-convert").addEventListener("click", function () { switchTab("convert"); });
    document.getElementById("jt-format").addEventListener("click", formatJson);
    document.getElementById("jt-compact").addEventListener("click", compactJson);
    document.getElementById("jt-expand-all").addEventListener("click", expandAll);
    document.getElementById("jt-collapse-all").addEventListener("click", collapseAll);
    document.getElementById("jt-edit").addEventListener("click", function () { showEditor(true); });
    document.getElementById("jt-copy").addEventListener("click", copyJson);
    document.getElementById("jt-clear").addEventListener("click", clearJson);
    document.getElementById("jt-example").addEventListener("change", loadExample);
    editor.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        formatJson();
      }
    });
    bindLineNumbers(editor, lineNumbers);
    viewer.addEventListener("copy", copyViewerSelection);
    initComparePane(parent);
    initConvertPane(parent);
  }

  // ═══ Format tab ═══

  function currentJsonText() { return editor ? editor.value : ""; }

  function parseEditor() {
    var raw = currentJsonText();
    if (!raw.trim()) {
      setMsg("", false);
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      showJsonError(error, raw);
      return undefined;
    }
  }

  function formatJson() {
    var value = parseEditor();
    if (value === null || value === undefined) return;
    var formatted = JSON.stringify(value, null, 2);
    editor.value = formatted;
    updateLineNumbers(editor, lineNumbers);
    showViewer(formatted);
    setMsg("✓ " + t("json.valid"), false);
  }

  function compactJson() {
    var value = parseEditor();
    if (value === null || value === undefined) return;
    editor.value = JSON.stringify(value);
    showEditor(false);
    updateLineNumbers(editor, lineNumbers);
    setMsg("✓ " + t("json.compacted"), false);
  }

  function showViewer(text) {
    viewMode = "view";
    foldModel = computeFoldModel(text);
    folded = {};
    document.getElementById("jt-edit-shell").classList.add("hidden");
    viewer.classList.remove("hidden");
    updateViewControls();
    renderViewer();
    viewer.focus();
  }

  function showEditor(focus) {
    viewMode = "edit";
    viewer.classList.add("hidden");
    document.getElementById("jt-edit-shell").classList.remove("hidden");
    updateViewControls();
    updateLineNumbers(editor, lineNumbers);
    if (focus) editor.focus();
  }

  function updateViewControls() {
    var viewing = viewMode === "view";
    document.getElementById("jt-expand-all").disabled = !viewing;
    document.getElementById("jt-collapse-all").disabled = !viewing;
    document.getElementById("jt-edit").classList.toggle("hidden", !viewing);
  }

  function renderViewer() {
    var lines = currentJsonText().split("\n");
    viewerGutter.innerHTML = "";
    viewerCode.innerHTML = "";
    for (var index = 0; index < lines.length; index++) {
      var hidden = isFoldHidden(index);
      var gutterRow = document.createElement("div");
      gutterRow.className = "jt-view-gutter-row" + (hidden ? " hidden" : "");
      var number = document.createElement("span");
      number.className = "jt-view-line-number";
      number.textContent = String(index + 1);
      gutterRow.appendChild(number);
      if (foldModel[index]) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "jt-view-fold";
        button.dataset.line = String(index);
        button.textContent = folded[index] ? "▸" : "▾";
        button.title = t("json.toggleNode");
        button.setAttribute("aria-label", t("json.toggleNode"));
        button.setAttribute("aria-expanded", String(!folded[index]));
        button.addEventListener("click", function () { toggleFold(Number(this.dataset.line)); });
        gutterRow.appendChild(button);
      }
      viewerGutter.appendChild(gutterRow);

      var codeRow = document.createElement("div");
      codeRow.className = "jt-code-line" + (hidden ? " hidden" : "") + (folded[index] ? " is-collapsed" : "");
      codeRow.dataset.line = String(index);
      if (folded[index]) codeRow.dataset.preview = " … " + (foldModel[index].isArray ? "]" : "}");
      codeRow.innerHTML = highlightJsonLine(lines[index]);
      viewerCode.appendChild(codeRow);
    }
  }

  function toggleFold(line) {
    if (!foldModel[line]) return;
    if (folded[line]) delete folded[line];
    else folded[line] = true;
    renderViewer();
  }

  function isFoldHidden(line) {
    return Object.keys(folded).some(function (startValue) {
      var start = Number(startValue);
      var info = foldModel[start];
      return info && line > start && line <= info.end;
    });
  }

  function expandAll() {
    folded = {};
    renderViewer();
  }

  function collapseAll() {
    folded = {};
    Object.keys(foldModel).forEach(function (line) { folded[line] = true; });
    renderViewer();
  }

  // Records every multi-line JSON object/array and its closing line.
  function computeFoldModel(text) {
    var model = {};
    var stack = [];
    var inString = false;
    var escaped = false;
    var lines = text.split("\n");
    for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      var line = lines[lineIndex];
      for (var charIndex = 0; charIndex < line.length; charIndex++) {
        var character = line[charIndex];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') { inString = true; continue; }
        if (character === "{" || character === "[") {
          stack.push({ line: lineIndex, isArray: character === "[", count: 0, hasValue: false });
          continue;
        }
        if (character === "," && stack.length) {
          stack[stack.length - 1].count++;
          stack[stack.length - 1].hasValue = true;
          continue;
        }
        if (character === "}" || character === "]") {
          var entry = stack.pop();
          if (entry && lineIndex > entry.line) {
            var openLine = lines[entry.line].trim();
            var empty = (openLine.endsWith("{") && line.trim().startsWith("}")) || (openLine.endsWith("[") && line.trim().startsWith("]"));
            model[entry.line] = { end: lineIndex, count: empty ? 0 : entry.count + 1, isArray: entry.isArray };
          }
          if (stack.length) stack[stack.length - 1].hasValue = true;
        }
      }
      inString = false;
    }
    return model;
  }

  function highlightJsonLine(line) {
    var tokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false)\b|\bnull\b|[{}\[\],]/g;
    var html = "";
    var lastIndex = 0;
    var match;
    while ((match = tokenPattern.exec(line))) {
      html += escapeHtml(line.slice(lastIndex, match.index));
      var token = match[0];
      var className = "jt-bracket";
      if (token[0] === '"') className = match[2] ? "jt-key" : "jt-string";
      else if (token === "true" || token === "false") className = "jt-bool";
      else if (token === "null") className = "jt-null";
      else if (/^-?\d/.test(token)) className = "jt-number";
      html += '<span class="' + className + '">' + escapeHtml(token) + '</span>';
      lastIndex = tokenPattern.lastIndex;
    }
    return html + escapeHtml(line.slice(lastIndex));
  }

  function copyViewerSelection(event) {
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", selection.toString());
  }

  function copyJson() {
    var value = currentJsonText();
    if (!value) return;
    navigator.clipboard.writeText(value).then(function () {
      showCopyToast(t("json.copied"));
      setMsg("✓ " + t("json.copied"), false);
    }).catch(function () {
      setMsg("✗ " + t("json.copyFailed"), true);
    });
  }

  function clearJson() {
    editor.value = "";
    showEditor(true);
    updateLineNumbers(editor, lineNumbers);
    setMsg("", false);
  }

  function loadExample() {
    var select = document.getElementById("jt-example");
    if (!EXAMPLES[select.value]) return;
    editor.value = JSON.stringify(EXAMPLES[select.value], null, 2);
    select.value = "";
    updateLineNumbers(editor, lineNumbers);
    showViewer(editor.value);
    setMsg("✓ " + t("json.exampleLoaded"), false);
  }

  function bindLineNumbers(textarea, gutter) {
    textarea.addEventListener("input", function () { updateLineNumbers(textarea, gutter); });
    textarea.addEventListener("scroll", function () { gutter.scrollTop = textarea.scrollTop; });
    updateLineNumbers(textarea, gutter);
  }

  function updateLineNumbers(textarea, gutter, activeLine) {
    var count = Math.max(1, textarea.value.split("\n").length);
    var numbers = [];
    for (var line = 1; line <= count; line++) {
      numbers.push('<span' + (line === activeLine ? ' class="active"' : "") + '>' + line + '</span>');
    }
    gutter.innerHTML = numbers.join("");
    gutter.scrollTop = textarea.scrollTop;
  }

  function showJsonError(error, raw) {
    showEditor(false);
    var details = locateJsonError(error, raw);
    var location = details.line ? t("json.errorLocation").replace("{line}", details.line).replace("{column}", details.column) : error.message;
    setMsg("✗ " + location, true);
    if (Number.isInteger(details.position)) {
      editor.focus();
      editor.setSelectionRange(details.position, Math.min(details.position + 1, raw.length));
    }
    updateLineNumbers(editor, lineNumbers, details.line);
  }

  function locateJsonError(error, raw) {
    var positionMatch = String(error.message).match(/position\s+(\d+)/i);
    var lineMatch = String(error.message).match(/line\s+(\d+)\s+column\s+(\d+)/i);
    var position = positionMatch ? Number(positionMatch[1]) : null;
    var line = lineMatch ? Number(lineMatch[1]) : null;
    var column = lineMatch ? Number(lineMatch[2]) : null;
    if (position !== null) {
      var before = raw.slice(0, position);
      line = before.split("\n").length;
      column = position - before.lastIndexOf("\n");
    }
    return { position: position, line: line, column: column };
  }

  // ═══ Compare tab ═══

  function initComparePane(parent) {
    var left = document.getElementById("jc-left");
    var right = document.getElementById("jc-right");
    compareLeftHl = document.getElementById("jc-left-hl");
    compareRightHl = document.getElementById("jc-right-hl");
    var panes = parent.querySelector("#jt-pane-compare .json-panes");
    var comparePanes = parent.querySelectorAll("#jt-pane-compare .json-pane");
    var leftPane = comparePanes[0];
    var rightPane = comparePanes[1];
    left.addEventListener("input", function () { renderCompareHl(compareLeftHl, left.value, null); scheduleCompare(); });
    right.addEventListener("input", function () { renderCompareHl(compareRightHl, right.value, null); scheduleCompare(); });
    bindCompareScroll(left, right, compareLeftHl, compareRightHl);
    bindHorizontalResizer(document.getElementById("jc-cmp-resizer"), panes, leftPane, rightPane, function () { return compareRatio; }, function (value) { compareRatio = value; });
    applySplit(leftPane, rightPane, compareRatio);
    renderCompareHl(compareLeftHl, "", null);
    renderCompareHl(compareRightHl, "", null);
  }

  function scheduleCompare() {
    clearTimeout(compareTimer);
    compareTimer = setTimeout(runCompare, 350);
  }

  function ensureDiffTool() {
    if (window.DiffTool && window.DiffTool.compareStatuses) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = DIFF_URL;
      script.onload = resolve;
      script.onerror = function () { reject(new Error(t("json.compareLoadFailed"))); };
      document.head.appendChild(script);
    });
  }

  function runCompare() {
    var runId = ++compareRunId;
    var leftEl = document.getElementById("jc-left");
    var rightEl = document.getElementById("jc-right");
    var left = leftEl.value;
    var right = rightEl.value;
    var leftValid = jsonValidity(left);
    var rightValid = jsonValidity(right);
    leftEl.parentElement.classList.toggle("is-invalid", leftValid === false);
    rightEl.parentElement.classList.toggle("is-invalid", rightValid === false);
    if (!left && !right) {
      renderCompareHl(compareLeftHl, left, null);
      renderCompareHl(compareRightHl, right, null);
      setCompareMsg(t("json.compareReady"), false);
      return;
    }
    if (leftValid === false || rightValid === false) {
      var invalidLabel = leftValid === false && rightValid === false ? t("json.compareBothInvalid") : leftValid === false ? t("json.compareLeftInvalid") : t("json.compareRightInvalid");
      setCompareMsg("✗ " + invalidLabel, true);
    }
    ensureDiffTool().then(function () {
      if (runId !== compareRunId) return;
      var result = window.DiffTool.compareStatuses(left, right);
      if (!result) {
        renderCompareHl(compareLeftHl, left, null);
        renderCompareHl(compareRightHl, right, null);
        setCompareMsg("✗ " + t("json.compareTooLarge"), true);
        return;
      }
      renderCompareHl(compareLeftHl, left, result.left);
      renderCompareHl(compareRightHl, right, result.right);
      if (leftValid !== false && rightValid !== false) {
        setCompareMsg(result.added || result.removed ? t("json.compareDifferent") : "✓ " + t("json.compareSame"), false);
      }
    }).catch(function (error) {
      if (runId === compareRunId) setCompareMsg("✗ " + (error.message || error), true);
    });
  }

  function jsonValidity(text) {
    if (!text.trim()) return null;
    try { JSON.parse(text); return true; } catch (error) { return false; }
  }

  function renderCompareHl(highlight, text, status) {
    var scrollTop = highlight.scrollTop;
    var scrollLeft = highlight.scrollLeft;
    highlight.innerHTML = text.split("\n").map(function (line, index) {
      var state = status && status[index + 1] && status[index + 1] !== "same" ? " cmp-" + status[index + 1] : "";
      return '<div class="cmp-line' + state + '">' + (line ? escapeHtml(line) : "&nbsp;") + '</div>';
    }).join("");
    highlight.scrollTop = scrollTop;
    highlight.scrollLeft = scrollLeft;
  }

  function bindCompareScroll(left, right, leftHighlight, rightHighlight) {
    var syncing = false;
    left.addEventListener("scroll", function () {
      leftHighlight.scrollTop = left.scrollTop;
      leftHighlight.scrollLeft = left.scrollLeft;
      if (!syncing) {
        syncing = true;
        right.scrollTop = left.scrollTop;
        syncing = false;
      }
    });
    right.addEventListener("scroll", function () {
      rightHighlight.scrollTop = right.scrollTop;
      rightHighlight.scrollLeft = right.scrollLeft;
      if (!syncing) {
        syncing = true;
        left.scrollTop = right.scrollTop;
        syncing = false;
      }
    });
  }

  function setCompareMsg(text, isError) {
    var message = document.getElementById("jc-compare-msg");
    message.textContent = text;
    message.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  // ═══ Convert tab ═══

  function initConvertPane(parent) {
    renderTargets("json", "yaml");
    var input = document.getElementById("jc-input");
    var panes = parent.querySelector("#jt-pane-convert .json-panes");
    var leftPane = parent.querySelector("#jt-pane-convert .json-pane-left");
    var rightPane = parent.querySelector("#jt-pane-convert .json-pane-right");
    document.getElementById("jc-convert").addEventListener("click", doConvert);
    document.getElementById("jc-swap").addEventListener("click", swapDirection);
    document.getElementById("jc-copy").addEventListener("click", copyConvertResult);
    document.getElementById("jc-from").addEventListener("change", function () { renderTargets(this.value); scheduleConvert(); });
    input.addEventListener("input", scheduleConvert);
    bindHorizontalResizer(document.getElementById("jc-resizer"), panes, leftPane, rightPane, function () { return convertRatio; }, function (value) { convertRatio = value; });
    applySplit(leftPane, rightPane, convertRatio);
  }

  function scheduleConvert() {
    clearTimeout(convertTimer);
    convertTimer = setTimeout(doConvert, 300);
  }

  function renderFormatOptions() {
    return FORMATS.map(function (format) { return '<option value="' + format + '">' + format.toUpperCase() + '</option>'; }).join("");
  }

  function renderTargets(from, keep) {
    var targets = CONVERT_TARGETS[from] || [];
    var select = document.getElementById("jc-to");
    select.innerHTML = targets.map(function (format) { return '<option value="' + format + '">' + format.toUpperCase() + '</option>'; }).join("");
    if (keep !== undefined && targets.indexOf(keep) !== -1) select.value = keep;
  }

  function ensureConverter() {
    if (window.ConverterTool && window.ConverterTool.convertText) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = CONVERTER_URL;
      script.onload = resolve;
      script.onerror = function () { reject(new Error(t("json.cvLoadFailed"))); };
      document.head.appendChild(script);
    });
  }

  function convertStructuredText(from, to, raw) {
    if (from === "json" || to === "json") return window.ConverterTool.convertText(from, to, raw);
    return window.ConverterTool.convertText(from, "json", raw).then(function (intermediate) {
      return window.ConverterTool.convertText("json", to, intermediate.content);
    });
  }

  function doConvert() {
    var input = document.getElementById("jc-input");
    var output = document.getElementById("jc-output");
    var from = document.getElementById("jc-from").value;
    var to = document.getElementById("jc-to").value;
    var raw = input.value;
    if (!raw.trim()) { output.value = ""; setConvertMsg("", false); return; }
    setConvertMsg(t("json.converting"), false);
    ensureConverter().then(function () { return convertStructuredText(from, to, raw); }).then(function (result) {
      output.value = result.content;
      setConvertMsg("✓ " + t("json.cvConverted"), false);
    }).catch(function (error) {
      output.value = "";
      setConvertMsg("✗ " + (error && error.message ? error.message : error), true);
    });
  }

  function copyConvertResult() {
    var output = document.getElementById("jc-output");
    if (!output.value) return;
    navigator.clipboard.writeText(output.value).then(function () {
      showCopyToast(t("json.copied"));
      setConvertMsg("✓ " + t("json.copied"), false);
    }).catch(function () { setConvertMsg("✗ " + t("json.copyFailed"), true); });
  }

  function swapDirection() {
    var fromElement = document.getElementById("jc-from");
    var toElement = document.getElementById("jc-to");
    var input = document.getElementById("jc-input");
    var output = document.getElementById("jc-output");
    var previousFrom = fromElement.value;
    var nextFrom = toElement.value;
    fromElement.value = nextFrom;
    renderTargets(nextFrom, previousFrom);
    var inputValue = input.value;
    input.value = output.value;
    output.value = inputValue;
    setConvertMsg("", false);
    if (input.value.trim()) doConvert();
  }

  // ═══ Shared UI helpers ═══

  function switchTab(mode) {
    ["format", "compare", "convert"].forEach(function (name) {
      var active = mode === name;
      document.getElementById("jt-tab-" + name).classList.toggle("active", active);
      document.getElementById("jt-tab-" + name).setAttribute("aria-selected", String(active));
      document.getElementById("jt-pane-" + name).classList.toggle("hidden", !active);
    });
    if (mode === "compare") scheduleCompare();
  }

  function bindHorizontalResizer(resizer, container, leftPane, rightPane, getRatio, setRatio) {
    function updateRatio(next) {
      setRatio(next);
      applySplit(leftPane, rightPane, next);
      resizer.setAttribute("aria-valuenow", String(Math.round(next * 100)));
    }
    resizer.addEventListener("pointerdown", function (event) {
      if (window.matchMedia("(max-width: 760px)").matches) return;
      event.preventDefault();
      var bounds = container.getBoundingClientRect();
      var startX = event.clientX;
      var startRatio = getRatio();
      resizer.setPointerCapture(event.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      function onMove(moveEvent) {
        var next = Math.max(0.2, Math.min(0.8, startRatio + (moveEvent.clientX - startX) / bounds.width));
        updateRatio(next);
      }
      function onUp(upEvent) {
        resizer.releasePointerCapture(upEvent.pointerId);
        resizer.removeEventListener("pointermove", onMove);
        resizer.removeEventListener("pointerup", onUp);
        resizer.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      resizer.addEventListener("pointermove", onMove);
      resizer.addEventListener("pointerup", onUp);
      resizer.addEventListener("pointercancel", onUp);
    });
    resizer.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      var direction = event.key === "ArrowLeft" ? -1 : 1;
      updateRatio(Math.max(0.2, Math.min(0.8, getRatio() + direction * 0.05)));
    });
  }

  function applySplit(leftPane, rightPane, ratio) {
    leftPane.style.flex = ratio + " 1 0";
    rightPane.style.flex = (1 - ratio) + " 1 0";
  }

  function setMsg(text, isError) {
    var message = document.getElementById("jt-msg");
    if (!message) return;
    message.textContent = text;
    message.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  function setConvertMsg(text, isError) {
    var message = document.getElementById("jc-msg");
    if (!message) return;
    message.textContent = text;
    message.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }

  return { init: init };
})();
