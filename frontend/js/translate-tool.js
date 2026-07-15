// Translate Tool — DeepSeek-powered, auto-detect direction, short-word phonetics.
var TranslateTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  var HISTORY_KEY = "translate_history";
  var MAX_HISTORY = 20;
  var _translating = false;

  // ═══ History ═══
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
    var el = document.getElementById("tr-history");
    if (!el) return;
    var list = loadHistory();
    if (!list.length) { el.innerHTML = ""; return; }
    el.innerHTML = '<span class="history-label">' + t("history.label") + '</span>' +
      list.map(function (item) {
        return '<button class="history-chip" title="' + escapeHtml(item) + '">' + escapeHtml(item.substring(0, 50)) + '</button>';
      }).join("");
  }

  // ═══ Translate ═══

  function doTranslate(fromHistory) {
    var input = document.getElementById("tr-input");
    var result = document.getElementById("tr-result");
    var text = input.value.trim();
    if (!text) return;
    if (_translating) return;  // prevent double-fetch
    // dedupe: don't re-translate same text
    if (!fromHistory && result.dataset.lastText === text) return;

    _translating = true;
    setState("loading");

    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "fail"); return d; }); })
      .then(function (d) {
        result.dataset.lastText = text;
        renderResult(d);
        setState("idle");
        _translating = false;
        saveHistory(text);
        renderHistory();
      })
      .catch(function (e) {
        setState("error", e.message || t("translate.error"));
        _translating = false;
      });
  }

  function renderResult(d) {
    var h = "";
    h += '<div class="tr-result-hd">';
    h += '<span class="tr-badge">' + (d.source_lang === "zh" ? "中 → 英" : d.target_lang === "zh" ? "→ 中" : "自动") + '</span>';
    h += '<button id="tr-copy" class="jt-btn" title="' + t("translate.copy") + '">📋</button>';
    h += '</div>';

    h += '<div class="tr-translation">' + escapeHtml(d.translation) + '</div>';

    if (d.phonetic) {
      h += '<div class="tr-phonetic">' + escapeHtml(d.phonetic) + '</div>';
    }
    // TTS speak button
    h += '<button id="tr-speak" class="tr-speak-btn" title="' + t("translate.speak") + '">🔊 ' + t("translate.speak") + '</button>';
    if (d.pos) {
      h += '<div class="tr-pos">[' + escapeHtml(d.pos) + ']</div>';
    }

    document.getElementById("tr-result-inner").innerHTML = h;
    document.getElementById("tr-result").className = "tr-result tr-result-visible";

    // copy button
    var copyBtn = document.getElementById("tr-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(d.translation).then(function () {
          copyBtn.textContent = "✓";
          setTimeout(function () { copyBtn.textContent = "📋"; }, 1500);
        });
      });
    }
    // TTS speak button
    var speakBtn = document.getElementById("tr-speak");
    if (speakBtn) {
      speakBtn.addEventListener("click", function () {
        speakText(d.translation, d.target_lang);
      });
    }
  }

  function speakText(text, targetLang) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Voices load async — try to pick a good one
    var voices = window.speechSynthesis.getVoices();
    var langPrefix = targetLang === "zh" ? "zh" : "en";
    if (!voices.length) {
      // voices not loaded yet — retry on next tick
      window.speechSynthesis.onvoiceschanged = function () {
        window.speechSynthesis.onvoiceschanged = null;
        speakText(text, targetLang);
      };
      return;
    }

    // Prefer native high-quality voices: Google > premium name > any match
    var preferred = null;
    var fallback = null;
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      if (!v.lang.startsWith(langPrefix)) continue;
      fallback = fallback || v;
      // macOS: Samantha (en), Ting-Ting (zh); Google voices are high-quality on all platforms
      if (v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Alex") || v.name.includes("Ting-Ting")) {
        preferred = v;
        break;
      }
      if (!preferred && v.localService) preferred = v;
    }
    var voice = preferred || fallback;
    if (!voice) return;

    var u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = targetLang === "zh" ? 0.95 : 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }

  function setState(state, msg) {
    var status = document.getElementById("tr-status");
    var result = document.getElementById("tr-result");
    var spinner = document.getElementById("tr-spinner");
    var input = document.getElementById("tr-input");

    switch (state) {
      case "loading":
        status.className = "tr-status";
        status.textContent = t("translate.translating");
        spinner.style.display = "inline-block";
        input.classList.add("tr-input-loading");
        break;
      case "error":
        status.className = "tr-status tr-status-error";
        status.textContent = msg;
        spinner.style.display = "none";
        input.classList.remove("tr-input-loading");
        result.className = "tr-result";
        break;
      default: // idle
        status.className = "tr-status";
        status.textContent = "";
        spinner.style.display = "none";
        input.classList.remove("tr-input-loading");
        break;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  // ═══ Init ═══

  function init(parent) {
    parent.innerHTML =
      '<div class="tr-tool">' +
      '  <div class="tr-header">' +
      '    <p class="tool-intro tr-subtitle">' + t("translate.subtitle") + '</p>' +
      '  </div>' +
      '  <div class="tr-input-wrap">' +
      '    <textarea id="tr-input" class="tr-textarea" placeholder="' + t("translate.placeholder") + '" rows="5"></textarea>' +
      '  </div>' +
      '  <div class="tr-controls">' +
      '    <span id="tr-status" class="tr-status"></span>' +
      '    <span id="tr-spinner" class="tr-spinner" style="display:none"></span>' +
      '    <button id="tr-btn" class="tr-btn">' + t("translate.translate") + '</button>' +
      '  </div>' +
      '  <div id="tr-result" class="tr-result">' +
      '    <div id="tr-result-inner"></div>' +
      '  </div>' +
      '  <div id="tr-history" class="history-bar"></div>' +
      '</div>';

    var input = document.getElementById("tr-input");
    var btn = document.getElementById("tr-btn");

    // translate on blur (leave input) or manual button click
    input.addEventListener("blur", function () { doTranslate(); });
    btn.addEventListener("click", function () { doTranslate(); });

    // history chip click
    var historyBar = document.getElementById("tr-history");
    if (historyBar) {
      historyBar.addEventListener("click", function (e) {
        var chip = e.target.closest(".history-chip");
        if (!chip) return;
        input.value = chip.textContent;
        input.focus();
        doTranslate(true);
      });
    }

    renderHistory();
  }

  return { init: init };
})();
