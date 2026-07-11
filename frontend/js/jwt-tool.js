// JWT Tool — decode, verify and encode JSON Web Tokens locally with Web Crypto API.
var JwtTool = (function () {
  var HISTORY_KEY = "jwt_tool_history";
  var MAX_HISTORY = 8;

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }
  function saveHistory(item) {
    var h = loadHistory().filter(function (x) { return x.jwt !== item.jwt; });
    h.unshift(item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
  }

  // base64url decode
  function base64UrlDecode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    try {
      var decoded = atob(str);
      return decodeURIComponent(Array.prototype.map.call(decoded, function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(""));
    } catch (e) {
      try { return atob(str); } catch (e2) { return "[decode error]"; }
    }
  }

  // base64url encode
  function base64UrlEncode(str) {
    return btoa(String.fromCharCode.apply(null, new TextEncoder().encode(str)))
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  function formatTimestamp(ts) {
    var d = new Date(ts * 1000);
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }

  function formatDuration(ts) {
    var now = Math.floor(Date.now() / 1000);
    var diff = ts - now;
    var abs = Math.abs(diff);
    var sign = diff >= 0 ? "" : "-";
    if (abs < 60) return sign + abs + "s";
    if (abs < 3600) return sign + Math.floor(abs / 60) + "m";
    if (abs < 86400) return sign + Math.floor(abs / 3600) + "h";
    return sign + Math.floor(abs / 86400) + "d";
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function syntaxHighlight(json) {
    return json.replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="jt-key">$1</span>:')
      .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="jt-string">$1</span>')
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="jt-number">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="jt-bool">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="jt-null">$1</span>');
  }

  function renderHistory(container) {
    var history = loadHistory();
    if (!history.length) { container.innerHTML = ""; return; }
    container.innerHTML =
      '<span class="history-label">' + t("jwt.history") + '</span>' +
      history.map(function (item, i) {
        var label = item.issuer || item.subject || item.jwt.slice(0, 30);
        return '<button class="history-chip" data-idx="' + i + '" title="' + escapeHtml(item.jwt) + '">' +
          escapeHtml(label) + '</button>';
      }).join("");
    container.querySelectorAll(".history-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var h = history[Number(this.dataset.idx)];
        document.getElementById("jwt-input").value = h.jwt;
        doDecode();
      });
    });
  }

  function init(parent) {
    parent.innerHTML =
      '<div class="b64-tool">' +
      '  <div class="b64-tabs">' +
      '    <button class="b64-tab active" data-tab="decode">' + t("jwt.decode") + '</button>' +
      '    <button class="b64-tab" data-tab="encode">' + t("jwt.encode") + '</button>' +
      '    <button class="b64-tab" data-tab="ref">' + t("jwt.reference") + '</button>' +
      '  </div>' +
      // Decode tab
      '  <section id="jwt-tab-decode">' +
      '    <textarea id="jwt-input" class="b64-textarea" placeholder="' + t("jwt.decodePlaceholder") + '" rows="4" style="min-height:80px;font-family:monospace;font-size:0.85rem;resize:vertical;"></textarea>' +
      '    <div class="jwt-decode-bar"><button id="jwt-decode-btn" class="jt-btn jt-btn-primary">' + t("jwt.decodeBtn") + '</button></div>' +
      '    <div id="jwt-error" class="jwt-error hidden"></div>' +
      '    <div id="jwt-output" class="jwt-output hidden">' +
      '      <div class="jwt-section jwt-section-header"><div class="jwt-section-label"><span class="jwt-dot jwt-dot-red"></span> ' + t("jwt.header") + ' <span class="jwt-algo" id="jwt-header-algo"></span></div><pre id="jwt-header-json" class="jwt-json"></pre></div>' +
      '      <div class="jwt-section jwt-section-payload"><div class="jwt-section-label"><span class="jwt-dot jwt-dot-purple"></span> ' + t("jwt.payload") + '</div><pre id="jwt-payload-json" class="jwt-json"></pre><div id="jwt-claims" class="jwt-claims"></div></div>' +
      '      <div class="jwt-section jwt-section-sig"><div class="jwt-section-label"><span class="jwt-dot jwt-dot-blue"></span> ' + t("jwt.signature") + '</div><pre id="jwt-signature-info" class="jwt-sig-info"></pre></div>' +
      '      <div class="jwt-section jwt-section-verify"><div class="jwt-section-label">🔐 ' + t("jwt.verify") + '</div><div id="jwt-verify-content"></div></div>' +
      '    </div>' +
      '  </section>' +
      // Encode tab
      '  <section id="jwt-tab-encode" style="display:none">' +
      '    <div class="jwt-encode-grid">' +
      '      <div><label class="jwt-encode-label">' + t("jwt.header") + ' (JSON)</label><textarea id="jwt-enc-header" class="b64-textarea" rows="6" style="min-height:90px;font-family:monospace;font-size:0.82rem;">{\n  "alg": "HS256",\n  "typ": "JWT"\n}</textarea></div>' +
      '      <div><label class="jwt-encode-label">' + t("jwt.payload") + ' (JSON)</label><textarea id="jwt-enc-payload" class="b64-textarea" rows="6" style="min-height:90px;font-family:monospace;font-size:0.82rem;">{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": ' + Math.floor(Date.now() / 1000) + '\n}</textarea></div>' +
      '    </div>' +
      '    <div class="jwt-encode-secret"><label class="jwt-encode-label">' + t("jwt.secret") + ' <span class="jwt-algo-hint" id="jwt-enc-algo-hint">(HS256)</span></label><input id="jwt-enc-secret" class="crypto-input" type="text" placeholder="' + t("jwt.secretPlaceholder") + '" style="max-width:480px"></div>' +
      '    <div class="jwt-encode-bar"><span id="jwt-enc-error" class="jwt-error"></span><button id="jwt-encode-btn" class="jt-btn jt-btn-primary">' + t("jwt.encodeBtn") + '</button></div>' +
      '    <div id="jwt-enc-result" class="content-result hidden"><label class="jwt-encode-label">' + t("jwt.yourToken") + '</label><div class="jwt-result-row"><input id="jwt-enc-output" class="crypto-input" type="text" readonly style="flex:1;font-family:monospace;font-size:0.78rem"><button id="jwt-enc-copy" class="jt-btn">' + t("jwt.copy") + '</button></div></div>' +
      '  </section>' +
      // Reference tab
      '  <section id="jwt-tab-ref" style="display:none">' +
      '    <div class="at-search-wrap"><input id="jwt-ref-search" class="search-input" type="text" placeholder="' + t("jwt.searchRef") + '" style="max-width:360px"></div>' +
      '    <div class="at-table-wrap"><table class="at-table">' +
      '      <thead><tr><th>' + t("jwt.claim") + '</th><th>' + t("jwt.description") + '</th><th>' + t("jwt.example") + '</th></tr></thead><tbody id="jwt-ref-body">' +
      buildRefTable() +
      '      </tbody></table></div>' +
      '  </section>' +
      '  <div id="jwt-history" class="history-bar"></div>' +
      '</div>';

    // events
    document.getElementById("jwt-decode-btn").addEventListener("click", doDecode);
    document.getElementById("jwt-input").addEventListener("input", function () { tryAutoDecode(); });
    document.getElementById("jwt-encode-btn").addEventListener("click", doEncode);
    document.getElementById("jwt-enc-copy").addEventListener("click", function () {
      var inp = document.getElementById("jwt-enc-output");
      inp.select();
      navigator.clipboard.writeText(inp.value).then(function () {
        window.showCopyToast && window.showCopyToast("✓ " + t("jwt.copied"));
      });
    });

    // tab switching
    parent.querySelectorAll(".b64-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        parent.querySelectorAll(".b64-tab").forEach(function (b) { b.classList.toggle("active", b === btn); });
        var tab = btn.dataset.tab;
        document.getElementById("jwt-tab-decode").style.display = tab === "decode" ? "" : "none";
        document.getElementById("jwt-tab-encode").style.display = tab === "encode" ? "" : "none";
        document.getElementById("jwt-tab-ref").style.display = tab === "ref" ? "" : "none";
      });
    });

    // ref search
    document.getElementById("jwt-ref-search").addEventListener("input", function () {
      var q = this.value.toLowerCase();
      document.querySelectorAll("#jwt-ref-body tr").forEach(function (tr) {
        tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
      });
    });

    // click signature to copy
    parent.addEventListener("click", function (e) {
      var el = e.target.closest("[data-copy]");
      if (!el) return;
      navigator.clipboard.writeText(el.dataset.copy).then(function () {
        window.showCopyToast && window.showCopyToast("✓ " + t("jwt.copied"));
      });
    });

    renderHistory(document.getElementById("jwt-history"));
  }

  function tryAutoDecode() {
    var input = document.getElementById("jwt-input").value.trim();
    if (input.split(".").length === 3) doDecode();
    else {
      document.getElementById("jwt-output").classList.add("hidden");
      document.getElementById("jwt-error").classList.add("hidden");
    }
  }

  function doDecode() {
    var jwt = document.getElementById("jwt-input").value.trim();
    var errorEl = document.getElementById("jwt-error");
    var outputEl = document.getElementById("jwt-output");
    errorEl.classList.add("hidden");
    outputEl.classList.add("hidden");
    if (!jwt) return;

    var parts = jwt.split(".");
    if (parts.length !== 3) { showError(t("jwt.invalidFormat")); return; }

    var headerJson, payloadJson;
    try { headerJson = base64UrlDecode(parts[0]); JSON.parse(headerJson); } catch (e) { showError(t("jwt.invalidHeader")); return; }
    try { payloadJson = base64UrlDecode(parts[1]); JSON.parse(payloadJson); } catch (e) { showError(t("jwt.invalidPayload")); return; }

    var header = JSON.parse(headerJson);
    var payload = JSON.parse(payloadJson);

    // render header
    document.getElementById("jwt-header-json").innerHTML = syntaxHighlight(JSON.stringify(header, null, 2));
    document.getElementById("jwt-header-algo").textContent = header.alg ? "· " + header.alg : "";

    // render payload
    document.getElementById("jwt-payload-json").innerHTML = syntaxHighlight(JSON.stringify(payload, null, 2));

    // render claims (timestamps)
    var claimsHtml = "";
    ["iat", "exp", "nbf"].forEach(function (key) {
      if (payload[key]) {
        var color = key === "exp" ? (payload[key] < Math.floor(Date.now() / 1000) ? "var(--accent-red, #f44336)" : "var(--green)") : "";
        claimsHtml += '<div class="jwt-claim-chip' + (key === "exp" ? (payload[key] < Math.floor(Date.now() / 1000) ? ' jwt-expired' : '') : '') + '"><code>' + key + '</code> ' + payload[key] + ' → ' + formatTimestamp(payload[key]) + ' <span style="color:' + (color || 'var(--text-muted)') + '">(' + formatDuration(payload[key]) + ')</span></div>';
      }
    });
    if (payload.iss) claimsHtml += '<div class="jwt-claim-chip"><code>iss</code> <span data-copy="' + escapeHtml(payload.iss) + '" style="cursor:pointer">' + escapeHtml(payload.iss) + '</span></div>';
    if (payload.sub) claimsHtml += '<div class="jwt-claim-chip"><code>sub</code> <span data-copy="' + escapeHtml(payload.sub) + '" style="cursor:pointer">' + escapeHtml(payload.sub) + '</span></div>';
    if (payload.aud) {
      var aud = Array.isArray(payload.aud) ? payload.aud.join(", ") : payload.aud;
      claimsHtml += '<div class="jwt-claim-chip"><code>aud</code> <span data-copy="' + escapeHtml(String(aud)) + '" style="cursor:pointer">' + escapeHtml(String(aud)) + '</span></div>';
    }
    document.getElementById("jwt-claims").innerHTML = claimsHtml;

    // render signature
    var sigHtml = '<span style="color:var(--text-muted)">' + escapeHtml(parts[2].slice(0, 32)) + '…</span>';
    sigHtml += '<div style="margin-top:4px"><code data-copy="' + escapeHtml(parts[2]) + '" style="cursor:pointer;font-size:0.7rem;word-break:break-all;color:var(--text-muted)">' + escapeHtml(parts[2]) + '</code></div>';
    document.getElementById("jwt-signature-info").innerHTML = sigHtml;

    // render verify section
    verifyAndRender(header, jwt, parts);

    outputEl.classList.remove("hidden");

    // save history
    saveHistory({ jwt: jwt, issuer: payload.iss, subject: payload.sub, time: Date.now() });
    renderHistory(document.getElementById("jwt-history"));
  }

  function verifyAndRender(header, jwt, parts) {
    var container = document.getElementById("jwt-verify-content");
    var secret = localStorage.getItem("jwt_verify_secret") || "";

    var html = '<div class="jwt-verify-row"><input id="jwt-verify-secret" class="crypto-input" type="text" placeholder="' + t("jwt.verifySecretPlaceholder") + '" value="' + escapeHtml(secret) + '" style="max-width:300px;font-family:monospace;font-size:0.8rem"><button id="jwt-verify-btn" class="jt-btn">' + t("jwt.verifyBtn") + '</button></div>';
    html += '<div id="jwt-verify-result" class="jwt-verify-result"></div>';
    container.innerHTML = html;

    document.getElementById("jwt-verify-secret").addEventListener("input", function () {
      localStorage.setItem("jwt_verify_secret", this.value);
    });
    document.getElementById("jwt-verify-btn").addEventListener("click", function () {
      doVerify(jwt, parts, header);
    });
  }

  async function doVerify(jwt, parts, header) {
    var secret = document.getElementById("jwt-verify-secret").value;
    var resultEl = document.getElementById("jwt-verify-result");
    if (!secret) { resultEl.innerHTML = '<span class="jwt-verify-fail">' + t("jwt.enterSecret") + '</span>'; return; }

    var alg = (header.alg || "HS256").toUpperCase();
    var hashMap = { "HS256": "SHA-256", "HS384": "SHA-384", "HS512": "SHA-512" };
    var hash = hashMap[alg];
    if (!hash) { resultEl.innerHTML = '<span class="jwt-verify-fail">' + t("jwt.unsupportedAlgo") + ' ' + escapeHtml(alg) + '</span>'; return; }

    try {
      var enc = new TextEncoder();
      var keyData = enc.encode(secret);
      var key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: hash }, false, ["sign", "verify"]);
      var data = enc.encode(parts[0] + "." + parts[1]);
      // base64url decode the signature
      var sigStr = parts[2].replace(/-/g, "+").replace(/_/g, "/");
      while (sigStr.length % 4) sigStr += "=";
      var sigBytes = Uint8Array.from(atob(sigStr), function (c) { return c.charCodeAt(0); });
      var valid = await crypto.subtle.verify("HMAC", key, sigBytes, data);
      resultEl.innerHTML = valid
        ? '<span class="jwt-verify-ok">✅ ' + t("jwt.signatureValid") + '</span>'
        : '<span class="jwt-verify-fail">❌ ' + t("jwt.signatureInvalid") + '</span>';
    } catch (e) {
      resultEl.innerHTML = '<span class="jwt-verify-fail">❌ ' + t("jwt.verifyError") + ': ' + escapeHtml(e.message) + '</span>';
    }
  }

  async function doEncode() {
    var headerText = document.getElementById("jwt-enc-header").value.trim();
    var payloadText = document.getElementById("jwt-enc-payload").value.trim();
    var secret = document.getElementById("jwt-enc-secret").value;
    var errorEl = document.getElementById("jwt-enc-error");
    var resultEl = document.getElementById("jwt-enc-result");
    errorEl.textContent = "";
    resultEl.classList.add("hidden");

    if (!secret) { errorEl.textContent = t("jwt.secretRequired"); return; }

    var header, payload;
    try { header = JSON.parse(headerText); } catch (e) { errorEl.textContent = t("jwt.invalidJson") + " (header)"; return; }
    try { payload = JSON.parse(payloadText); } catch (e) { errorEl.textContent = t("jwt.invalidJson") + " (payload)"; return; }

    var alg = (header.alg || "HS256").toUpperCase();
    var hashMap = { "HS256": "SHA-256", "HS384": "SHA-384", "HS512": "SHA-512" };
    var hash = hashMap[alg];
    if (!hash) { errorEl.textContent = t("jwt.unsupportedAlgo") + " " + alg; return; }

    try {
      var enc = new TextEncoder();
      var keyData = enc.encode(secret);
      var key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: hash }, false, ["sign"]);

      var headerB64 = base64UrlEncode(JSON.stringify(header));
      var payloadB64 = base64UrlEncode(JSON.stringify(payload));
      var data = enc.encode(headerB64 + "." + payloadB64);

      var sig = await crypto.subtle.sign("HMAC", key, data);
      var sigStr = btoa(String.fromCharCode.apply(null, new Uint8Array(sig)))
        .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

      var jwt = headerB64 + "." + payloadB64 + "." + sigStr;
      document.getElementById("jwt-enc-output").value = jwt;
      resultEl.classList.remove("hidden");
    } catch (e) {
      errorEl.textContent = t("jwt.encodeError") + ": " + e.message;
    }
  }

  function showError(msg) {
    var el = document.getElementById("jwt-error");
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function buildRefTable() {
    var claims = [
      ["iss", "Issuer", "签发者", "Issuer", '"https://auth.example.com"', "The entity that issued the JWT"],
      ["sub", "Subject", "主题", "Subject", '"user@example.com"', "The subject/principal of the JWT"],
      ["aud", "Audience", "接收方", "Audience", '"api.example.com"', "Intended recipient(s); string or array"],
      ["exp", "Expiration", "过期时间", "Expiration", "1710000000", "Timestamp after which JWT is invalid"],
      ["nbf", "Not Before", "生效时间", "Not Before", "1710000000", "Timestamp before which JWT is invalid"],
      ["iat", "Issued At", "签发时间", "Issued At", "1710000000", "Timestamp when the JWT was created"],
      ["jti", "JWT ID", "JWT 唯一标识", "JWT ID", '"abc123"', "Unique identifier to prevent replay"],
      ["typ", "Type", "类型", "Type", '"JWT"', "Media type of the token (in header)"],
      ["alg", "Algorithm", "算法", "Algorithm", '"HS256"', "Signing algorithm: HS256/HS384/HS512/RS256/ES256"],
      ["kid", "Key ID", "密钥标识", "Key ID", '"2025-01"', "Which key was used to sign (in header)"],
    ];

    var h = "";
    claims.forEach(function (c) {
      var name = currentLang() === "en" ? c[1] : c[2];
      var desc = currentLang() === "en" ? c[5] : c[4];
      h += '<tr data-search="' + c.join(" ").toLowerCase() + '"><td><code>' + c[0] + '</code> · ' + name + '</td><td>' + desc + '</td><td><code>' + escapeHtml(c[4]) + '</code></td></tr>';
    });
    return h;
  }

  function currentLang() {
    return (window.__locale && window.__locale.menu && window.__locale.menu.home === "首页") ? "zh" : "en";
  }

  return { init: init };
})();
