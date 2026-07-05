// URL Encoder/Decoder — native encodeURIComponent/decodeURIComponent, zero deps.
var EncoderTool = (function () {
  var HISTORY_KEY = "encoder_history";
  var MAX_HISTORY = 20;
  var currentMode = "encode";
  var explicitMode = false; // user manually picked mode → don't auto-override

  function t(key) { return (window.__t && window.__t(key)) || key; }

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

  function init(parent) {
    parent.innerHTML =
      '<div class="enc-tool">' +
      '  <div class="enc-toolbar">' +
      '    <button id="enc-encode" class="jt-btn jt-btn-primary">' + t("encoder.encode") + '</button>' +
      '    <button id="enc-decode" class="jt-btn">' + t("encoder.decode") + '</button>' +
      '    <button id="enc-swap" class="jt-btn">' + t("encoder.swap") + '</button>' +
      '    <button id="enc-copy" class="jt-btn">' + t("encoder.copy") + '</button>' +
      '    <span id="enc-msg" class="jt-msg"></span>' +
      '  </div>' +
      '  <div class="enc-panes">' +
      '    <textarea id="enc-input" class="enc-textarea" placeholder="' + t("encoder.inputPlaceholder") + '"></textarea>' +
      '    <textarea id="enc-output" class="enc-textarea" readonly placeholder="' + t("encoder.outputPlaceholder") + '"></textarea>' +
      '  </div>' +
      '  <div id="encoder-history" class="history-bar"></div>' +
      '</div>';

    var input  = document.getElementById("enc-input");
    var output = document.getElementById("enc-output");

    document.getElementById("enc-encode").addEventListener("click", function () {
      currentMode = "encode";
      explicitMode = true;
      updateButtons();
      convert();
    });
    document.getElementById("enc-decode").addEventListener("click", function () {
      currentMode = "decode";
      explicitMode = true;
      updateButtons();
      convert();
    });
    document.getElementById("enc-swap").addEventListener("click", function () {
      input.value = output.value;
      convert();
    });
    document.getElementById("enc-copy").addEventListener("click", function () {
      var val = output.value;
      if (!val) return;
      navigator.clipboard.writeText(val);
      setMsg("✓ " + t("encoder.copied"), false);
    });

    input.addEventListener("input", function () {
      if (!this.value.trim()) explicitMode = false;
      if (!explicitMode) autoDetect();
      convert();
    });
    input.addEventListener("blur", function () {
      var raw = input.value.trim();
      if (raw) { saveHistory(raw); renderHistory(); }
    });

    renderHistory();
  }

  function autoDetect() {
    var raw = document.getElementById("enc-input").value;
    // ponytail: if input contains %XX patterns, it's likely already encoded → decode it
    currentMode = /%[0-9A-Fa-f]{2}/.test(raw) ? "decode" : "encode";
    updateButtons();
  }

  function updateButtons() {
    document.getElementById("enc-encode").className = "jt-btn" + (currentMode === "encode" ? " jt-btn-primary" : "");
    document.getElementById("enc-decode").className = "jt-btn" + (currentMode === "decode" ? " jt-btn-primary" : "");
  }

  function convert() {
    var raw = document.getElementById("enc-input").value;
    var output = document.getElementById("enc-output");
    if (!raw) { output.value = ""; setMsg("", false); return; }

    try {
      var result = currentMode === "encode" ? encodeURIComponent(raw) : decodeURIComponent(raw);
      output.value = result;
      var autoLabel = explicitMode ? "" : " [" + t("encoder.auto") + "]";
      setMsg("✓ " + (currentMode === "encode" ? t("encoder.encoded") : t("encoder.decoded")) + autoLabel, false);
    } catch (e) {
      output.value = "";
      setMsg("✗ " + e.message, true);
    }
  }

  function setMsg(text, isError) {
    var el = document.getElementById("enc-msg");
    el.textContent = text;
    el.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  function renderHistory() {
    var list = loadHistory();
    var el = document.getElementById("encoder-history");
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + '</span>';
    list.forEach(function (item) {
      html += '<button class="history-chip" title="' + escapeHtml(item) + '">' + escapeHtml(item.substring(0, 60)) + '</button>';
    });
    el.innerHTML = html;
    el.querySelectorAll(".history-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.getElementById("enc-input").value = this.getAttribute("title");
        convert();
      });
    });
  }

  function escapeHtml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  return { init: init };
})();
