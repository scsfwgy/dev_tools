// UUID v4/v7 and ULID generator/parser — local browser processing only.
var UuidTool = (function () {
  var HISTORY_KEY = "devtools_uuid_history";
  var ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var container;

  function t(key) { return (window.__t && window.__t(key)) || key; }
  function byId(id) { return container.querySelector("#" + id); }
  function escapeHtml(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function randomBytes(length) { var bytes = new Uint8Array(length); window.crypto.getRandomValues(bytes); return bytes; }
  function bytesToUuid(bytes) {
    var hex = Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  function generateUuidV4() {
    var bytes = randomBytes(16);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    return bytesToUuid(bytes);
  }

  function generateUuidV7(now) {
    var timestamp = BigInt(now === undefined ? Date.now() : now);
    var bytes = randomBytes(16);
    for (var index = 5; index >= 0; index -= 1) {
      bytes[index] = Number(timestamp & 255n);
      timestamp >>= 8n;
    }
    bytes[6] = (bytes[6] & 15) | 112;
    bytes[8] = (bytes[8] & 63) | 128;
    return bytesToUuid(bytes);
  }

  function generateUlid(now) {
    var timestamp = BigInt(now === undefined ? Date.now() : now);
    var bytes = randomBytes(16);
    for (var index = 5; index >= 0; index -= 1) {
      bytes[index] = Number(timestamp & 255n);
      timestamp >>= 8n;
    }
    var value = 0n;
    bytes.forEach(function (byte) { value = (value << 8n) | BigInt(byte); });
    var output = new Array(26);
    for (var position = 25; position >= 0; position -= 1) {
      output[position] = ALPHABET[Number(value & 31n)];
      value >>= 5n;
    }
    return output.join("");
  }

  function analyze(raw) {
    var value = String(raw || "").trim();
    var uuid = value.match(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f])([0-9a-f]{3})-([0-9a-f])([0-9a-f]{3})-([0-9a-f]{12})$/i);
    if (uuid) {
      var version = parseInt(uuid[3], 16);
      var variantNibble = parseInt(uuid[5], 16);
      var result = { valid: true, type: "UUID", version: version, variant: (variantNibble & 8) === 8 ? "RFC 4122 / RFC 9562" : "Other" };
      if (version === 7) {
        var millis = Number(BigInt("0x" + value.replace(/-/g, "").slice(0, 12)));
        result.timestamp = new Date(millis);
      }
      return result;
    }
    var upper = value.toUpperCase();
    if (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(upper)) {
      var timeValue = 0n;
      for (var i = 0; i < 10; i += 1) timeValue = timeValue * 32n + BigInt(ALPHABET.indexOf(upper[i]));
      return { valid: true, type: "ULID", version: null, variant: null, timestamp: new Date(Number(timeValue)) };
    }
    return { valid: false };
  }

  function loadHistory() { try { var value = JSON.parse(localStorage.getItem(HISTORY_KEY)); return Array.isArray(value) ? value.slice(0, 10) : []; } catch (error) { return []; } }
  function saveHistory(values) {
    var list = values.concat(loadHistory()).filter(function (value, index, source) { return source.indexOf(value) === index; }).slice(0, 10);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (error) { /* storage unavailable */ }
  }
  function renderHistory() {
    var bar = byId("uuid-history");
    var values = loadHistory();
    bar.innerHTML = values.length ? '<span class="history-label">' + t("uuid.history") + '</span>' + values.map(function (value) {
      return '<button type="button" class="history-item" data-uuid-history="' + escapeHtml(value) + '">' + escapeHtml(value) + '</button>';
    }).join("") : "";
    bar.querySelectorAll("[data-uuid-history]").forEach(function (button) {
      button.addEventListener("click", function () { byId("uuid-inspect-input").value = this.dataset.uuidHistory; inspect(); });
    });
  }
  function copy(value) {
    navigator.clipboard.writeText(value).then(function () { showCopyToast(t("uuid.copied")); }).catch(function () {});
  }
  function generate() {
    var type = byId("uuid-type").value;
    var count = Math.max(1, Math.min(100, Number(byId("uuid-count").value) || 1));
    byId("uuid-count").value = count;
    var generator = type === "v7" ? generateUuidV7 : (type === "ulid" ? generateUlid : generateUuidV4);
    var values = Array.from({ length: count }, generator);
    byId("uuid-output").value = values.join("\n");
    byId("uuid-copy-all").disabled = false;
    saveHistory(values);
    renderHistory();
  }
  function inspect() {
    var result = analyze(byId("uuid-inspect-input").value);
    var output = byId("uuid-analysis");
    if (!result.valid) { output.innerHTML = '<p class="local-tool-error">' + t("uuid.invalid") + '</p>'; return; }
    var rows = [[t("uuid.type"), result.type]];
    if (result.version !== null) rows.push([t("uuid.version"), "v" + result.version], [t("uuid.variant"), result.variant]);
    if (result.timestamp) rows.push([t("uuid.timestamp"), result.timestamp.toISOString()]);
    output.innerHTML = rows.map(function (row) { return '<div class="local-detail-row"><span>' + row[0] + '</span><code>' + escapeHtml(row[1]) + '</code></div>'; }).join("");
  }

  function init(parent) {
    container = parent;
    container.innerHTML = '<div class="local-tool uuid-tool">' +
      '<p class="tool-intro">' + t("uuid.intro") + '</p>' +
      '<div class="local-tool-grid"><section class="tool-panel"><h2>' + t("uuid.generateTitle") + '</h2>' +
      '<div class="local-inline-fields"><label class="tool-field"><span>' + t("uuid.format") + '</span><select id="uuid-type"><option value="v4">UUID v4</option><option value="v7">UUID v7</option><option value="ulid">ULID</option></select></label>' +
      '<label class="tool-field"><span>' + t("uuid.count") + '</span><input id="uuid-count" type="number" min="1" max="100" value="5" inputmode="numeric"></label></div>' +
      '<div class="tool-actions"><button id="uuid-generate" class="local-primary" type="button">' + t("uuid.generate") + '</button><button id="uuid-copy-all" type="button" disabled>' + t("uuid.copyAll") + '</button></div>' +
      '<label class="tool-field"><span>' + t("uuid.result") + '</span><textarea id="uuid-output" class="local-code-output" rows="8" readonly></textarea></label></section>' +
      '<section class="tool-panel"><h2>' + t("uuid.inspectTitle") + '</h2><label class="tool-field"><span>' + t("uuid.identifier") + '</span><input id="uuid-inspect-input" type="text" placeholder="018f47a4-5dac-7c6e-8000-000000000000" autocomplete="off" spellcheck="false"></label>' +
      '<button id="uuid-inspect" type="button">' + t("uuid.inspect") + '</button><div id="uuid-analysis" class="local-detail-list" role="status" aria-live="polite"></div></section></div>' +
      '<div id="uuid-history" class="history-bar"></div></div>';
    byId("uuid-generate").addEventListener("click", generate);
    byId("uuid-copy-all").addEventListener("click", function () { copy(byId("uuid-output").value); });
    byId("uuid-inspect").addEventListener("click", inspect);
    byId("uuid-inspect-input").addEventListener("keydown", function (event) { if (event.key === "Enter") inspect(); });
    renderHistory();
    generate();
  }

  return { init: init, generateUuidV4: generateUuidV4, generateUuidV7: generateUuidV7, generateUlid: generateUlid, analyze: analyze };
})();
