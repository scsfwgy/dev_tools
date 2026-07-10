// Mortgage Tool — equal installment vs equal principal with chart and detail table.
var MortgageTool = (function () {
  var HISTORY_KEY = "mortgage_calc_history";
  var MAX_HISTORY = 12;
  var activeTab = "ei";
  var chartData = null;
  var detailPage = 0;
  var PAGE_SIZE = 24;

  function t(key) { return (window.__t && window.__t(key)) || key; }
  function byId(id) { return document.getElementById(id); }
  function val(id) { return parseFloat(byId(id).value) || 0; }

  function fmt(n) {
    if (!isFinite(n) || n === null) return "—";
    return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtInt(n) {
    if (!isFinite(n) || n === null) return "—";
    return n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  }
  function pct(n) { return fmt(n) + "%"; }

  // ── calculation ──

  function calcEqualInstallment(principal, monthlyRate, months) {
    if (monthlyRate === 0) {
      var m = principal / months;
      return { monthly: m, totalInterest: 0, total: principal };
    }
    var pow = Math.pow(1 + monthlyRate, months);
    var monthly = principal * monthlyRate * pow / (pow - 1);
    var total = monthly * months;
    return {
      monthly: Math.round(monthly * 100) / 100,
      totalInterest: Math.round((total - principal) * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }

  function calcEqualPrincipal(principal, monthlyRate, months) {
    var mp = principal / months;
    var firstMonth = mp + principal * monthlyRate;
    var totalInterest = principal * monthlyRate * (months + 1) / 2;
    var decrease = mp * monthlyRate;
    return {
      firstMonth: Math.round(firstMonth * 100) / 100,
      lastMonth: Math.round((mp + mp * monthlyRate) * 100) / 100,
      monthlyPrincipal: Math.round(mp * 100) / 100,
      decrease: Math.round(decrease * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      total: Math.round((principal + totalInterest) * 100) / 100
    };
  }

  function buildSchedule(principal, monthlyRate, months, method) {
    var schedule = [];
    var remaining = principal;
    var fixedPayment = 0;
    var fixedPrincipal = 0;
    var repaidTotal = 0;

    if (method === "ei") {
      fixedPayment = calcEqualInstallment(principal, monthlyRate, months).monthly;
    } else {
      fixedPrincipal = principal / months;
    }

    for (var i = 1; i <= months; i++) {
      var interest = remaining * monthlyRate;
      var payment, prin;
      if (method === "ei") {
        payment = fixedPayment;
        prin = payment - interest;
      } else {
        prin = fixedPrincipal;
        payment = prin + interest;
      }
      remaining -= prin;
      if (remaining < 0) remaining = 0;
      repaidTotal += prin;
      schedule.push({
        month: i,
        payment: Math.round(payment * 100) / 100,
        principal: Math.round(prin * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        interestRatio: payment > 0 ? Math.round(interest / payment * 10000) / 100 : 0,
        progress: Math.round(repaidTotal / principal * 10000) / 100
      });
    }
    return schedule;
  }

  // ── history ──

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function saveHistory(entry) {
    var items = loadHistory();
    items = items.filter(function (item) {
      return !(item.amount === entry.amount && item.rate === entry.rate && item.years === entry.years);
    });
    items.unshift(entry);
    items = items.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }

  function renderHistory(el) {
    var items = loadHistory();
    if (!items.length) { el.innerHTML = ""; return; }
    el.innerHTML = '<span class="history-label">' + t("mortgage.historyLabel") + '</span>' +
      items.map(function (item, i) {
        return '<button class="history-chip" data-idx="' + i + '">' +
          fmtInt(item.amount) + t("mortgage.wan") + ' · ' + item.rate + '% · ' + item.years + t("mortgage.year") +
          '</button>';
      }).join("");
  }

  // ── chart ──

  function drawChart(canvas, schedule, months) {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var W = rect.width;
    var H = 280;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    var style = getComputedStyle(document.documentElement);
    var bg = style.getPropertyValue("--bg-card").trim();
    var border = style.getPropertyValue("--border").trim();
    var text = style.getPropertyValue("--text").trim();
    var textMuted = style.getPropertyValue("--text-muted").trim();
    var accent = style.getPropertyValue("--accent").trim();
    var green = style.getPropertyValue("--green").trim();

    var pad = { top: 20, right: 16, bottom: 36, left: 60 };
    var pw = W - pad.left - pad.right;
    var ph = H - pad.top - pad.bottom;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var maxVal = 0;
    for (var i = 0; i < schedule.length; i++) {
      if (schedule[i].payment > maxVal) maxVal = schedule[i].payment;
    }
    maxVal = Math.ceil(maxVal / 1000) * 1000;
    if (maxVal === 0) maxVal = 1000;

    function x(m) { return pad.left + (m - 1) / (months - 1) * pw; }
    function y(v) { return pad.top + ph - (v / maxVal) * ph; }

    ctx.strokeStyle = border;
    ctx.lineWidth = 0.5;
    var gridLines = 5;
    for (var g = 0; g <= gridLines; g++) {
      var gy = pad.top + (ph / gridLines) * g;
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(W - pad.right, gy);
      ctx.stroke();
      ctx.fillStyle = textMuted;
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(fmtInt(maxVal * (1 - g / gridLines)), pad.left - 6, gy + 3);
    }

    ctx.fillStyle = textMuted;
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    var step = Math.max(1, Math.floor(months / 12));
    for (var yr = 1; yr * 12 <= months; yr += step) {
      ctx.fillText(yr + t("mortgage.year"), x(yr * 12), H - pad.bottom + 16);
    }

    // gradient fills under lines
    function fillGradient(key, color) {
      var grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);
      grad.addColorStop(0, color + "26");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x(1), pad.top + ph);
      for (var i = 0; i < schedule.length; i++) ctx.lineTo(x(schedule[i].month), y(schedule[i][key]));
      ctx.lineTo(x(schedule[schedule.length - 1].month), pad.top + ph);
      ctx.closePath();
      ctx.fill();
    }
    fillGradient("principal", green);
    fillGradient("interest", "#f85149");

    function drawLine(key, color, dash) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      var first = true;
      for (var i = 0; i < schedule.length; i++) {
        var px = x(schedule[i].month);
        var py = y(schedule[i][key]);
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawLine("payment", accent, []);
    drawLine("principal", green, []);
    drawLine("interest", "#f85149", [5, 3]);

    var legendY = pad.top + 4;
    function dot(color, label, lx) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lx, legendY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = text;
      ctx.font = "11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(label, lx + 8, legendY + 4);
      return lx + ctx.measureText(label).width + 24;
    }
    var lx = pad.left;
    lx = dot(accent, t("mortgage.monthlyPayment"), lx);
    lx = dot(green, t("mortgage.monthlyPrincipal"), lx);
    dot("#f85149", t("mortgage.monthlyInterest"), lx);
  }

  // ── detail table with pagination ──

  function renderDetailTable(schedule, months) {
    var totalPages = Math.ceil(months / PAGE_SIZE);
    if (detailPage >= totalPages) detailPage = totalPages - 1;
    if (detailPage < 0) detailPage = 0;
    var start = detailPage * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, months);
    var page = schedule.slice(start, end);

    var pager = '';
    if (totalPages > 1) {
      pager = '<div class="mg-pager">' +
        '<button class="mg-pager-btn" data-mg-page="0" ' + (detailPage === 0 ? 'disabled' : '') + '>«</button>' +
        '<button class="mg-pager-btn" data-mg-page="' + (detailPage - 1) + '" ' + (detailPage === 0 ? 'disabled' : '') + '>‹</button>' +
        '<span class="mg-pager-info">' + (start + 1) + '-' + end + ' / ' + months + '</span>' +
        '<button class="mg-pager-btn" data-mg-page="' + (detailPage + 1) + '" ' + (detailPage >= totalPages - 1 ? 'disabled' : '') + '>›</button>' +
        '<button class="mg-pager-btn" data-mg-page="' + (totalPages - 1) + '" ' + (detailPage >= totalPages - 1 ? 'disabled' : '') + '>»</button>' +
        '</div>';
    }

    return '<div class="at-table-wrap"><table class="at-table mg-detail-table"><thead><tr>' +
      '<th>' + t("mortgage.month") + '</th>' +
      '<th>' + t("mortgage.monthlyPayment") + '</th>' +
      '<th>' + t("mortgage.monthlyPrincipal") + '</th>' +
      '<th>' + t("mortgage.monthlyInterest") + '</th>' +
      '<th>' + t("mortgage.interestRatio") + '</th>' +
      '<th>' + t("mortgage.progress") + '</th>' +
      '<th>' + t("mortgage.remainingPrincipal") + '</th>' +
      '</tr></thead><tbody>' +
      page.map(function (r) {
        return '<tr><td>' + r.month + '</td><td>¥' + fmt(r.payment) + '</td><td>¥' + fmt(r.principal) + '</td><td>¥' + fmt(r.interest) + '</td><td>' + pct(r.interestRatio) + '</td><td>' + pct(r.progress) + '</td><td>¥' + fmt(r.remaining) + '</td></tr>';
      }).join("") +
      '</tbody></table></div>' + pager;
  }

  // ── update ──

  function updateAll() {
    var amount = val("mg-amount");
    if (amount <= 0) return;
    var annualRate = val("mg-rate");
    var years = val("mg-years");
    var months = Math.round(years * 12);
    var monthlyRate = annualRate / 100 / 12;
    var principal = amount * 10000;

    var ei = calcEqualInstallment(principal, monthlyRate, months);
    var ep = calcEqualPrincipal(principal, monthlyRate, months);
    var saving = Math.round((ei.totalInterest - ep.totalInterest) * 100) / 100;

    byId("mg-ei-monthly").textContent = "¥ " + fmt(ei.monthly);
    byId("mg-ei-interest").textContent = "¥ " + fmt(ei.totalInterest);
    byId("mg-ei-total").textContent = "¥ " + fmt(ei.total);
    byId("mg-ep-monthly").textContent = "¥ " + fmt(ep.firstMonth) + " → ¥ " + fmt(ep.lastMonth);
    byId("mg-ep-interest").textContent = "¥ " + fmt(ep.totalInterest);
    byId("mg-ep-total").textContent = "¥ " + fmt(ep.total);
    byId("mg-ep-decrease").textContent = t("mortgage.monthlyDecrease") + " ¥ " + fmt(ep.decrease);
    byId("mg-ei-ratio").textContent = pct(Math.round(ei.totalInterest / ei.total * 10000) / 100);
    byId("mg-ep-ratio").textContent = pct(Math.round(ep.totalInterest / ep.total * 10000) / 100);
    byId("mg-saving").textContent = saving > 0 ? t("mortgage.saving") + " ¥ " + fmt(saving) : "";

    chartData = {
      ei: buildSchedule(principal, monthlyRate, months, "ei"),
      ep: buildSchedule(principal, monthlyRate, months, "ep"),
      months: months
    };

    detailPage = 0;
    refreshDetailAndChart();
  }

  function refreshDetailAndChart() {
    if (!chartData) return;
    var schedule = activeTab === "ei" ? chartData.ei : chartData.ep;
    drawChart(byId("mg-chart"), schedule, chartData.months);
    byId("mg-detail").innerHTML = renderDetailTable(schedule, chartData.months);
    bindPager();
  }

  function bindPager() {
    var buttons = document.querySelectorAll("[data-mg-page]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        detailPage = parseInt(this.dataset.mgPage);
        refreshDetailAndChart();
      });
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    detailPage = 0;
    byId("mg-tab-ei").className = "b64-tab" + (tab === "ei" ? " active" : "");
    byId("mg-tab-ep").className = "b64-tab" + (tab === "ep" ? " active" : "");
    refreshDetailAndChart();
  }

  function snapshot() {
    var amount = val("mg-amount");
    if (amount <= 0) return;
    saveHistory({ amount: amount, rate: val("mg-rate"), years: val("mg-years"), ts: Date.now() });
    renderHistory(byId("mg-history"));
  }

  // ── init ──

  function init(container) {
    container.innerHTML =
      '<div>' +
      '  <div class="at-doc-refs"><span>' + t("mortgage.referenceNote") + '</span><a href="https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125440/3876551/index.html" target="_blank" rel="noopener">' + t("mortgage.pbcLpr") + '</a><a href="https://www.chinamoney.com.cn/chinese/bklpr/" target="_blank" rel="noopener">' + t("mortgage.chinaMoneyLpr") + '</a></div>' +
      '  <div class="at-table-wrap"><table class="at-table tax-main"><tbody>' +
      '    <tr><td style="width:28%"><label for="mg-amount">' + t("mortgage.amount") + '</label></td>' +
      '      <td colspan="3"><div class="tax-inline"><input id="mg-amount" class="crypto-input tax-num" type="number" min="0" step="1" value="100" inputmode="decimal" autocomplete="off"><span class="tax-unit">' + t("mortgage.wan") + '</span></div></td></tr>' +
      '    <tr><td><label for="mg-rate">' + t("mortgage.rate") + '</label></td>' +
      '      <td colspan="3"><div class="tax-inline"><input id="mg-rate" class="crypto-input tax-num" type="number" min="0" max="30" step="0.01" value="3.5" inputmode="decimal" autocomplete="off"><span class="tax-unit">%</span></div></td></tr>' +
      '    <tr><td><label for="mg-years">' + t("mortgage.years") + '</label></td>' +
      '      <td colspan="3"><div class="tax-inline"><input id="mg-years" class="crypto-input tax-num" type="number" min="1" max="50" step="1" value="30" inputmode="decimal" autocomplete="off"><span class="tax-unit">' + t("mortgage.year") + '</span></div></td></tr>' +
      '    <tr><td colspan="4" style="padding:14px 0 6px;font-weight:650;font-size:.84rem;color:var(--text);border-bottom:1px solid var(--border)">' + t("mortgage.result") + '</td></tr>' +
      '    <tr><th></th><th>' + t("mortgage.equalInstallment") + '</th><th>' + t("mortgage.equalPrincipal") + '</th><th></th></tr>' +
      '    <tr><td>' + t("mortgage.monthlyPayment") + '</td><td id="mg-ei-monthly">—</td><td id="mg-ep-monthly">—</td><td></td></tr>' +
      '    <tr><td></td><td></td><td id="mg-ep-decrease" style="color:var(--text-muted);font-size:.78rem">—</td><td></td></tr>' +
      '    <tr><td>' + t("mortgage.totalInterest") + '</td><td id="mg-ei-interest">—</td><td id="mg-ep-interest">—</td><td></td></tr>' +
      '    <tr><td>' + t("mortgage.totalPayment") + '</td><td id="mg-ei-total">—</td><td id="mg-ep-total">—</td><td></td></tr>' +
      '    <tr><td>' + t("mortgage.interestRatio") + '</td><td id="mg-ei-ratio">—</td><td id="mg-ep-ratio">—</td><td></td></tr>' +
      '    <tr><td></td><td colspan="2" id="mg-saving" style="color:var(--green);font-size:.82rem;font-weight:650"></td><td></td></tr>' +
      '  </tbody></table></div>' +
      '  <div class="mg-chart-section">' +
      '    <div class="b64-tabs" style="margin-bottom:10px">' +
      '      <button id="mg-tab-ei" class="b64-tab active">' + t("mortgage.equalInstallment") + '</button>' +
      '      <button id="mg-tab-ep" class="b64-tab">' + t("mortgage.equalPrincipal") + '</button>' +
      '    </div>' +
      '    <canvas id="mg-chart"></canvas>' +
      '  </div>' +
      '  <div id="mg-detail" class="mg-detail-section"></div>' +
      '  <div id="mg-history" class="history-bar"></div>' +
      '</div>';

    var inputs = container.querySelectorAll(".tax-num");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener("input", updateAll);
    }
    container.querySelector("#mg-amount").addEventListener("change", snapshot);

    byId("mg-tab-ei").addEventListener("click", function () { switchTab("ei"); });
    byId("mg-tab-ep").addEventListener("click", function () { switchTab("ep"); });

    window.addEventListener("resize", function () {
      if (chartData) drawChart(byId("mg-chart"), activeTab === "ei" ? chartData.ei : chartData.ep, chartData.months);
    });
    var themeObserver = new MutationObserver(function () {
      if (chartData) drawChart(byId("mg-chart"), activeTab === "ei" ? chartData.ei : chartData.ep, chartData.months);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    renderHistory(byId("mg-history"));
    container.addEventListener("click", function (e) {
      var chip = e.target.closest(".history-chip");
      if (!chip) return;
      var idx = parseInt(chip.dataset.idx);
      var items = loadHistory();
      if (!items[idx]) return;
      byId("mg-amount").value = items[idx].amount;
      byId("mg-rate").value = items[idx].rate;
      byId("mg-years").value = items[idx].years;
      updateAll();
    });
    updateAll();
  }

  return { init: init };
})();
