// Function Plotter — safe local expression parsing and animated Canvas rendering.
var FunctionTool = (function () {
  var SAMPLE_COUNT = 801;
  var MAX_EXPRESSION_LENGTH = 200;
  var DEFAULT_EXPRESSION = "y = x^2";
  var root = null;
  var canvas = null;
  var context = null;
  var resizeObserver = null;
  var themeObserver = null;
  var debounceTimer = null;
  var animationFrame = null;
  var points = [];
  var bounds = null;
  var dataBounds = null;
  var plotMode = "cartesian";
  var parametricViewDirty = false;
  var lastProgress = 1;
  var hoverIndex = -1;
  var dragState = null;
  var keydownHandler = null;

  var FUNCTIONS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sqrt: Math.sqrt,
    abs: Math.abs,
    exp: Math.exp,
    ln: Math.log,
    log: Math.log10 || function (value) { return Math.log(value) / Math.LN10; },
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round
  };

  function t(key, replacements) {
    var value = (window.__t && window.__t(key)) || key;
    if (replacements) {
      Object.keys(replacements).forEach(function (name) {
        value = value.replace(new RegExp("\\{" + name + "\\}", "g"), replacements[name]);
      });
    }
    return value;
  }

  function normalizeSymbols(raw) {
    var expression = String(raw || "").trim().toLowerCase();
    if (!expression) throw new Error(t("functionTool.errors.empty"));
    if (expression.length > MAX_EXPRESSION_LENGTH) throw new Error(t("functionTool.errors.tooLong"));
    return expression
      .replace(/[−–—]/g, "-")
      .replace(/[×·]/g, "*")
      .replace(/÷/g, "/")
      .replace(/π/g, "pi")
      .replace(/²/g, "^2")
      .replace(/³/g, "^3");
  }

  function normalizeExpression(raw) {
    var expression = normalizeSymbols(raw);
    expression = expression.replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*/, "");
    return expression;
  }

  function tokenize(raw) {
    var source = normalizeExpression(raw);
    var tokens = [];
    var index = 0;
    while (index < source.length) {
      var char = source[index];
      if (/\s/.test(char)) {
        index += 1;
        continue;
      }
      var numberMatch = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/);
      if (numberMatch) {
        tokens.push({ type: "number", value: Number(numberMatch[0]) });
        index += numberMatch[0].length;
        continue;
      }
      var nameMatch = source.slice(index).match(/^[a-z]+/);
      if (nameMatch) {
        tokens.push({ type: "name", value: nameMatch[0] });
        index += nameMatch[0].length;
        continue;
      }
      var comparison = source.slice(index, index + 2);
      if (["<=", ">=", "==", "!="].indexOf(comparison) !== -1) {
        tokens.push({ type: "op", value: comparison });
        index += 2;
        continue;
      }
      if ("+-*/^(),<>?:".indexOf(char) !== -1) {
        tokens.push({ type: char === "(" || char === ")" ? "paren" : "op", value: char });
        index += 1;
        continue;
      }
      throw new Error(t("functionTool.errors.invalidCharacter", { char: char }));
    }
    tokens.push({ type: "eof", value: "" });
    return tokens;
  }

  function compileExpression(raw) {
    var tokens = tokenize(raw);
    var position = 0;

    function binaryNode(operator, left, right) {
      if (operator === "+") return function (x) { return left(x) + right(x); };
      if (operator === "-") return function (x) { return left(x) - right(x); };
      if (operator === "*") return function (x) { return left(x) * right(x); };
      if (operator === "/") return function (x) { return left(x) / right(x); };
      return function (x) { return Math.pow(left(x), right(x)); };
    }

    function conditionalNode(condition, whenTrue, whenFalse) {
      return function (x) {
        return condition(x) !== 0 ? whenTrue(x) : whenFalse(x);
      };
    }

    function peek() {
      return tokens[position];
    }

    function take(value) {
      if (peek().value === value) {
        position += 1;
        return true;
      }
      return false;
    }

    function parsePrimary() {
      var token = peek();
      if (token.type === "number") {
        position += 1;
        return function () { return token.value; };
      }
      if (token.type === "name") {
        position += 1;
        if (token.value === "x" || token.value === "t") return function (x) { return x; };
        if (token.value === "pi") return function () { return Math.PI; };
        if (token.value === "e") return function () { return Math.E; };
        if (token.value === "if") {
          if (!take("(")) throw new Error(t("functionTool.errors.functionParentheses", { name: token.value }));
          var condition = parseConditional();
          if (take(",")) {
            var functionWhenTrue = parseConditional();
            if (!take(",")) throw new Error(t("functionTool.errors.conditionalComma"));
            var functionWhenFalse = parseConditional();
            if (!take(")")) throw new Error(t("functionTool.errors.missingParen"));
            return conditionalNode(condition, functionWhenTrue, functionWhenFalse);
          }
          if (!take(")")) throw new Error(t("functionTool.errors.missingParen"));
          var readableWhenTrue = parseConditional();
          if (!take("else")) throw new Error(t("functionTool.errors.conditionalElse"));
          var readableWhenFalse = parseConditional();
          return conditionalNode(condition, readableWhenTrue, readableWhenFalse);
        }
        var fn = FUNCTIONS[token.value];
        if (!fn) throw new Error(t("functionTool.errors.unknownName", { name: token.value }));
        if (!take("(")) throw new Error(t("functionTool.errors.functionParentheses", { name: token.value }));
        var argument = parseConditional();
        if (!take(")")) throw new Error(t("functionTool.errors.missingParen"));
        return function (x) { return fn(argument(x)); };
      }
      if (take("(")) {
        var nested = parseConditional();
        if (!take(")")) throw new Error(t("functionTool.errors.missingParen"));
        return nested;
      }
      throw new Error(t("functionTool.errors.unexpected"));
    }

    function parsePower() {
      var left = parsePrimary();
      if (take("^")) {
        var right = parseUnary();
        return binaryNode("^", left, right);
      }
      return left;
    }

    function parseUnary() {
      if (take("+")) return parseUnary();
      if (take("-")) {
        var operand = parseUnary();
        return function (x) { return -operand(x); };
      }
      return parsePower();
    }

    function startsImplicitFactor(token) {
      return token.type === "number" || (token.type === "name" && token.value !== "else") || token.value === "(";
    }

    function parseMultiply() {
      var left = parseUnary();
      while (peek().value === "*" || peek().value === "/" || startsImplicitFactor(peek())) {
        var operator = "*";
        if (peek().value === "*" || peek().value === "/") {
          operator = peek().value;
          position += 1;
        }
        var right = parseUnary();
        left = binaryNode(operator, left, right);
      }
      return left;
    }

    function parseAdd() {
      var left = parseMultiply();
      while (peek().value === "+" || peek().value === "-") {
        var operator = peek().value;
        position += 1;
        var right = parseMultiply();
        left = binaryNode(operator, left, right);
      }
      return left;
    }

    function parseComparison() {
      var left = parseAdd();
      var operator = peek().value;
      if (["<", "<=", ">", ">=", "==", "!="].indexOf(operator) === -1) return left;
      position += 1;
      var right = parseAdd();
      return function (x) {
        var leftValue = left(x);
        var rightValue = right(x);
        if (operator === "<") return leftValue < rightValue ? 1 : 0;
        if (operator === "<=") return leftValue <= rightValue ? 1 : 0;
        if (operator === ">") return leftValue > rightValue ? 1 : 0;
        if (operator === ">=") return leftValue >= rightValue ? 1 : 0;
        if (operator === "==") return leftValue === rightValue ? 1 : 0;
        return leftValue !== rightValue ? 1 : 0;
      };
    }

    function parseConditional() {
      var condition = parseComparison();
      if (!take("?")) return condition;
      var whenTrue = parseConditional();
      if (!take(":")) throw new Error(t("functionTool.errors.conditionalColon"));
      var whenFalse = parseConditional();
      return conditionalNode(condition, whenTrue, whenFalse);
    }

    var evaluate = parseConditional();
    if (peek().type !== "eof") throw new Error(t("functionTool.errors.unexpected"));
    return {
      normalized: normalizeExpression(raw),
      evaluate: function (x) {
        var value = evaluate(x);
        return Number.isFinite(value) ? value : null;
      }
    };
  }

  function splitTopLevel(source, delimiter) {
    var parts = [];
    var start = 0;
    var depth = 0;
    for (var index = 0; index < source.length; index += 1) {
      if (source[index] === "(") depth += 1;
      else if (source[index] === ")") depth -= 1;
      else if (source[index] === delimiter && depth === 0) {
        parts.push(source.slice(start, index).trim());
        start = index + 1;
      }
    }
    parts.push(source.slice(start).trim());
    return parts;
  }

  function compilePlotExpression(raw) {
    var source = normalizeSymbols(raw);
    var parts = splitTopLevel(source, ";");
    if (parts.length === 1) {
      var lines = source.split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
      if (lines.length === 2 && lines.every(function (line) { return /^[xy]\s*=/.test(line); })) parts = lines;
    }
    if (parts.length === 1) {
      return { mode: "cartesian", y: compileExpression(source) };
    }
    if (parts.length !== 2) throw new Error(t("functionTool.errors.parametric"));
    var xSource = null;
    var ySource = null;
    parts.forEach(function (part) {
      var match = part.match(/^\s*([xy])\s*=\s*(.+)$/);
      if (!match) throw new Error(t("functionTool.errors.parametric"));
      if (match[1] === "x") xSource = match[2];
      else ySource = match[2];
    });
    if (!xSource || !ySource) throw new Error(t("functionTool.errors.parametric"));
    return {
      mode: "parametric",
      x: compileExpression(xSource),
      y: compileExpression(ySource)
    };
  }

  function readNumber(id, fallback) {
    var input = root && root.querySelector("#" + id);
    var value = input ? Number(input.value) : NaN;
    return Number.isFinite(value) ? value : fallback;
  }

  function getSettings() {
    return {
      xMin: readNumber("fn-x-min", -10),
      xMax: readNumber("fn-x-max", 10),
      duration: Math.max(0, Math.min(5000, readNumber("fn-duration", 1200))),
      lineWidth: Math.max(1, Math.min(8, readNumber("fn-line-width", 3))),
      color: (root.querySelector("#fn-color") || {}).value || "#2f81f7",
      showGrid: !!(root.querySelector("#fn-grid") || {}).checked
    };
  }

  function sampleFunction(compiled, xMin, xMax) {
    var sampled = [];
    for (var index = 0; index < SAMPLE_COUNT; index += 1) {
      var x = xMin + (xMax - xMin) * index / (SAMPLE_COUNT - 1);
      var y;
      try {
        y = compiled.evaluate(x);
      } catch (_) {
        y = null;
      }
      if (y !== null && (!Number.isFinite(y) || Math.abs(y) > 1e12)) y = null;
      sampled.push({ x: x, y: y });
    }
    return sampled;
  }

  function sampleParametric(compiled, tMin, tMax) {
    var sampled = [];
    for (var index = 0; index < SAMPLE_COUNT; index += 1) {
      var parameter = tMin + (tMax - tMin) * index / (SAMPLE_COUNT - 1);
      var x;
      var y;
      try {
        x = compiled.x.evaluate(parameter);
        y = compiled.y.evaluate(parameter);
      } catch (_) {
        x = null;
        y = null;
      }
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e12 || Math.abs(y) > 1e12) {
        x = null;
        y = null;
      }
      sampled.push({ x: x, y: y, parameter: parameter });
    }
    return sampled;
  }

  function quantile(sorted, ratio) {
    if (!sorted.length) return 0;
    var position = (sorted.length - 1) * ratio;
    var lower = Math.floor(position);
    var upper = Math.ceil(position);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  }

  function calculateBounds(sampled, xMin, xMax) {
    var values = sampled
      .filter(function (point) { return point.y !== null; })
      .map(function (point) { return point.y; })
      .sort(function (a, b) { return a - b; });
    if (!values.length) throw new Error(t("functionTool.errors.noValues"));
    var yMin = values.length > 80 ? quantile(values, 0.01) : values[0];
    var yMax = values.length > 80 ? quantile(values, 0.99) : values[values.length - 1];
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) throw new Error(t("functionTool.errors.noValues"));
    if (Math.abs(yMax - yMin) < 1e-9) {
      var constantPadding = Math.max(1, Math.abs(yMax) * 0.2);
      yMin -= constantPadding;
      yMax += constantPadding;
    } else {
      var padding = (yMax - yMin) * 0.1;
      yMin -= padding;
      yMax += padding;
    }
    if (yMin > 0 && yMin < (yMax - yMin) * 0.35) yMin = 0;
    if (yMax < 0 && Math.abs(yMax) < (yMax - yMin) * 0.35) yMax = 0;
    return { xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax };
  }

  function paddedBounds(min, max) {
    if (Math.abs(max - min) < 1e-9) {
      var constantPadding = Math.max(1, Math.abs(max) * 0.2);
      return { min: min - constantPadding, max: max + constantPadding };
    }
    var padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding };
  }

  function calculateParametricBounds(sampled) {
    var valid = sampled.filter(function (point) { return point.x !== null && point.y !== null; });
    if (!valid.length) throw new Error(t("functionTool.errors.noValues"));
    var xValues = valid.map(function (point) { return point.x; });
    var yValues = valid.map(function (point) { return point.y; });
    var xRange = paddedBounds(Math.min.apply(null, xValues), Math.max.apply(null, xValues));
    var yRange = paddedBounds(Math.min.apply(null, yValues), Math.max.apply(null, yValues));
    return { xMin: xRange.min, xMax: xRange.max, yMin: yRange.min, yMax: yRange.max };
  }

  function fitBoundsToCanvas(sourceBounds, metrics) {
    var fitted = {
      xMin: sourceBounds.xMin,
      xMax: sourceBounds.xMax,
      yMin: sourceBounds.yMin,
      yMax: sourceBounds.yMax
    };
    var plotWidth = metrics.width - metrics.left - metrics.right;
    var plotHeight = metrics.height - metrics.top - metrics.bottom;
    var targetAspect = plotWidth / plotHeight;
    var xSpan = fitted.xMax - fitted.xMin;
    var ySpan = fitted.yMax - fitted.yMin;
    var centerX = (fitted.xMin + fitted.xMax) / 2;
    var centerY = (fitted.yMin + fitted.yMax) / 2;
    if (xSpan / ySpan < targetAspect) xSpan = ySpan * targetAspect;
    else ySpan = xSpan / targetAspect;
    fitted.xMin = centerX - xSpan / 2;
    fitted.xMax = centerX + xSpan / 2;
    fitted.yMin = centerY - ySpan / 2;
    fitted.yMax = centerY + ySpan / 2;
    return fitted;
  }

  function themeColors() {
    var styles = getComputedStyle(document.documentElement);
    return {
      background: styles.getPropertyValue("--bg-card").trim() || "#0d1117",
      text: styles.getPropertyValue("--text-secondary").trim() || "#8b949e",
      muted: styles.getPropertyValue("--text-muted").trim() || "#6e7681",
      border: styles.getPropertyValue("--border").trim() || "#30363d",
      accent: styles.getPropertyValue("--accent").trim() || "#2f81f7"
    };
  }

  function niceStep(range, targetTicks) {
    var rough = Math.abs(range) / Math.max(2, targetTicks);
    var exponent = Math.floor(Math.log10(rough || 1));
    var fraction = rough / Math.pow(10, exponent);
    var niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return niceFraction * Math.pow(10, exponent);
  }

  function formatTick(value, step) {
    if (Math.abs(value) < step * 0.001) return "0";
    if (Math.abs(value) >= 100000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) {
      return value.toExponential(1);
    }
    var decimals = Math.max(0, Math.min(5, -Math.floor(Math.log10(Math.abs(step || 1)))));
    var formatted = value.toFixed(decimals);
    return decimals > 0 ? formatted.replace(/\.?0+$/, "") : formatted;
  }

  function canvasMetrics() {
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(320, rect.width || 700);
    var height = Math.max(340, rect.height || 500);
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    var pixelWidth = Math.round(width * ratio);
    var pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return {
      width: width,
      height: height,
      left: width < 520 ? 50 : 64,
      right: 22,
      top: 24,
      bottom: 46
    };
  }

  function mapPoint(point, metrics) {
    var plotWidth = metrics.width - metrics.left - metrics.right;
    var plotHeight = metrics.height - metrics.top - metrics.bottom;
    return {
      x: metrics.left + (point.x - bounds.xMin) / (bounds.xMax - bounds.xMin) * plotWidth,
      y: metrics.top + (bounds.yMax - point.y) / (bounds.yMax - bounds.yMin) * plotHeight
    };
  }

  function drawAxisArrowheads(metrics, colors, axisX, axisY) {
    var plotRight = metrics.width - metrics.right;
    var arrowSize = 7;
    context.save();
    context.fillStyle = colors.text;
    context.globalAlpha = 0.9;
    context.beginPath();
    context.moveTo(plotRight, axisY);
    context.lineTo(plotRight - arrowSize, axisY - 4);
    context.lineTo(plotRight - arrowSize, axisY + 4);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(axisX, metrics.top);
    context.lineTo(axisX - 4, metrics.top + arrowSize);
    context.lineTo(axisX + 4, metrics.top + arrowSize);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawGrid(metrics, colors, settings) {
    var plotRight = metrics.width - metrics.right;
    var plotBottom = metrics.height - metrics.bottom;
    var xStep = niceStep(bounds.xMax - bounds.xMin, metrics.width < 520 ? 5 : 8);
    var yStep = niceStep(bounds.yMax - bounds.yMin, 6);
    context.lineWidth = 1;
    context.font = '11px "SF Mono", "Cascadia Code", monospace';
    context.textAlign = "center";
    context.textBaseline = "top";
    var startX = Math.ceil(bounds.xMin / xStep) * xStep;
    for (var xValue = startX; xValue <= bounds.xMax + xStep * 0.001; xValue += xStep) {
      var xPixel = mapPoint({ x: xValue, y: bounds.yMin }, metrics).x;
      if (settings.showGrid) {
        context.strokeStyle = colors.border;
        context.globalAlpha = 0.55;
        context.beginPath();
        context.moveTo(xPixel, metrics.top);
        context.lineTo(xPixel, plotBottom);
        context.stroke();
      }
      context.globalAlpha = 1;
      context.fillStyle = colors.muted;
      context.fillText(formatTick(xValue, xStep), xPixel, plotBottom + 12);
    }

    context.textAlign = "right";
    context.textBaseline = "middle";
    var startY = Math.ceil(bounds.yMin / yStep) * yStep;
    for (var yValue = startY; yValue <= bounds.yMax + yStep * 0.001; yValue += yStep) {
      var yPixel = mapPoint({ x: bounds.xMin, y: yValue }, metrics).y;
      if (settings.showGrid) {
        context.strokeStyle = colors.border;
        context.globalAlpha = 0.55;
        context.beginPath();
        context.moveTo(metrics.left, yPixel);
        context.lineTo(plotRight, yPixel);
        context.stroke();
      }
      context.globalAlpha = 1;
      context.fillStyle = colors.muted;
      context.fillText(formatTick(yValue, yStep), metrics.left - 9, yPixel);
    }

    context.strokeStyle = colors.text;
    context.globalAlpha = 0.8;
    context.lineWidth = 1.25;
    var axisX = bounds.xMin <= 0 && bounds.xMax >= 0
      ? mapPoint({ x: 0, y: bounds.yMin }, metrics).x
      : metrics.left;
    var axisY = bounds.yMin <= 0 && bounds.yMax >= 0
      ? mapPoint({ x: bounds.xMin, y: 0 }, metrics).y
      : plotBottom;
    context.beginPath();
    context.moveTo(axisX, metrics.top);
    context.lineTo(axisX, plotBottom);
    context.moveTo(metrics.left, axisY);
    context.lineTo(plotRight, axisY);
    context.stroke();
    drawAxisArrowheads(metrics, colors, axisX, axisY);
    context.globalAlpha = 1;
    context.fillStyle = colors.text;
    context.font = '600 12px "SF Mono", "Cascadia Code", monospace';
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.fillText("x", plotRight - 10, axisY - 6);
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText("y", axisX + 7, metrics.top + 9);
  }

  function shouldBreak(previous, current, metrics) {
    if (!previous || previous.y === null || current.y === null) return true;
    var previousPixel = mapPoint(previous, metrics);
    var currentPixel = mapPoint(current, metrics);
    return Math.abs(currentPixel.y - previousPixel.y) > (metrics.height - metrics.top - metrics.bottom) * 1.35;
  }

  function drawCurve(metrics, settings, progress) {
    var visibleCount = Math.max(1, Math.ceil(points.length * Math.max(0, Math.min(1, progress))));
    context.save();
    context.beginPath();
    context.rect(
      metrics.left,
      metrics.top,
      metrics.width - metrics.left - metrics.right,
      metrics.height - metrics.top - metrics.bottom
    );
    context.clip();
    context.strokeStyle = settings.color;
    context.lineWidth = settings.lineWidth;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    var hasPath = false;
    for (var index = 0; index < visibleCount; index += 1) {
      var point = points[index];
      if (point.y === null) {
        hasPath = false;
        continue;
      }
      var pixel = mapPoint(point, metrics);
      if (!hasPath || shouldBreak(points[index - 1], point, metrics)) {
        context.moveTo(pixel.x, pixel.y);
        hasPath = true;
      } else {
        context.lineTo(pixel.x, pixel.y);
      }
    }
    context.stroke();
    if (progress < 1 && visibleCount > 0) {
      var head = points[Math.min(visibleCount - 1, points.length - 1)];
      if (head && head.y !== null) {
        var headPixel = mapPoint(head, metrics);
        context.fillStyle = settings.color;
        context.beginPath();
        context.arc(headPixel.x, headPixel.y, Math.max(3, settings.lineWidth + 1), 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  function drawHover(metrics, colors, settings) {
    if (hoverIndex < 0 || hoverIndex >= points.length || lastProgress < 1) return;
    var point = points[hoverIndex];
    if (!point || point.y === null) return;
    var pixel = mapPoint(point, metrics);
    var plotBottom = metrics.height - metrics.bottom;
    context.save();
    context.strokeStyle = colors.muted;
    context.globalAlpha = 0.7;
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(pixel.x, metrics.top);
    context.lineTo(pixel.x, plotBottom);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
    context.fillStyle = settings.color;
    context.beginPath();
    context.arc(pixel.x, pixel.y, 4, 0, Math.PI * 2);
    context.fill();

    var label = "x: " + formatNumber(point.x) + "   y: " + formatNumber(point.y);
    if (plotMode === "parametric" && Number.isFinite(point.parameter)) {
      label = "t: " + formatNumber(point.parameter) + "   " + label;
    }
    context.font = '600 12px "SF Mono", "Cascadia Code", monospace';
    var labelWidth = context.measureText(label).width + 18;
    var labelX = Math.min(metrics.width - metrics.right - labelWidth, Math.max(metrics.left, pixel.x + 10));
    var labelY = Math.max(metrics.top + 4, pixel.y - 34);
    context.fillStyle = colors.background;
    context.strokeStyle = colors.border;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(labelX, labelY, labelWidth, 28, 6);
    context.fill();
    context.stroke();
    context.fillStyle = colors.text;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(label, labelX + 9, labelY + 14);
    context.restore();
  }

  function render(progress) {
    if (!canvas || !context || !bounds || !points.length) return;
    lastProgress = progress;
    var metrics = canvasMetrics();
    if (plotMode === "parametric" && dataBounds && !parametricViewDirty) {
      bounds = fitBoundsToCanvas(dataBounds, metrics);
    }
    var colors = themeColors();
    var settings = getSettings();
    context.clearRect(0, 0, metrics.width, metrics.height);
    context.fillStyle = colors.background;
    context.fillRect(0, 0, metrics.width, metrics.height);
    drawGrid(metrics, colors, settings);
    drawCurve(metrics, settings, progress);
    drawHover(metrics, colors, settings);
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "—";
    if (Math.abs(value) >= 1000000 || (Math.abs(value) > 0 && Math.abs(value) < 0.0001)) return value.toExponential(4);
    return Number(value.toPrecision(7)).toString();
  }

  function setStatus(message, isError) {
    var status = root && root.querySelector("#fn-status");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", !!isError);
  }

  function cancelAnimation() {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  function isFullscreen() {
    var preview = root && root.querySelector(".fn-preview");
    return !!(preview && preview.classList.contains("is-fullscreen"));
  }

  function updateFullscreenButtons() {
    if (!root) return;
    var active = isFullscreen();
    var enterButton = root.querySelector("#fn-fullscreen");
    var fullscreenActions = root.querySelector(".fn-fullscreen-toolbar");
    if (enterButton) enterButton.setAttribute("aria-expanded", active ? "true" : "false");
    if (fullscreenActions) fullscreenActions.setAttribute("aria-hidden", active ? "false" : "true");
  }

  function enterFullscreen() {
    if (!root || isFullscreen()) return;
    root.querySelector(".fn-preview").classList.add("is-fullscreen");
    document.body.classList.add("fn-fullscreen-active");
    updateFullscreenButtons();
    requestAnimationFrame(function () { render(lastProgress); });
  }

  function exitFullscreen() {
    if (!root || !isFullscreen()) return;
    root.querySelector(".fn-preview").classList.remove("is-fullscreen");
    document.body.classList.remove("fn-fullscreen-active");
    updateFullscreenButtons();
    requestAnimationFrame(function () { render(lastProgress); });
  }

  function playAnimation() {
    cancelAnimation();
    hoverIndex = -1;
    var settings = getSettings();
    var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (settings.duration <= 0 || reducedMotion) {
      render(1);
      if (reducedMotion) setStatus(t("functionTool.reducedMotion"), false);
      return;
    }
    var startTime = performance.now();
    function frame(now) {
      var rawProgress = Math.min(1, (now - startTime) / settings.duration);
      var eased = 1 - Math.pow(1 - rawProgress, 3);
      render(eased);
      if (rawProgress < 1) {
        animationFrame = requestAnimationFrame(frame);
      } else {
        animationFrame = null;
        render(1);
      }
    }
    render(0);
    animationFrame = requestAnimationFrame(frame);
  }

  function updateRangeLabels() {
    if (!root) return;
    var minLabel = root.querySelector("#fn-range-min-label");
    var maxLabel = root.querySelector("#fn-range-max-label");
    if (minLabel) minLabel.textContent = t(plotMode === "parametric" ? "functionTool.parameterMin" : "functionTool.xMin");
    if (maxLabel) maxLabel.textContent = t(plotMode === "parametric" ? "functionTool.parameterMax" : "functionTool.xMax");
  }

  function plot(animate) {
    if (!root) return;
    cancelAnimation();
    var input = root.querySelector("#fn-expression");
    var settings = getSettings();
    try {
      if (!(settings.xMin < settings.xMax)) throw new Error(t("functionTool.errors.range"));
      var compiled = compilePlotExpression(input.value);
      plotMode = compiled.mode;
      updateRangeLabels();
      if (plotMode === "parametric") {
        points = sampleParametric(compiled, settings.xMin, settings.xMax);
        dataBounds = calculateParametricBounds(points);
        parametricViewDirty = false;
        bounds = fitBoundsToCanvas(dataBounds, canvasMetrics());
      } else {
        points = sampleFunction(compiled.y, settings.xMin, settings.xMax);
        dataBounds = null;
        parametricViewDirty = false;
        bounds = calculateBounds(points, settings.xMin, settings.xMax);
      }
      var validCount = points.filter(function (point) { return point.y !== null; }).length;
      canvas.setAttribute("aria-label", plotMode === "parametric"
        ? t("functionTool.parametricChartAria", { expression: input.value.trim() })
        : t("functionTool.chartAria", {
          expression: input.value.trim(),
          min: formatNumber(bounds.xMin),
          max: formatNumber(bounds.xMax)
        }));
      root.querySelector("#fn-current-expression").textContent = input.value.trim();
      setStatus(t("functionTool.ready", { count: validCount }), false);
      if (animate) playAnimation();
      else render(1);
    } catch (error) {
      points = [];
      bounds = null;
      dataBounds = null;
      plotMode = "cartesian";
      parametricViewDirty = false;
      updateRangeLabels();
      hoverIndex = -1;
      setStatus(error.message || t("functionTool.errors.invalid"), true);
      clearCanvasMessage(t("functionTool.emptyChart"));
    }
  }

  function clearCanvasMessage(message) {
    if (!canvas || !context) return;
    var metrics = canvasMetrics();
    var colors = themeColors();
    context.clearRect(0, 0, metrics.width, metrics.height);
    context.fillStyle = colors.background;
    context.fillRect(0, 0, metrics.width, metrics.height);
    context.fillStyle = colors.muted;
    context.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(message, metrics.width / 2, metrics.height / 2);
  }

  function schedulePlot() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { plot(true); }, 300);
  }

  function resetView() {
    if (plotMode === "parametric" && dataBounds) {
      parametricViewDirty = false;
      bounds = fitBoundsToCanvas(dataBounds, canvasMetrics());
      playAnimation();
      return;
    }
    root.querySelector("#fn-x-min").value = "-10";
    root.querySelector("#fn-x-max").value = "10";
    plot(true);
  }

  function handlePointerMove(event) {
    if (!bounds || !points.length || lastProgress < 1 || dragState) return;
    var rect = canvas.getBoundingClientRect();
    var metrics = canvasMetrics();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    var plotWidth = metrics.width - metrics.left - metrics.right;
    if (x < metrics.left || x > metrics.width - metrics.right || y < metrics.top || y > metrics.height - metrics.bottom) {
      hoverIndex = -1;
    } else if (plotMode === "parametric") {
      var closestIndex = -1;
      var closestDistance = Infinity;
      points.forEach(function (point, index) {
        if (point.x === null || point.y === null) return;
        var pixel = mapPoint(point, metrics);
        var distance = Math.pow(pixel.x - x, 2) + Math.pow(pixel.y - y, 2);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      hoverIndex = closestDistance <= 900 ? closestIndex : -1;
    } else {
      hoverIndex = Math.max(0, Math.min(points.length - 1, Math.round((x - metrics.left) / plotWidth * (points.length - 1))));
    }
    render(1);
  }

  function handleWheel(event) {
    if (!bounds || !points.length) return;
    event.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var metrics = canvasMetrics();
    var plotWidth = metrics.width - metrics.left - metrics.right;
    var ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - metrics.left) / plotWidth));
    var scale = event.deltaY > 0 ? 1.18 : 0.84;
    if (plotMode === "parametric") {
      var plotHeight = metrics.height - metrics.top - metrics.bottom;
      var yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top - metrics.top) / plotHeight));
      var xSpan = bounds.xMax - bounds.xMin;
      var ySpan = bounds.yMax - bounds.yMin;
      var nextXSpan = Math.max(0.0001, Math.min(1e9, xSpan * scale));
      var nextYSpan = Math.max(0.0001, Math.min(1e9, ySpan * scale));
      var centerX = bounds.xMin + xSpan * ratio;
      var centerY = bounds.yMax - ySpan * yRatio;
      bounds = {
        xMin: centerX - nextXSpan * ratio,
        xMax: centerX + nextXSpan * (1 - ratio),
        yMin: centerY - nextYSpan * (1 - yRatio),
        yMax: centerY + nextYSpan * yRatio
      };
      parametricViewDirty = true;
      hoverIndex = -1;
      render(1);
      return;
    }
    var settings = getSettings();
    var span = settings.xMax - settings.xMin;
    var nextSpan = Math.max(0.0001, Math.min(1e9, span * scale));
    var center = settings.xMin + span * ratio;
    var nextMin = center - nextSpan * ratio;
    var nextMax = nextMin + nextSpan;
    root.querySelector("#fn-x-min").value = Number(nextMin.toPrecision(8));
    root.querySelector("#fn-x-max").value = Number(nextMax.toPrecision(8));
    plot(false);
  }

  function handlePointerDown(event) {
    if (!bounds || !points.length || event.button !== 0) return;
    dragState = plotMode === "parametric" ? {
      mode: "parametric",
      startX: event.clientX,
      startY: event.clientY,
      bounds: { xMin: bounds.xMin, xMax: bounds.xMax, yMin: bounds.yMin, yMax: bounds.yMax }
    } : {
      mode: "cartesian",
      startX: event.clientX,
      xMin: getSettings().xMin,
      xMax: getSettings().xMax
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
  }

  function handlePointerDrag(event) {
    if (!dragState) return;
    var metrics = canvasMetrics();
    var plotWidth = metrics.width - metrics.left - metrics.right;
    if (dragState.mode === "parametric") {
      var plotHeight = metrics.height - metrics.top - metrics.bottom;
      var xSpan = dragState.bounds.xMax - dragState.bounds.xMin;
      var ySpan = dragState.bounds.yMax - dragState.bounds.yMin;
      var shiftX = -(event.clientX - dragState.startX) / plotWidth * xSpan;
      var shiftY = (event.clientY - dragState.startY) / plotHeight * ySpan;
      bounds = {
        xMin: dragState.bounds.xMin + shiftX,
        xMax: dragState.bounds.xMax + shiftX,
        yMin: dragState.bounds.yMin + shiftY,
        yMax: dragState.bounds.yMax + shiftY
      };
      parametricViewDirty = true;
      hoverIndex = -1;
      render(1);
      return;
    }
    var span = dragState.xMax - dragState.xMin;
    var shift = -(event.clientX - dragState.startX) / plotWidth * span;
    root.querySelector("#fn-x-min").value = Number((dragState.xMin + shift).toPrecision(8));
    root.querySelector("#fn-x-max").value = Number((dragState.xMax + shift).toPrecision(8));
    plot(false);
  }

  function handlePointerUp(event) {
    if (!dragState) return;
    dragState = null;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  function bindEvents() {
    root.querySelector("#fn-plot").addEventListener("click", function () { plot(true); });
    root.querySelector("#fn-replay").addEventListener("click", playAnimation);
    root.querySelector("#fn-fullscreen-replay").addEventListener("click", playAnimation);
    root.querySelector("#fn-fullscreen").addEventListener("click", enterFullscreen);
    root.querySelector("#fn-exit-fullscreen").addEventListener("click", exitFullscreen);
    root.querySelector("#fn-toolbar-reset").addEventListener("click", resetView);
    root.querySelector("#fn-fullscreen-reset").addEventListener("click", resetView);
    root.querySelector("#fn-expression").addEventListener("input", schedulePlot);
    root.querySelector("#fn-expression").addEventListener("keydown", function (event) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        clearTimeout(debounceTimer);
        plot(true);
      }
    });
    root.querySelectorAll("[data-fn-expression]").forEach(function (button) {
      button.addEventListener("click", function () {
        root.querySelector("#fn-expression").value = this.dataset.fnExpression;
        if (this.dataset.fnMin && this.dataset.fnMax) {
          root.querySelector("#fn-x-min").value = this.dataset.fnMin;
          root.querySelector("#fn-x-max").value = this.dataset.fnMax;
        } else {
          root.querySelector("#fn-x-min").value = "-10";
          root.querySelector("#fn-x-max").value = "10";
        }
        plot(true);
      });
    });
    ["fn-x-min", "fn-x-max", "fn-duration", "fn-line-width", "fn-color", "fn-grid"].forEach(function (id) {
      root.querySelector("#" + id).addEventListener("input", function () {
        if (id === "fn-duration") {
          root.querySelector("#fn-duration-value").textContent = this.value + " ms";
          return;
        }
        if (id === "fn-line-width") root.querySelector("#fn-line-width-value").textContent = this.value + " px";
        schedulePlot();
      });
    });
    root.querySelector("#fn-reset-view").addEventListener("click", resetView);
    canvas.addEventListener("pointermove", function (event) {
      if (dragState) handlePointerDrag(event);
      else handlePointerMove(event);
    });
    canvas.addEventListener("pointerleave", function () {
      if (!dragState) {
        hoverIndex = -1;
        render(lastProgress);
      }
    });
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    keydownHandler = function (event) {
      if (event.key === "Escape" && isFullscreen()) exitFullscreen();
    };
    document.addEventListener("keydown", keydownHandler);
  }

  function init(container) {
    deactivate();
    root = container;
    var examples = [
      { key: "constant", label: "y = 1", expression: "y = 1" },
      { key: "linear", label: "y = x", expression: "y = x" },
      { key: "quadratic", label: "y = x²", expression: "y = x^2" },
      { key: "cubic", label: "y = x³", expression: "y = x^3" },
      { key: "absolute", label: "y = |x|", expression: "y = abs(x)" },
      { key: "squareRoot", label: "y = √x", expression: "y = sqrt(x)" },
      { key: "reciprocal", label: "y = 1/x", expression: "y = 1/x" },
      { key: "sine", label: "y = sin(x)", expression: "y = sin(x)" },
      { key: "cosine", label: "y = cos(x)", expression: "y = cos(x)" },
      { key: "tangent", label: "y = tan(x)", expression: "y = tan(x)" },
      { key: "exponential", label: "y = eˣ", expression: "y = e^x" },
      { key: "naturalLog", label: "y = ln(x)", expression: "y = ln(x)" },
      { key: "sinc", label: "y = sin(x)/x", expression: "y = sin(x)/x" },
      { key: "damped", label: "y = e⁻|x|/4 cos(4x)", expression: "y = exp(-abs(x)/4) * cos(4x)" },
      { key: "piecewise", label: "if(x<0) -x else x", expression: "y = if(x < 0) -x else x" },
      { key: "threePiece", label: "if(x<-2) … else if …", expression: "y = if(x < -2) -1\n    else if(x <= 2) x^2/4\n    else 1" },
      { key: "sign", label: "if(x<0) -1 else if …", expression: "y = if(x < 0) -1\n    else if(x == 0) 0\n    else 1" },
      { key: "pulse", label: "if(x<0) 0 else if …", expression: "y = if(x < 0) 0\n    else if(x <= 4) 1\n    else 0" },
      {
        key: "heart",
        label: "x(t); y(t)",
        expression: "x = 16sin(t)^3; y = 13cos(t)-5cos(2t)-2cos(3t)-cos(4t)",
        min: "0",
        max: "6.283185307179586"
      }
    ];
    container.innerHTML = [
      '<div class="fn-tool">',
      '  <section class="fn-controls" aria-labelledby="fn-input-title">',
      '    <div class="fn-heading">',
      '      <div><h2 id="fn-input-title">' + t("functionTool.inputTitle") + '</h2><p>' + t("functionTool.inputHint") + '</p></div>',
      '    </div>',
      '    <label class="fn-expression-label" for="fn-expression">' + t("functionTool.expression") + '</label>',
      '    <div class="fn-expression-row">',
      '      <textarea id="fn-expression" rows="2" maxlength="200" spellcheck="false" autocomplete="off" aria-describedby="fn-syntax-hint" placeholder="' + t("functionTool.expressionPlaceholder") + '">' + DEFAULT_EXPRESSION + '</textarea>',
      '      <button id="fn-plot" type="button">' + t("functionTool.plot") + '</button>',
      '    </div>',
      '    <div id="fn-syntax-hint" class="fn-syntax-guide">',
      '      <p>' + t("functionTool.syntaxIntro") + '</p>',
      '      <dl>',
      '        <div><dt>' + t("functionTool.syntaxBasicLabel") + '</dt><dd><code>y = sin(x) + x^2</code><span>' + t("functionTool.syntaxBasicHint") + '</span></dd></div>',
      '        <div><dt>' + t("functionTool.syntaxPiecewiseLabel") + '</dt><dd><code>y = if(x &lt; 0) -x else x</code><span>' + t("functionTool.syntaxPiecewiseHint") + '</span></dd></div>',
      '        <div><dt>' + t("functionTool.syntaxNestedLabel") + '</dt><dd><code>y = if(x &lt; -1) -1<br>&nbsp;&nbsp;&nbsp;&nbsp;else if(x &lt;= 1) x<br>&nbsp;&nbsp;&nbsp;&nbsp;else 1</code><span>' + t("functionTool.syntaxNestedHint") + '</span></dd></div>',
      '        <div><dt>' + t("functionTool.syntaxParametricLabel") + '</dt><dd><code>x = cos(t)<br>y = sin(t)</code><span>' + t("functionTool.syntaxParametricHint") + '</span></dd></div>',
      '      </dl>',
      '      <small>' + t("functionTool.syntaxShortcut") + '</small>',
      '    </div>',
      '    <div class="fn-examples-head"><strong>' + t("functionTool.commonFunctions") + '</strong><span>' + t("functionTool.clickToFill") + '</span></div>',
      '    <div class="fn-examples-table-wrap">',
      '      <table class="fn-examples-table">',
      '        <thead><tr><th scope="col">' + t("functionTool.functionDescription") + '</th><th scope="col">' + t("functionTool.functionFormula") + '</th></tr></thead>',
      '        <tbody>',
      examples.map(function (example) {
        var key = "functionTool.examples." + example.key;
        var range = example.min ? ' data-fn-min="' + example.min + '" data-fn-max="' + example.max + '"' : "";
        return '<tr><td><strong>' + t(key + ".name") + '</strong><small>' + t(key + ".description") + '</small></td><td><button type="button" data-fn-expression="' + example.expression + '"' + range + '><code>' + example.label + '</code></button></td></tr>';
      }).join(""),
      '        </tbody>',
      '      </table>',
      '    </div>',
      '    <details class="fn-advanced">',
      '      <summary><span><strong>' + t("functionTool.advanced") + '</strong><small>' + t("functionTool.advancedHint") + '</small></span><span class="fn-chevron" aria-hidden="true">⌄</span></summary>',
      '      <div class="fn-advanced-content">',
      '        <div class="fn-range-grid">',
      '          <label><span id="fn-range-min-label">' + t("functionTool.xMin") + '</span><input id="fn-x-min" type="number" value="-10" step="any"></label>',
      '          <label><span id="fn-range-max-label">' + t("functionTool.xMax") + '</span><input id="fn-x-max" type="number" value="10" step="any"></label>',
      '        </div>',
      '        <button id="fn-reset-view" class="fn-secondary-button" type="button">' + t("functionTool.resetView") + '</button>',
      '        <label class="fn-slider"><span>' + t("functionTool.animationDuration") + '<output id="fn-duration-value">1200 ms</output></span><input id="fn-duration" type="range" min="0" max="5000" step="100" value="1200"></label>',
      '        <label class="fn-slider"><span>' + t("functionTool.lineWidth") + '<output id="fn-line-width-value">3 px</output></span><input id="fn-line-width" type="range" min="1" max="8" step="0.5" value="3"></label>',
      '        <div class="fn-appearance-row"><label><span>' + t("functionTool.curveColor") + '</span><input id="fn-color" type="color" value="#2f81f7"></label><label class="fn-check"><input id="fn-grid" type="checkbox" checked><span>' + t("functionTool.showGrid") + '</span></label></div>',
      '      </div>',
      '    </details>',
      '  </section>',
      '  <section class="fn-preview" aria-labelledby="fn-preview-title">',
      '    <div class="fn-preview-heading">',
      '      <div><h2 id="fn-preview-title">' + t("functionTool.previewTitle") + '</h2><code id="fn-current-expression">' + DEFAULT_EXPRESSION + '</code><span class="fn-preview-help">' + t("functionTool.chartHelp") + '</span></div>',
      '      <div class="fn-preview-actions">',
      '        <button id="fn-toolbar-reset" type="button"><span aria-hidden="true">⌂</span> ' + t("functionTool.reset") + '</button>',
      '        <button id="fn-replay" type="button"><span aria-hidden="true">↻</span> ' + t("functionTool.replay") + '</button>',
      '        <button id="fn-fullscreen" type="button" aria-expanded="false"><span aria-hidden="true">⛶</span> ' + t("functionTool.fullscreen") + '</button>',
      '      </div>',
      '    </div>',
      '    <div class="fn-fullscreen-toolbar" aria-hidden="true">',
      '      <span class="fn-fullscreen-help">' + t("functionTool.chartHelp") + '</span>',
      '      <div class="fn-fullscreen-actions">',
      '        <button id="fn-fullscreen-reset" type="button"><span aria-hidden="true">⌂</span> ' + t("functionTool.reset") + '</button>',
      '        <button id="fn-fullscreen-replay" type="button"><span aria-hidden="true">↻</span> ' + t("functionTool.replay") + '</button>',
      '        <button id="fn-exit-fullscreen" type="button"><span aria-hidden="true">×</span> ' + t("functionTool.exitFullscreen") + '</button>',
      '      </div>',
      '    </div>',
      '    <div class="fn-chart-shell">',
      '      <canvas id="fn-chart" class="fn-chart" role="img">' + t("functionTool.canvasFallback") + '</canvas>',
      '    </div>',
      '    <div id="fn-status" class="fn-status" role="status" aria-live="polite"></div>',
      '  </section>',
      '</div>'
    ].join("");
    canvas = root.querySelector("#fn-chart");
    context = canvas.getContext("2d");
    bindEvents();
    resizeObserver = new ResizeObserver(function () { render(lastProgress); });
    resizeObserver.observe(canvas);
    themeObserver = new MutationObserver(function () { render(lastProgress); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    plot(true);
  }

  function deactivate() {
    clearTimeout(debounceTimer);
    debounceTimer = null;
    cancelAnimation();
    if (root && isFullscreen()) exitFullscreen();
    document.body.classList.remove("fn-fullscreen-active");
    if (keydownHandler) document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    if (themeObserver) themeObserver.disconnect();
    themeObserver = null;
    points = [];
    bounds = null;
    dataBounds = null;
    plotMode = "cartesian";
    parametricViewDirty = false;
    hoverIndex = -1;
    dragState = null;
    canvas = null;
    context = null;
    root = null;
  }

  return {
    init: init,
    deactivate: deactivate,
    __test: {
      normalizeExpression: normalizeExpression,
      tokenize: tokenize,
      compileExpression: compileExpression,
      compilePlotExpression: compilePlotExpression,
      sampleFunction: sampleFunction,
      sampleParametric: sampleParametric,
      calculateBounds: calculateBounds,
      calculateParametricBounds: calculateParametricBounds,
      formatTick: formatTick
    }
  };
})();
