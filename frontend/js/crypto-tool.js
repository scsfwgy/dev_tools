// Crypto Tool — symmetric (AES) + asymmetric (RSA) via Web Crypto API, zero deps.
var CryptoTool = (function () {
  var tab = "symmetric";
  var rsaKeyPair = null;

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function init(parent) {
    parent.innerHTML =
      '<div class="b64-tool">' +
      '  <div class="b64-tabs">' +
      '    <button id="crypto-tab-sym" class="b64-tab active">' + t("crypto.symmetric") + '</button>' +
      '    <button id="crypto-tab-asym" class="b64-tab">' + t("crypto.asymmetric") + '</button>' +
      '  </div>' +
      // ── symmetric pane ──
      '  <div id="crypto-pane-sym" class="b64-pane">' +
      '    <div class="crypto-config">' +
      '      <select id="crypto-sym-algo" class="settings-select" style="width:auto">' +
      '        <option value="AES-GCM">AES-GCM</option>' +
      '        <option value="AES-CBC">AES-CBC</option>' +
      '      </select>' +
      '      <select id="crypto-sym-len" class="settings-select" style="width:auto">' +
      '        <option value="256">256 bit</option>' +
      '        <option value="128">128 bit</option>' +
      '        <option value="192">192 bit</option>' +
      '      </select>' +
      '      <select id="crypto-sym-keymode" class="settings-select" style="width:auto">' +
      '        <option value="password">' + t("crypto.keyPassword") + '</option>' +
      '        <option value="hex">' + t("crypto.keyHex") + '</option>' +
      '      </select>' +
      '    </div>' +
      '    <div class="crypto-config">' +
      '      <div id="crypto-sym-pwd-row">' +
      '        <label class="crypto-inline"><span data-i18n="crypto.password">' + t("crypto.password") + '</span>' +
      '          <input id="crypto-sym-pwd" class="crypto-input" type="text" placeholder="' + t("crypto.passwordPlaceholder") + '">' +
      '        </label>' +
      '      </div>' +
      '      <div id="crypto-sym-hex-row" style="display:none">' +
      '        <label class="crypto-inline"><span data-i18n="crypto.keyHex">' + t("crypto.keyHex") + '</span>' +
      '          <input id="crypto-sym-keyhex" class="crypto-input" type="text" placeholder="' + t("crypto.keyHexPlaceholder") + '" style="width:300px">' +
      '        </label>' +
      '      </div>' +
      '      <label class="crypto-inline"><span>IV</span>' +
      '        <input id="crypto-sym-iv" class="crypto-input" type="text" style="width:180px" placeholder="Base64 IV">' +
      '        <button id="crypto-sym-iv-gen" class="jt-btn" style="font-size:0.78rem">' + t("crypto.newIv") + '</button>' +
      '      </label>' +
      '    </div>' +
      '    <div class="b64-toolbar" style="margin-bottom:12px">' +
      '      <button id="crypto-sym-enc" class="jt-btn jt-btn-primary">' + t("crypto.encrypt") + '</button>' +
      '      <button id="crypto-sym-dec" class="jt-btn">' + t("crypto.decrypt") + '</button>' +
      '      <button id="crypto-sym-swap" class="jt-btn">' + t("crypto.swap") + '</button>' +
      '      <button id="crypto-sym-copy" class="jt-btn">' + t("crypto.copy") + '</button>' +
      '      <span id="crypto-sym-msg" class="jt-msg"></span>' +
      '    </div>' +
      '    <div class="b64-panes">' +
      '      <textarea id="crypto-sym-input" class="b64-textarea" placeholder="' + t("crypto.inputPlaceholder") + '"></textarea>' +
      '      <textarea id="crypto-sym-output" class="b64-textarea" readonly placeholder="' + t("crypto.outputPlaceholder") + '"></textarea>' +
      '    </div>' +
      '    <div id="crypto-sym-history" class="history-bar"></div>' +
      '  </div>' +
      // ── asymmetric pane ──
      '  <div id="crypto-pane-asym" class="b64-pane hidden">' +
      '    <div class="crypto-config">' +
      '      <select id="crypto-asym-len" class="settings-select" style="width:auto">' +
      '        <option value="2048">RSA 2048</option>' +
      '        <option value="4096">RSA 4096</option>' +
      '      </select>' +
      '      <button id="crypto-asym-gen" class="jt-btn jt-btn-primary">' + t("crypto.generateKey") + '</button>' +
      '      <span id="crypto-asym-msg" class="jt-msg" style="margin-left:0"></span>' +
      '    </div>' +
      '    <div class="crypto-key-row">' +
      '      <label class="crypto-key-label">' + t("crypto.publicKey") + '</label>' +
      '      <textarea id="crypto-asym-pub" class="b64-textarea" style="height:80px;min-height:80px" placeholder="' + t("crypto.pubPlaceholder") + '"></textarea>' +
      '      <button id="crypto-asym-copy-pub" class="jt-btn" style="margin-top:4px">' + t("crypto.copy") + '</button>' +
      '    </div>' +
      '    <div class="crypto-key-row">' +
      '      <label class="crypto-key-label">' + t("crypto.privateKey") + '</label>' +
      '      <textarea id="crypto-asym-prv" class="b64-textarea" style="height:80px;min-height:80px" placeholder="' + t("crypto.prvPlaceholder") + '"></textarea>' +
      '      <button id="crypto-asym-copy-prv" class="jt-btn" style="margin-top:4px">' + t("crypto.copy") + '</button>' +
      '    </div>' +
      '    <div class="crypto-config">' +
      '      <button id="crypto-asym-import" class="jt-btn">' + t("crypto.importKeys") + '</button>' +
      '    </div>' +
      '    <div class="b64-toolbar" style="margin-bottom:12px">' +
      '      <button id="crypto-asym-enc" class="jt-btn jt-btn-primary">' + t("crypto.encryptPub") + '</button>' +
      '      <button id="crypto-asym-dec" class="jt-btn">' + t("crypto.decryptPrv") + '</button>' +
      '      <button id="crypto-asym-swap" class="jt-btn">' + t("crypto.swap") + '</button>' +
      '      <button id="crypto-asym-copy" class="jt-btn">' + t("crypto.copy") + '</button>' +
      '      <span id="crypto-asym-op-msg" class="jt-msg"></span>' +
      '    </div>' +
      '    <div class="b64-panes">' +
      '      <textarea id="crypto-asym-input" class="b64-textarea" placeholder="' + t("crypto.inputPlaceholder") + '"></textarea>' +
      '      <textarea id="crypto-asym-output" class="b64-textarea" readonly placeholder="' + t("crypto.outputPlaceholder") + '"></textarea>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    bindSymEvents();
    bindAsymEvents();
    genIv();
    symHistoryRender();
  }

  // ── tab switching ──

  function switchTab(mode) {
    tab = mode;
    document.getElementById("crypto-tab-sym").className = "b64-tab" + (mode === "symmetric" ? " active" : "");
    document.getElementById("crypto-tab-asym").className = "b64-tab" + (mode === "asymmetric" ? " active" : "");
    document.getElementById("crypto-pane-sym").classList.toggle("hidden", mode !== "symmetric");
    document.getElementById("crypto-pane-asym").classList.toggle("hidden", mode !== "asymmetric");
  }

  // ═══════════════════════ symmetric ═══════════════════════

  function symMsg(text, err) {
    var el = document.getElementById("crypto-sym-msg");
    el.textContent = text;
    el.className = "jt-msg" + (err ? " jt-msg-error" : " jt-msg-ok");
  }

  function genIv() {
    var iv = crypto.getRandomValues(new Uint8Array(16));
    document.getElementById("crypto-sym-iv").value = btoa(String.fromCharCode.apply(null, iv));
  }

  function symKeyMode() {
    return document.getElementById("crypto-sym-keymode").value;
  }

  function toggleKeyMode() {
    var mode = symKeyMode();
    document.getElementById("crypto-sym-pwd-row").style.display = mode === "password" ? "" : "none";
    document.getElementById("crypto-sym-hex-row").style.display = mode === "hex" ? "" : "none";
  }

  function bindSymEvents() {
    document.getElementById("crypto-tab-sym").addEventListener("click", function () { switchTab("symmetric"); });
    document.getElementById("crypto-tab-asym").addEventListener("click", function () { switchTab("asymmetric"); });
    document.getElementById("crypto-sym-keymode").addEventListener("change", toggleKeyMode);
    document.getElementById("crypto-sym-iv-gen").addEventListener("click", genIv);
    document.getElementById("crypto-sym-enc").addEventListener("click", function () { symConvert("encrypt"); });
    document.getElementById("crypto-sym-dec").addEventListener("click", function () { symConvert("decrypt"); });
    document.getElementById("crypto-sym-swap").addEventListener("click", function () {
      document.getElementById("crypto-sym-input").value = document.getElementById("crypto-sym-output").value;
      symConvert("decrypt");
    });
    document.getElementById("crypto-sym-copy").addEventListener("click", function () {
      var v = document.getElementById("crypto-sym-output").value;
      if (v) { navigator.clipboard.writeText(v); symMsg("✓ " + t("crypto.copied"), false); }
    });
    document.getElementById("crypto-sym-input").addEventListener("blur", function () {
      var raw = this.value.trim();
      if (raw) { symHistorySave(raw); symHistoryRender(); }
    });
  }

  async function symGetKey() {
    var algo = document.getElementById("crypto-sym-algo").value;
    var len = parseInt(document.getElementById("crypto-sym-len").value);

    if (symKeyMode() === "hex") {
      // raw hex key input — developer-supplied key
      var hex = document.getElementById("crypto-sym-keyhex").value.trim();
      if (!hex) throw new Error(t("crypto.emptyKey"));
      var raw = hexToBytes(hex);
      if (raw.length !== len / 8) throw new Error(t("crypto.keyLengthError") + " (" + len / 8 + " bytes)");
      return crypto.subtle.importKey("raw", raw, { name: algo, length: len }, false, ["encrypt", "decrypt"]);
    }

    // password → PBKDF2 derive
    var pwd = document.getElementById("crypto-sym-pwd").value;
    if (!pwd) throw new Error(t("crypto.emptyPassword"));
    var enc = new TextEncoder();
    var keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pwd), "PBKDF2", false, ["deriveKey"]);
    var salt = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("devtools-salt-" + pwd))).slice(0, 16);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: algo, length: len },
      false,
      ["encrypt", "decrypt"]
    );
  }

  function symGetIv() {
    var ivB64 = document.getElementById("crypto-sym-iv").value.trim();
    if (!ivB64) throw new Error(t("crypto.emptyIv"));
    var raw = Uint8Array.from(atob(ivB64), function (c) { return c.charCodeAt(0); });
    var algo = document.getElementById("crypto-sym-algo").value;
    var len = algo === "AES-GCM" ? 12 : 16;
    return raw.slice(0, len);
  }

  async function symConvert(mode) {
    var inputEl = document.getElementById("crypto-sym-input");
    var outputEl = document.getElementById("crypto-sym-output");
    var raw = inputEl.value;
    if (!raw) { outputEl.value = ""; symMsg("", false); return; }

    try {
      var key = await symGetKey();
      var iv = symGetIv();
      var algo = document.getElementById("crypto-sym-algo").value;
      var enc = new TextEncoder();
      var result;

      if (mode === "encrypt") {
        var data = enc.encode(raw);
        var cipher = await crypto.subtle.encrypt({ name: algo, iv: iv }, key, data);
        var ivB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(iv)));
        var ctB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(cipher)));
        result = ivB64 + ":" + ctB64;
      } else {
        var parts = raw.split(":");
        var ctRaw, ivRaw;
        if (parts.length === 2) {
          ivRaw = Uint8Array.from(atob(parts[0]), function (c) { return c.charCodeAt(0); });
          ctRaw = Uint8Array.from(atob(parts[1]), function (c) { return c.charCodeAt(0); });
        } else {
          ivRaw = iv;
          ctRaw = Uint8Array.from(atob(raw), function (c) { return c.charCodeAt(0); });
        }
        var dec = await crypto.subtle.decrypt({ name: algo, iv: ivRaw }, key, ctRaw);
        result = new TextDecoder().decode(dec);
      }
      outputEl.value = result;
      symMsg("✓ " + t("crypto." + (mode === "encrypt" ? "encrypted" : "decrypted")), false);
    } catch (e) {
      outputEl.value = "";
      symMsg("✗ " + (e.message || e), true);
    }
  }

  // ── symmetric history ──

  var SYM_HISTORY_KEY = "crypto_sym_history";
  var MAX_HISTORY = 20;

  function symHistoryLoad() {
    try { return JSON.parse(localStorage.getItem(SYM_HISTORY_KEY)) || []; } catch (e) { return []; }
  }
  function symHistorySave(input) {
    var list = symHistoryLoad();
    var idx = list.indexOf(input);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(input);
    if (list.length > MAX_HISTORY) list.pop();
    localStorage.setItem(SYM_HISTORY_KEY, JSON.stringify(list));
  }
  function symHistoryRender() {
    var list = symHistoryLoad();
    var el = document.getElementById("crypto-sym-history");
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + '</span>';
    list.forEach(function (item) {
      html += '<button class="history-chip" title="' + escapeH(item) + '">' + escapeH(item.substring(0, 60)) + '</button>';
    });
    el.innerHTML = html;
    el.querySelectorAll(".history-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.getElementById("crypto-sym-input").value = this.getAttribute("title");
      });
    });
  }

  // ═══════════════════════ asymmetric ═══════════════════════

  function asymMsg(text, err) {
    var el = document.getElementById("crypto-asym-msg");
    if (el) { el.textContent = text; el.className = "jt-msg" + (err ? " jt-msg-error" : " jt-msg-ok"); }
  }
  function asymOpMsg(text, err) {
    var el = document.getElementById("crypto-asym-op-msg");
    if (el) { el.textContent = text; el.className = "jt-msg" + (err ? " jt-msg-error" : " jt-msg-ok"); }
  }

  function bindAsymEvents() {
    document.getElementById("crypto-asym-gen").addEventListener("click", asymGen);
    document.getElementById("crypto-asym-import").addEventListener("click", asymImport);
    document.getElementById("crypto-asym-copy-pub").addEventListener("click", function () {
      var v = document.getElementById("crypto-asym-pub").value;
      if (v) { navigator.clipboard.writeText(v); asymMsg("✓ " + t("crypto.copied"), false); }
    });
    document.getElementById("crypto-asym-copy-prv").addEventListener("click", function () {
      var v = document.getElementById("crypto-asym-prv").value;
      if (v) { navigator.clipboard.writeText(v); asymMsg("✓ " + t("crypto.copied"), false); }
    });
    document.getElementById("crypto-asym-enc").addEventListener("click", function () { asymConvert("encrypt"); });
    document.getElementById("crypto-asym-dec").addEventListener("click", function () { asymConvert("decrypt"); });
    document.getElementById("crypto-asym-swap").addEventListener("click", function () {
      document.getElementById("crypto-asym-input").value = document.getElementById("crypto-asym-output").value;
      asymConvert("decrypt");
    });
    document.getElementById("crypto-asym-copy").addEventListener("click", function () {
      var v = document.getElementById("crypto-asym-output").value;
      if (v) { navigator.clipboard.writeText(v); asymOpMsg("✓ " + t("crypto.copied"), false); }
    });
  }

  async function asymGen() {
    try {
      var len = parseInt(document.getElementById("crypto-asym-len").value);
      asymMsg("⏳ " + t("crypto.generating"), false);
      rsaKeyPair = await crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: len, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true,
        ["encrypt", "decrypt"]
      );
      var pubDer = await crypto.subtle.exportKey("spki", rsaKeyPair.publicKey);
      var prvDer = await crypto.subtle.exportKey("pkcs8", rsaKeyPair.privateKey);
      document.getElementById("crypto-asym-pub").value = derToPem(pubDer, "PUBLIC KEY");
      document.getElementById("crypto-asym-prv").value = derToPem(prvDer, "PRIVATE KEY");
      asymMsg("✓ " + t("crypto.keyGenerated"), false);
    } catch (e) {
      asymMsg("✗ " + (e.message || e), true);
    }
  }

  async function asymImport() {
    try {
      var pubPem = document.getElementById("crypto-asym-pub").value.trim();
      var prvPem = document.getElementById("crypto-asym-prv").value.trim();
      if (!pubPem && !prvPem) { asymMsg(t("crypto.emptyKeys"), true); return; }

      asymMsg("⏳ " + t("crypto.importing"), false);
      var pubKey = null, prvKey = null;

      if (pubPem) {
        var pubDer = pemToDer(pubPem);
        pubKey = await crypto.subtle.importKey("spki", pubDer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
      }
      if (prvPem) {
        var prvDer = pemToDer(prvPem);
        prvKey = await crypto.subtle.importKey("pkcs8", prvDer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
      }

      rsaKeyPair = { publicKey: pubKey, privateKey: prvKey };
      asymMsg("✓ " + t("crypto.keysImported"), false);
    } catch (e) {
      asymMsg("✗ " + (e.message || e), true);
    }
  }

  async function asymConvert(mode) {
    var inputEl = document.getElementById("crypto-asym-input");
    var outputEl = document.getElementById("crypto-asym-output");
    var raw = inputEl.value;
    if (!raw) { outputEl.value = ""; asymOpMsg("", false); return; }

    try {
      if (!rsaKeyPair) { throw new Error(t("crypto.noKey")); }
      var enc = new TextEncoder();
      var result;
      if (mode === "encrypt") {
        if (!rsaKeyPair.publicKey) throw new Error(t("crypto.noPubKey"));
        var data = enc.encode(raw);
        var cipher = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsaKeyPair.publicKey, data);
        result = btoa(String.fromCharCode.apply(null, new Uint8Array(cipher)));
      } else {
        if (!rsaKeyPair.privateKey) throw new Error(t("crypto.noPrvKey"));
        var ct = Uint8Array.from(atob(raw), function (c) { return c.charCodeAt(0); });
        var dec = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, rsaKeyPair.privateKey, ct);
        result = new TextDecoder().decode(dec);
      }
      outputEl.value = result;
      asymOpMsg("✓ " + t("crypto." + (mode === "encrypt" ? "encrypted" : "decrypted")), false);
    } catch (e) {
      outputEl.value = "";
      asymOpMsg("✗ " + (e.message || e), true);
    }
  }

  // ── helpers ──

  function derToPem(der, label) {
    var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(der)));
    var lines = b64.match(/.{1,64}/g).join("\n");
    return "-----BEGIN " + label + "-----\n" + lines + "\n-----END " + label + "-----";
  }

  function pemToDer(pem) {
    var b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
    var raw = atob(b64);
    return new Uint8Array(raw.split("").map(function (c) { return c.charCodeAt(0); })).buffer;
  }

  function hexToBytes(hex) {
    var cleaned = hex.replace(/\s+/g, "");
    if (cleaned.length % 2 !== 0) throw new Error("Hex length must be even");
    var bytes = new Uint8Array(cleaned.length / 2);
    for (var i = 0; i < cleaned.length; i += 2) bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
    return bytes;
  }

  function escapeH(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  return { init: init };
})();
