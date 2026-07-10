// Tax Tool — China comprehensive income IIT estimate with cumulative withholding details.
var TaxTool = (function () {
  var HISTORY_KEY = "tax_calc_history";
  var MAX_HISTORY = 12;
  var STANDARD_DEDUCTION_MONTHLY = 5000;
  var activeTab = "summary";

  var MONTHLY_BRACKETS = [
    [0, 0.03, 0],
    [3000, 0.10, 210],
    [12000, 0.20, 1410],
    [25000, 0.25, 2660],
    [35000, 0.30, 4410],
    [55000, 0.35, 7160],
    [80000, 0.45, 15160]
  ];

  var ANNUAL_BRACKETS = [
    [0, 36000, 0.03, 0],
    [36000, 144000, 0.10, 2520],
    [144000, 300000, 0.20, 16920],
    [300000, 420000, 0.25, 31920],
    [420000, 660000, 0.30, 52920],
    [660000, 960000, 0.35, 85920],
    [960000, null, 0.45, 181920]
  ];

  function t(key) { return (window.__t && window.__t(key)) || key; }
  function byId(id) { return document.getElementById(id); }
  function val(id) { return parseFloat(byId(id).value) || 0; }
  function roundMoney(number) { return Math.round(number * 100) / 100; }
  function currentLocale() { return document.documentElement.lang.toLowerCase().indexOf("en") === 0 ? "en-US" : "zh-CN"; }
  function fmt(number) {
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString(currentLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function money(number) { return "¥ " + fmt(number); }
  function percent(number) { return fmt(number * 100) + "%"; }

  function readRates() {
    return {
      pension: val("tax-pension") / 100,
      medical: val("tax-medical") / 100,
      unemployment: val("tax-unemployment") / 100,
      housingFund: val("tax-hf") / 100
    };
  }

  function bracketTax(taxable, brackets) {
    if (taxable <= 0) return { tax: 0, rate: 0, qd: 0, level: 0 };
    for (var index = brackets.length - 1; index >= 0; index--) {
      if (taxable > brackets[index][0]) {
        var rateIndex = brackets[index].length === 4 ? 2 : 1;
        var qdIndex = brackets[index].length === 4 ? 3 : 2;
        return {
          tax: roundMoney(taxable * brackets[index][rateIndex] - brackets[index][qdIndex]),
          rate: brackets[index][rateIndex],
          qd: brackets[index][qdIndex],
          level: index + 1
        };
      }
    }
    return { tax: 0, rate: 0, qd: 0, level: 0 };
  }

  function calcBonusSeparate(bonus) {
    if (bonus <= 0) return 0;
    var result = bracketTax(bonus / 12, MONTHLY_BRACKETS);
    return roundMoney(bonus * result.rate - result.qd);
  }

  function calculate() {
    var gross = val("tax-gross");
    var rates = readRates();
    var deduction = val("tax-deduction");
    var bonus = val("tax-bonus");
    var insurance = roundMoney(gross * (rates.pension + rates.medical + rates.unemployment + rates.housingFund));
    var schedule = [];
    var previousTax = 0;

    for (var month = 1; month <= 12; month++) {
      var cumulativeTaxable = Math.max(0, roundMoney((gross - insurance - deduction - STANDARD_DEDUCTION_MONTHLY) * month));
      var cumulativeResult = bracketTax(cumulativeTaxable, ANNUAL_BRACKETS);
      var withholding = Math.max(0, roundMoney(cumulativeResult.tax - previousTax));
      schedule.push({
        month: month,
        cumulativeTaxable: cumulativeTaxable,
        rate: cumulativeResult.rate,
        level: cumulativeResult.level,
        withholding: withholding,
        cumulativeTax: cumulativeResult.tax,
        netPay: roundMoney(gross - insurance - withholding)
      });
      previousTax = cumulativeResult.tax;
    }

    var annualGross = roundMoney(gross * 12);
    var annualInsurance = roundMoney(insurance * 12);
    var annualDeduction = roundMoney(deduction * 12);
    var annualTaxable = schedule[11].cumulativeTaxable;
    var annualTax = schedule[11].cumulativeTax;
    var annualNet = roundMoney(annualGross - annualInsurance - annualTax);
    var breakdown = [];
    var bracketTaxTotal = 0;

    ANNUAL_BRACKETS.forEach(function (bracket, index) {
      var upper = bracket[1];
      var portion = Math.max(0, Math.min(annualTaxable, upper === null ? annualTaxable : upper) - bracket[0]);
      var tax = roundMoney(portion * bracket[2]);
      bracketTaxTotal = roundMoney(bracketTaxTotal + tax);
      breakdown.push({
        level: index + 1,
        lower: bracket[0],
        upper: upper,
        rate: bracket[2],
        quickDeduction: bracket[3],
        portion: portion,
        tax: tax,
        cumulativeTax: bracketTaxTotal
      });
    });

    return {
      gross: gross,
      insurance: insurance,
      deduction: deduction,
      bonus: bonus,
      annualGross: annualGross,
      annualInsurance: annualInsurance,
      annualDeduction: annualDeduction,
      annualTaxable: annualTaxable,
      annualTax: annualTax,
      annualNet: annualNet,
      averageTax: roundMoney(annualTax / 12),
      averageNet: roundMoney(annualNet / 12),
      effectiveRate: annualGross > 0 ? annualTax / annualGross : 0,
      schedule: schedule,
      breakdown: breakdown
    };
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (error) { return []; }
  }

  function saveHistory(entry) {
    var items = loadHistory().filter(function (item) { return item.gross !== entry.gross; });
    items.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  }

  function renderHistory() {
    var element = byId("tax-history");
    var items = loadHistory();
    if (!items.length) { element.innerHTML = ""; return; }
    element.innerHTML = '<span class="history-label">' + t("tax.historyLabel") + '</span>' + items.map(function (item, index) {
      return '<button class="history-chip" data-tax-history="' + index + '">' + t("tax.grossLabel") + ' ¥' + fmt(item.gross) + ' → ' + t("tax.averageNet") + ' ¥' + fmt(item.averageNet) + '</button>';
    }).join("");
  }

  function renderSummary(result) {
    var monthlyTaxable = roundMoney(result.annualTaxable / 12);
    byId("tax-summary-body").innerHTML = [
      [t("tax.grossIncome"), money(result.gross), money(result.annualGross)],
      [t("tax.socialInsurance"), money(result.insurance), money(result.annualInsurance)],
      [t("tax.specialDeduction"), money(result.deduction), money(result.annualDeduction)],
      [t("tax.taxableIncome"), money(monthlyTaxable), money(result.annualTaxable)],
      [t("tax.incomeTax"), money(result.averageTax), money(result.annualTax)],
      [t("tax.netPay"), '<strong class="tax-positive">' + money(result.averageNet) + '</strong>', '<strong class="tax-positive">' + money(result.annualNet) + '</strong>'],
      [t("tax.effectiveRate"), percent(result.effectiveRate), percent(result.effectiveRate)]
    ].map(function (row) {
      return '<tr><td>' + row[0] + '</td><td>' + row[1] + '</td><td>' + row[2] + '</td></tr>';
    }).join("");

    var bonusWrap = byId("tax-bonus-wrap");
    if (result.bonus <= 0) { bonusWrap.classList.add("hidden"); return; }
    var separateBonusTax = calcBonusSeparate(result.bonus);
    var separateTotal = roundMoney(result.annualTax + separateBonusTax);
    var combinedTaxable = result.annualTaxable + result.bonus;
    var combinedTotal = bracketTax(combinedTaxable, ANNUAL_BRACKETS).tax;
    var combinedBonusTax = roundMoney(combinedTotal - result.annualTax);
    var separateBetter = separateTotal <= combinedTotal;
    var saving = Math.abs(roundMoney(separateTotal - combinedTotal));
    byId("tax-bonus-body").innerHTML =
      '<tr class="' + (separateBetter ? "tax-better-row" : "") + '"><td>' + t("tax.separateMethod") + '</td><td>' + money(separateBonusTax) + '</td><td>' + money(separateTotal) + '</td><td>' + (separateBetter ? '<span class="tax-recommend">✓ ' + t("tax.recommended") + '</span>' : '') + '</td></tr>' +
      '<tr class="' + (!separateBetter ? "tax-better-row" : "") + '"><td>' + t("tax.combinedMethod") + '</td><td>' + money(combinedBonusTax) + '</td><td>' + money(combinedTotal) + '</td><td>' + (!separateBetter ? '<span class="tax-recommend">✓ ' + t("tax.recommended") + '</span>' : '') + '</td></tr>';
    byId("tax-saving").textContent = saving > 0 ? t("tax.saving") + " " + money(saving) : "";
    bonusWrap.classList.remove("hidden");
  }

  function renderSchedule(result) {
    byId("tax-schedule-body").innerHTML = result.schedule.map(function (row) {
      return '<tr><td>' + row.month + '</td><td>' + money(row.cumulativeTaxable) + '</td><td>' + (row.level ? t("tax.level") + row.level + t("tax.levelSuffix") : "—") + '</td><td>' + percent(row.rate) + '</td><td>' + money(row.withholding) + '</td><td>' + money(row.cumulativeTax) + '</td><td>' + money(row.netPay) + '</td></tr>';
    }).join("");
  }

  function renderBreakdown(result) {
    byId("tax-bracket-body").innerHTML = result.breakdown.map(function (row) {
      var range = row.upper === null ? money(row.lower) + "+" : money(row.lower) + " – " + money(row.upper);
      var activeClass = row.portion > 0 ? ' class="tax-used-row"' : "";
      return '<tr' + activeClass + '><td>' + t("tax.level") + row.level + t("tax.levelSuffix") + '</td><td>' + range + '</td><td>' + percent(row.rate) + '</td><td>' + money(row.portion) + '</td><td>' + money(row.tax) + '</td><td>' + money(row.cumulativeTax) + '</td></tr>';
    }).join("");
  }

  function renderGuide(result) {
    byId("tax-guide-example-body").innerHTML = [
      [t("tax.grossIncome"), money(result.gross) + " × 12", money(result.annualGross)],
      [t("tax.socialInsurance"), money(result.insurance) + " × 12", "− " + money(result.annualInsurance)],
      [t("tax.basicDeduction"), money(STANDARD_DEDUCTION_MONTHLY) + " × 12", "− " + money(STANDARD_DEDUCTION_MONTHLY * 12)],
      [t("tax.specialDeduction"), money(result.deduction) + " × 12", "− " + money(result.annualDeduction)],
      [t("tax.taxableIncome"), t("tax.guideSubtractFormula"), money(result.annualTaxable)],
      [t("tax.incomeTax"), t("tax.guideProgressiveFormula"), money(result.annualTax)],
      [t("tax.netPay"), t("tax.guideNetFormula"), money(result.annualNet)]
    ].map(function (row) {
      return '<tr><td>' + row[0] + '</td><td>' + row[1] + '</td><td>' + row[2] + '</td></tr>';
    }).join("");

    byId("tax-guide-stage-body").innerHTML = result.breakdown.filter(function (row) {
      return row.portion > 0;
    }).map(function (row) {
      return '<tr><td>' + t("tax.level") + row.level + t("tax.levelSuffix") + '</td><td>' + money(row.portion) + '</td><td>' + percent(row.rate) + '</td><td>' + money(row.tax) + '</td></tr>';
    }).join("");
  }

  function updateAll() {
    var result = calculate();
    renderSummary(result);
    renderSchedule(result);
    renderBreakdown(result);
    renderGuide(result);
  }

  function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll("[data-tax-tab]").forEach(function (button) {
      button.className = "b64-tab" + (button.dataset.taxTab === activeTab ? " active" : "");
    });
    document.querySelectorAll("[data-tax-panel]").forEach(function (panel) {
      panel.classList.toggle("hidden", panel.dataset.taxPanel !== activeTab);
    });
  }

  function init(container) {
    container.innerHTML =
      '<div class="b64-tool">' +
      '<div class="at-doc-refs"><span>' + t("tax.assumptionNote") + '</span><a href="https://fgk.chinatax.gov.cn/zcfgk/c100012/c5194838/content.html" target="_blank" rel="noopener">' + t("tax.officialWithholding") + '</a><a href="https://shanghai.chinatax.gov.cn/zcfw/zcfgk/grsds/202402/P020240202362406243753.pdf" target="_blank" rel="noopener">' + t("tax.officialRateTable") + '</a></div>' +
      '<div class="at-table-wrap"><table class="at-table tax-input-table"><tbody>' +
      '<tr><td><label for="tax-gross">' + t("tax.grossLabel") + '</label></td><td><div class="tax-inline"><input id="tax-gross" class="crypto-input tax-num" type="number" min="0" step="100" value="20000" inputmode="decimal"><span class="tax-unit">' + t("tax.yuanPerMonth") + '</span></div></td><td><label for="tax-deduction">' + t("tax.deductionLabel") + '</label></td><td><div class="tax-inline"><input id="tax-deduction" class="crypto-input tax-num" type="number" min="0" step="100" value="0" inputmode="decimal"><span class="tax-unit">' + t("tax.yuanPerMonth") + '</span></div></td></tr>' +
      '<tr><td><label for="tax-pension">' + t("tax.pension") + '</label></td><td><div class="tax-inline"><input id="tax-pension" class="crypto-input tax-num" type="number" min="0" max="30" step="0.1" value="8" inputmode="decimal"><span class="tax-unit">%</span></div></td><td><label for="tax-medical">' + t("tax.medical") + '</label></td><td><div class="tax-inline"><input id="tax-medical" class="crypto-input tax-num" type="number" min="0" max="30" step="0.1" value="2" inputmode="decimal"><span class="tax-unit">%</span></div></td></tr>' +
      '<tr><td><label for="tax-unemployment">' + t("tax.unemployment") + '</label></td><td><div class="tax-inline"><input id="tax-unemployment" class="crypto-input tax-num" type="number" min="0" max="30" step="0.1" value="0.5" inputmode="decimal"><span class="tax-unit">%</span></div></td><td><label for="tax-hf">' + t("tax.housingFund") + '</label></td><td><div class="tax-inline"><input id="tax-hf" class="crypto-input tax-num" type="number" min="0" max="25" step="0.1" value="7" inputmode="decimal"><span class="tax-unit">%</span></div></td></tr>' +
      '<tr><td><label for="tax-bonus">' + t("tax.bonusLabel") + '</label></td><td><div class="tax-inline"><input id="tax-bonus" class="crypto-input tax-num" type="number" min="0" step="1000" value="0" inputmode="decimal"><span class="tax-unit">' + t("tax.yuan") + '</span></div></td><td colspan="2" class="at-muted">' + t("tax.rateNote") + '</td></tr>' +
      '</tbody></table></div>' +
      '<div class="b64-tabs tax-result-tabs"><button class="b64-tab active" data-tax-tab="summary">' + t("tax.summaryTab") + '</button><button class="b64-tab" data-tax-tab="schedule">' + t("tax.scheduleTab") + '</button><button class="b64-tab" data-tax-tab="brackets">' + t("tax.bracketsTab") + '</button><button class="b64-tab" data-tax-tab="guide">' + t("tax.guideTab") + '</button></div>' +
      '<div class="android-section" data-tax-panel="summary"><div class="at-doc-refs"><span>' + t("tax.averageNote") + '</span></div><div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("tax.item") + '</th><th>' + t("tax.monthlyAverage") + '</th><th>' + t("tax.annual") + '</th></tr></thead><tbody id="tax-summary-body"></tbody></table></div><div id="tax-bonus-wrap" class="hidden"><div class="at-doc-refs tax-subnote"><span>' + t("tax.bonusTitle") + '</span><span id="tax-saving" class="tax-saving-note"></span></div><div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("tax.method") + '</th><th>' + t("tax.bonusTax") + '</th><th>' + t("tax.annualTotalTax") + '</th><th></th></tr></thead><tbody id="tax-bonus-body"></tbody></table></div></div></div>' +
      '<div class="android-section hidden" data-tax-panel="schedule"><div class="at-doc-refs"><span>' + t("tax.scheduleNote") + '</span></div><div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("tax.month") + '</th><th>' + t("tax.cumulativeTaxable") + '</th><th>' + t("tax.taxLevel") + '</th><th>' + t("tax.rate") + '</th><th>' + t("tax.currentTax") + '</th><th>' + t("tax.cumulativeTax") + '</th><th>' + t("tax.currentNet") + '</th></tr></thead><tbody id="tax-schedule-body"></tbody></table></div></div>' +
      '<div class="android-section hidden" data-tax-panel="brackets"><div class="at-doc-refs"><span>' + t("tax.bracketNote") + '</span></div><div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("tax.taxLevel") + '</th><th>' + t("tax.bracketRange") + '</th><th>' + t("tax.rate") + '</th><th>' + t("tax.taxedPortion") + '</th><th>' + t("tax.stageTax") + '</th><th>' + t("tax.cumulativeTax") + '</th></tr></thead><tbody id="tax-bracket-body"></tbody></table></div></div>' +
      '<div class="android-section hidden" data-tax-panel="guide">' +
      '<div class="at-doc-refs"><span>' + t("tax.guideIntro") + '</span></div>' +
      '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("tax.guideStep") + '</th><th>' + t("tax.guideMeaning") + '</th><th>' + t("tax.guideFormula") + '</th></tr></thead><tbody>' +
      '<tr><td>1. ' + t("tax.grossIncome") + '</td><td>' + t("tax.guideGrossMeaning") + '</td><td>' + t("tax.guideGrossFormula") + '</td></tr>' +
      '<tr><td>2. ' + t("tax.socialInsurance") + '</td><td>' + t("tax.guideContributionMeaning") + '</td><td>' + t("tax.guideContributionFormula") + '</td></tr>' +
      '<tr><td>3. ' + t("tax.basicDeduction") + '</td><td>' + t("tax.guideBasicMeaning") + '</td><td>' + t("tax.guideBasicFormula") + '</td></tr>' +
      '<tr><td>4. ' + t("tax.specialDeduction") + '</td><td>' + t("tax.guideSpecialMeaning") + '</td><td>' + t("tax.guideSpecialFormula") + '</td></tr>' +
      '<tr><td>5. ' + t("tax.taxableIncome") + '</td><td>' + t("tax.guideTaxableMeaning") + '</td><td>' + t("tax.guideTaxableFormula") + '</td></tr>' +
      '<tr><td>6. ' + t("tax.incomeTax") + '</td><td>' + t("tax.guideTaxMeaning") + '</td><td>' + t("tax.guideTaxFormula") + '</td></tr>' +
      '</tbody></table></div>' +
      '<div class="at-doc-refs tax-subnote"><span>' + t("tax.contributionTitle") + '</span><span>' + t("tax.contributionIntro") + '</span></div>' +
      '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("tax.item") + '</th><th>' + t("tax.defaultRate") + '</th><th>' + t("tax.calculationBasis") + '</th><th>' + t("tax.note") + '</th></tr></thead><tbody>' +
      '<tr><td>' + t("tax.pension") + '</td><td>8%</td><td>' + t("tax.contributionBaseTimesRate") + '</td><td>' + t("tax.pensionGuide") + '</td></tr>' +
      '<tr><td>' + t("tax.medical") + '</td><td>2%</td><td>' + t("tax.contributionBaseTimesRate") + '</td><td>' + t("tax.medicalGuide") + '</td></tr>' +
      '<tr><td>' + t("tax.unemployment") + '</td><td>0.5%</td><td>' + t("tax.contributionBaseTimesRate") + '</td><td>' + t("tax.unemploymentGuide") + '</td></tr>' +
      '<tr><td>' + t("tax.housingFund") + '</td><td>7%</td><td>' + t("tax.contributionBaseTimesRate") + '</td><td>' + t("tax.housingGuide") + '</td></tr>' +
      '</tbody></table></div>' +
      '<div class="at-doc-refs tax-subnote"><span>' + t("tax.exampleTitle") + '</span><span>' + t("tax.exampleIntro") + '</span></div>' +
      '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("tax.item") + '</th><th>' + t("tax.calculation") + '</th><th>' + t("tax.result") + '</th></tr></thead><tbody id="tax-guide-example-body"></tbody></table></div>' +
      '<div class="at-doc-refs tax-subnote"><span>' + t("tax.progressiveExample") + '</span></div>' +
      '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("tax.taxLevel") + '</th><th>' + t("tax.taxedPortion") + '</th><th>' + t("tax.rate") + '</th><th>' + t("tax.stageTax") + '</th></tr></thead><tbody id="tax-guide-stage-body"></tbody></table></div>' +
      '<div class="at-doc-refs tax-subnote"><span>' + t("tax.guideDisclaimer") + '</span></div></div>' +
      '<div id="tax-history" class="history-bar"></div></div>';

    container.querySelectorAll(".tax-num").forEach(function (input) { input.addEventListener("input", updateAll); });
    container.querySelectorAll("[data-tax-tab]").forEach(function (button) { button.addEventListener("click", function () { switchTab(this.dataset.taxTab); }); });
    byId("tax-gross").addEventListener("change", function () {
      var result = calculate();
      if (result.gross > 0) saveHistory({ gross: result.gross, averageNet: result.averageNet, ts: Date.now() });
      renderHistory();
    });
    container.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-tax-history]");
      if (!chip) return;
      var item = loadHistory()[parseInt(chip.dataset.taxHistory, 10)];
      if (!item) return;
      byId("tax-gross").value = item.gross;
      updateAll();
    });
    renderHistory();
    switchTab(activeTab);
    updateAll();
  }

  return { init: init };
})();
