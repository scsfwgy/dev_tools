// Math Curiosities — interactive number-sequence visualizer.
var MathCuriositiesTool = (function () {
  "use strict";

  var MAX_STEPS = 2000;
  var MAX_VALUE = 1e15;
  var MAX_INPUT = 999999999;
  var PAGE_SIZE = 50;

  var container = null;
  var canvas = null;
  var context = null;
  var width = 0;
  var height = 0;
  var palette = null;
  var resizeObserver = null;
  var themeObserver = null;

  var currentCuriosity = "collatz";
  var currentInput = 27;
  var sequence = [];
  var settled = false;
  var detailPage = 0;

  var CURIOSITY_DEFS = {
    collatz: {
      nameKey: "collatz",
      descKey: "collatzDesc",
      rule: "mathCuriosities.rules.collatz",
      defaultInput: 27,
      step: function (n) { return n % 2 === 0 ? n / 2 : 3 * n + 1; },
      isTerminal: function (n) { return n === 1; },
      cycle: [4, 2, 1],
      color: "#ff6b6b",
    },
    juggler: {
      nameKey: "juggler",
      descKey: "jugglerDesc",
      rule: "mathCuriosities.rules.juggler",
      defaultInput: 37,
      maxSteps: 500,
      step: function (n) { return n % 2 === 0 ? Math.floor(Math.sqrt(n)) : Math.floor(Math.pow(n, 1.5)); },
      isTerminal: function (n) { return n === 1; },
      cycle: [1],
      color: "#f06595",
    },
    happy: {
      nameKey: "happy",
      descKey: "happyDesc",
      rule: "mathCuriosities.rules.happy",
      defaultInput: 19,
      maxSteps: 200,
      step: function (n) {
        var sum = 0;
        while (n > 0) { var d = n % 10; sum += d * d; n = Math.floor(n / 10); }
        return sum;
      },
      isTerminal: function (n, seen) { return n === 1 || (seen && seen.has(n)); },
      cycle: [4, 16, 37, 58, 89, 145, 42, 20],
      color: "#74c0fc",
      hasSeen: true,
    },
    kaprekar: {
      nameKey: "kaprekar",
      descKey: "kaprekarDesc",
      rule: "mathCuriosities.rules.kaprekar",
      defaultInput: 3524,
      maxSteps: 20,
      step: function (n) {
        var s = String(n).padStart(4, "0").split("").sort();
        return parseInt(s.reverse().join(""), 10) - parseInt(s.join(""), 10);
      },
      isTerminal: function (n, seen) { return n === 6174 || (seen && seen.has(n)); },
      cycle: [6174],
      color: "#ffd43b",
      hasSeen: true,
      validate: function (n) { return n >= 1000 && n <= 9998 && !/^(\\d)\\1{3}$/.test(String(n)); },
      formatStep: function (n, i) {
        if (i === 1) return String(n).padStart(4, "0");
        var s = String(n).padStart(4, "0").split("").sort();
        var hi = s.slice().reverse().join("");
        var lo = s.join("");
        return hi + " − " + lo + " = " + n;
      },
    },
    digitalRoot: {
      nameKey: "digitalRoot",
      descKey: "digitalRootDesc",
      rule: "mathCuriosities.rules.digitalRoot",
      defaultInput: 98765,
      maxSteps: 30,
      step: function (n) {
        var sum = 0;
        while (n > 0) { sum += n % 10; n = Math.floor(n / 10); }
        return sum;
      },
      isTerminal: function (n) { return n < 10; },
      cycle: null,
      color: "#b197fc",
    },
  };

  var CURIOSITY_IDS = Object.keys(CURIOSITY_DEFS);

  function t(key) {
    return (window.__t && window.__t(key)) || key;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function formatNumber(n) {
    if (n >= 1e12) return n.toExponential(3);
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e4) return n.toLocaleString("en-US");
    return String(n);
  }

  function computeSequence(curiosityId, start) {
    var def = CURIOSITY_DEFS[curiosityId];
    var n = start;
    var seq = [n];
    var seen = def.hasSeen ? new Set() : null;
    if (seen) seen.add(n);
    var limit = def.maxSteps || MAX_STEPS;
    settled = false;
    for (var i = 0; i < limit; i++) {
      if (n > MAX_VALUE) break;
      if (def.isTerminal(n, seen)) { settled = true; break; }
      n = def.step(n);
      seq.push(n);
      if (seen) {
        if (seen.has(n)) break;
        seen.add(n);
      }
    }
    return seq;
  }

  function validateInput(curiosityId, raw) {
    var value = parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(value) || value < 1 || value > MAX_INPUT) return { valid: false, value: null };
    var def = CURIOSITY_DEFS[curiosityId];
    if (def.validate && !def.validate(value)) return { valid: false, value: null };
    return { valid: true, value: value };
  }

  function readPalette() {
    var styles = getComputedStyle(document.documentElement);
    palette = {
      background: styles.getPropertyValue("--ball-game-canvas-bg").trim() || "#10161f",
      text: styles.getPropertyValue("--text-muted").trim() || "#8b949e",
      border: styles.getPropertyValue("--border").trim() || "#30363d",
      accent: styles.getPropertyValue("--ecosystem-prey").trim() || "#38bdf8",
      heading: styles.getPropertyValue("--text-primary").trim() || "#e6edf3",
    };
  }

  function drawChart() {
    if (!context || !canvas || !palette) return;
    var w = width, h = height;
    if (!w || !h) return;

    var left = 52, right = 18, top = 18, bottom = 36;
    var pw = Math.max(1, w - left - right);
    var ph = Math.max(1, h - top - bottom);

    context.fillStyle = palette.background;
    context.fillRect(0, 0, w, h);

    var maxVal = sequence.reduce(function (m, v) { return Math.max(m, v); }, 1);
    var logMax = Math.log10(Math.max(2, maxVal));
    var useLog = maxVal > 10000;
    var toY = useLog
      ? function (v) { return Math.log10(Math.max(1, v)) / Math.max(0.01, logMax); }
      : function (v) { return v / maxVal; };
    var fromY = useLog
      ? function (frac) { return Math.pow(10, frac * logMax); }
      : function (frac) { return frac * maxVal; };

    // Grid
    var gridLines = useLog ? Math.min(6, Math.ceil(logMax)) : 5;
    context.strokeStyle = palette.border;
    context.lineWidth = 0.5;
    for (var gi = 0; gi <= gridLines; gi++) {
      var gy = Math.round(top + ph - (gi / gridLines) * ph) + 0.5;
      context.beginPath(); context.moveTo(left, gy); context.lineTo(left + pw, gy); context.stroke();
    }

    // Labels
    context.fillStyle = palette.text;
    context.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "top";
    for (var xi = 0; xi <= 5; xi++) {
      var si = Math.round((xi / 5) * (sequence.length - 1));
      context.fillText(String(si), left + (si / Math.max(1, sequence.length - 1)) * pw, top + ph + 6);
    }
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (var yi = 0; yi <= gridLines; yi++) {
      context.fillText(formatNumber(fromY(yi / gridLines)), left - 7, top + ph - (yi / gridLines) * ph);
    }
    context.textAlign = "center";
    context.fillText(useLog ? t("mathCuriosities.logScale") : t("mathCuriosities.linearScale"), left + pw / 2, h - 9);

    var def = CURIOSITY_DEFS[currentCuriosity];
    var curveColor = def.color || palette.accent;

    // Gradient fill
    var grad = context.createLinearGradient(0, top, 0, top + ph);
    grad.addColorStop(0, curveColor + "33");
    grad.addColorStop(1, curveColor + "05");
    context.fillStyle = grad;
    context.beginPath();
    sequence.forEach(function (v, i) {
      var sx = left + (i / Math.max(1, sequence.length - 1)) * pw;
      var sy = top + ph - toY(v) * ph;
      if (i === 0) context.moveTo(sx, sy); else context.lineTo(sx, sy);
    });
    context.lineTo(left + pw, top + ph);
    context.lineTo(left, top + ph);
    context.closePath();
    context.fill();

    // Line
    context.strokeStyle = curveColor;
    context.lineWidth = 2;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    sequence.forEach(function (v, i) {
      var sx = left + (i / Math.max(1, sequence.length - 1)) * pw;
      var sy = top + ph - toY(v) * ph;
      if (i === 0) context.moveTo(sx, sy); else context.lineTo(sx, sy);
    });
    context.stroke();

    // Endpoint
    var lx = left + pw;
    var ly = top + ph - toY(sequence[sequence.length - 1]) * ph;
    context.fillStyle = settled ? "#51cf66" : "#ff6b6b";
    context.beginPath(); context.arc(lx, ly, 4, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#fff";
    context.beginPath(); context.arc(lx, ly, 2, 0, Math.PI * 2); context.fill();

    // Stats line
    context.fillStyle = palette.text;
    context.textAlign = "left";
    context.textBaseline = "top";
    context.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(t("mathCuriosities.steps") + ": " + (sequence.length - 1), left, 6);
    context.fillText(t("mathCuriosities.peak") + ": " + formatNumber(maxVal), left + 100, 6);
    context.fillText(t("mathCuriosities.final") + ": " + formatNumber(sequence[sequence.length - 1]), left + 230, 6);
    context.fillText(settled ? "✓ " + t("mathCuriosities.converged") : "→ " + t("mathCuriosities.running"), left + 340, 6);
  }

  function resizeCanvas() {
    if (!canvas || !canvas.parentElement || !context) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(360, Math.round(rect.width));
    height = Math.max(260, Math.round(rect.height));
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawChart();
  }

  function renderDetailTable() {
    var tableContainer = container.querySelector("#math-curiosities-detail");
    if (!tableContainer) return;
    var totalPages = Math.ceil(sequence.length / PAGE_SIZE);
    if (detailPage >= totalPages) detailPage = Math.max(0, totalPages - 1);

    var start = detailPage * PAGE_SIZE;
    var page = sequence.slice(start, start + PAGE_SIZE);
    var def = CURIOSITY_DEFS[currentCuriosity];

    var rows = page.map(function (val, i) {
      var stepNum = start + i;
      var label = (def.formatStep ? def.formatStep(val, stepNum) : formatNumber(val));
      var highlight = (i === page.length - 1 && settled && stepNum === sequence.length - 1) ? ' class="math-curiosities-final"' : "";
      return '<tr' + highlight + '><td class="math-curiosities-step-col">' + stepNum + '</td><td>' + label + '</td></tr>';
    }).join("");

    var pager = "";
    if (totalPages > 1) {
      pager = '<div class="math-curiosities-pager">' +
        '<button id="math-curiosities-prev" type="button" ' + (detailPage === 0 ? "disabled" : "") + '>' + t("mathCuriosities.prev") + '</button>' +
        '<span>' + t("mathCuriosities.page").replace("{0}", detailPage + 1).replace("{1}", totalPages) + '</span>' +
        '<button id="math-curiosities-next" type="button" ' + (detailPage >= totalPages - 1 ? "disabled" : "") + '>' + t("mathCuriosities.next") + '</button>' +
        '</div>';
    }

    tableContainer.innerHTML =
      '<h3>' + t("mathCuriosities.detailTitle") + ' <span class="math-curiosities-detail-count">(' + sequence.length + ' ' + t("mathCuriosities.entries") + ')</span></h3>' +
      '<div class="math-curiosities-table-wrap"><table class="math-curiosities-table">' +
      '<thead><tr><th class="math-curiosities-step-col">' + t("mathCuriosities.step") + '</th><th>' + t("mathCuriosities.value") + '</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' + pager;

    if (totalPages > 1) {
      container.querySelector("#math-curiosities-prev").addEventListener("click", function () {
        if (detailPage > 0) { detailPage--; renderDetailTable(); }
      });
      container.querySelector("#math-curiosities-next").addEventListener("click", function () {
        if (detailPage < totalPages - 1) { detailPage++; renderDetailTable(); }
      });
    }
  }

  function run() {
    var input = container.querySelector("#math-curiosities-input");
    var raw = input.value;
    var validation = validateInput(currentCuriosity, raw);
    var errorEl = container.querySelector("#math-curiosities-error");
    if (!validation.valid) {
      errorEl.classList.remove("hidden");
      errorEl.textContent = t("mathCuriosities.invalidInput");
      return;
    }
    errorEl.classList.add("hidden");
    currentInput = validation.value;
    sequence = computeSequence(currentCuriosity, currentInput);
    detailPage = 0;
    updateDesc();
    drawChart();
    renderDetailTable();
  }

  function updateDesc() {
    if (!container) return;
    var def = CURIOSITY_DEFS[currentCuriosity];
    container.querySelector("#math-curiosities-desc").textContent = t("mathCuriosities.descriptions." + def.descKey);
    container.querySelector("#math-curiosities-rule").textContent = t(def.rule);
    container.querySelector("#math-curiosities-input").value = String(currentInput);
  }

  function switchCuriosity(curiosityId) {
    currentCuriosity = curiosityId;
    var def = CURIOSITY_DEFS[curiosityId];
    currentInput = def.defaultInput;
    container.querySelector("#math-curiosities-select").value = curiosityId;
    updateDesc();
    run();
  }

  function bindEvents() {
    container.querySelector("#math-curiosities-select").addEventListener("change", function () {
      switchCuriosity(this.value);
    });
    container.querySelector("#math-curiosities-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") run();
    });
    container.querySelector("#math-curiosities-run").addEventListener("click", run);

    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement);
    themeObserver = new MutationObserver(function () { readPalette(); drawChart(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function init(element) {
    deactivate();
    container = element;
    container.innerHTML =
      '<div class="ball-game-tool math-curiosities-tool">' +
        '<div class="ball-game-layout">' +
          '<aside class="ball-game-config">' +
            '<h3>' + t("mathCuriosities.curiosityLabel") + '</h3>' +
            '<select id="math-curiosities-select" class="math-curiosities-select">' +
              CURIOSITY_IDS.map(function (cid) {
                return '<option value="' + cid + '"' + (cid === "collatz" ? " selected" : "") + '>' + t("mathCuriosities.names." + CURIOSITY_DEFS[cid].nameKey) + '</option>';
              }).join("") +
            '</select>' +
            '<p id="math-curiosities-desc" class="math-curiosities-desc">' + t("mathCuriosities.descriptions.collatzDesc") + '</p>' +
            '<details class="math-curiosities-rule-details">' +
              '<summary>' + t("mathCuriosities.ruleTitle") + '</summary>' +
              '<code id="math-curiosities-rule" class="math-curiosities-rule">' + t("mathCuriosities.rules.collatz") + '</code>' +
            '</details>' +
            '<label class="ball-game-control" for="math-curiosities-input">' +
              '<span><b>' + t("mathCuriosities.startingNumber") + '</b></span>' +
              '<input id="math-curiosities-input" type="number" min="1" max="' + MAX_INPUT + '" value="27" inputmode="numeric" aria-describedby="math-curiosities-error">' +
            '</label>' +
            '<div class="ball-game-actions"><button id="math-curiosities-run" class="ball-game-primary" type="button" style="grid-column:1/-1">' + t("mathCuriosities.run") + '</button></div>' +
            '<p id="math-curiosities-error" class="ball-game-config-error hidden" role="alert"></p>' +
          '</aside>' +
          '<main class="ball-game-stage-card math-curiosities-stage">' +
            '<div class="ball-game-canvas-shell">' +
              '<canvas id="math-curiosities-canvas" class="ball-game-canvas" role="img" aria-label="' + t("mathCuriosities.canvasLabel") + '"></canvas>' +
            '</div>' +
            '<div id="math-curiosities-detail" class="math-curiosities-detail"></div>' +
          '</main>' +
        '</div>' +
      '</div>';

    canvas = container.querySelector("#math-curiosities-canvas");
    context = canvas.getContext("2d");
    readPalette();
    bindEvents();
    resizeCanvas();
    run();
  }

  function deactivate() {
    if (resizeObserver) resizeObserver.disconnect();
    if (themeObserver) themeObserver.disconnect();
    resizeObserver = null;
    themeObserver = null;
    canvas = null;
    context = null;
    container = null;
    sequence = [];
    palette = null;
  }

  return {
    init: init,
    deactivate: deactivate,
    _test: {
      computeSequence: computeSequence,
      validateInput: validateInput,
      CURIOSITY_DEFS: CURIOSITY_DEFS,
    },
  };
})();
