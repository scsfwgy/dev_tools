// JSON Tool — formatter, compactor, collapsible tree + paste-based JSON/CSV/YAML/XML conversion.
var JsonTool = (function () {
  var editor, lineNumbers, tree, viewMode = "editor";
  var splitRatio = 0.5;
  var convertTimer = null;
  // ponytail: conversion logic lives in ConverterTool (file converter); keep this URL in sync with TOOL_REGISTRY's converter script.
  var CONVERTER_URL = "/js/converter-tool.js";
  var CONVERT_TARGETS = {
    json: ["yaml", "csv", "xml"],
    csv: ["json"],
    yaml: ["json"],
    xml: ["json"]
  };
  var EXAMPLES = {
    api: { status: "ok", data: [{ id: 101, name: "Tools24", active: true }], pagination: { page: 1, total: 1 } },
    config: { app: { name: "DevTools", locale: "zh-CN", theme: "dark" }, features: ["json", "jwt", "image"], debug: false },
    nested: { user: { id: 42, profile: { nickname: "developer", tags: ["web", "mobile"] } }, permissions: { read: true, write: false } },
  };

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function init(parent) {
    parent.innerHTML =
      '<div class="json-tool json-tool-single">' +
      '  <div class="b64-tabs" role="tablist" aria-label="' + t("json.tabGroup") + '">' +
      '    <button id="jt-tab-format" class="b64-tab active" type="button" role="tab" aria-selected="true">' + t("json.format") + '</button>' +
      '    <button id="jt-tab-convert" class="b64-tab" type="button" role="tab" aria-selected="false">' + t("json.convert") + '</button>' +
      '  </div>' +
      '  <div id="jt-pane-format" class="b64-pane">' +
      '    <div class="json-toolbar">' +
      '      <button id="jt-format" class="jt-btn jt-btn-primary" type="button">' + t("json.formatBtn") + '</button>' +
      '      <button id="jt-compact" class="jt-btn" type="button">' + t("json.compact") + '</button>' +
      '      <button id="jt-fold" class="jt-btn" type="button" aria-pressed="false">' + t("json.fold") + '</button>' +
      '      <button id="jt-analyze" class="jt-btn" type="button" aria-pressed="false">' + t("json.analyze") + '</button>' +
      '      <button id="jt-copy" class="jt-btn" type="button">' + t("json.copy") + '</button>' +
      '      <select id="jt-example" class="settings-select jt-example-select"><option value="">' + t("json.loadExample") + '</option><option value="api">' + t("json.exampleApi") + '</option><option value="config">' + t("json.exampleConfig") + '</option><option value="nested">' + t("json.exampleNested") + '</option></select>' +
      '      <span id="jt-msg" class="jt-msg" aria-live="polite"></span>' +
      '    </div>' +
      '    <div class="jt-editor-wrap json-editor-single">' +
      '      <pre id="jt-line-numbers" class="jt-line-numbers" aria-hidden="true">1</pre>' +
      '      <textarea id="jt-editor" class="jt-editor" spellcheck="false" placeholder="' + t("json.placeholder") + '"></textarea>' +
      '      <div id="jt-tree" class="jt-tree hidden" tabindex="0" role="region" aria-label="' + t("json.foldedView") + '"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div id="jt-pane-convert" class="b64-pane hidden">' +
      '    <div class="json-toolbar">' +
      '      <select id="jc-from" class="settings-select" style="width:auto" aria-label="' + t("json.cvFrom") + '">' + renderFormatOptions("json") + '</select>' +
      '      <span aria-hidden="true">→</span>' +
      '      <select id="jc-to" class="settings-select" style="width:auto" aria-label="' + t("json.cvTo") + '"></select>' +
      '      <button id="jc-convert" class="jt-btn jt-btn-primary" type="button">' + t("json.convertBtn") + '</button>' +
      '      <button id="jc-swap" class="jt-btn" type="button" aria-label="' + t("json.swapDir") + '" title="' + t("json.swapDir") + '">⇄</button>' +
      '      <button id="jc-copy" class="jt-btn" type="button">' + t("json.copy") + '</button>' +
      '      <span id="jc-msg" class="jt-msg" aria-live="polite"></span>' +
      '    </div>' +
      '    <div class="json-panes">' +
      '      <div class="json-pane json-pane-left"><textarea id="jc-input" class="jt-editor" spellcheck="false" placeholder="' + t("json.cvPlaceholder") + '"></textarea></div>' +
      '      <div id="jc-resizer" class="jt-resizer"></div>' +
      '      <div class="json-pane json-pane-right"><textarea id="jc-output" class="jt-editor" readonly spellcheck="false" placeholder="' + t("json.cvOutputPlaceholder") + '"></textarea></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    editor = document.getElementById("jt-editor");
    lineNumbers = document.getElementById("jt-line-numbers");
    tree = document.getElementById("jt-tree");

    document.getElementById("jt-tab-format").addEventListener("click", function () { switchTab("format"); });
    document.getElementById("jt-tab-convert").addEventListener("click", function () { switchTab("convert"); });
    document.getElementById("jt-format").addEventListener("click", formatJson);
    document.getElementById("jt-compact").addEventListener("click", compactJson);
    document.getElementById("jt-fold").addEventListener("click", toggleFoldedView);
    document.getElementById("jt-analyze").addEventListener("click", toggleAnalysisView);
    document.getElementById("jt-copy").addEventListener("click", copyJson);
    document.getElementById("jt-example").addEventListener("change", loadExample);
    editor.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        formatJson();
      }
    });
    bindLineNumbers(editor, lineNumbers);
    initConvertPane(parent);
  }

  function initConvertPane(parent) {
    renderTargets("json", "yaml");
    var input = document.getElementById("jc-input");
    var resizer = document.getElementById("jc-resizer");
    var leftPane = parent.querySelector("#jt-pane-convert .json-pane-left");
    var rightPane = parent.querySelector("#jt-pane-convert .json-pane-right");
    document.getElementById("jc-convert").addEventListener("click", doConvert);
    document.getElementById("jc-swap").addEventListener("click", swapDirection);
    document.getElementById("jc-copy").addEventListener("click", copyConvertResult);
    document.getElementById("jc-from").addEventListener("change", function () { renderTargets(this.value); });
    input.addEventListener("input", function () {
      clearTimeout(convertTimer);
      convertTimer = setTimeout(doConvert, 300);
    });
    resizer.addEventListener("mousedown", function (event) {
      event.preventDefault();
      var panes = parent.querySelector("#jt-pane-convert .json-panes");
      var startX = event.clientX, startRatio = splitRatio, width = panes.getBoundingClientRect().width;
      function onMove(ev) { splitRatio = Math.max(0.2, Math.min(0.8, startRatio + (ev.clientX - startX) / width)); applyConvertSplit(leftPane, rightPane); }
      function onUp() { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; }
      document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
    });
    applyConvertSplit(leftPane, rightPane);
  }

  function applyConvertSplit(leftPane, rightPane) {
    leftPane.style.flex = "0 0 " + (splitRatio * 100) + "%";
    rightPane.style.flex = "0 0 " + ((1 - splitRatio) * 100) + "%";
  }

  function switchTab(mode) {
    document.getElementById("jt-tab-format").classList.toggle("active", mode === "format");
    document.getElementById("jt-tab-convert").classList.toggle("active", mode === "convert");
    document.getElementById("jt-tab-format").setAttribute("aria-selected", String(mode === "format"));
    document.getElementById("jt-tab-convert").setAttribute("aria-selected", String(mode === "convert"));
    document.getElementById("jt-pane-format").classList.toggle("hidden", mode !== "format");
    document.getElementById("jt-pane-convert").classList.toggle("hidden", mode !== "convert");
  }

  function renderFormatOptions(selected) {
    return ["json", "csv", "yaml", "xml"].map(function (format) {
      return '<option value="' + format + '">' + format.toUpperCase() + '</option>';
    }).join("");
  }

  function renderTargets(from, keep) {
    var targets = CONVERT_TARGETS[from] || [];
    var select = document.getElementById("jc-to");
    select.innerHTML = targets.map(function (format) {
      return '<option value="' + format + '">' + format.toUpperCase() + '</option>';
    }).join("");
    if (keep !== undefined && targets.indexOf(keep) !== -1) select.value = keep;
  }

  function parseEditor() {
    var raw = editor.value.trim();
    if (!raw) {
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
    showEditor();
    var value = parseEditor();
    if (value === null || value === undefined) return;
    editor.value = JSON.stringify(value, null, 2);
    updateLineNumbers(editor, lineNumbers);
    setMsg("✓ " + t("json.valid"), false);
  }

  function compactJson() {
    showEditor();
    var value = parseEditor();
    if (value === null || value === undefined) return;
    editor.value = JSON.stringify(value);
    updateLineNumbers(editor, lineNumbers);
    setMsg("✓ " + t("json.compacted"), false);
  }

  function toggleFoldedView() {
    if (viewMode === "fold") {
      showEditor();
      editor.focus();
      return;
    }
    var value = parseEditor();
    if (value === null || value === undefined) return;
    editor.value = JSON.stringify(value, null, 2);
    updateLineNumbers(editor, lineNumbers);
    showTree(value, "fold");
    setMsg("✓ " + t("json.folded"), false);
  }

  function toggleAnalysisView() {
    if (viewMode === "analysis") {
      showEditor();
      editor.focus();
      return;
    }
    var value = parseEditor();
    if (value === null || value === undefined) return;
    editor.value = JSON.stringify(value, null, 2);
    updateLineNumbers(editor, lineNumbers);
    showTree(value, "analysis");
    setMsg("✓ " + t("json.analyzed"), false);
  }

  function showTree(value, mode) {
    viewMode = mode;
    tree.innerHTML = buildNode(value, mode === "analysis");
    tree.setAttribute("aria-label", t(mode === "analysis" ? "json.analysisView" : "json.foldedView"));
    bindTreeToggles();
    if (mode === "fold") {
      tree.querySelectorAll(".jt-collapsible").forEach(function (node) {
        node.classList.add("jt-collapsed");
        node.querySelector(".jt-toggle").setAttribute("aria-expanded", "false");
      });
    }
    editor.classList.add("hidden");
    lineNumbers.classList.add("hidden");
    tree.classList.remove("hidden");
    updateViewButtons();
    tree.focus();
  }

  function showEditor() {
    viewMode = "editor";
    if (!editor) return;
    editor.classList.remove("hidden");
    lineNumbers.classList.remove("hidden");
    tree.classList.add("hidden");
    updateViewButtons();
  }

  function updateViewButtons() {
    var foldButton = document.getElementById("jt-fold");
    var analyzeButton = document.getElementById("jt-analyze");
    if (!foldButton || !analyzeButton) return;
    foldButton.textContent = t(viewMode === "fold" ? "json.edit" : "json.fold");
    analyzeButton.textContent = t(viewMode === "analysis" ? "json.edit" : "json.analyze");
    foldButton.setAttribute("aria-pressed", String(viewMode === "fold"));
    analyzeButton.setAttribute("aria-pressed", String(viewMode === "analysis"));
  }

  function copyJson() {
    var value = editor.value;
    if (!value) return;
    navigator.clipboard.writeText(value).then(function () {
      showCopyToast(t("json.copied"));
      setMsg("✓ " + t("json.copied"), false);
    }).catch(function () {
      setMsg("✗ " + t("json.copyFailed"), true);
    });
  }

  function loadExample() {
    var select = document.getElementById("jt-example");
    if (!EXAMPLES[select.value]) return;
    showEditor();
    editor.value = JSON.stringify(EXAMPLES[select.value], null, 2);
    select.value = "";
    updateLineNumbers(editor, lineNumbers);
    setMsg("✓ " + t("json.exampleLoaded"), false);
    editor.focus();
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

  // ═══ Convert tab ═══

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

  function doConvert() {
    var input = document.getElementById("jc-input");
    var output = document.getElementById("jc-output");
    var from = document.getElementById("jc-from").value;
    var to = document.getElementById("jc-to").value;
    var raw = input.value;
    if (!raw.trim()) { output.value = ""; setConvertMsg("", false); return; }
    if (from === to) { output.value = raw; setConvertMsg("", false); return; }
    setConvertMsg(t("json.converting"), false);
    ensureConverter().then(function () {
      return window.ConverterTool.convertText(from, to, raw);
    }).then(function (result) {
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
    });
  }

  function swapDirection() {
    var fromEl = document.getElementById("jc-from");
    var toEl = document.getElementById("jc-to");
    var input = document.getElementById("jc-input");
    var output = document.getElementById("jc-output");
    var newFrom = toEl.value;
    renderTargets(newFrom, fromEl.value);
    fromEl.value = newFrom;
    var inputValue = input.value;
    input.value = output.value;
    output.value = inputValue;
    setConvertMsg("", false);
    if (input.value.trim()) doConvert();
  }

  function showJsonError(error, raw) {
    showEditor();
    var details = locateJsonError(error, raw);
    var location = details.line ? t("json.errorLocation").replace("{line}", details.line).replace("{column}", details.column) : error.message;
    setMsg("✗ " + location, true);
    if (Number.isInteger(details.position)) {
      editor.focus();
      editor.setSelectionRange(details.position, Math.min(details.position + 1, raw.length));
    }
    updateLineNumbers(editor, lineNumbers, details.line);
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
      numbers.push(line === activeLine ? '<span class="active">' + line + '</span>' : String(line));
    }
    gutter.innerHTML = numbers.join("\n");
    gutter.scrollTop = textarea.scrollTop;
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

  function bindTreeToggles() {
    tree.querySelectorAll(".jt-toggle").forEach(function (toggle) {
      toggle.addEventListener("click", function (event) {
        event.stopPropagation();
        this.parentElement.classList.toggle("jt-collapsed");
        this.setAttribute("aria-expanded", String(!this.parentElement.classList.contains("jt-collapsed")));
      });
    });
  }

  function buildNode(value, showCounts) {
    if (value === null) return '<span class="jt-null">null</span>';
    if (typeof value === "boolean") return '<span class="jt-bool">' + value + '</span>';
    if (typeof value === "number") return '<span class="jt-number">' + value + '</span>';
    if (typeof value === "string") return '<span class="jt-string">&quot;' + escapeHtml(value) + '&quot;</span>';

    var isArray = Array.isArray(value);
    var keys = isArray ? value.map(function (_, index) { return index; }) : Object.keys(value);
    if (!keys.length) return '<span class="jt-bracket">' + (isArray ? "[]" : "{}") + '</span>';
    var open = isArray ? "[" : "{";
    var close = isArray ? "]" : "}";
    var countLabel = isArray ? t("json.items") : t("json.keys");
    var modeClass = showCounts ? " jt-analysis-node" : " jt-fold-node";
    var summary = showCounts ? '<span class="jt-count">' + keys.length + ' ' + countLabel + '</span>' : '<span class="jt-fold-placeholder">…' + close + '</span>';
    var html = '<div class="jt-row jt-collapsible' + modeClass + '"><button class="jt-toggle" type="button" aria-label="' + t("json.toggleNode") + '" aria-expanded="true">▼</button><span class="jt-bracket">' + open + '</span>' + summary + '</div><div class="jt-children">';
    keys.forEach(function (key, index) {
      var label = isArray ? key : '&quot;' + escapeHtml(String(key)) + '&quot;';
      var keyHtml = isArray && !showCounts ? "" : '<span class="jt-key">' + label + '</span>: ';
      html += '<div class="jt-row">' + keyHtml + buildNode(value[key], showCounts) + (index < keys.length - 1 ? '<span class="jt-comma">,</span>' : '') + '</div>';
    });
    return html + '</div><div class="jt-row jt-closing"><span class="jt-bracket">' + close + '</span></div>';
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }

  return { init: init };
})();
