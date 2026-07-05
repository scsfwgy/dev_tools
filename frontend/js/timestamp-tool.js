// Timestamp Tool — auto-detect formats, native Date, zero deps.
var TimestampTool = (function () {
  var syncTimer, msTimer, inited, tsNow;
  var HISTORY_KEY = "ts_history";
  var MAX_HISTORY = 20;

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
      '<div class="ts-tool">' +
      '  <div class="ts-now" id="ts-now"></div>' +
      '  <div class="ts-input-wrap">' +
      '    <input id="ts-input" class="ts-input" placeholder="' + t("timestamp.placeholder") + '">' +
      '  </div>' +
      '  <div id="ts-results" class="ts-results"></div>' +
      '  <div id="ts-history" class="history-bar"></div>' +
      '</div>';

    tsNow = document.getElementById("ts-now");
    inited = false;

    buildNow();
    syncTimer = setInterval(syncNow, 1000);
    msTimer = setInterval(tickMs, 50);

    tsNow.addEventListener("click", function () {
      navigator.clipboard.writeText(fmtDatetime(new Date()));
      showToast(t("timestamp.copied"));
    });

    var input = document.getElementById("ts-input");
    // live convert on every keystroke
    input.addEventListener("input", function () {
      convert(this.value.trim());
    });
    // save to history only when focus leaves (no accidental partial entries)
    input.addEventListener("blur", function () {
      var raw = this.value.trim();
      if (raw && parseInput(raw)) {
        saveHistory(raw);
        renderHistory();
      }
    });

    renderHistory();
  }

  function buildNow() {
    var now = new Date();
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    tsNow.innerHTML =
      '<span class="ts-now-label">' + t("timestamp.now") + '</span>' +
      '<span class="ts-now-value">' +
        '<span id="ts-date" class="ts-now-date">' + fmtDate(now) + '</span>' +
        ' ' +
        '<span id="ts-sec" class="ts-now-time">' + fmtTime(now) + '</span>' +
        ' ' +
        '<span id="ts-ms" class="ts-now-ms">' + fmtMs(now) + '</span>' +
      '</span>' +
      '<span class="ts-now-tz">' + t("timestamp.timezone") + ' ' + tz + ' · UTC' + fmtOffset(now) + '</span>';
    inited = true;
  }

  function syncNow() {
    var now = new Date();
    var dateEl = document.getElementById("ts-date");
    if (dateEl) { var d = fmtDate(now); if (dateEl.textContent !== d) dateEl.textContent = d; }
    var secEl = document.getElementById("ts-sec");
    if (secEl) { var tm = fmtTime(now); if (secEl.textContent !== tm) secEl.textContent = tm; }
  }

  function tickMs() {
    var msEl = document.getElementById("ts-ms");
    if (msEl) msEl.textContent = fmtMs(new Date());
  }

  function showToast(msg) {
    var el = document.createElement("span");
    el.className = "ts-toast";
    el.textContent = msg;
    tsNow.appendChild(el);
    setTimeout(function () { el.remove(); }, 1200);
  }

  function convert(raw) {
    var el = document.getElementById("ts-results");
    if (!raw) { el.innerHTML = ""; return; }
    var d = parseInput(raw);
    if (!d) { el.innerHTML = '<div class="ts-error">' + t("timestamp.invalid") + '</div>'; return; }

    var rows = [
      [t("timestamp.ms"),       String(d.getTime())],
      [t("timestamp.sec"),      String(Math.floor(d.getTime() / 1000))],
      [t("timestamp.datetime"), fmtDatetime(d)],
      [t("timestamp.iso"),      fmtIsoLocal(d)],
      [t("timestamp.isoUtc"),   d.toISOString()],
      [t("timestamp.rfc"),      fmtRFC2822(d)],
      [t("timestamp.dow"),      fmtDayOfWeek(d)],
      [t("timestamp.week"),     fmtWeekLabel(d)],
      [t("timestamp.quarter"),  "Q" + (Math.floor(d.getMonth() / 3) + 1)],
      [t("timestamp.relative"), fmtRelative(d)],
      [t("timestamp.utc"),      d.toUTCString()],
      [t("timestamp.local"),    d.toString()],
    ];

    var html = '<div class="ts-card">';
    rows.forEach(function (r) {
      html += '<div class="ts-row"><span class="ts-label">' + r[0] + '</span><span class="ts-val">' + escapeHtml(r[1]) + '</span><button class="ts-copy" data-val="' + escapeHtml(r[1]) + '">' + t("timestamp.copy") + '</button></div>';
    });
    html += '</div>';
    el.innerHTML = html;

    el.querySelectorAll(".ts-copy").forEach(function (btn) {
      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(this.dataset.val);
        var orig = this.textContent;
        this.textContent = "✓";
        setTimeout(function () { btn.textContent = orig; }, 800);
      });
    });
  }

  function parseInput(s) {
    var d;
    if (/^-?\d{13}$/.test(s)) { d = new Date(parseInt(s, 10)); if (!isNaN(d.getTime())) return d; }
    if (/^-?\d{10}$/.test(s)) { d = new Date(parseInt(s, 10) * 1000); if (!isNaN(d.getTime())) return d; }
    var m1 = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})\s+(\d{1,3})$/);
    if (m1) { d = new Date(+m1[1], m1[2]-1, +m1[3], +m1[4], +m1[5], +m1[6], +m1[7]); if (!isNaN(d.getTime())) return d; }
    var m2 = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (m2) { d = new Date(+m2[1], m2[2]-1, +m2[3], +m2[4], +m2[5], +m2[6]); if (!isNaN(d.getTime())) return d; }
    var m3 = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
    if (m3) { d = new Date(+m3[1], m3[2]-1, +m3[3], +m3[4], +m3[5]); if (!isNaN(d.getTime())) return d; }
    var m4 = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m4) { d = new Date(+m4[1], m4[2]-1, +m4[3]); if (!isNaN(d.getTime())) return d; }
    var m5 = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m5) { d = new Date(+m5[1], m5[2]-1, +m5[3]); if (!isNaN(d.getTime())) return d; }
    d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(d) { return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }
  function fmtTime(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); }
  function fmtMs(d)   { return String(d.getMilliseconds()).padStart(3, "0"); }
  function fmtDatetime(d) { return fmtDate(d) + " " + fmtTime(d) + " " + fmtMs(d); }
  function fmtOffset(d) { var off = -d.getTimezoneOffset()/60; return (off >= 0 ? "+":"") + off; }
  function pad(n)     { return n < 10 ? "0" + n : String(n); }
  function escapeHtml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function fmtTzOffset() {
    var off = -new Date().getTimezoneOffset();
    return (off >= 0 ? "+" : "-") + pad(Math.floor(Math.abs(off)/60)) + ":" + pad(Math.abs(off)%60);
  }

  function fmtIsoLocal(d) { return fmtDate(d) + "T" + fmtTime(d) + "." + fmtMs(d) + fmtTzOffset(); }

  function fmtRFC2822(d) {
    var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return days[d.getDay()] + ", " + pad(d.getDate()) + " " + months[d.getMonth()] + " " + d.getFullYear() +
      " " + fmtTime(d) + " " + fmtTzOffset().replace(":","");
  }

  function fmtDayOfWeek(d) {
    var zh = t("timestamp.days").split(","), en = t("timestamp.daysEn").split(",");
    return (zh[d.getDay()]||"") + " / " + (en[d.getDay()]||"");
  }

  function fmtWeekLabel(d) { return t("timestamp.weekPrefix") + " " + fmtWeekNum(d) + " " + t("timestamp.weekSuffix"); }

  function fmtWeekNum(d) {
    var start = new Date(d.getFullYear(), 0, 1);
    var diff = (d - start) + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
    return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
  }

  function fmtRelative(d) {
    var diff = d.getTime() - Date.now(), abs = Math.abs(diff);
    var sec = Math.floor(abs/1000), min = Math.floor(sec/60), hr = Math.floor(min/60);
    var day = Math.floor(hr/24), mon = Math.floor(day/30), yr = Math.floor(day/365);
    var suffix = diff >= 0 ? t("timestamp.future") : t("timestamp.past");
    if (abs < 5000) return t("timestamp.justNow");
    if (sec < 60) return sec + " " + t("timestamp.secUnit") + suffix;
    if (min < 60) return min + " " + t("timestamp.minUnit") + suffix;
    if (hr < 24)  return hr + " " + t("timestamp.hrUnit") + suffix;
    if (day < 30) return day + " " + t("timestamp.dayUnit") + suffix;
    if (mon < 12) return mon + " " + t("timestamp.monUnit") + suffix;
    return yr + " " + t("timestamp.yrUnit") + suffix;
  }

  function renderHistory() {
    var list = loadHistory();
    var el = document.getElementById("ts-history");
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + '</span>';
    list.forEach(function (item) {
      html += '<button class="history-chip" title="' + escapeHtml(item) + '">' + escapeHtml(item) + '</button>';
    });
    el.innerHTML = html;
    el.querySelectorAll(".history-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var input = document.getElementById("ts-input");
        input.value = this.textContent;
        convert(this.textContent.trim());
      });
    });
  }

  return { init: init };
})();
