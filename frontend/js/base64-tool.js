// Base64 Tool — encode/decode text & files. btoa/atob + FileReader + Blob, zero deps.
var Base64Tool = (function () {
  var tab = "text"; // "text" | "file"
  var fileData = null; // { name, size, type, base64 }

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function init(parent) {
    parent.innerHTML =
      '<div class="b64-tool">' +
      '  <div class="b64-tabs">' +
      '    <button id="b64-tab-text" class="b64-tab active">' + t("base64.text") + '</button>' +
      '    <button id="b64-tab-file" class="b64-tab">' + t("base64.file") + '</button>' +
      '  </div>' +
      '  <div id="b64-pane-text" class="b64-pane">' +
      '    <div class="b64-toolbar">' +
      '      <button id="b64-encode" class="jt-btn jt-btn-primary">' + t("base64.encode") + '</button>' +
      '      <button id="b64-decode" class="jt-btn">' + t("base64.decode") + '</button>' +
      '      <button id="b64-swap" class="jt-btn">' + t("base64.swap") + '</button>' +
      '      <button id="b64-copy-out" class="jt-btn">' + t("base64.copy") + '</button>' +
      '      <span id="b64-msg" class="jt-msg"></span>' +
      '    </div>' +
      '    <div class="b64-panes">' +
      '      <textarea id="b64-input" class="b64-textarea" placeholder="' + t("base64.inputPlaceholder") + '"></textarea>' +
      '      <textarea id="b64-output" class="b64-textarea" readonly placeholder="' + t("base64.outputPlaceholder") + '"></textarea>' +
      '    </div>' +
      '  </div>' +
      '  <div id="b64-pane-file" class="b64-pane hidden">' +
      '    <div class="b64-file-grid">' +
      '      <div class="b64-file-card">' +
      '        <div class="b64-dropzone" id="b64-dropzone">' +
      '          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
      '          <p class="b64-drop-text">' + t("base64.dropText") + '</p>' +
      '          <p class="b64-or">' + t("base64.or") + '</p>' +
      '          <label class="jt-btn jt-btn-primary b64-file-btn">' + t("base64.chooseFile") + '<input type="file" id="b64-file-input" hidden></label>' +
      '        </div>' +
      '        <div id="b64-file-info" class="b64-file-info hidden">' +
      '          <span id="b64-file-name"></span>' +
      '          <span id="b64-file-size"></span>' +
      '          <button id="b64-copy-file" class="jt-btn">' + t("base64.copyBase64") + '</button>' +
      '        </div>' +
      '      </div>' +
      '      <div class="b64-file-card">' +
      '        <textarea id="b64-decode-input" class="b64-textarea" placeholder="' + t("base64.pasteBase64") + '"></textarea>' +
      '        <button id="b64-download" class="jt-btn jt-btn-primary b64-dl-btn">' + t("base64.download") + '</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div id="base64-history" class="history-bar"></div>' +
      '</div>';

    bindEvents();
    renderHistory();
  }

  function bindEvents() {
    // tabs
    document.getElementById("b64-tab-text").addEventListener("click", function () { switchTab("text"); });
    document.getElementById("b64-tab-file").addEventListener("click", function () { switchTab("file"); });

    // text mode
    document.getElementById("b64-encode").addEventListener("click", function () { textConvert("encode"); });
    document.getElementById("b64-decode").addEventListener("click", function () { textConvert("decode"); });
    document.getElementById("b64-swap").addEventListener("click", function () {
      var input = document.getElementById("b64-input"), output = document.getElementById("b64-output");
      input.value = output.value; textConvert("decode");
    });
    document.getElementById("b64-copy-out").addEventListener("click", function () {
      var val = document.getElementById("b64-output").value;
      if (val) { navigator.clipboard.writeText(val); setMsg("✓ " + t("base64.copied"), false); }
    });

    // file mode
    var drop = document.getElementById("b64-dropzone");
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("b64-dragover"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("b64-dragover"); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("b64-dragover"); handleFile(e.dataTransfer.files[0]); });

    document.getElementById("b64-file-input").addEventListener("change", function () {
      if (this.files[0]) handleFile(this.files[0]);
    });

    document.getElementById("b64-copy-file").addEventListener("click", function () {
      if (fileData) { navigator.clipboard.writeText(fileData.base64); setMsg("✓ " + t("base64.copied"), false); }
    });

    document.getElementById("b64-download").addEventListener("click", downloadFile);
  }

  function switchTab(mode) {
    tab = mode;
    document.getElementById("b64-tab-text").className = "b64-tab" + (mode === "text" ? " active" : "");
    document.getElementById("b64-tab-file").className = "b64-tab" + (mode === "file" ? " active" : "");
    document.getElementById("b64-pane-text").classList.toggle("hidden", mode !== "text");
    document.getElementById("b64-pane-file").classList.toggle("hidden", mode !== "file");
  }

  function textConvert(mode) {
    var input = document.getElementById("b64-input").value;
    var output = document.getElementById("b64-output");
    if (!input) { output.value = ""; setMsg("", false); return; }
    try {
      var result = mode === "encode" ? btoa(unescape(encodeURIComponent(input))) : decodeURIComponent(escape(atob(input)));
      output.value = result;
      setMsg("✓ " + (mode === "encode" ? t("base64.encoded") : t("base64.decoded")), false);
      saveHistory(input);
      renderHistory();
    } catch (e) {
      output.value = "";
      setMsg("✗ " + e.message, true);
    }
  }

  function handleFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var base64 = reader.result.split(",")[1];
      var full = reader.result;
      fileData = { name: file.name, size: formatSize(file.size), type: file.type, base64: full };

      document.getElementById("b64-file-name").textContent = file.name + " (" + fileData.type + ")";
      document.getElementById("b64-file-size").textContent = fileData.size;
      document.getElementById("b64-file-info").classList.remove("hidden");
      document.getElementById("b64-decode-input").value = full;
      saveHistory(file.name);
      renderHistory();
    };
    reader.readAsDataURL(file);
  }

  function downloadFile() {
    var base64 = document.getElementById("b64-decode-input").value.trim();
    if (!base64) { setMsg("✗ " + t("base64.noInput"), true); return; }

    try {
      // strip data URL prefix if present
      var mime = "application/octet-stream";
      var raw = base64;
      var m = base64.match(/^data:([^;]*);base64,(.*)$/);
      if (m) { mime = m[1] || mime; raw = m[2]; }

      var binary = atob(raw);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var blob = new Blob([bytes], { type: mime });
      var url = URL.createObjectURL(blob);

      var a = document.createElement("a");
      a.href = url;
      a.download = inferFilename(mime);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMsg("✓ " + t("base64.downloaded"), false);
    } catch (e) {
      setMsg("✗ " + e.message, true);
    }
  }

  function inferFilename(mime) {
    var map = { "image/png":"file.png","image/jpeg":"file.jpg","image/gif":"file.gif","image/webp":"file.webp",
                "application/pdf":"file.pdf","text/plain":"file.txt","application/zip":"file.zip",
                "application/json":"file.json","text/html":"file.html","text/css":"file.css" };
    return map[mime] || "download";
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function setMsg(text, isError) {
    var el = document.getElementById("b64-msg");
    if (!el) return;
    el.textContent = text;
    el.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  // ── history (shared pattern) ──
  var HISTORY_KEY = "base64_history";
  var MAX_HISTORY = 20;

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function saveHistory(input) {
    var list = loadHistory();
    var idx = list.indexOf(input);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(input);
    if (list.length > MAX_HISTORY) list.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }

  function renderHistory() {
    var list = loadHistory();
    var el = document.getElementById("base64-history");
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + '</span>';
    list.forEach(function (item) {
      html += '<button class="history-chip" title="' + escapeHtml(item) + '">' + escapeHtml(item.substring(0, 60)) + '</button>';
    });
    el.innerHTML = html;
    el.querySelectorAll(".history-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        if (tab === "text") {
          document.getElementById("b64-input").value = this.getAttribute("title");
          textConvert("encode");
        }
      });
    });
  }

  function escapeHtml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  return { init: init };
})();
