// QR Code Tool — generate & parse via qrcode + jsQR, zero server deps.
var QrcodeTool = (function () {
  var tab = "generate";
  var scriptPromises = {};
  var QR_GEN_URL = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
  var QR_PARSE_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function init(parent) {
    parent.innerHTML =
      '<div class="b64-tool">' +
      '  <div class="b64-tabs">' +
      '    <button id="qr-tab-gen" class="b64-tab active">' + t("qrcode.generate") + '</button>' +
      '    <button id="qr-tab-parse" class="b64-tab">' + t("qrcode.parse") + '</button>' +
      '  </div>' +
      // ── generate pane ──
      '  <div id="qr-pane-gen" class="b64-pane">' +
      '    <div class="qr-gen-wrap">' +
      '      <div class="qr-gen-left">' +
      '        <textarea id="qr-input" class="b64-textarea" placeholder="' + t("qrcode.inputPlaceholder") + '" style="flex:1;min-height:120px"></textarea>' +
      '        <div class="qr-gen-opts">' +
      '          <label class="crypto-inline"><span>' + t("qrcode.size") + '</span>' +
      '            <select id="qr-size" class="settings-select" style="width:auto">' +
      '              <option value="256">256px</option><option value="192">192px</option>' +
      '              <option value="320">320px</option><option value="400">400px</option>' +
      '            </select></label>' +
      '          <button id="qr-gen-btn" class="jt-btn jt-btn-primary">' + t("qrcode.generate") + '</button>' +
      '          <button id="qr-dl-btn" class="jt-btn">' + t("qrcode.download") + '</button>' +
      '          <span id="qr-gen-msg" class="jt-msg"></span>' +
      '        </div>' +
      '      </div>' +
      '      <div class="qr-gen-right">' +
      '        <canvas id="qr-canvas" style="display:none"></canvas>' +
      '        <div id="qr-preview" class="qr-preview">' +
      '          <div class="qr-empty">' + t("qrcode.emptyPreview") + '</div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    <div id="qr-history" class="history-bar"></div>' +
      '  </div>' +
      // ── parse pane ──
      '  <div id="qr-pane-parse" class="b64-pane hidden">' +
      '    <div class="qr-parse-wrap">' +
      '      <div class="qr-parse-left">' +
      '        <div class="qr-dropzone" id="qr-dropzone">' +
      '          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
      '          <p>' + t("qrcode.dropText") + '</p>' +
      '          <p style="font-size:0.8rem;color:var(--text-muted)">' + t("qrcode.or") + '</p>' +
      '          <label class="jt-btn">' + t("qrcode.chooseImage") + '<input type="file" id="qr-file" accept="image/*" hidden></label>' +
      '          <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">' + t("qrcode.pasteHint") + '</p>' +
      '        </div>' +
      '        <canvas id="qr-parse-canvas" style="display:none"></canvas>' +
      '        <img id="qr-preview-img" style="display:none;max-width:100%;max-height:240px;border-radius:8px;border:1px solid var(--border)">' +
      '      </div>' +
      '      <div class="qr-parse-right">' +
      '        <div class="b64-toolbar" style="margin-bottom:12px;padding-bottom:0;border-bottom:none">' +
      '          <span id="qr-parse-msg" class="jt-msg"></span>' +
      '          <button id="qr-copy-result" class="jt-btn" style="margin-left:auto;display:none">' + t("qrcode.copy") + '</button>' +
      '        </div>' +
      '        <textarea id="qr-result" class="b64-textarea" readonly placeholder="' + t("qrcode.resultPlaceholder") + '" style="flex:1;min-height:120px"></textarea>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    bindEvents();
    renderHistory();
  }

  function switchTab(mode) {
    tab = mode;
    document.getElementById("qr-tab-gen").className = "b64-tab" + (mode === "generate" ? " active" : "");
    document.getElementById("qr-tab-parse").className = "b64-tab" + (mode === "parse" ? " active" : "");
    document.getElementById("qr-pane-gen").classList.toggle("hidden", mode !== "generate");
    document.getElementById("qr-pane-parse").classList.toggle("hidden", mode !== "parse");
  }

  function genMsg(text, err) {
    var el = document.getElementById("qr-gen-msg");
    el.textContent = text;
    el.className = "jt-msg" + (err ? " jt-msg-error" : " jt-msg-ok");
  }

  function bindEvents() {
    document.getElementById("qr-tab-gen").addEventListener("click", function () { switchTab("generate"); });
    document.getElementById("qr-tab-parse").addEventListener("click", function () { switchTab("parse"); });

    // generate
    document.getElementById("qr-gen-btn").addEventListener("click", function () { generateQr(); });
    document.getElementById("qr-dl-btn").addEventListener("click", downloadQr);
    document.getElementById("qr-input").addEventListener("input", function () {
      // auto-generate on input (debounce 300ms)
      clearTimeout(this._qrTimer);
      var self = this;
      this._qrTimer = setTimeout(function () { generateQr(); }, 300);
    });

    // parse
    var drop = document.getElementById("qr-dropzone");
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("b64-dragover"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("b64-dragover"); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("b64-dragover"); handleParseFile(e.dataTransfer.files[0]); });
    document.getElementById("qr-file").addEventListener("change", function () { if (this.files[0]) handleParseFile(this.files[0]); });
    document.addEventListener("paste", handlePaste);
    document.getElementById("qr-copy-result").addEventListener("click", function () {
      var v = document.getElementById("qr-result").value;
      if (v) { navigator.clipboard.writeText(v); showCopyToast(t("qrcode.copied")); }
    });
  }

  // ═══ Generate ═══

  async function generateQr() {
    var text = document.getElementById("qr-input").value.trim();
    var preview = document.getElementById("qr-preview");
    if (!text) {
      preview.innerHTML = '<div class="qr-empty">' + t("qrcode.emptyPreview") + '</div>';
      genMsg("", false);
      return;
    }
    var size = parseInt(document.getElementById("qr-size").value);
    var canvas = document.getElementById("qr-canvas");
    try {
      await ensureScript("qrcode", QR_GEN_URL);
      var qr = qrcode(0, "M"); // type 0=auto, error M
      qr.addData(text);
      qr.make();
      var moduleCount = qr.getModuleCount();
      var cellSize = Math.floor(size / moduleCount);
      var imgSize = moduleCount * cellSize;
      canvas.width = imgSize;
      canvas.height = imgSize;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, imgSize, imgSize);
      ctx.fillStyle = "#000";
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
          }
        }
      }
      var dataUrl = canvas.toDataURL("image/png");
      preview.innerHTML = '<img src="' + dataUrl + '" style="max-width:100%;max-height:100%" alt="QR Code">';
      saveHistory(text);
      renderHistory();
      genMsg("✓ " + t("qrcode.generated"), false);
    } catch (e) {
      genMsg("✗ " + (e.message || e), true);
    }
  }

  function downloadQr() {
    var canvas = document.getElementById("qr-canvas");
    if (!canvas.width) { genMsg(t("qrcode.emptyInput"), true); return; }
    var a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "qrcode_" + dateStamp() + ".png";
    a.click();
    genMsg("✓ " + t("qrcode.downloaded"), false);
  }

  // ═══ Parse ═══

  function parseMsg(text, err) {
    var el = document.getElementById("qr-parse-msg");
    el.textContent = text;
    el.className = "jt-msg" + (err ? " jt-msg-error" : " jt-msg-ok");
  }

  function handleParseFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      showParsedImage(reader.result);
      decodeQr(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(e) {
    if (tab !== "parse") return;
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        var blob = items[i].getAsFile();
        var reader = new FileReader();
        reader.onload = function () {
          showParsedImage(reader.result);
          decodeQr(reader.result);
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  }

  function showParsedImage(dataUrl) {
    var img = document.getElementById("qr-preview-img");
    img.src = dataUrl;
    img.style.display = "block";
    document.getElementById("qr-dropzone").style.display = "none";
  }

  function decodeQr(dataUrl) {
    var img = new Image();
    img.onload = async function () {
      var canvas = document.getElementById("qr-parse-canvas");
      var maxW = 800;
      var scale = img.width > maxW ? maxW / img.width : 1;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var resultEl = document.getElementById("qr-result");
      var copyBtn = document.getElementById("qr-copy-result");
      var code;
      try {
        await ensureScript("jsQR", QR_PARSE_URL);
        code = jsQR(imageData.data, canvas.width, canvas.height);
      } catch (e) {
        resultEl.value = "";
        copyBtn.style.display = "none";
        parseMsg("✗ " + (e.message || e), true);
        return;
      }
      if (code) {
        resultEl.value = code.data;
        copyBtn.style.display = "";
        parseMsg("✓ " + t("qrcode.parsed"), false);
      } else {
        resultEl.value = "";
        copyBtn.style.display = "none";
        parseMsg("✗ " + t("qrcode.parseFailed"), true);
      }
    };
    img.src = dataUrl;
  }

  function ensureScript(globalName, src) {
    if (window[globalName]) return Promise.resolve();
    if (scriptPromises[globalName]) return scriptPromises[globalName];
    scriptPromises[globalName] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = function () {
        if (window[globalName]) resolve();
        else reject(new Error(t("qrcode.loadFailed")));
      };
      script.onerror = function () { reject(new Error(t("qrcode.loadFailed"))); };
      document.head.appendChild(script);
    });
    return scriptPromises[globalName];
  }

  // ── history ──

  var HISTORY_KEY = "qrcode_history";
  var MAX_HISTORY = 20;

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function saveHistory(text) {
    var list = loadHistory();
    var idx = list.indexOf(text);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(text);
    if (list.length > MAX_HISTORY) list.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }

  function renderHistory() {
    var list = loadHistory();
    var el = document.getElementById("qr-history");
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + '</span>';
    list.forEach(function (item) {
      html += '<button class="history-chip" title="' + escapeHtml(item) + '">' + escapeHtml(item.substring(0, 60)) + '</button>';
    });
    el.innerHTML = html;
    el.querySelectorAll(".history-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.getElementById("qr-input").value = this.getAttribute("title");
        generateQr();
      });
    });
  }

  function dateStamp() {
    var d = new Date();
    return d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0") + "_" +
      String(d.getHours()).padStart(2, "0") +
      String(d.getMinutes()).padStart(2, "0") +
      String(d.getSeconds()).padStart(2, "0");
  }

  function escapeHtml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  return { init: init };
})();
