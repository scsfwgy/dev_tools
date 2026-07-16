// Five-field POSIX Cron parser and timezone-aware next-run calculator.
var CronTool = (function () {
  var HISTORY_KEY = "devtools_cron_history";
  var MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  var DAYS = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  var FORMATTERS = {};
  var container;
  function t(key) { return (window.__t && window.__t(key)) || key; }
  function byId(id) { return container.querySelector("#" + id); }
  function escapeHtml(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function parseValue(value, names, min, max, dow) {
    var upper = String(value).toUpperCase();
    var number = Object.prototype.hasOwnProperty.call(names || {}, upper) ? names[upper] : Number(upper);
    if (!Number.isInteger(number)) throw new Error(t("cron.invalidValue") + ": " + value);
    if (dow && number === 7) number = 0;
    if (number < min || number > max) throw new Error(t("cron.outOfRange") + ": " + value);
    return number;
  }
  function parseField(text, min, max, names, dow) {
    var values = new Set();
    var raw = String(text).trim();
    if (!raw) throw new Error(t("cron.emptyField"));
    raw.split(",").forEach(function (part) {
      var pair = part.split("/");
      if (pair.length > 2 || !pair[0]) throw new Error(t("cron.invalidSyntax") + ": " + part);
      var step = pair.length === 2 ? Number(pair[1]) : 1;
      if (!Number.isInteger(step) || step < 1) throw new Error(t("cron.invalidStep") + ": " + part);
      var start, end;
      if (pair[0] === "*") { start = min; end = max; }
      else if (pair[0].indexOf("-") !== -1) {
        var range = pair[0].split("-");
        if (range.length !== 2) throw new Error(t("cron.invalidSyntax") + ": " + part);
        start = parseValue(range[0], names, min, max, dow);
        end = parseValue(range[1], names, min, max, dow);
        if (start > end && !dow) throw new Error(t("cron.invalidRange") + ": " + part);
      } else { start = parseValue(pair[0], names, min, max, dow); end = pair.length === 2 ? max : start; }
      if (dow && start > end) {
        for (var wrap = start; wrap <= max; wrap += step) values.add(wrap === 7 ? 0 : wrap);
        for (var wrapped = min; wrapped <= end; wrapped += step) values.add(wrapped === 7 ? 0 : wrapped);
      } else {
        for (var value = start; value <= end; value += step) values.add(dow && value === 7 ? 0 : value);
      }
    });
    return { values: values, wildcard: raw.charAt(0) === "*" };
  }
  function parseCron(expression) {
    var fields = String(expression || "").trim().split(/\s+/);
    if (fields.length !== 5) throw new Error(t("cron.fiveFields"));
    return {
      minute: parseField(fields[0], 0, 59), hour: parseField(fields[1], 0, 23),
      day: parseField(fields[2], 1, 31), month: parseField(fields[3], 1, 12, MONTHS),
      weekday: parseField(fields[4], 0, 7, DAYS, true), expression: fields.join(" ")
    };
  }
  function formatterFor(timeZone) {
    if (!FORMATTERS[timeZone]) FORMATTERS[timeZone] = new Intl.DateTimeFormat("en-US", { timeZone: timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", weekday: "short", hourCycle: "h23" });
    return FORMATTERS[timeZone];
  }
  function zonedParts(date, timeZone) {
    var values = {};
    formatterFor(timeZone).formatToParts(date).forEach(function (part) { if (part.type !== "literal") values[part.type] = part.value; });
    return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), weekday: DAYS[String(values.weekday).toUpperCase()] };
  }
  function scheduleMatches(schedule, parts) {
    if (!schedule.month.values.has(parts.month) || !schedule.hour.values.has(parts.hour) || !schedule.minute.values.has(parts.minute)) return false;
    var dayMatch = schedule.day.values.has(parts.day);
    var weekdayMatch = schedule.weekday.values.has(parts.weekday);
    if (schedule.day.wildcard && schedule.weekday.wildcard) return true;
    if (schedule.day.wildcard) return weekdayMatch;
    if (schedule.weekday.wildcard) return dayMatch;
    return dayMatch || weekdayMatch;
  }
  function nextRuns(expression, timeZone, count, fromDate) {
    var schedule = typeof expression === "string" ? parseCron(expression) : expression;
    var total = Math.max(1, Math.min(20, count || 8));
    var cursor = new Date((fromDate || new Date()).getTime());
    cursor.setUTCSeconds(0, 0); cursor = new Date(cursor.getTime() + 60000);
    var limit = cursor.getTime() + 3660 * 86400000;
    var output = [];
    while (cursor.getTime() <= limit && output.length < total) {
      var parts = zonedParts(cursor, timeZone);
      if (scheduleMatches(schedule, parts)) output.push(new Date(cursor));
      var dayEligible = schedule.month.values.has(parts.month) && (schedule.day.wildcard || schedule.day.values.has(parts.day) || schedule.weekday.wildcard || schedule.weekday.values.has(parts.weekday));
      if (!dayEligible || !schedule.hour.values.has(parts.hour)) cursor = new Date(cursor.getTime() + Math.max(1, 60 - parts.minute) * 60000);
      else cursor = new Date(cursor.getTime() + 60000);
    }
    return output;
  }
  function loadHistory() { try { var value = JSON.parse(localStorage.getItem(HISTORY_KEY)); return Array.isArray(value) ? value.slice(0, 10) : []; } catch (error) { return []; } }
  function saveHistory(value) { var list = [value].concat(loadHistory()).filter(function (item, index, source) { return source.indexOf(item) === index; }).slice(0, 10); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (error) { /* storage unavailable */ } }
  function renderHistory() {
    var bar = byId("cron-history"); var list = loadHistory();
    bar.innerHTML = list.length ? '<span class="history-label">' + t("cron.history") + '</span>' + list.map(function (value) { return '<button type="button" class="history-item" data-cron-history="' + escapeHtml(value) + '">' + escapeHtml(value) + '</button>'; }).join("") : "";
    bar.querySelectorAll("[data-cron-history]").forEach(function (button) { button.addEventListener("click", function () { byId("cron-input").value = this.dataset.cronHistory; calculate(); }); });
  }
  function formatRun(date, timeZone) {
    var language = document.documentElement.lang === "en" ? "en-US" : "zh-CN";
    return new Intl.DateTimeFormat(language, { timeZone: timeZone, dateStyle: "medium", timeStyle: "medium", hourCycle: "h23" }).format(date);
  }
  function calculate() {
    var expression = byId("cron-input").value.trim(); var timeZone = byId("cron-zone").value; var status = byId("cron-status");
    try {
      var schedule = parseCron(expression); var runs = nextRuns(schedule, timeZone, 8);
      status.textContent = t("cron.valid"); status.classList.remove("is-error");
      byId("cron-results").innerHTML = runs.length ? runs.map(function (date, index) { return '<div class="cron-run"><span>' + String(index + 1).padStart(2, "0") + '</span><time datetime="' + date.toISOString() + '">' + escapeHtml(formatRun(date, timeZone)) + '</time><code>' + escapeHtml(date.toISOString()) + '</code></div>'; }).join("") : '<p class="local-empty">' + t("cron.noRuns") + '</p>';
      saveHistory(schedule.expression); renderHistory();
    } catch (error) { status.textContent = error.message || t("cron.invalid"); status.classList.add("is-error"); byId("cron-results").innerHTML = ""; }
  }
  function init(parent) {
    container = parent;
    var localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    var zones = [localZone, "UTC", "Asia/Shanghai", "America/New_York", "Europe/London", "Asia/Tokyo"].filter(function (value, index, source) { return source.indexOf(value) === index; });
    var examples = [["*/5 * * * *", t("cron.everyFive")], ["0 9 * * 1-5", t("cron.weekdays")], ["0 0 1 * *", t("cron.monthly")], ["30 8 * * MON", t("cron.monday")]];
    container.innerHTML = '<div class="local-tool cron-tool"><p class="tool-intro">' + t("cron.intro") + '</p><section class="tool-panel">' +
      '<div class="cron-editor"><label class="tool-field"><span>' + t("cron.expression") + '</span><input id="cron-input" class="local-code-input" value="0 9 * * 1-5" spellcheck="false" autocomplete="off"></label>' +
      '<label class="tool-field"><span>' + t("cron.timezone") + '</span><select id="cron-zone">' + zones.map(function (zone) { return '<option value="' + escapeHtml(zone) + '">' + escapeHtml(zone === localZone ? zone + " · " + t("cron.local") : zone) + '</option>'; }).join("") + '</select></label></div>' +
      '<div class="tool-actions"><button id="cron-calculate" class="local-primary" type="button">' + t("cron.calculate") + '</button></div><p id="cron-status" class="local-status" role="status" aria-live="polite"></p>' +
      '<div class="cron-fields" aria-label="' + t("cron.fieldOrder") + '"><span>' + t("cron.minute") + '</span><span>' + t("cron.hour") + '</span><span>' + t("cron.day") + '</span><span>' + t("cron.month") + '</span><span>' + t("cron.weekday") + '</span></div></section>' +
      '<div class="cron-examples">' + examples.map(function (item) { return '<button type="button" data-cron-example="' + item[0] + '"><code>' + item[0] + '</code><span>' + item[1] + '</span></button>'; }).join("") + '</div>' +
      '<section class="tool-panel"><h2>' + t("cron.nextRuns") + '</h2><div id="cron-results" class="cron-results"></div></section><div id="cron-history" class="history-bar"></div></div>';
    byId("cron-calculate").addEventListener("click", calculate);
    byId("cron-input").addEventListener("keydown", function (event) { if (event.key === "Enter") calculate(); });
    byId("cron-zone").addEventListener("change", calculate);
    container.querySelectorAll("[data-cron-example]").forEach(function (button) { button.addEventListener("click", function () { byId("cron-input").value = this.dataset.cronExample; calculate(); }); });
    renderHistory(); calculate();
  }
  return { init: init, parseCron: parseCron, nextRuns: nextRuns };
})();
