// Big Fish Eats Small Fish — wall replication and area-preserving collision merges.
var FishGameTool = (function () {
  "use strict";

  var MIN_COUNT = 1;
  var MAX_COUNT = 20;
  var MIN_SPEED = 0.1;
  var MAX_SPEED = 10;
  var MIN_LIMIT = 1;
  var MAX_LIMIT = 10000;
  var MIN_SIZE = 4;
  var MAX_SIZE = 30;
  var DEFAULT_SIZE = 12;
  var BASE_SPEED = 70;
  var MAX_DELTA_SECONDS = 0.032;
  var SMALL_MASS = 1;
  var WALL_COOLDOWN_MS = 180;
  var MERGE_COOLDOWN_MS = 140;

  var container = null;
  var canvas = null;
  var context = null;
  var chartCanvas = null;
  var chartContext = null;
  var fish = [];
  var history = [];
  var historyIntervalMs = 100;
  var nextHistoryAt = 100;
  var activeConfig = null;
  var baseColor = null;
  var width = 0;
  var height = 0;
  var recommendedLimit = 80;
  var limitCustomized = false;
  var elapsedMs = 0;
  var frameId = 0;
  var lastFrameAt = 0;
  var running = false;
  var started = false;
  var visibilitySuspended = false;
  var mountVersion = 0;
  var resizeObserver = null;
  var themeObserver = null;
  var palette = null;
  var randomSource = Math.random;

  function t(key) {
    return (window.__t && window.__t(key)) || key;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function normalizeConfig(count, size, speed, color, limit, recommendation) {
    var normalizedCount = clamp(Math.round(Number(count) || 1), MIN_COUNT, MAX_COUNT);
    var normalizedColor = /^#[0-9a-f]{6}$/i.test(String(color || ""))
      ? String(color).toLowerCase()
      : "#38bdf8";
    var fallbackLimit = clamp(Math.round(Number(recommendation) || 80), MIN_LIMIT, MAX_LIMIT);
    return {
      count: normalizedCount,
      size: clamp(Number(size) || DEFAULT_SIZE, MIN_SIZE, MAX_SIZE),
      speed: clamp(Number(speed) || 1, MIN_SPEED, MAX_SPEED),
      color: normalizedColor,
      limit: clamp(Math.round(Number(limit) || fallbackLimit), Math.max(MIN_LIMIT, normalizedCount), MAX_LIMIT)
    };
  }

  function validatePopulationLimit(rawValue, count) {
    var text = String(rawValue === undefined || rawValue === null ? "" : rawValue).trim();
    var value = Number(text);
    if (!text || !Number.isFinite(value) || !Number.isInteger(value) || value < MIN_LIMIT || value > MAX_LIMIT) {
      return { valid: false, value: null, error: "range" };
    }
    if (value < count) return { valid: false, value: null, error: "count" };
    return { valid: true, value: value, error: null };
  }

  function populationCap(canvasWidth, canvasHeight) {
    return clamp(Math.floor(Math.max(0, canvasWidth) * Math.max(0, canvasHeight) / 5000), 60, 240);
  }

  function currentConfig() {
    if (!container) return normalizeConfig(1, DEFAULT_SIZE, 1, "#38bdf8", recommendedLimit, recommendedLimit);
    return normalizeConfig(
      container.querySelector("#fish-game-count").value,
      container.querySelector("#fish-game-size").value,
      container.querySelector("#fish-game-speed").value,
      container.querySelector("#fish-game-color").value,
      container.querySelector("#fish-game-limit").value,
      recommendedLimit
    );
  }

  function hexToHsl(hex) {
    var normalized = String(hex || "#38bdf8").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) normalized = "38bdf8";
    var red = parseInt(normalized.slice(0, 2), 16) / 255;
    var green = parseInt(normalized.slice(2, 4), 16) / 255;
    var blue = parseInt(normalized.slice(4, 6), 16) / 255;
    var maximum = Math.max(red, green, blue);
    var minimum = Math.min(red, green, blue);
    var lightness = (maximum + minimum) / 2;
    var saturation = 0;
    var hue = 0;
    var delta = maximum - minimum;
    if (delta) {
      saturation = delta / (1 - Math.abs(2 * lightness - 1));
      if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
      else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
      else hue = 60 * ((red - green) / delta + 4);
    }
    if (hue < 0) hue += 360;
    return { h: hue, s: saturation * 100, l: lightness * 100 };
  }

  function colorForMass(mass) {
    var level = Math.log2(Math.max(1, mass));
    return "hsl(" + ((baseColor.h + level * 34) % 360).toFixed(1) + " " +
      clamp(baseColor.s + level * 1.5, 52, 88).toFixed(1) + "% " +
      clamp(baseColor.l + level * 1.2, 46, 68).toFixed(1) + "%)";
  }

  function fishRadius(mass, baseRadius) {
    return baseRadius * Math.sqrt(Math.max(SMALL_MASS, mass));
  }

  function velocityFor(speed, angle) {
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  }

  function normalizedVelocity(vx, vy, speed, fallbackVx, fallbackVy) {
    var magnitude = Math.hypot(vx, vy);
    if (magnitude < 0.000001) {
      vx = fallbackVx;
      vy = fallbackVy;
      magnitude = Math.hypot(vx, vy);
    }
    if (magnitude < 0.000001) return velocityFor(speed, randomSource() * Math.PI * 2);
    return { vx: vx / magnitude * speed, vy: vy / magnitude * speed };
  }

  function clampToAxis(value, radius, dimension) {
    if (radius * 2 >= dimension) return dimension / 2;
    return clamp(value, radius, dimension - radius);
  }

  function createFish(x, y, mass, baseRadius, speed, angle, bornAt) {
    var velocity = velocityFor(speed, angle);
    return {
      x: x,
      y: y,
      mass: mass,
      radius: fishRadius(mass, baseRadius),
      vx: velocity.vx,
      vy: velocity.vy,
      wallImmuneUntil: bornAt + WALL_COOLDOWN_MS,
      mergeImmuneUntil: bornAt + MERGE_COOLDOWN_MS
    };
  }

  function placeSeed(config) {
    return createFish(
      width / 2,
      height / 2,
      SMALL_MASS,
      config.size / 2,
      BASE_SPEED * config.speed,
      randomSource() * Math.PI * 2,
      0
    );
  }

  function isSmall(fishItem) {
    return Math.abs(fishItem.mass - SMALL_MASS) < 0.000001;
  }

  function largestMass(items) {
    return items.reduce(function (maximum, item) {
      return Math.max(maximum, item.mass);
    }, 0);
  }

  function smallFishCount(items) {
    return items.reduce(function (total, item) {
      return total + (isSmall(item) ? 1 : 0);
    }, 0);
  }

  function totalMass(items) {
    return items.reduce(function (total, item) { return total + item.mass; }, 0);
  }

  function wallCollision(fishItem) {
    var normalX = 0;
    var normalY = 0;
    var radius = fishItem.radius;
    if (radius * 2 >= width) fishItem.x = width / 2;
    else if (fishItem.x <= radius) { fishItem.x = radius; normalX += 1; }
    else if (fishItem.x >= width - radius) { fishItem.x = width - radius; normalX -= 1; }
    if (radius * 2 >= height) fishItem.y = height / 2;
    else if (fishItem.y <= radius) { fishItem.y = radius; normalY += 1; }
    else if (fishItem.y >= height - radius) { fishItem.y = height - radius; normalY -= 1; }
    if (!normalX && !normalY) return null;
    return Math.atan2(normalY, normalX);
  }

  function reflectFromWall(fishItem, normalAngle) {
    var normalX = Math.cos(normalAngle);
    var normalY = Math.sin(normalAngle);
    var dot = fishItem.vx * normalX + fishItem.vy * normalY;
    if (dot < 0) {
      fishItem.vx -= 2 * dot * normalX;
      fishItem.vy -= 2 * dot * normalY;
    }
  }

  function canReplicateAtWall(fishItem, now, count, limit) {
    return isSmall(fishItem) && now >= fishItem.wallImmuneUntil && count < limit;
  }

  function splitAtWall(fishItem, normalAngle) {
    var config = activeConfig || currentConfig();
    var baseRadius = config.size / 2;
    var speed = BASE_SPEED * config.speed;
    var spread = 0.42 + randomSource() * 0.38;
    var normalX = Math.cos(normalAngle);
    var normalY = Math.sin(normalAngle);
    var tangentX = -normalY;
    var tangentY = normalX;
    var centerX = clampToAxis(fishItem.x + normalX * (baseRadius + 2), baseRadius, width);
    var centerY = clampToAxis(fishItem.y + normalY * (baseRadius + 2), baseRadius, height);
    return [
      createFish(
        clampToAxis(centerX + tangentX * baseRadius * 0.65, baseRadius, width),
        clampToAxis(centerY + tangentY * baseRadius * 0.65, baseRadius, height),
        SMALL_MASS,
        baseRadius,
        speed,
        normalAngle + spread,
        elapsedMs
      ),
      createFish(
        clampToAxis(centerX - tangentX * baseRadius * 0.65, baseRadius, width),
        clampToAxis(centerY - tangentY * baseRadius * 0.65, baseRadius, height),
        SMALL_MASS,
        baseRadius,
        speed,
        normalAngle - spread,
        elapsedMs
      )
    ];
  }

  function collisionPairs(items, now) {
    var pairs = [];
    var used = new Set();
    var maximumRadius = items.reduce(function (maximum, item) {
      return Math.max(maximum, item.radius);
    }, 1);
    var cellSize = Math.max(2, maximumRadius * 2);
    var grid = new Map();
    items.forEach(function (item, index) {
      if (now < item.mergeImmuneUntil || used.has(index)) return;
      var cellX = Math.floor(item.x / cellSize);
      var cellY = Math.floor(item.y / cellSize);
      var matched = false;
      for (var offsetX = -1; offsetX <= 1 && !matched; offsetX += 1) {
        for (var offsetY = -1; offsetY <= 1 && !matched; offsetY += 1) {
          var candidates = grid.get((cellX + offsetX) + ":" + (cellY + offsetY)) || [];
          for (var candidate = 0; candidate < candidates.length; candidate += 1) {
            var otherIndex = candidates[candidate];
            if (used.has(otherIndex)) continue;
            var other = items[otherIndex];
            if (now < other.mergeImmuneUntil) continue;
            var dx = item.x - other.x;
            var dy = item.y - other.y;
            var distance = item.radius + other.radius;
            if (dx * dx + dy * dy <= distance * distance) {
              pairs.push([otherIndex, index]);
              used.add(otherIndex);
              used.add(index);
              matched = true;
              break;
            }
          }
        }
      }
      if (!matched) {
        var key = cellX + ":" + cellY;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(index);
      }
    });
    return pairs;
  }

  function mergeTwo(first, second) {
    var config = activeConfig || currentConfig();
    var combinedMass = first.mass + second.mass;
    var firstIsEater = first.mass > second.mass ||
      (first.mass === second.mass && randomSource() < 0.5);
    var eater = firstIsEater ? first : second;
    var x = (first.x * first.mass + second.x * second.mass) / combinedMass;
    var y = (first.y * first.mass + second.y * second.mass) / combinedMass;
    var velocity = normalizedVelocity(
      first.vx * first.mass + second.vx * second.mass,
      first.vy * first.mass + second.vy * second.mass,
      BASE_SPEED * config.speed,
      eater.vx,
      eater.vy
    );
    var radius = fishRadius(combinedMass, config.size / 2);
    return {
      x: clampToAxis(x, radius, width),
      y: clampToAxis(y, radius, height),
      mass: combinedMass,
      radius: radius,
      vx: velocity.vx,
      vy: velocity.vy,
      wallImmuneUntil: elapsedMs + WALL_COOLDOWN_MS,
      mergeImmuneUntil: elapsedMs + MERGE_COOLDOWN_MS
    };
  }

  function resolveMerges() {
    var pairs = collisionPairs(fish, elapsedMs);
    if (!pairs.length) return;
    var removed = new Set();
    var merged = [];
    pairs.forEach(function (pair) {
      removed.add(pair[0]);
      removed.add(pair[1]);
      merged.push(mergeTwo(fish[pair[0]], fish[pair[1]]));
    });
    fish = fish.filter(function (_, index) { return !removed.has(index); }).concat(merged);
  }

  function updateWorldStep(deltaSeconds) {
    var projectedCount = fish.length;
    var nextFish = [];
    fish.forEach(function (fishItem) {
      fishItem.x += fishItem.vx * deltaSeconds;
      fishItem.y += fishItem.vy * deltaSeconds;
      var normalAngle = wallCollision(fishItem);
      if (normalAngle !== null && canReplicateAtWall(
        fishItem,
        elapsedMs,
        projectedCount,
        (activeConfig || currentConfig()).limit
      )) {
        projectedCount += 1;
        nextFish.push.apply(nextFish, splitAtWall(fishItem, normalAngle));
      } else {
        if (normalAngle !== null) reflectFromWall(fishItem, normalAngle);
        nextFish.push(fishItem);
      }
    });
    fish = nextFish;
    resolveMerges();
  }

  function physicsSubstepCount(deltaSeconds, speedMultiplier, baseRadius) {
    var maximumStepSeconds = (baseRadius * 0.5) / Math.max(BASE_SPEED * speedMultiplier, 1);
    return Math.max(1, Math.ceil(deltaSeconds / maximumStepSeconds));
  }

  function updateWorld(deltaSeconds) {
    var config = activeConfig || currentConfig();
    var steps = physicsSubstepCount(deltaSeconds, config.speed, config.size / 2);
    var stepSeconds = deltaSeconds / steps;
    for (var step = 0; step < steps; step += 1) updateWorldStep(stepSeconds);
  }

  function readPalette() {
    var styles = getComputedStyle(document.documentElement);
    palette = {
      background: styles.getPropertyValue("--ball-game-canvas-bg").trim() || "#10161f",
      text: styles.getPropertyValue("--text-muted").trim() || "#8b949e",
      border: styles.getPropertyValue("--border").trim() || "#30363d",
      accent: styles.getPropertyValue("--ecosystem-prey").trim() || "#38bdf8",
      giant: styles.getPropertyValue("--amber").trim() || "#d29922"
    };
  }

  function resizeChart(ratio) {
    if (!chartCanvas || !chartCanvas.parentElement || !chartContext) return;
    var rect = chartCanvas.parentElement.getBoundingClientRect();
    var chartWidth = Math.max(280, Math.round(rect.width));
    var chartHeight = Math.max(150, Math.round(rect.height));
    chartCanvas.width = Math.round(chartWidth * ratio);
    chartCanvas.height = Math.round(chartHeight * ratio);
    chartCanvas.style.width = chartWidth + "px";
    chartCanvas.style.height = chartHeight + "px";
    chartContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawChart(chartWidth, chartHeight);
  }

  function resizeCanvas() {
    if (!canvas || !canvas.parentElement || !context) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    var nextWidth = Math.max(280, Math.round(rect.width));
    var nextHeight = Math.max(320, Math.round(rect.height));
    var previousWidth = width || nextWidth;
    var previousHeight = height || nextHeight;
    width = nextWidth;
    height = nextHeight;
    recommendedLimit = populationCap(width, height);
    updateLimitRecommendation();
    var ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    resizeChart(ratio);
    fish.forEach(function (item) {
      item.x = clampToAxis(item.x * width / previousWidth, item.radius, width);
      item.y = clampToAxis(item.y * height / previousHeight, item.radius, height);
    });
    updateStats();
    if (!running) drawWorld();
  }

  function updateLimitRecommendation() {
    if (!container) return;
    var input = container.querySelector("#fish-game-limit");
    if (!limitCustomized) input.value = String(recommendedLimit);
    container.querySelector("#fish-game-limit-recommendation").textContent =
      t("fishGame.recommended") + " " + recommendedLimit;
  }

  function limitValidation() {
    if (!container) return validatePopulationLimit(recommendedLimit, 1);
    var count = clamp(Math.round(Number(container.querySelector("#fish-game-count").value) || 1), MIN_COUNT, MAX_COUNT);
    return validatePopulationLimit(container.querySelector("#fish-game-limit").value, count);
  }

  function showLimitError(validation) {
    if (!container) return;
    var error = container.querySelector("#fish-game-limit-error");
    error.classList.toggle("hidden", validation.valid);
    error.textContent = validation.valid
      ? ""
      : t("fishGame.errors." + validation.error) +
        (validation.error === "count" ? " " + container.querySelector("#fish-game-count").value : "");
  }

  function resetHistory() {
    history = [{
      time: 0,
      count: fish.length,
      largest: largestMass(fish)
    }];
    historyIntervalMs = 100;
    nextHistoryAt = historyIntervalMs;
  }

  function recordHistory() {
    if (!started || elapsedMs < nextHistoryAt) return;
    history.push({
      time: elapsedMs,
      count: fish.length,
      largest: largestMass(fish)
    });
    nextHistoryAt = elapsedMs + historyIntervalMs;
    if (history.length > 1200) {
      history = history.filter(function (_, index) {
        return index % 2 === 0 || index === history.length - 1;
      });
      historyIntervalMs *= 2;
      nextHistoryAt = elapsedMs + historyIntervalMs;
    }
  }

  function resetWorld(shouldRun) {
    var validation = limitValidation();
    showLimitError(validation);
    if (!validation.valid) return false;
    activeConfig = currentConfig();
    activeConfig.limit = validation.value;
    baseColor = hexToHsl(activeConfig.color);
    fish = [];
    elapsedMs = 0;
    for (var index = 0; index < activeConfig.count; index += 1) fish.push(placeSeed(activeConfig));
    resetHistory();
    started = Boolean(shouldRun);
    running = Boolean(shouldRun);
    visibilitySuspended = false;
    lastFrameAt = performance.now();
    updateControls();
    updateStats();
    drawWorld();
    cancelAnimation();
    if (running) frameId = requestAnimationFrame(function (time) { animate(time, mountVersion); });
    return true;
  }

  function cancelAnimation() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function setRunning(nextRunning) {
    if (!started) return;
    running = nextRunning;
    cancelAnimation();
    lastFrameAt = performance.now();
    if (running && !document.hidden) {
      frameId = requestAnimationFrame(function (time) { animate(time, mountVersion); });
    }
    updateControls();
    updateStats();
  }

  function formatTime(milliseconds) {
    var total = Math.floor(Math.max(0, milliseconds));
    var minutes = Math.floor(total / 60000);
    var seconds = Math.floor(total / 1000) % 60;
    var millisecondsPart = total % 1000;
    return String(minutes).padStart(2, "0") + ":" +
      String(seconds).padStart(2, "0") + "." +
      String(millisecondsPart).padStart(3, "0");
  }

  function formatAxisTime(milliseconds) {
    if (milliseconds < 60000) return (milliseconds / 1000).toFixed(milliseconds < 10000 ? 1 : 0) + "s";
    return (milliseconds / 60000).toFixed(1) + "m";
  }

  function chartPoints() {
    var points = history.slice();
    var last = points[points.length - 1];
    if (started && (!last || last.time < elapsedMs)) {
      points.push({ time: elapsedMs, count: fish.length, largest: largestMass(fish) });
    }
    return points.length ? points : [{ time: 0, count: fish.length, largest: largestMass(fish) }];
  }

  function drawChartLine(points, field, color, left, top, plotWidth, plotHeight, timeMaximum, valueMaximum) {
    chartContext.strokeStyle = color;
    chartContext.lineWidth = 2;
    chartContext.lineJoin = "round";
    chartContext.lineCap = "round";
    chartContext.beginPath();
    points.forEach(function (point, index) {
      var x = left + clamp(point.time / timeMaximum, 0, 1) * plotWidth;
      var y = top + plotHeight - clamp(point[field] / valueMaximum, 0, 1) * plotHeight;
      if (!index) chartContext.moveTo(x, y);
      else chartContext.lineTo(x, y);
    });
    chartContext.stroke();
  }

  function drawChart(chartWidth, chartHeight) {
    if (!chartContext || !chartCanvas || !palette) return;
    var stage = container && container.querySelector("#fish-game-stage");
    if (stage && stage.classList.contains("is-fullscreen")) return;
    var widthValue = chartWidth || chartCanvas.clientWidth;
    var heightValue = chartHeight || chartCanvas.clientHeight;
    if (!widthValue || !heightValue) return;
    var left = 48;
    var right = 14;
    var top = 12;
    var bottom = 32;
    var plotWidth = Math.max(1, widthValue - left - right);
    var plotHeight = Math.max(1, heightValue - top - bottom);
    var points = chartPoints();
    var timeMaximum = Math.max(10000, elapsedMs, points[points.length - 1].time);
    var maximum = points.reduce(function (value, point) {
      return Math.max(value, point.count, point.largest);
    }, 0);
    var valueMaximum = Math.max(5, Math.ceil(maximum * 1.15));

    chartContext.clearRect(0, 0, widthValue, heightValue);
    chartContext.fillStyle = palette.background;
    chartContext.fillRect(0, 0, widthValue, heightValue);
    chartContext.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    chartContext.textBaseline = "middle";
    for (var yTick = 0; yTick <= 4; yTick += 1) {
      var yRatio = yTick / 4;
      var y = top + plotHeight - yRatio * plotHeight;
      chartContext.strokeStyle = palette.border;
      chartContext.lineWidth = 1;
      chartContext.beginPath();
      chartContext.moveTo(left, y + 0.5);
      chartContext.lineTo(left + plotWidth, y + 0.5);
      chartContext.stroke();
      chartContext.fillStyle = palette.text;
      chartContext.textAlign = "right";
      chartContext.fillText(String(Math.round(valueMaximum * yRatio)), left - 7, y);
    }
    for (var xTick = 0; xTick <= 4; xTick += 1) {
      var xRatio = xTick / 4;
      var x = left + xRatio * plotWidth;
      chartContext.fillStyle = palette.text;
      chartContext.textAlign = "center";
      chartContext.fillText(formatAxisTime(timeMaximum * xRatio), x, top + plotHeight + 14);
    }
    chartContext.save();
    chartContext.fillStyle = palette.text;
    chartContext.textAlign = "center";
    chartContext.fillText(t("fishGame.chartTimeAxis"), left + plotWidth / 2, heightValue - 7);
    chartContext.translate(11, top + plotHeight / 2);
    chartContext.rotate(-Math.PI / 2);
    chartContext.fillText(t("fishGame.chartValueAxis"), 0, 0);
    chartContext.restore();
    drawChartLine(points, "count", palette.accent, left, top, plotWidth, plotHeight, timeMaximum, valueMaximum);
    drawChartLine(points, "largest", palette.giant, left, top, plotWidth, plotHeight, timeMaximum, valueMaximum);
  }

  function giantColor(mass, breath, settled) {
    var level = Math.log2(Math.max(1, mass));
    var danger = settled ? 0.3 : 1;
    var hueShift = breath * 8 * danger;
    var satBoost = (12 + breath * 8) * danger;
    var h = (baseColor.h + level * 34 + hueShift + 360) % 360;
    var s = clamp(baseColor.s + level * 1.5 + satBoost, 55, 94);
    var l = clamp(baseColor.l + level * 1.2, 42, 64);
    return "hsl(" + h.toFixed(1) + " " + s.toFixed(1) + "% " + l.toFixed(1) + "%)";
  }

  function drawWorld() {
    if (!context || !palette || !baseColor) return;
    context.fillStyle = palette.background;
    context.fillRect(0, 0, width, height);
    var sortedFish = fish.slice().sort(function (first, second) {
      return first.mass - second.mass;
    });
    var giant = sortedFish.length ? sortedFish[sortedFish.length - 1] : null;
    var settled = giant && fish.length === 1 && !isSmall(giant);
    var breath = Math.sin(elapsedMs / 1200);
    var giantScale = settled ? 1 + breath * 0.02 : 1 + breath * 0.05;
    var scanPhase = (elapsedMs % 2000) / 2000;
    sortedFish.forEach(function (item) {
      context.fillStyle = colorForMass(item.mass);
      context.beginPath();
      var r = item === giant ? item.radius * giantScale : item.radius;
      context.arc(item.x, item.y, r, 0, Math.PI * 2);
      context.fill();
      if (item === giant && !settled) {
        // Danger glow overlay: subtle warm pulse
        context.fillStyle = giantColor(item.mass, breath, false);
        context.globalAlpha = 0.22;
        context.beginPath();
        context.arc(item.x, item.y, r * (1 + breath * 0.04), 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        // Double ripple scanning rings
        context.strokeStyle = giantColor(item.mass, breath, false);
        var rings = [
          { r: item.radius * (1.25 + scanPhase * 0.55), a: 0.5 * (1 - scanPhase), w: 2.5 },
          { r: item.radius * (1.15 + ((scanPhase + 0.5) % 1) * 0.55), a: 0.3 * (1 - ((scanPhase + 0.5) % 1)), w: 1.8 }
        ];
        rings.forEach(function (ring) {
          context.globalAlpha = ring.a;
          context.lineWidth = ring.w;
          context.beginPath();
          context.arc(item.x, item.y, ring.r, 0, Math.PI * 2);
          context.stroke();
        });
        context.globalAlpha = 1;
        context.lineWidth = 1;
      }
      if (item === giant && settled) {
        // Subtle warm glow when ecosystem is complete
        context.fillStyle = giantColor(item.mass, breath, true);
        context.globalAlpha = 0.14;
        context.beginPath();
        context.arc(item.x, item.y, r * (1 + breath * 0.03), 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
    });
    if (!started) {
      context.fillStyle = palette.text;
      context.textAlign = "center";
      context.font = "600 13px -apple-system, BlinkMacSystemFont, sans-serif";
      context.fillText(t("fishGame.previewHint"), width / 2, height - 24);
    }
    drawChart();
  }

  function isSettled() {
    return fish.length === 1 && !isSmall(fish[0]);
  }

  function updateStats() {
    if (!container) return;
    var smallCount = smallFishCount(fish);
    var biggest = largestMass(fish);
    var atLimit = fish.length >= (activeConfig || currentConfig()).limit;
    var settled = started && isSettled();
    container.querySelector("#fish-game-time").textContent = formatTime(elapsedMs);
    container.querySelector("#fish-game-population").textContent =
      fish.length + " / " + (activeConfig || currentConfig()).limit;
    container.querySelector("#fish-game-small-stat").textContent = String(smallCount);
    container.querySelector("#fish-game-largest-stat").textContent =
      (Number.isInteger(biggest) ? biggest : biggest.toFixed(1)) + "×";
    container.querySelector("#fish-game-speed-stat").textContent =
      (activeConfig || currentConfig()).speed.toFixed(1) + "×";
    var status = container.querySelector("#fish-game-status");
    status.classList.toggle("is-live", running && !atLimit);
    status.classList.toggle("is-limit", atLimit && !settled);
    status.classList.toggle("is-unified", settled);
    var statusKey = !started
      ? "ready"
      : (settled ? "settled" : (atLimit ? "limit" : (running ? "running" : "paused")));
    status.querySelector("span:last-child").textContent = t("fishGame.status." + statusKey);
  }

  function updateControls() {
    if (!container) return;
    var settled = started && isSettled();
    var startButton = container.querySelector("#fish-game-start");
    var pauseButton = container.querySelector("#fish-game-pause");
    startButton.textContent = t(started ? "fishGame.regenerate" : "fishGame.start");
    pauseButton.textContent = t(running ? "fishGame.pause" : "fishGame.resume");
    pauseButton.disabled = !started || settled;
    pauseButton.setAttribute("aria-pressed", String(!running && started));
  }

  function animate(time, version) {
    if (!running || version !== mountVersion || !container || !document.body.contains(container)) {
      cancelAnimation();
      return;
    }
    var deltaSeconds = clamp((time - lastFrameAt) / 1000, 0, MAX_DELTA_SECONDS);
    lastFrameAt = time;
    elapsedMs += deltaSeconds * 1000;
    updateWorld(deltaSeconds);
    if (isSettled()) running = false;
    recordHistory();
    drawWorld();
    updateStats();
    updateControls();
    if (running) frameId = requestAnimationFrame(function (nextTime) { animate(nextTime, version); });
    else frameId = 0;
  }

  function syncFullscreenState() {
    if (!container) return;
    var stage = container.querySelector("#fish-game-stage");
    if (!stage) return;
    var active = stage.classList.contains("is-viewport-fullscreen");
    stage.classList.toggle("is-fullscreen", active);
    var enterButton = container.querySelector("#fish-game-fullscreen");
    if (enterButton) enterButton.setAttribute("aria-pressed", String(active));
    setTimeout(resizeCanvas, 60);
  }

  function enterFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#fish-game-stage");
    if (!stage) return;
    stage.classList.add("is-viewport-fullscreen");
    document.body.classList.add("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function exitFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#fish-game-stage");
    if (stage) stage.classList.remove("is-viewport-fullscreen", "is-fullscreen");
    document.body.classList.remove("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function handleKeydown(event) {
    if (event.key !== "Escape" || !container) return;
    var stage = container.querySelector("#fish-game-stage");
    if (stage && stage.classList.contains("is-viewport-fullscreen")) exitFullscreen();
  }

  function handleVisibility() {
    if (document.hidden && running) {
      visibilitySuspended = true;
      cancelAnimation();
      return;
    }
    if (!document.hidden && running && visibilitySuspended) {
      visibilitySuspended = false;
      lastFrameAt = performance.now();
      frameId = requestAnimationFrame(function (time) { animate(time, mountVersion); });
    }
  }

  function updateInputLabels() {
    if (!container) return;
    container.querySelector("#fish-game-count-value").textContent =
      container.querySelector("#fish-game-count").value;
    container.querySelector("#fish-game-size-value").textContent =
      container.querySelector("#fish-game-size").value + "px";
    container.querySelector("#fish-game-speed-value").textContent =
      Number(container.querySelector("#fish-game-speed").value).toFixed(1) + "×";
    container.querySelector("#fish-game-color-value").textContent =
      container.querySelector("#fish-game-color").value.toUpperCase();
    updateLimitRecommendation();
    var validation = limitValidation();
    showLimitError(validation);
    if (!started && validation.valid) resetWorld(false);
  }

  function bindEvents() {
    container.querySelector("#fish-game-start").addEventListener("click", function () { resetWorld(true); });
    container.querySelector("#fish-game-pause").addEventListener("click", function () { setRunning(!running); });
    ["#fish-game-count", "#fish-game-size", "#fish-game-speed", "#fish-game-color"].forEach(function (selector) {
      container.querySelector(selector).addEventListener("input", updateInputLabels);
    });
    container.querySelector("#fish-game-limit").addEventListener("input", function () {
      limitCustomized = true;
      updateInputLabels();
    });
    container.querySelector("#fish-game-fullscreen").addEventListener("click", enterFullscreen);
    container.querySelector("#fish-game-exit-fullscreen").addEventListener("click", exitFullscreen);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("keydown", handleKeydown);
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement);
    resizeObserver.observe(chartCanvas.parentElement);
    themeObserver = new MutationObserver(function () { readPalette(); drawWorld(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function init(element) {
    deactivate();
    mountVersion += 1;
    container = element;
    container.innerHTML = '<div class="ball-game-tool fish-game-tool">' +
      '<div class="ball-game-layout"><aside class="ball-game-config"><section class="ball-game-guide" aria-labelledby="fish-game-guide-title"><h2 id="fish-game-guide-title">' + t("fishGame.guide.title") + '</h2><ul>' +
        '<li>' + t("fishGame.guide.item1") + '</li><li>' + t("fishGame.guide.item2") + '</li><li>' + t("fishGame.guide.item3") + '</li><li>' + t("fishGame.guide.item4") + '</li></ul></section>' +
        '<h3>' + t("fishGame.configTitle") + '</h3>' +
        '<label class="ball-game-control" for="fish-game-count"><span><b>' + t("fishGame.initialCount") + '</b><output id="fish-game-count-value">1</output></span><input id="fish-game-count" type="range" min="1" max="20" step="1" value="1"></label>' +
        '<label class="ball-game-control ball-game-color-control" for="fish-game-color"><span><b>' + t("fishGame.seedColor") + '</b><output id="fish-game-color-value">#38BDF8</output></span><input id="fish-game-color" type="color" value="#38bdf8"></label>' +
        '<label class="ball-game-control" for="fish-game-size"><span><b>' + t("fishGame.baseSize") + '</b><output id="fish-game-size-value">12px</output></span><input id="fish-game-size" type="range" min="4" max="30" step="1" value="12"></label>' +
        '<label class="ball-game-control" for="fish-game-speed"><span><b>' + t("fishGame.baseSpeed") + '</b><output id="fish-game-speed-value">1.0×</output></span><input id="fish-game-speed" type="range" min="0.1" max="10" step="0.1" value="1"></label>' +
        '<label class="ball-game-control" for="fish-game-limit"><span><b>' + t("fishGame.populationLimit") + '</b><output id="fish-game-limit-recommendation">' + t("fishGame.recommended") + ' 80</output></span><input id="fish-game-limit" type="number" step="1" value="80" inputmode="numeric" aria-describedby="fish-game-limit-error"></label>' +
        '<div class="ball-game-actions"><button id="fish-game-start" class="ball-game-primary" type="button">' + t("fishGame.start") + '</button><button id="fish-game-pause" type="button" disabled aria-pressed="false">' + t("fishGame.resume") + '</button></div>' +
        '<p id="fish-game-limit-error" class="ball-game-config-error hidden" role="alert"></p>' +
        '<p class="ball-game-config-note">' + t("fishGame.configNote") + '</p></aside>' +
        '<main id="fish-game-stage" class="ball-game-stage-card fish-game-stage"><div class="ball-game-fullscreen-toolbar"><span>' + t("fishGame.fullscreenTitle") + '</span><button id="fish-game-exit-fullscreen" type="button">' + t("fishGame.exitFullscreen") + '</button></div><div class="ball-game-stats">' +
          '<div><span>' + t("fishGame.totalTime") + '</span><strong id="fish-game-time">00:00.000</strong></div>' +
          '<div><span>' + t("fishGame.population") + '</span><strong id="fish-game-population">1 / 80</strong></div>' +
          '<div><span>' + t("fishGame.smallFish") + '</span><strong id="fish-game-small-stat">1</strong></div>' +
          '<div><span>' + t("fishGame.largestMass") + '</span><strong id="fish-game-largest-stat">1×</strong></div>' +
          '<div><span>' + t("fishGame.currentSpeed") + '</span><strong id="fish-game-speed-stat">1.0×</strong></div></div>' +
          '<div class="ball-game-status-row"><div id="fish-game-status" class="ball-game-status fish-game-status"><span aria-hidden="true"></span><span>' + t("fishGame.status.ready") + '</span></div><div class="ball-game-status-actions"><span>' + t("fishGame.capHint") + '</span><button id="fish-game-fullscreen" type="button" aria-pressed="false">' + t("fishGame.fullscreen") + '</button></div></div>' +
          '<div class="ball-game-canvas-shell"><canvas id="fish-game-canvas" class="ball-game-canvas" role="img" aria-label="' + t("fishGame.canvasLabel") + '"></canvas></div>' +
          '<section class="ball-game-chart-card"><div><h3>' + t("fishGame.ecosystemChart") + '</h3><div class="predator-game-legend"><span class="predator-game-legend-item"><i class="predator-game-swatch is-prey" aria-hidden="true"></i>' + t("fishGame.fishCountSeries") + '</span><span class="predator-game-legend-item"><i class="fish-game-swatch is-giant" aria-hidden="true"></i>' + t("fishGame.largestSeries") + '</span></div></div><div class="ball-game-chart-shell"><canvas id="fish-game-chart" class="ball-game-population-chart" role="img" aria-label="' + t("fishGame.chartLabel") + '"></canvas></div></section></main></div>' +
      '</div>';
    canvas = container.querySelector("#fish-game-canvas");
    context = canvas.getContext("2d");
    chartCanvas = container.querySelector("#fish-game-chart");
    chartContext = chartCanvas.getContext("2d");
    readPalette();
    bindEvents();
    resizeCanvas();
    resetWorld(false);
  }

  function deactivate() {
    running = false;
    started = false;
    visibilitySuspended = false;
    cancelAnimation();
    document.removeEventListener("visibilitychange", handleVisibility);
    document.removeEventListener("keydown", handleKeydown);
    document.body.classList.remove("ball-game-fullscreen-active");
    if (resizeObserver) resizeObserver.disconnect();
    if (themeObserver) themeObserver.disconnect();
    resizeObserver = null;
    themeObserver = null;
    fish = [];
    history = [];
    activeConfig = null;
    baseColor = null;
    elapsedMs = 0;
    recommendedLimit = 80;
    limitCustomized = false;
    canvas = null;
    context = null;
    chartCanvas = null;
    chartContext = null;
    container = null;
    mountVersion += 1;
  }

  return {
    init: init,
    deactivate: deactivate,
    _test: {
      normalizeConfig: normalizeConfig,
      validatePopulationLimit: validatePopulationLimit,
      populationCap: populationCap,
      hexToHsl: hexToHsl,
      fishRadius: fishRadius,
      velocityFor: velocityFor,
      normalizedVelocity: normalizedVelocity,
      clampToAxis: clampToAxis,
      isSmall: isSmall,
      largestMass: largestMass,
      smallFishCount: smallFishCount,
      totalMass: totalMass,
      collisionPairs: collisionPairs,
      reflectFromWall: reflectFromWall,
      canReplicateAtWall: canReplicateAtWall,
      physicsSubstepCount: physicsSubstepCount,
      formatTime: formatTime,
      formatAxisTime: formatAxisTime
    }
  };
})();
