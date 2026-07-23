// Red vs Green — a constant-population battle driven by local numerical support.
var WarGameTool = (function () {
  "use strict";

  var RED = 0;
  var GREEN = 1;
  var MIN_COUNT = 1;
  var MAX_COUNT = 500;
  var MIN_SPEED = 0.1;
  var MAX_SPEED = 10;
  var BASE_SPEED = 70;
  var BALL_RADIUS = 6;
  var COLLISION_CELL_SIZE = BALL_RADIUS * 2;
  var SUPPORT_RADIUS = 58;
  var CONVERSION_COOLDOWN_MS = 140;
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

  function normalizeConfig(count, speed) {
    return {
      count: clamp(Math.round(Number(count) || 80), MIN_COUNT, MAX_COUNT),
      speed: clamp(Number(speed) || 1, MIN_SPEED, MAX_SPEED)
    };
  }

  function currentConfig() {
    if (!container) return normalizeConfig(80, 1);
    return normalizeConfig(
      container.querySelector("#war-game-count").value,
      container.querySelector("#war-game-speed").value
    );
  }

  function velocityFor(speed, angle) {
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
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

  function nearbySupport(species, x, y, ballList, grid, radius, cellSize) {
    var support = 0;
    var radiusSquared = radius * radius;
    var cellX = Math.floor(x / cellSize);
    var cellY = Math.floor(y / cellSize);
    var reach = Math.ceil(radius / cellSize);
    for (var offsetX = -reach; offsetX <= reach; offsetX += 1) {
      for (var offsetY = -reach; offsetY <= reach; offsetY += 1) {
        var candidates = grid.get((cellX + offsetX) + ":" + (cellY + offsetY)) || [];
        candidates.forEach(function (index) {
          var ball = ballList[index];
          if (ball.species !== species) return;
          var dx = ball.x - x;
          var dy = ball.y - y;
          if (dx * dx + dy * dy <= radiusSquared) support += 1;
        });
      }
    }
    return Math.max(1, support);
  }

  function battleWinner(redSupport, greenSupport, rng) {
    var redStrength = Math.max(1, Number(redSupport) || 1);
    var greenStrength = Math.max(1, Number(greenSupport) || 1);
    var redChance = redStrength / (redStrength + greenStrength);
    return (rng || randomSource)() < redChance ? RED : GREEN;
  }

  function populationCounts(ballList) {
    return ballList.reduce(function (counts, ball) {
      counts[ball.species] += 1;
      return counts;
    }, [0, 0]);
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
            var collisionDistance = BALL_RADIUS * 2;
            if (dx * dx + dy * dy <= collisionDistance * collisionDistance) {
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

  function seedPosition(species, rng) {
    var source = rng || randomSource;
    var left = BALL_RADIUS;
    var right = width - BALL_RADIUS;
    var middleGap = Math.min(24, width * 0.04);
    return {
      x: species === RED
        ? left + source() * Math.max(1, width / 2 - middleGap - left)
        : width / 2 + middleGap + source() * Math.max(1, right - width / 2 - middleGap),
      y: BALL_RADIUS + source() * Math.max(1, height - BALL_RADIUS * 2)
    };
  }

  function createBall(species, speed, rng) {
    var source = rng || randomSource;
    var position = seedPosition(species, source);
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

  function resolveBattles() {
    var supportGrid = buildSpatialGrid(balls, SUPPORT_RADIUS);
    collisionPairs(balls, elapsedMs).forEach(function (pair) {
      var first = balls[pair[0]];
      var second = balls[pair[1]];
      var midpointX = (first.x + second.x) / 2;
      var midpointY = (first.y + second.y) / 2;
      var redSupport = nearbySupport(RED, midpointX, midpointY, balls, supportGrid, SUPPORT_RADIUS, SUPPORT_RADIUS);
      var greenSupport = nearbySupport(GREEN, midpointX, midpointY, balls, supportGrid, SUPPORT_RADIUS, SUPPORT_RADIUS);
      var winner = battleWinner(redSupport, greenSupport, randomSource);
      if (first.species !== winner) first.species = winner;
      else second.species = winner;
      first.immuneUntil = elapsedMs + CONVERSION_COOLDOWN_MS;
      second.immuneUntil = elapsedMs + CONVERSION_COOLDOWN_MS;
    });
  }

  function physicsSubstepCount(deltaSeconds, speedMultiplier) {
    var maximumStepSeconds = (BALL_RADIUS * 0.5) / Math.max(BASE_SPEED * speedMultiplier, 1);
    return Math.max(1, Math.ceil(deltaSeconds / maximumStepSeconds));
  }

  function updateWorld(deltaSeconds) {
    var speedMultiplier = (activeConfig || currentConfig()).speed;
    var stepCount = physicsSubstepCount(deltaSeconds, speedMultiplier);
    var stepSeconds = deltaSeconds / stepCount;
    for (var step = 0; step < stepCount; step += 1) {
      balls.forEach(function (ball) { moveAndBounce(ball, stepSeconds); });
      resolveBattles();
    }
  }

  function readPalette() {
    var styles = getComputedStyle(document.documentElement);
    palette = {
      background: styles.getPropertyValue("--ball-game-canvas-bg").trim() || "#10161f",
      text: styles.getPropertyValue("--text-muted").trim() || "#8b949e",
      border: styles.getPropertyValue("--border").trim() || "#30363d",
      red: styles.getPropertyValue("--ecosystem-predator").trim() || "#fb7185",
      green: styles.getPropertyValue("--ecosystem-resource").trim() || "#4ade80"
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

  function seedWorld(config) {
    balls = [];
    elapsedMs = 0;
    var speed = BASE_SPEED * config.speed;
    [RED, GREEN].forEach(function (species) {
      for (var index = 0; index < config.count; index += 1) {
        balls.push(createBall(species, speed));
      }
    });
    resetHistory();
  }

  function resetHistory() {
    var counts = populationCounts(balls);
    history = [{ time: 0, red: counts[RED], green: counts[GREEN] }];
    historyIntervalMs = 100;
    nextHistoryAt = historyIntervalMs;
  }

  function recordHistory() {
    if (!started || elapsedMs < nextHistoryAt) return;
    var counts = populationCounts(balls);
    history.push({ time: elapsedMs, red: counts[RED], green: counts[GREEN] });
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
    activeConfig = currentConfig();
    seedWorld(activeConfig);
    started = Boolean(shouldRun);
    running = Boolean(shouldRun);
    visibilitySuspended = false;
    lastFrameAt = performance.now();
    updateControls();
    updateStats();
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
      var counts = populationCounts(balls);
      points.push({ time: elapsedMs, red: counts[RED], green: counts[GREEN] });
    }
    return points.length ? points : [{ time: 0, red: 0, green: 0 }];
  }

  function drawChartLine(points, field, color, left, top, plotWidth, plotHeight, timeMaximum, countMaximum) {
    chartContext.strokeStyle = color;
    chartContext.lineWidth = 2;
    chartContext.lineJoin = "round";
    chartContext.lineCap = "round";
    chartContext.beginPath();
    points.forEach(function (point, index) {
      var x = left + clamp(point.time / timeMaximum, 0, 1) * plotWidth;
      var y = top + plotHeight - clamp(point[field] / countMaximum, 0, 1) * plotHeight;
      if (!index) chartContext.moveTo(x, y);
      else chartContext.lineTo(x, y);
    });
    chartContext.stroke();
  }

  function drawChart(chartWidth, chartHeight) {
    if (!chartContext || !chartCanvas || !palette) return;
    var stage = container && container.querySelector("#war-game-stage");
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
      return Math.max(value, point.red, point.green);
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
    chartContext.fillText(t("warGame.chartTimeAxis"), left + plotWidth / 2, heightValue - 7);
    chartContext.translate(11, top + plotHeight / 2);
    chartContext.rotate(-Math.PI / 2);
    chartContext.fillText(t("warGame.chartCountAxis"), 0, 0);
    chartContext.restore();
    drawChartLine(points, "red", palette.red, left, top, plotWidth, plotHeight, timeMaximum, countMaximum);
    drawChartLine(points, "green", palette.green, left, top, plotWidth, plotHeight, timeMaximum, countMaximum);
  }

  function drawWorld() {
    if (!context || !palette) return;
    context.fillStyle = palette.background;
    context.fillRect(0, 0, width, height);
    balls.forEach(function (ball) {
      context.fillStyle = ball.species === RED ? palette.red : palette.green;
      context.beginPath();
      context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      context.fill();
    });
    if (!started) {
      context.fillStyle = palette.text;
      context.textAlign = "center";
      context.font = "600 13px -apple-system, BlinkMacSystemFont, sans-serif";
      context.fillText(t("warGame.previewHint"), width / 2, height - 24);
    }
    drawChart();
  }

  function winningSpecies(counts) {
    if (counts[RED] === 0 && counts[GREEN] > 0) return GREEN;
    if (counts[GREEN] === 0 && counts[RED] > 0) return RED;
    return null;
  }

  function advantageText(counts) {
    var difference = counts[RED] - counts[GREEN];
    if (!difference) return t("warGame.balance");
    return (difference > 0 ? t("warGame.red") : t("warGame.green")) + " +" + Math.abs(difference);
  }

  function updateStats() {
    if (!container) return;
    var counts = populationCounts(balls);
    var winner = started ? winningSpecies(counts) : null;
    container.querySelector("#war-game-time").textContent = formatTime(elapsedMs);
    container.querySelector("#war-game-red-stat").textContent = String(counts[RED]);
    container.querySelector("#war-game-green-stat").textContent = String(counts[GREEN]);
    container.querySelector("#war-game-advantage-stat").textContent = advantageText(counts);
    container.querySelector("#war-game-speed-stat").textContent =
      (activeConfig || currentConfig()).speed.toFixed(1) + "×";
    var status = container.querySelector("#war-game-status");
    status.classList.toggle("is-live", running && winner === null);
    status.classList.toggle("is-unified", winner !== null);
    var statusText = !started
      ? t("warGame.status.ready")
      : (winner !== null
        ? t("warGame.status.winner").replace("{side}", winner === RED ? t("warGame.red") : t("warGame.green"))
        : t("warGame.status." + (running ? "running" : "paused")));
    status.querySelector("span:last-child").textContent = statusText;
  }

  function updateControls() {
    if (!container) return;
    var winner = started && winningSpecies(populationCounts(balls)) !== null;
    var startButton = container.querySelector("#war-game-start");
    var pauseButton = container.querySelector("#war-game-pause");
    startButton.textContent = t(started ? "warGame.regenerate" : "warGame.start");
    pauseButton.textContent = t(running ? "warGame.pause" : "warGame.resume");
    pauseButton.disabled = !started || winner;
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
    if (winningSpecies(populationCounts(balls)) !== null) running = false;
    recordHistory();
    drawWorld();
    updateStats();
    updateControls();
    if (running) frameId = requestAnimationFrame(function (nextTime) { animate(nextTime, version); });
    else frameId = 0;
  }

  function syncFullscreenState() {
    if (!container) return;
    var stage = container.querySelector("#war-game-stage");
    if (!stage) return;
    var active = stage.classList.contains("is-viewport-fullscreen");
    stage.classList.toggle("is-fullscreen", active);
    var enterButton = container.querySelector("#war-game-fullscreen");
    if (enterButton) enterButton.setAttribute("aria-pressed", String(active));
    setTimeout(resizeCanvas, 60);
  }

  function enterFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#war-game-stage");
    if (!stage) return;
    stage.classList.add("is-viewport-fullscreen");
    document.body.classList.add("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function exitFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#war-game-stage");
    if (stage) stage.classList.remove("is-viewport-fullscreen", "is-fullscreen");
    document.body.classList.remove("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function handleKeydown(event) {
    if (event.key !== "Escape" || !container) return;
    var stage = container.querySelector("#war-game-stage");
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
    container.querySelector("#war-game-count-value").textContent =
      container.querySelector("#war-game-count").value;
    container.querySelector("#war-game-speed-value").textContent =
      Number(container.querySelector("#war-game-speed").value).toFixed(1) + "×";
    if (!started) resetWorld(false);
  }

  function bindEvents() {
    container.querySelector("#war-game-start").addEventListener("click", function () { resetWorld(true); });
    container.querySelector("#war-game-pause").addEventListener("click", function () { setRunning(!running); });
    ["#war-game-count", "#war-game-speed"].forEach(function (selector) {
      container.querySelector(selector).addEventListener("input", updateInputLabels);
    });
    container.querySelector("#war-game-fullscreen").addEventListener("click", enterFullscreen);
    container.querySelector("#war-game-exit-fullscreen").addEventListener("click", exitFullscreen);
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
    container.innerHTML = '<div class="ball-game-tool war-game-tool">' +
      '<div class="ball-game-layout"><aside class="ball-game-config"><section class="ball-game-guide" aria-labelledby="war-game-guide-title"><h2 id="war-game-guide-title">' + t("warGame.guide.title") + '</h2><ul>' +
        '<li>' + t("warGame.guide.item1") + '</li><li>' + t("warGame.guide.item2") + '</li><li>' + t("warGame.guide.item3") + '</li><li>' + t("warGame.guide.item4") + '</li></ul></section>' +
        '<h3>' + t("warGame.configTitle") + '</h3>' +
        '<label class="ball-game-control" for="war-game-count"><span><b>' + t("warGame.initialCount") + '</b><output id="war-game-count-value">80</output></span><input id="war-game-count" type="range" min="1" max="500" step="1" value="80"></label>' +
        '<label class="ball-game-control" for="war-game-speed"><span><b>' + t("warGame.baseSpeed") + '</b><output id="war-game-speed-value">1.0×</output></span><input id="war-game-speed" type="range" min="0.1" max="10" step="0.1" value="1"></label>' +
        '<div class="ball-game-actions"><button id="war-game-start" class="ball-game-primary" type="button">' + t("warGame.start") + '</button><button id="war-game-pause" type="button" disabled aria-pressed="false">' + t("warGame.resume") + '</button></div>' +
        '<p class="ball-game-config-note">' + t("warGame.configNote") + '</p></aside>' +
        '<main id="war-game-stage" class="ball-game-stage-card war-game-stage"><div class="ball-game-fullscreen-toolbar"><span>' + t("warGame.fullscreenTitle") + '</span><button id="war-game-exit-fullscreen" type="button">' + t("warGame.exitFullscreen") + '</button></div><div class="ball-game-stats">' +
          '<div><span>' + t("warGame.totalTime") + '</span><strong id="war-game-time">00:00.000</strong></div>' +
          '<div><span>' + t("warGame.red") + '</span><strong id="war-game-red-stat">80</strong></div>' +
          '<div><span>' + t("warGame.green") + '</span><strong id="war-game-green-stat">80</strong></div>' +
          '<div><span>' + t("warGame.advantage") + '</span><strong id="war-game-advantage-stat">' + t("warGame.balance") + '</strong></div>' +
          '<div><span>' + t("warGame.currentSpeed") + '</span><strong id="war-game-speed-stat">1.0×</strong></div></div>' +
          '<div class="ball-game-status-row"><div id="war-game-status" class="ball-game-status war-game-status"><span aria-hidden="true"></span><span>' + t("warGame.status.ready") + '</span></div><div class="ball-game-status-actions"><span>' + t("warGame.totalHint") + '</span><button id="war-game-fullscreen" type="button" aria-pressed="false">' + t("warGame.fullscreen") + '</button></div></div>' +
          '<div class="ball-game-canvas-shell"><canvas id="war-game-canvas" class="ball-game-canvas" role="img" aria-label="' + t("warGame.canvasLabel") + '"></canvas></div>' +
          '<section class="ball-game-chart-card"><div><h3>' + t("warGame.populationChart") + '</h3><div class="predator-game-legend"><span class="predator-game-legend-item"><i class="predator-game-swatch is-predators" aria-hidden="true"></i>' + t("warGame.red") + '</span><span class="predator-game-legend-item"><i class="predator-game-swatch is-resources" aria-hidden="true"></i>' + t("warGame.green") + '</span></div></div><div class="ball-game-chart-shell"><canvas id="war-game-chart" class="ball-game-population-chart" role="img" aria-label="' + t("warGame.chartLabel") + '"></canvas></div></section></main></div>' +
      '</div>';
    canvas = container.querySelector("#war-game-canvas");
    context = canvas.getContext("2d");
    chartCanvas = container.querySelector("#war-game-chart");
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
      normalizeConfig: normalizeConfig,
      velocityFor: velocityFor,
      buildSpatialGrid: buildSpatialGrid,
      nearbySupport: nearbySupport,
      battleWinner: battleWinner,
      populationCounts: populationCounts,
      collisionPairs: collisionPairs,
      winningSpecies: winningSpecies,
      formatTime: formatTime,
      formatAxisTime: formatAxisTime,
      physicsSubstepCount: physicsSubstepCount
    }
  };
})();
