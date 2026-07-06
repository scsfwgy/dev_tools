// Encoder Tool — multi-type codec: URL, UTF-8 hex, Unicode escapes, ASCII/Native.
var EncoderTool = (function () {
  var HISTORY_KEY = "encoder_history";
  var MAX_HISTORY = 20;
  var currentTab = "url";
  var currentMode = "encode";
  var explicitMode = false;

  var TABS = ["url", "utf8", "unicode", "native", "base64", "base32", "base16"];

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
      '  <div class="b64-tabs" id="enc-tabs">' +
      '    <button class="b64-tab active" data-tab="url">' + t("encoder.tabUrl") + '</button>' +
      '    <button class="b64-tab" data-tab="utf8">' + t("encoder.tabUtf8") + '</button>' +
      '    <button class="b64-tab" data-tab="unicode">' + t("encoder.tabUnicode") + '</button>' +
      '    <button class="b64-tab" data-tab="native">' + t("encoder.tabNative") + '</button>' +
      '    <button class="b64-tab" data-tab="base64">' + t("encoder.tabBase64") + '</button>' +
      '    <button class="b64-tab" data-tab="base32">' + t("encoder.tabBase32") + '</button>' +
      '    <button class="b64-tab" data-tab="base16">' + t("encoder.tabBase16") + '</button>' +
      '  </div>' +
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

    bindEvents();
    renderHistory();
  }

  function bindEvents() {
    // tab clicks
    document.querySelectorAll("#enc-tabs .b64-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTab(this.dataset.tab);
      });
    });

    document.getElementById("enc-encode").addEventListener("click", function () {
      currentMode = "encode";
      explicitMode = true;
      updateUI();
      convert();
    });
    document.getElementById("enc-decode").addEventListener("click", function () {
      currentMode = "decode";
      explicitMode = true;
      updateUI();
      convert();
    });
    document.getElementById("enc-swap").addEventListener("click", function () {
      var input = document.getElementById("enc-input");
      var output = document.getElementById("enc-output");
      input.value = output.value;
      // swap mode so the pasted result can be decoded back
      currentMode = currentMode === "encode" ? "decode" : "encode";
      explicitMode = true;
      updateUI();
      convert();
    });
    document.getElementById("enc-copy").addEventListener("click", function () {
      var val = document.getElementById("enc-output").value;
      if (!val) return;
      navigator.clipboard.writeText(val);
      setMsg("✓ " + t("encoder.copied"), false);
    });

    var input = document.getElementById("enc-input");
    input.addEventListener("input", function () {
      if (!this.value.trim()) { explicitMode = false; }
      if (!explicitMode) autoDetect();
      convert();
    });
    input.addEventListener("blur", function () {
      var raw = input.value.trim();
      if (raw) { saveHistory(raw); renderHistory(); }
    });
  }

  function switchTab(tab) {
    if (!TABS.includes(tab)) return;
    currentTab = tab;
    document.querySelectorAll("#enc-tabs .b64-tab").forEach(function (btn) {
      btn.className = "b64-tab" + (btn.dataset.tab === tab ? " active" : "");
    });
    // auto-switch to sensible encode/decode mode when tab changes manually
    currentMode = "encode";
    updateUI();
    convert();
  }

  function autoDetect() {
    var raw = document.getElementById("enc-input").value;
    if (!raw) return;

    // detect \uXXXX pattern → Unicode tab, decode
    if (/\\u[0-9A-Fa-f]{4}/.test(raw)) {
      currentTab = "unicode";
      currentMode = "decode";
    }
    // detect \xHH pattern → UTF-8 tab, decode
    else if (/\\x[0-9A-Fa-f]{2}/.test(raw)) {
      currentTab = "utf8";
      currentMode = "decode";
    }
    // detect %XX pattern → URL tab, decode
    else if (/%[0-9A-Fa-f]{2}/.test(raw)) {
      currentTab = "url";
      currentMode = "decode";
    }
    // detect Base64-like → Base64 tab, decode
    else if (/^[A-Za-z0-9+/]+=*$/.test(raw.trim()) && raw.trim().length >= 4 && raw.trim().length % 4 === 0) {
      currentTab = "base64";
      currentMode = "decode";
    }
    // detect Base32-like → Base32 tab, decode
    else if (/^[A-Z2-7]+=*$/i.test(raw.trim()) && raw.trim().length >= 8) {
      currentTab = "base32";
      currentMode = "decode";
    }
    // detect hex-only string → Base16 tab, decode
    else if (/^[\s0-9A-Fa-f]+$/.test(raw.trim()) && raw.replace(/\s/g, "").length >= 4) {
      currentTab = "base16";
      currentMode = "decode";
    }
    // default: keep current tab, encode
    else {
      currentMode = "encode";
    }

    document.querySelectorAll("#enc-tabs .b64-tab").forEach(function (btn) {
      btn.className = "b64-tab" + (btn.dataset.tab === currentTab ? " active" : "");
    });
    updateUI();
  }

  function updateUI() {
    document.getElementById("enc-encode").className = "jt-btn" + (currentMode === "encode" ? " jt-btn-primary" : "");
    document.getElementById("enc-decode").className = "jt-btn" + (currentMode === "decode" ? " jt-btn-primary" : "");
  }

  // ── Conversion dispatch ──

  function convert() {
    var raw = document.getElementById("enc-input").value;
    var output = document.getElementById("enc-output");
    if (!raw) { output.value = ""; setMsg("", false); return; }

    try {
      var result;
      if (currentTab === "url") {
        result = currentMode === "encode" ? urlEncode(raw) : urlDecode(raw);
      } else if (currentTab === "utf8") {
        result = currentMode === "encode" ? utf8Encode(raw) : utf8Decode(raw);
      } else if (currentTab === "unicode") {
        result = currentMode === "encode" ? unicodeEncode(raw) : unicodeDecode(raw);
      } else if (currentTab === "base64") {
        result = currentMode === "encode" ? base64Encode(raw) : base64Decode(raw);
      } else if (currentTab === "base32") {
        result = currentMode === "encode" ? base32Encode(raw) : base32Decode(raw);
      } else if (currentTab === "base16") {
        result = currentMode === "encode" ? base16Encode(raw) : base16Decode(raw);
      } else {
        result = currentMode === "encode" ? nativeEncode(raw) : nativeDecode(raw);
      }
      output.value = result;
      var autoLabel = explicitMode ? "" : " [" + t("encoder.auto") + "]";
      setMsg("✓ " + t("encoder." + currentMode + "d") + autoLabel, false);
    } catch (e) {
      output.value = "";
      setMsg("✗ " + e.message, true);
    }
  }

  // ── URL codec ──

  function urlEncode(s) { return encodeURIComponent(s); }
  function urlDecode(s) { return decodeURIComponent(s); }

  // ── UTF-8 hex codec ──

  function utf8Encode(s) {
    // ponytail: TextEncoder for UTF-8 bytes, format as \xHH
    var bytes = new TextEncoder().encode(s);
    var parts = [];
    for (var i = 0; i < bytes.length; i++) {
      parts.push("\\x" + bytes[i].toString(16).toUpperCase().padStart(2, "0"));
    }
    return parts.join("");
  }

  function utf8Decode(s) {
    // Accept \xHH, 0xHH, or raw hex bytes (space-separated)
    var cleaned = s.replace(/\\x/gi, "").replace(/0x/gi, "").replace(/\s+/g, "");
    if (!/^[0-9A-Fa-f]*$/.test(cleaned) || cleaned.length % 2 !== 0) {
      throw new Error("Invalid hex input");
    }
    var bytes = new Uint8Array(cleaned.length / 2);
    for (var i = 0; i < cleaned.length; i += 2) {
      bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  }

  // ── Unicode escape codec ──

  function unicodeEncode(s) {
    var parts = [];
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i);
      if (cp > 0xFFFF) {
        // non-BMP: output as \u{XXXXXX}
        parts.push("\\u{" + cp.toString(16).toUpperCase() + "}");
        i++; // ponytail: skip surrogate pair
      } else {
        parts.push("\\u" + cp.toString(16).toUpperCase().padStart(4, "0"));
      }
    }
    return parts.join("");
  }

  function unicodeDecode(s) {
    // ponytail: JSON.parse handles all \u and \u{} escape forms natively
    return JSON.parse('"' + s + '"');
  }

  // ── ASCII / Native codec ──

  function nativeEncode(s) {
    var parts = [];
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i);
      if (cp > 127) {
        if (cp > 0xFFFF) {
          parts.push("\\u{" + cp.toString(16).toUpperCase() + "}");
          i++;
        } else {
          parts.push("\\u" + cp.toString(16).toUpperCase().padStart(4, "0"));
        }
      } else {
        parts.push(s.charAt(i));
      }
    }
    return parts.join("");
  }

  function nativeDecode(s) { return unicodeDecode(s); }

  // ── Base64 codec ──

  function base64Encode(s) {
    return btoa(unescape(encodeURIComponent(s)));
  }

  function base64Decode(s) {
    return decodeURIComponent(escape(atob(s.trim())));
  }

  // ── Base32 codec (RFC 4648) ──

  var B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  function base32Encode(s) {
    var bytes = new TextEncoder().encode(s);
    var bits = "", result = "";
    for (var i = 0; i < bytes.length; i++) {
      bits += bytes[i].toString(2).padStart(8, "0");
    }
    for (var j = 0; j < bits.length; j += 5) {
      var chunk = bits.substring(j, j + 5).padEnd(5, "0");
      result += B32[parseInt(chunk, 2)];
    }
    // RFC 4648 padding
    var pad = (8 - (result.length % 8)) % 8;
    return result + "=".repeat(pad);
  }

  function base32Decode(s) {
    var cleaned = s.trim().toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
    var bits = "";
    for (var i = 0; i < cleaned.length; i++) {
      var val = B32.indexOf(cleaned[i]);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, "0");
    }
    var bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (var j = 0; j < bytes.length; j++) {
      bytes[j] = parseInt(bits.substring(j * 8, j * 8 + 8), 2);
    }
    return new TextDecoder().decode(bytes);
  }

  // ── Base16 (hex) codec ──

  function base16Encode(s) {
    var bytes = new TextEncoder().encode(s);
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).toUpperCase().padStart(2, "0");
    }
    return hex;
  }

  function base16Decode(s) {
    var cleaned = s.trim().replace(/\s+/g, "");
    if (!/^[0-9A-Fa-f]*$/.test(cleaned) || cleaned.length % 2 !== 0) {
      throw new Error("Invalid hex input");
    }
    var bytes = new Uint8Array(cleaned.length / 2);
    for (var i = 0; i < cleaned.length; i += 2) {
      bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  }

  // ── helpers ──

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
        explicitMode = false;
        autoDetect();
        convert();
      });
    });
  }

  function escapeHtml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  return { init: init };
})();
