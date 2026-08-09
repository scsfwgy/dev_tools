// Major Events Timeline — a local, bilingual 1993–2026 world and China reference table.
var HistoryEventsTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function splitEvents(value) {
    return String(value || "").split(/[；;]/).map(function (event) { return event.trim(); }).filter(Boolean);
  }

  function decadeSource(year, side) {
    if (side === "china") {
      if (year <= 2018) return "https://www.ccdi.gov.cn/yaowen/201812/t20181217_185209.html";
      if (year <= 2021) return "http://www.xinhuanet.com/2021-06/28/c_1127603399.htm";
      return "https://www.gov.cn/yaowen/";
    }
    if (year <= 2000) return "https://www.un.org/en/about-us/history-of-the-un/1991-2000";
    if (year <= 2010) return "https://www.un.org/en/about-us/history-of-the-un/2001-2010";
    if (year <= 2020) return "https://www.un.org/en/about-us/history-of-the-un/2011-2020";
    return "https://www.cfr.org/education/learn/timelines/essential-events-1945";
  }

  function yearSource(year, side) {
    return side === "china"
      ? "https://zh.wikipedia.org/wiki/" + encodeURIComponent(year + "年中国大陆")
      : "https://en.wikipedia.org/wiki/" + encodeURIComponent(String(year));
  }

  function timelineSources(year, side) {
    if (side === "china") {
      return [
        "https://zh.wikipedia.org/wiki/" + encodeURIComponent(year + "年"),
        "https://zh.wikipedia.org/wiki/" + encodeURIComponent("中华人民共和国历史年表")
      ];
    }
    return [
      year <= 2000
        ? "https://en.wikipedia.org/wiki/Timeline_of_the_20th_century"
        : "https://en.wikipedia.org/wiki/Timeline_of_the_21st_century",
      "https://en.wikipedia.org/wiki/Timeline_of_modern_history"
    ];
  }

  function sourceUrls(item, side, eventCount) {
    var year = Number(item.year);
    var candidates = [item[side + "Source"], decadeSource(year, side), yearSource(year, side)].concat(timelineSources(year, side));
    var unique = candidates.filter(function (url, index) {
      return url && candidates.indexOf(url) === index;
    });
    return unique.slice(0, Math.max(1, eventCount));
  }

  function buildCell(item, side, label) {
    var events = splitEvents(item[side]);
    var sources = sourceUrls(item, side, events.length);
    var eventList = '<ul class="history-events-list">' + events.map(function (event, index) {
      return '<li><span>' + escapeHtml(event) + '</span>' +
        '<a class="history-events-source" href="' + escapeHtml(sources[index]) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '<span aria-hidden="true"> ↗</span></a></li>';
    }).join("") + '</ul>';
    return '<td>' + eventList + '</td>';
  }

  function init(parent) {
    var events = t("historyEvents.events");
    if (!Array.isArray(events)) events = [];

    var sourceLabel = t("historyEvents.source");
    var rows = events.map(function (item) {
      return '<tr>' +
        '<th class="history-events-year" scope="row">' + escapeHtml(item.year) + '</th>' +
        buildCell(item, "world", sourceLabel) +
        buildCell(item, "china", sourceLabel) +
      '</tr>';
    }).join("");

    parent.innerHTML = '<section class="history-events-tool" aria-describedby="history-events-summary">' +
      '<div class="history-events-summary" id="history-events-summary">' +
        '<p>' + escapeHtml(t("historyEvents.summary")) + '</p>' +
        '<span>' + escapeHtml(t("historyEvents.rangeNote")) + '</span>' +
      '</div>' +
      '<div class="history-events-table-wrap" tabindex="0" role="region" aria-label="' + escapeHtml(t("historyEvents.tableLabel")) + '">' +
        '<table class="history-events-table">' +
          '<thead><tr><th scope="col">' + escapeHtml(t("historyEvents.year")) + '</th><th scope="col">' + escapeHtml(t("historyEvents.world")) + '</th><th scope="col">' + escapeHtml(t("historyEvents.china")) + '</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</section>';
  }

  return { init: init };
})();
