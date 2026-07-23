// N-Sided Cycle — balanced cyclic dominance for two or more factions.
var CycleGameTool = (function () {
  "use strict";

  var MIN_COUNT = 1;
  var MAX_COUNT = 300;
  var MIN_FACTIONS = 2;
  var MAX_FACTIONS = 20;
  var MIN_SPEED = 0.1;
  var MAX_SPEED = 10;
  var BASE_SPEED = 70;
  var BALL_RADIUS = 6;
  var COLLISION_CELL_SIZE = BALL_RADIUS * 2;
  var CONVERSION_COOLDOWN_MS = 120;
  var MAX_DELTA_SECONDS = 0.032;

  var container = null;
  var canvas = null;
  var context = null;
  var chartCanvas = null;
  var chartContext = null;
  var balls = [];
  var history = [];
  var historyIntervalMs = 100;
  var nextHistoryAt = 100;
  var activeConfig = null;
  var width = 0;
  var height = 0;
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

  function randomBetween(minimum, maximum, rng) {
    return minimum + (maximum - minimum) * (rng || randomSource)();
  }

  function normalizeConfig(factions, count, speed) {
    return {
      factions: clamp(Math.round(Number(factions) || 3), MIN_FACTIONS, MAX_FACTIONS),
      count: clamp(Math.round(Number(count) || 30), MIN_COUNT, MAX_COUNT),
      speed: clamp(Number(speed) || 1, MIN_SPEED, MAX_SPEED)
    };
  }

  function winnerSpecies(first, second, factionCount, rng) {
    if (first === second) return null;
    var count = Math.max(MIN_FACTIONS, Math.round(factionCount));
    var distance = (second - first + count) % count;
    if (count % 2 === 0 && distance === count / 2) {
      return (rng || randomSource)() < 0.5 ? first : second;
    }
    return distance <= Math.floor((count - 1) / 2) ? first : second;
  }

  function populationCounts(ballList, factionCount) {
    var counts = Array(Math.max(MIN_FACTIONS, Math.round(factionCount))).fill(0);
    ballList.forEach(function (ball) {
      if (ball.species >= 0 && ball.species < counts.length) counts[ball.species] += 1;
    });
    return counts;
  }

  function velocityFor(speed, angle) {
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  }

  function clusterCenter(species, factionCount, canvasWidth, canvasHeight) {
    var angle = -Math.PI / 2 + species * Math.PI * 2 / factionCount;
    var radius = Math.min(canvasWidth, canvasHeight) * 0.27;
    return {
      x: canvasWidth / 2 + Math.cos(angle) * radius,
      y: canvasHeight / 2 + Math.sin(angle) * radius
    };
  }

  function seedPosition(species, factionCount, rng) {
    var source = rng || randomSource;
    var center = clusterCenter(species, factionCount, width, height);
    var angle = source() * Math.PI * 2;
    var radius = Math.sqrt(source()) * Math.min(width, height) * Math.min(0.18, 0.42 / Math.sqrt(factionCount));
    return {
      x: clamp(center.x + Math.cos(angle) * radius, BALL_RADIUS, width - BALL_RADIUS),
      y: clamp(center.y + Math.sin(angle) * radius, BALL_RADIUS, height - BALL_RADIUS)
    };
  }

  function createBall(species, factionCount, speed, rng) {
    var source = rng || randomSource;
    var position = seedPosition(species, factionCount, source);
    var velocity = velocityFor(speed, source() * Math.PI * 2);
    return {
      x: position.x,
      y: position.y,
      vx: velocity.vx,
      vy: velocity.vy,
      species: species,
      immuneUntil: 0
    };
  }

  function currentConfig() {
    if (!container) return normalizeConfig(3, 30, 1);
    return normalizeConfig(
      container.querySelector("#cycle-game-factions").value,
      container.querySelector("#cycle-game-count").value,
      container.querySelector("#cycle-game-speed").value
    );
  }

  function buildSpatialGrid(items, cellSize) {
    var grid = new Map();
    items.forEach(function (item, index) {
      var key = Math.floor(item.x / cellSize) + ":" + Math.floor(item.y / cellSize);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(index);
    });
    return grid;
  }

  function collisionPairs(ballList, now) {
    var grid = new Map();
    var pairs = [];
    var used = new Set();
    ballList.forEach(function (ball, index) {
      if (now < ball.immuneUntil || used.has(index)) return;
      var cellX = Math.floor(ball.x / COLLISION_CELL_SIZE);
      var cellY = Math.floor(ball.y / COLLISION_CELL_SIZE);
      var matched = false;
      for (var offsetX = -1; offsetX <= 1 && !matched; offsetX += 1) {
        for (var offsetY = -1; offsetY <= 1 && !matched; offsetY += 1) {
          var candidates = grid.get((cellX + offsetX) + ":" + (cellY + offsetY)) || [];
          for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
            var otherIndex = candidates[candidateIndex];
            if (used.has(otherIndex)) continue;
            var other = ballList[otherIndex];
            if (ball.species === other.species || now < other.immuneUntil) continue;
            var dx = ball.x - other.x;
            var dy = ball.y - other.y;
            var distance = BALL_RADIUS * 2;
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

  function resolveConversions() {
    var factionCount = (activeConfig || currentConfig()).factions;
    collisionPairs(balls, elapsedMs).forEach(function (pair) {
      var first = balls[pair[0]];
      var second = balls[pair[1]];
      var winner = winnerSpecies(first.species, second.species, factionCount, randomSource);
      if (winner === null) return;
      if (first.species !== winner) first.species = winner;
      else second.species = winner;
      first.immuneUntil = elapsedMs + CONVERSION_COOLDOWN_MS;
      second.immuneUntil = elapsedMs + CONVERSION_COOLDOWN_MS;
    });
  }

  function moveAndBounce(ball, deltaSeconds) {
    ball.x += ball.vx * deltaSeconds;
    ball.y += ball.vy * deltaSeconds;
    if (ball.x <= BALL_RADIUS) {
      ball.x = BALL_RADIUS;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x >= width - BALL_RADIUS) {
      ball.x = width - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= BALL_RADIUS) {
      ball.y = BALL_RADIUS;
      ball.vy = Math.abs(ball.vy);
    } else if (ball.y >= height - BALL_RADIUS) {
      ball.y = height - BALL_RADIUS;
      ball.vy = -Math.abs(ball.vy);
    }
  }

  function physicsSubstepCount(deltaSeconds, speedMultiplier) {
    var maximumStepSeconds = (BALL_RADIUS * 0.5) / Math.max(BASE_SPEED * speedMultiplier, 1);
    return Math.max(1, Math.ceil(deltaSeconds / maximumStepSeconds));
  }

  function updateWorldStep(deltaSeconds) {
    balls.forEach(function (ball) { moveAndBounce(ball, deltaSeconds); });
    resolveConversions();
  }

  function updateWorld(deltaSeconds) {
    var speedMultiplier = (activeConfig || currentConfig()).speed;
    var stepCount = physicsSubstepCount(deltaSeconds, speedMultiplier);
    var stepSeconds = deltaSeconds / stepCount;
    for (var step = 0; step < stepCount; step += 1) updateWorldStep(stepSeconds);
  }

  function readPalette() {
    var styles = getComputedStyle(document.documentElement);
    palette = {
      background: styles.getPropertyValue("--ball-game-canvas-bg").trim() || "#10161f",
      text: styles.getPropertyValue("--text-muted").trim() || "#8b949e",
      border: styles.getPropertyValue("--border").trim() || "#30363d"
    };
  }

  function speciesHue(species, factionCount) {
    if (factionCount === 3) return [350, 205, 135][species];
    return (350 + species * 360 / factionCount) % 360;
  }

  function colorForSpecies(species, factionCount) {
    var count = factionCount || (activeConfig || currentConfig()).factions;
    return "hsl(" + speciesHue(species, count).toFixed(1) + " 72% 56%)";
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
    var ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    resizeChart(ratio);
    balls.forEach(function (ball) {
      ball.x = clamp(ball.x * width / previousWidth, BALL_RADIUS, width - BALL_RADIUS);
      ball.y = clamp(ball.y * height / previousHeight, BALL_RADIUS, height - BALL_RADIUS);
    });
    updateStats();
    if (!running) drawWorld();
  }

  function resetHistory() {
    var counts = populationCounts(balls, (activeConfig || currentConfig()).factions);
    history = [{ time: 0, counts: counts.slice() }];
    historyIntervalMs = 100;
    nextHistoryAt = historyIntervalMs;
  }

  function recordHistory() {
    if (!started || elapsedMs < nextHistoryAt) return;
    var counts = populationCounts(balls, activeConfig.factions);
    history.push({
      time: elapsedMs,
      counts: counts.slice()
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

  function seedWorld(config) {
    balls = [];
    elapsedMs = 0;
    var speed = BASE_SPEED * config.speed;
    for (var species = 0; species < config.factions; species += 1) {
      for (var index = 0; index < config.count; index += 1) {
        balls.push(createBall(species, config.factions, speed));
      }
    }
    resetHistory();
  }

  function resetWorld(shouldRun) {
    activeConfig = currentConfig();
    seedWorld(activeConfig);
    started = Boolean(shouldRun);
    running = Boolean(shouldRun);
    visibilitySuspended = false;
    lastFrameAt = performance.now();
    updateControls();
    updateStats();
    updateLegend();
    drawWorld();
    cancelAnimation();
    if (running) frameId = requestAnimationFrame(function (time) { animate(time, mountVersion); });
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
    var totalMilliseconds = Math.floor(Math.max(0, milliseconds));
    var minutes = Math.floor(totalMilliseconds / 60000);
    var seconds = Math.floor(totalMilliseconds / 1000) % 60;
    var millisecondsPart = totalMilliseconds % 1000;
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
      var counts = populationCounts(balls, activeConfig.factions);
      points.push({ time: elapsedMs, counts: counts.slice() });
    }
    return points.length ? points : [{ time: 0, counts: [] }];
  }

  function drawChartLine(points, species, left, top, plotWidth, plotHeight, timeMaximum, countMaximum) {
    chartContext.strokeStyle = colorForSpecies(species);
    chartContext.lineWidth = 2;
    chartContext.lineJoin = "round";
    chartContext.lineCap = "round";
    chartContext.beginPath();
    points.forEach(function (point, index) {
      var x = left + clamp(point.time / timeMaximum, 0, 1) * plotWidth;
      var y = top + plotHeight - clamp((point.counts[species] || 0) / countMaximum, 0, 1) * plotHeight;
      if (!index) chartContext.moveTo(x, y);
      else chartContext.lineTo(x, y);
    });
    chartContext.stroke();
  }

  function drawChart(chartWidth, chartHeight) {
    if (!chartContext || !chartCanvas || !palette) return;
    var stage = container && container.querySelector("#cycle-game-stage");
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
      return Math.max.apply(Math, [value].concat(point.counts));
    }, 0);
    var countMaximum = Math.max(5, Math.ceil(maximum * 1.15));

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
      chartContext.fillText(String(Math.round(countMaximum * yRatio)), left - 7, y);
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
    chartContext.fillText(t("cycleGame.chartTimeAxis"), left + plotWidth / 2, heightValue - 7);
    chartContext.translate(11, top + plotHeight / 2);
    chartContext.rotate(-Math.PI / 2);
    chartContext.fillText(t("cycleGame.chartCountAxis"), 0, 0);
    chartContext.restore();
    var factionCount = (activeConfig || currentConfig()).factions;
    for (var species = 0; species < factionCount; species += 1) {
      drawChartLine(points, species, left, top, plotWidth, plotHeight, timeMaximum, countMaximum);
    }
  }

  function drawWorld() {
    if (!context || !palette) return;
    context.fillStyle = palette.background;
    context.fillRect(0, 0, width, height);
    balls.forEach(function (ball) {
      context.fillStyle = colorForSpecies(ball.species);
      context.beginPath();
      context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      context.fill();
    });
    if (!started) {
      context.fillStyle = palette.text;
      context.textAlign = "center";
      context.font = "600 13px -apple-system, BlinkMacSystemFont, sans-serif";
      context.fillText(t("cycleGame.previewHint"), width / 2, height - 24);
    }
    drawChart();
  }

  function unifiedSpecies(counts) {
    var occupied = counts.reduce(function (total, count) { return total + (count > 0 ? 1 : 0); }, 0);
    if (occupied !== 1) return null;
    return counts.findIndex(function (count) { return count > 0; });
  }

  function factionLabel(species) {
    return t("cycleGame.faction").replace("{number}", String(species + 1));
  }

  function updateStats() {
    if (!container) return;
    var factionCount = (activeConfig || currentConfig()).factions;
    var counts = populationCounts(balls, factionCount);
    var unified = started ? unifiedSpecies(counts) : null;
    var leader = counts.reduce(function (best, count, index) {
      return count > best.count ? { count: count, species: index } : best;
    }, { count: -1, species: 0 });
    var activeFactions = counts.reduce(function (total, count) {
      return total + (count > 0 ? 1 : 0);
    }, 0);
    container.querySelector("#cycle-game-time").textContent = formatTime(elapsedMs);
    container.querySelector("#cycle-game-leader-stat").textContent =
      factionLabel(leader.species) + " · " + leader.count;
    container.querySelector("#cycle-game-active-stat").textContent =
      activeFactions + " / " + factionCount;
    container.querySelector("#cycle-game-total-stat").textContent = String(balls.length);
    container.querySelector("#cycle-game-speed-stat").textContent =
      (activeConfig || currentConfig()).speed.toFixed(1) + "×";
    var status = container.querySelector("#cycle-game-status");
    status.classList.toggle("is-live", running && unified === null);
    status.classList.toggle("is-unified", unified !== null);
    var text = !started
      ? t("cycleGame.status.ready")
      : (unified !== null
        ? t("cycleGame.status.unified").replace("{faction}", factionLabel(unified))
        : t("cycleGame.status." + (running ? "running" : "paused")));
    status.querySelector("span:last-child").textContent = text;
  }

  function updateControls() {
    if (!container) return;
    var factionCount = (activeConfig || currentConfig()).factions;
    var unified = started && unifiedSpecies(populationCounts(balls, factionCount)) !== null;
    var startButton = container.querySelector("#cycle-game-start");
    var pauseButton = container.querySelector("#cycle-game-pause");
    startButton.textContent = t(started ? "cycleGame.regenerate" : "cycleGame.start");
    pauseButton.textContent = t(running ? "cycleGame.pause" : "cycleGame.resume");
    pauseButton.disabled = !started || unified;
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
    var unified = unifiedSpecies(populationCounts(balls, activeConfig.factions)) !== null;
    if (unified) running = false;
    recordHistory();
    drawWorld();
    updateStats();
    updateControls();
    if (running) frameId = requestAnimationFrame(function (nextTime) { animate(nextTime, version); });
    else frameId = 0;
  }

  function syncFullscreenState() {
    if (!container) return;
    var stage = container.querySelector("#cycle-game-stage");
    if (!stage) return;
    var active = stage.classList.contains("is-viewport-fullscreen");
    stage.classList.toggle("is-fullscreen", active);
    var enterButton = container.querySelector("#cycle-game-fullscreen");
    if (enterButton) enterButton.setAttribute("aria-pressed", String(active));
    setTimeout(resizeCanvas, 60);
  }

  function enterFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#cycle-game-stage");
    if (!stage) return;
    stage.classList.add("is-viewport-fullscreen");
    document.body.classList.add("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function exitFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#cycle-game-stage");
    if (stage) stage.classList.remove("is-viewport-fullscreen", "is-fullscreen");
    document.body.classList.remove("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function handleKeydown(event) {
    if (event.key !== "Escape" || !container) return;
    var stage = container.querySelector("#cycle-game-stage");
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
    container.querySelector("#cycle-game-factions-value").textContent =
      container.querySelector("#cycle-game-factions").value;
    container.querySelector("#cycle-game-count-value").textContent =
      container.querySelector("#cycle-game-count").value;
    container.querySelector("#cycle-game-speed-value").textContent =
      Number(container.querySelector("#cycle-game-speed").value).toFixed(1) + "×";
    if (!started) resetWorld(false);
  }

  function bindEvents() {
    container.querySelector("#cycle-game-start").addEventListener("click", function () { resetWorld(true); });
    container.querySelector("#cycle-game-pause").addEventListener("click", function () { setRunning(!running); });
    ["#cycle-game-factions", "#cycle-game-count", "#cycle-game-speed"].forEach(function (selector) {
      container.querySelector(selector).addEventListener("input", updateInputLabels);
    });
    container.querySelector("#cycle-game-fullscreen").addEventListener("click", enterFullscreen);
    container.querySelector("#cycle-game-exit-fullscreen").addEventListener("click", exitFullscreen);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("keydown", handleKeydown);
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement);
    resizeObserver.observe(chartCanvas.parentElement);
    themeObserver = new MutationObserver(function () {
      readPalette();
      updateLegend();
      drawWorld();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function legendItems(requestedFactionCount) {
    var factionCount = requestedFactionCount || (activeConfig || currentConfig()).factions;
    var items = [];
    for (var species = 0; species < factionCount; species += 1) {
      items.push('<span class="predator-game-legend-item"><i class="cycle-game-swatch" style="background:' +
        colorForSpecies(species, factionCount) + '" aria-hidden="true"></i>' + factionLabel(species) + '</span>');
    }
    return items.join("");
  }

  function updateLegend() {
    if (!container) return;
    var legend = container.querySelector(".cycle-game-legend");
    if (legend) legend.innerHTML = legendItems();
  }

  function init(element) {
    deactivate();
    mountVersion += 1;
    container = element;
    container.innerHTML = '<div class="ball-game-tool cycle-game-tool">' +
      '<div class="ball-game-layout"><aside class="ball-game-config"><section class="ball-game-guide" aria-labelledby="cycle-game-guide-title"><h2 id="cycle-game-guide-title">' + t("cycleGame.guide.title") + '</h2><ul>' +
        '<li>' + t("cycleGame.guide.item1") + '</li><li>' + t("cycleGame.guide.item2") + '</li><li>' + t("cycleGame.guide.item3") + '</li><li>' + t("cycleGame.guide.item4") + '</li></ul></section>' +
        '<h3>' + t("cycleGame.configTitle") + '</h3>' +
        '<label class="ball-game-control" for="cycle-game-factions"><span><b>' + t("cycleGame.factionCount") + '</b><output id="cycle-game-factions-value">3</output></span><input id="cycle-game-factions" type="range" min="2" max="20" step="1" value="3"></label>' +
        '<label class="ball-game-control" for="cycle-game-count"><span><b>' + t("cycleGame.initialCount") + '</b><output id="cycle-game-count-value">30</output></span><input id="cycle-game-count" type="range" min="1" max="300" step="1" value="30"></label>' +
        '<label class="ball-game-control" for="cycle-game-speed"><span><b>' + t("cycleGame.baseSpeed") + '</b><output id="cycle-game-speed-value">1.0×</output></span><input id="cycle-game-speed" type="range" min="0.1" max="10" step="0.1" value="1"></label>' +
        '<div class="ball-game-actions"><button id="cycle-game-start" class="ball-game-primary" type="button">' + t("cycleGame.start") + '</button><button id="cycle-game-pause" type="button" disabled aria-pressed="false">' + t("cycleGame.resume") + '</button></div>' +
        '<p class="ball-game-config-note">' + t("cycleGame.configNote") + '</p></aside>' +
        '<main id="cycle-game-stage" class="ball-game-stage-card cycle-game-stage"><div class="ball-game-fullscreen-toolbar"><span>' + t("cycleGame.fullscreenTitle") + '</span><button id="cycle-game-exit-fullscreen" type="button">' + t("cycleGame.exitFullscreen") + '</button></div><div class="ball-game-stats">' +
          '<div><span>' + t("cycleGame.totalTime") + '</span><strong id="cycle-game-time">00:00.000</strong></div>' +
          '<div><span>' + t("cycleGame.leader") + '</span><strong id="cycle-game-leader-stat">' + t("cycleGame.faction").replace("{number}", "1") + ' · 30</strong></div>' +
          '<div><span>' + t("cycleGame.activeFactions") + '</span><strong id="cycle-game-active-stat">3 / 3</strong></div>' +
          '<div><span>' + t("cycleGame.totalCount") + '</span><strong id="cycle-game-total-stat">90</strong></div>' +
          '<div><span>' + t("cycleGame.currentSpeed") + '</span><strong id="cycle-game-speed-stat">1.0×</strong></div></div>' +
          '<div class="ball-game-status-row"><div id="cycle-game-status" class="ball-game-status cycle-game-status"><span aria-hidden="true"></span><span>' + t("cycleGame.status.ready") + '</span></div><div class="ball-game-status-actions"><span>' + t("cycleGame.totalHint") + '</span><button id="cycle-game-fullscreen" type="button" aria-pressed="false">' + t("cycleGame.fullscreen") + '</button></div></div>' +
          '<div class="ball-game-canvas-shell"><canvas id="cycle-game-canvas" class="ball-game-canvas" role="img" aria-label="' + t("cycleGame.canvasLabel") + '"></canvas></div>' +
          '<section class="ball-game-chart-card"><div><h3>' + t("cycleGame.populationChart") + '</h3><div class="predator-game-legend cycle-game-legend">' +
            legendItems(3) +
          '</div></div><div class="ball-game-chart-shell"><canvas id="cycle-game-chart" class="ball-game-population-chart" role="img" aria-label="' + t("cycleGame.chartLabel") + '"></canvas></div></section></main></div>' +
      '</div>';
    canvas = container.querySelector("#cycle-game-canvas");
    context = canvas.getContext("2d");
    chartCanvas = container.querySelector("#cycle-game-chart");
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
    balls = [];
    history = [];
    activeConfig = null;
    elapsedMs = 0;
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
      clamp: clamp,
      normalizeConfig: normalizeConfig,
      winnerSpecies: winnerSpecies,
      populationCounts: populationCounts,
      velocityFor: velocityFor,
      clusterCenter: clusterCenter,
      buildSpatialGrid: buildSpatialGrid,
      collisionPairs: collisionPairs,
      unifiedSpecies: unifiedSpecies,
      formatTime: formatTime,
      formatAxisTime: formatAxisTime,
      physicsSubstepCount: physicsSubstepCount
    }
  };
})();
