// Ball Genesis — a local Canvas wall-splitting sandbox.
var BallGameTool = (function () {
  "use strict";

  var MIN_COUNT = 1;
  var MAX_COUNT = 20;
  var MIN_SPEED = 0.1;
  var MAX_SPEED = 10;
  var MIN_LIMIT = 1;
  var MAX_LIMIT = 10000;
  var BASE_SPEED = 70;
  var BALL_RADIUS = 8;
  var COLLISION_CELL_SIZE = BALL_RADIUS * 2;
  var MAX_DELTA_SECONDS = 0.032;

  var container = null;
  var canvas = null;
  var context = null;
  var populationCanvas = null;
  var populationContext = null;
  var balls = [];
  var populationHistory = [];
  var populationSampleIntervalMs = 100;
  var nextPopulationSampleAt = 100;
  var generationColors = [];
  var width = 0;
  var height = 0;
  var populationLimit = 40;
  var recommendedLimit = 40;
  var limitCustomized = false;
  var activeConfig = null;
  var elapsedMs = 0;
  var reachedLimitAtMs = null;
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

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function randomBetween(minimum, maximum, rng) {
    return minimum + (maximum - minimum) * (rng || randomSource)();
  }

  function normalizeConfig(count, speed, color, limit, recommendation) {
    var normalizedColor = /^#[0-9a-f]{6}$/i.test(String(color || "")) ? String(color).toLowerCase() : "#3b82f6";
    var normalizedCount = clamp(Math.round(Number(count) || 1), MIN_COUNT, MAX_COUNT);
    var fallbackLimit = clamp(Math.round(Number(recommendation) || 40), MIN_LIMIT, MAX_LIMIT);
    return {
      count: normalizedCount,
      speed: clamp(Number(speed) || 1, MIN_SPEED, MAX_SPEED),
      color: normalizedColor,
      limit: clamp(Math.round(Number(limit) || fallbackLimit), Math.max(MIN_LIMIT, normalizedCount), MAX_LIMIT)
    };
  }

  function populationCap(canvasWidth, canvasHeight) {
    return clamp(Math.floor((Math.max(0, canvasWidth) * Math.max(0, canvasHeight)) / 6500), 40, 160);
  }

  function validatePopulationLimit(rawValue, count) {
    var text = String(rawValue === undefined || rawValue === null ? "" : rawValue).trim();
    var numericValue = Number(text);
    if (!text || !Number.isFinite(numericValue) || !Number.isInteger(numericValue) || numericValue < MIN_LIMIT || numericValue > MAX_LIMIT) {
      return { valid: false, value: null, error: "range" };
    }
    if (numericValue < count) return { valid: false, value: null, error: "count" };
    return { valid: true, value: numericValue, error: null };
  }

  function hexToHsl(hex) {
    var normalized = String(hex || "#3b82f6").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) normalized = "3b82f6";
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

  function nextGenerationColor(previous, rng) {
    var source = rng || randomSource;
    var direction = source() < 0.5 ? -1 : 1;
    return {
      h: (previous.h + direction * randomBetween(24, 60, source) + 360) % 360,
      s: clamp(previous.s + randomBetween(-5, 5, source), 46, 88),
      l: clamp(previous.l + randomBetween(-6, 6, source), 40, 68)
    };
  }

  function generationColor(colors, generation, rng) {
    while (colors.length <= generation) {
      colors.push(nextGenerationColor(colors[colors.length - 1], rng));
    }
    return colors[generation];
  }

  function colorForGeneration(generation) {
    return generationColor(generationColors, generation, randomSource);
  }

  function symmetricAngles(normalAngle, spread) {
    return [normalAngle + spread, normalAngle - spread];
  }

  function velocityFor(speed, angle) {
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed
    };
  }

  function colorCss(color) {
    return "hsl(" + color.h.toFixed(1) + " " + color.s.toFixed(1) + "% " + color.l.toFixed(1) + "%)";
  }

  function currentConfig() {
    var config;
    if (!container) {
      config = normalizeConfig(1, 1, "#3b82f6", recommendedLimit, recommendedLimit);
      config.disappearOnContact = true;
      return config;
    }
    config = normalizeConfig(
      container.querySelector("#ball-game-count").value,
      container.querySelector("#ball-game-speed").value,
      container.querySelector("#ball-game-color").value,
      container.querySelector("#ball-game-limit").value,
      recommendedLimit
    );
    config.disappearOnContact = container.querySelector("#ball-game-collision").checked;
    return config;
  }

  function updateLimitRecommendation() {
    if (!container) return;
    var limitInput = container.querySelector("#ball-game-limit");
    var recommendationOutput = container.querySelector("#ball-game-limit-recommendation");
    if (!limitCustomized) limitInput.value = String(recommendedLimit);
    if (recommendationOutput) {
      recommendationOutput.textContent = t("ballGame.recommended") + " " + recommendedLimit;
    }
  }

  function limitValidation() {
    if (!container) return validatePopulationLimit(recommendedLimit, 1);
    var count = clamp(Math.round(Number(container.querySelector("#ball-game-count").value) || 1), MIN_COUNT, MAX_COUNT);
    return validatePopulationLimit(container.querySelector("#ball-game-limit").value, count);
  }

  function showLimitError(validation) {
    if (!container) return;
    var errorElement = container.querySelector("#ball-game-limit-error");
    if (!errorElement) return;
    errorElement.classList.toggle("hidden", validation.valid);
    errorElement.textContent = validation.valid
      ? ""
      : t("ballGame.errors." + validation.error) + (validation.error === "count" ? " " + container.querySelector("#ball-game-count").value : "");
  }

  function createBall(x, y, color, speed, angle, generation, bornAt) {
    var velocity = velocityFor(speed, angle);
    return {
      x: x,
      y: y,
      radius: BALL_RADIUS,
      color: color,
      vx: velocity.vx,
      vy: velocity.vy,
      generation: generation,
      wallImmuneUntil: bornAt + (generation ? 180 : 0),
      collisionImmuneUntil: bornAt + (generation ? 320 : 420)
    };
  }

  function placeSeedBall(config, baseColor) {
    var x = width / 2;
    var y = height / 2;
    var angle = randomSource() * Math.PI * 2;
    return createBall(
      x,
      y,
      { h: baseColor.h, s: baseColor.s, l: baseColor.l },
      BASE_SPEED * config.speed,
      angle,
      0,
      0
    );
  }

  function readPalette() {
    var styles = getComputedStyle(document.documentElement);
    palette = {
      background: styles.getPropertyValue("--ball-game-canvas-bg").trim() || "#10151d",
      text: styles.getPropertyValue("--text-muted").trim() || "#6e7681",
      border: styles.getPropertyValue("--border").trim() || "#30363d",
      accent: styles.getPropertyValue("--accent").trim() || "#2f81f7"
    };
  }

  function resizePopulationChart(ratio) {
    if (!populationCanvas || !populationCanvas.parentElement) return;
    var rect = populationCanvas.parentElement.getBoundingClientRect();
    var chartWidth = Math.max(280, Math.round(rect.width));
    var chartHeight = Math.max(150, Math.round(rect.height));
    populationCanvas.width = Math.round(chartWidth * ratio);
    populationCanvas.height = Math.round(chartHeight * ratio);
    populationCanvas.style.width = chartWidth + "px";
    populationCanvas.style.height = chartHeight + "px";
    populationContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawPopulationChart(chartWidth, chartHeight);
  }

  function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    var nextWidth = Math.max(280, Math.round(rect.width));
    var nextHeight = Math.max(320, Math.round(rect.height));
    var previousWidth = width || nextWidth;
    var previousHeight = height || nextHeight;
    width = nextWidth;
    height = nextHeight;
    recommendedLimit = populationCap(width, height);
    updateLimitRecommendation();
    var validation = limitValidation();
    if (!started && validation.valid) populationLimit = validation.value;
    var ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    resizePopulationChart(ratio);
    balls.forEach(function (ball) {
      ball.x = clamp(ball.x * width / previousWidth, BALL_RADIUS, width - BALL_RADIUS);
      ball.y = clamp(ball.y * height / previousHeight, BALL_RADIUS, height - BALL_RADIUS);
    });
    updateStats();
    if (!running) drawWorld();
  }

  function resetPopulationHistory() {
    populationHistory = [{ time: 0, count: balls.length }];
    populationSampleIntervalMs = 100;
    nextPopulationSampleAt = populationSampleIntervalMs;
  }

  function recordPopulationSample() {
    if (!started || elapsedMs < nextPopulationSampleAt) return;
    populationHistory.push({ time: elapsedMs, count: balls.length });
    nextPopulationSampleAt = elapsedMs + populationSampleIntervalMs;
    if (populationHistory.length > 1200) {
      populationHistory = populationHistory.filter(function (_, index) {
        return index % 2 === 0 || index === populationHistory.length - 1;
      });
      populationSampleIntervalMs *= 2;
      nextPopulationSampleAt = elapsedMs + populationSampleIntervalMs;
    }
  }

  function resetWorld(shouldRun) {
    var validation = limitValidation();
    showLimitError(validation);
    if (!validation.valid) return false;
    var config = currentConfig();
    config.limit = validation.value;
    activeConfig = config;
    populationLimit = config.limit;
    var baseColor = hexToHsl(config.color);
    balls = [];
    generationColors = [baseColor];
    elapsedMs = 0;
    reachedLimitAtMs = null;
    for (var index = 0; index < config.count; index += 1) {
      balls.push(placeSeedBall(config, baseColor));
    }
    resetPopulationHistory();
    started = Boolean(shouldRun);
    running = Boolean(shouldRun);
    visibilitySuspended = false;
    lastFrameAt = performance.now();
    updateControls();
    updateStats();
    var live = container.querySelector("#ball-game-live");
    if (live) {
      delete live.dataset.limitAnnounced;
      live.textContent = "";
    }
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

  function splitAtWall(ball, normalAngle) {
    var config = activeConfig || currentConfig();
    var generation = ball.generation + 1;
    var color = colorForGeneration(generation);
    var spread = randomBetween(0.38, 0.82);
    var angles = symmetricAngles(normalAngle, spread);
    var speed = BASE_SPEED * config.speed;
    var normalX = Math.cos(normalAngle);
    var normalY = Math.sin(normalAngle);
    var tangentX = -normalY;
    var tangentY = normalX;
    var centerX = clamp(ball.x + normalX * (BALL_RADIUS + 2), BALL_RADIUS, width - BALL_RADIUS);
    var centerY = clamp(ball.y + normalY * (BALL_RADIUS + 2), BALL_RADIUS, height - BALL_RADIUS);
    return [
      createBall(
        clamp(centerX + tangentX * BALL_RADIUS * 0.62, BALL_RADIUS, width - BALL_RADIUS),
        clamp(centerY + tangentY * BALL_RADIUS * 0.62, BALL_RADIUS, height - BALL_RADIUS),
        color,
        speed,
        angles[0],
        generation,
        elapsedMs
      ),
      createBall(
        clamp(centerX - tangentX * BALL_RADIUS * 0.62, BALL_RADIUS, width - BALL_RADIUS),
        clamp(centerY - tangentY * BALL_RADIUS * 0.62, BALL_RADIUS, height - BALL_RADIUS),
        color,
        speed,
        angles[1],
        generation,
        elapsedMs
      )
    ];
  }

  function wallCollision(ball) {
    var normalX = 0;
    var normalY = 0;
    if (ball.x <= BALL_RADIUS) { ball.x = BALL_RADIUS; normalX += 1; }
    else if (ball.x >= width - BALL_RADIUS) { ball.x = width - BALL_RADIUS; normalX -= 1; }
    if (ball.y <= BALL_RADIUS) { ball.y = BALL_RADIUS; normalY += 1; }
    else if (ball.y >= height - BALL_RADIUS) { ball.y = height - BALL_RADIUS; normalY -= 1; }
    if (!normalX && !normalY) return null;
    return Math.atan2(normalY, normalX);
  }

  function reflectFromWall(ball, normalAngle) {
    var normalX = Math.cos(normalAngle);
    var normalY = Math.sin(normalAngle);
    var dot = ball.vx * normalX + ball.vy * normalY;
    if (dot < 0) {
      ball.vx -= 2 * dot * normalX;
      ball.vy -= 2 * dot * normalY;
    }
  }

  function canSplitAtWall(ball, now, count, limit) {
    return now >= ball.wallImmuneUntil && count < limit;
  }

  function collidingBallIndexes(ballList, now) {
    var grid = new Map();
    var colliding = new Set();
    ballList.forEach(function (ball, index) {
      if (now < ball.collisionImmuneUntil) return;
      var cellX = Math.floor(ball.x / COLLISION_CELL_SIZE);
      var cellY = Math.floor(ball.y / COLLISION_CELL_SIZE);
      for (var offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (var offsetY = -1; offsetY <= 1; offsetY += 1) {
          var candidates = grid.get((cellX + offsetX) + ":" + (cellY + offsetY)) || [];
          candidates.forEach(function (otherIndex) {
            var other = ballList[otherIndex];
            var dx = ball.x - other.x;
            var dy = ball.y - other.y;
            var minimumDistance = ball.radius + other.radius;
            if (dx * dx + dy * dy <= minimumDistance * minimumDistance) {
              colliding.add(index);
              colliding.add(otherIndex);
            }
          });
        }
      }
      var key = cellX + ":" + cellY;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(index);
    });
    return Array.from(colliding);
  }

  function removeTouchingBalls() {
    if (!activeConfig || !activeConfig.disappearOnContact || balls.length < 2) return;
    var collidingIndexes = collidingBallIndexes(balls, elapsedMs);
    if (!collidingIndexes.length) return;
    var removed = new Set(collidingIndexes);
    balls = balls.filter(function (_, index) { return !removed.has(index); });
  }

  function updateWorldStep(deltaSeconds) {
    var projectedCount = balls.length;
    var nextBalls = [];
    balls.forEach(function (ball) {
      ball.x += ball.vx * deltaSeconds;
      ball.y += ball.vy * deltaSeconds;
      var normalAngle = wallCollision(ball);
      if (normalAngle !== null && canSplitAtWall(ball, elapsedMs, projectedCount, populationLimit)) {
        projectedCount += 1;
        if (started && projectedCount >= populationLimit && reachedLimitAtMs === null) reachedLimitAtMs = elapsedMs;
        nextBalls.push.apply(nextBalls, splitAtWall(ball, normalAngle));
      } else {
        if (normalAngle !== null) reflectFromWall(ball, normalAngle);
        nextBalls.push(ball);
      }
    });
    balls = nextBalls;
    removeTouchingBalls();
  }

  function physicsSubstepCount(deltaSeconds, speedMultiplier) {
    var maximumStepSeconds = (BALL_RADIUS * 0.5) / Math.max(BASE_SPEED * speedMultiplier, 1);
    return Math.max(1, Math.ceil(deltaSeconds / maximumStepSeconds));
  }

  function updateWorld(deltaSeconds) {
    var speedMultiplier = (activeConfig || currentConfig()).speed;
    var stepCount = physicsSubstepCount(deltaSeconds, speedMultiplier);
    var stepSeconds = deltaSeconds / stepCount;
    for (var step = 0; step < stepCount; step += 1) updateWorldStep(stepSeconds);
  }

  function drawBackground() {
    context.fillStyle = palette.background;
    context.fillRect(0, 0, width, height);
  }

  function drawBall(ball) {
    context.fillStyle = colorCss(ball.color);
    context.beginPath();
    context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    context.fill();
  }

  function formatAxisTime(milliseconds) {
    if (milliseconds < 60000) return (milliseconds / 1000).toFixed(milliseconds < 10000 ? 1 : 0) + "s";
    return (milliseconds / 60000).toFixed(1) + "m";
  }

  function drawPopulationChart(chartWidth, chartHeight) {
    if (!populationContext || !populationCanvas || !palette) return;
    var stage = container && container.querySelector("#ball-game-stage");
    if (stage && stage.classList.contains("is-fullscreen")) return;
    var widthValue = chartWidth || populationCanvas.clientWidth;
    var heightValue = chartHeight || populationCanvas.clientHeight;
    if (!widthValue || !heightValue) return;
    var left = 48;
    var right = 14;
    var top = 12;
    var bottom = 32;
    var plotWidth = Math.max(1, widthValue - left - right);
    var plotHeight = Math.max(1, heightValue - top - bottom);
    var points = populationHistory.slice();
    var lastPoint = points[points.length - 1];
    if (started && (!lastPoint || lastPoint.time < elapsedMs)) points.push({ time: elapsedMs, count: balls.length });
    if (!points.length) points.push({ time: 0, count: balls.length });
    var timeMaximum = Math.max(10000, elapsedMs, points[points.length - 1].time);
    var countMaximum = points.reduce(function (maximum, point) { return Math.max(maximum, point.count); }, 0);
    var yMaximum = Math.max(5, Math.ceil(countMaximum * 1.15));

    populationContext.clearRect(0, 0, widthValue, heightValue);
    populationContext.fillStyle = palette.background;
    populationContext.fillRect(0, 0, widthValue, heightValue);
    populationContext.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    populationContext.textBaseline = "middle";

    for (var yTick = 0; yTick <= 4; yTick += 1) {
      var yRatio = yTick / 4;
      var y = top + plotHeight - yRatio * plotHeight;
      populationContext.strokeStyle = palette.border;
      populationContext.lineWidth = 1;
      populationContext.beginPath();
      populationContext.moveTo(left, y + 0.5);
      populationContext.lineTo(left + plotWidth, y + 0.5);
      populationContext.stroke();
      populationContext.fillStyle = palette.text;
      populationContext.textAlign = "right";
      populationContext.fillText(String(Math.round(yMaximum * yRatio)), left - 7, y);
    }

    for (var xTick = 0; xTick <= 4; xTick += 1) {
      var xRatio = xTick / 4;
      var x = left + xRatio * plotWidth;
      populationContext.fillStyle = palette.text;
      populationContext.textAlign = "center";
      populationContext.fillText(formatAxisTime(timeMaximum * xRatio), x, top + plotHeight + 14);
    }

    populationContext.save();
    populationContext.fillStyle = palette.text;
    populationContext.textAlign = "center";
    populationContext.fillText(t("ballGame.chartTimeAxis"), left + plotWidth / 2, heightValue - 7);
    populationContext.translate(11, top + plotHeight / 2);
    populationContext.rotate(-Math.PI / 2);
    populationContext.fillText(t("ballGame.chartCountAxis"), 0, 0);
    populationContext.restore();

    populationContext.strokeStyle = palette.accent;
    populationContext.lineWidth = 2;
    populationContext.lineJoin = "round";
    populationContext.lineCap = "round";
    populationContext.beginPath();
    points.forEach(function (point, index) {
      var pointX = left + clamp(point.time / timeMaximum, 0, 1) * plotWidth;
      var pointY = top + plotHeight - clamp(point.count / yMaximum, 0, 1) * plotHeight;
      if (!index) populationContext.moveTo(pointX, pointY);
      else populationContext.lineTo(pointX, pointY);
    });
    populationContext.stroke();
  }

  function drawWorld() {
    if (!context || !palette) return;
    drawBackground();
    balls.forEach(drawBall);
    if (!started) {
      context.fillStyle = palette.text;
      context.textAlign = "center";
      context.font = "600 13px -apple-system, BlinkMacSystemFont, sans-serif";
      context.fillText(t("ballGame.previewHint"), width / 2, height - 24);
    }
    drawPopulationChart();
  }

  function formatTime(milliseconds) {
    var totalMilliseconds = Math.floor(Math.max(0, milliseconds));
    var minutes = Math.floor(totalMilliseconds / 60000);
    var seconds = Math.floor(totalMilliseconds / 1000) % 60;
    var millisecondsPart = totalMilliseconds % 1000;
    return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0") + "." + String(millisecondsPart).padStart(3, "0");
  }

  function updateStats() {
    if (!container) return;
    var generation = balls.reduce(function (maximum, ball) {
      return Math.max(maximum, ball.generation);
    }, 0);
    var atLimit = balls.length >= populationLimit;
    if (started && atLimit && reachedLimitAtMs === null) reachedLimitAtMs = elapsedMs;
    var totalTimeElement = container.querySelector("#ball-game-total-time");
    var limitTimeElement = container.querySelector("#ball-game-limit-time");
    var populationElement = container.querySelector("#ball-game-population");
    var generationElement = container.querySelector("#ball-game-generation");
    var speedElement = container.querySelector("#ball-game-speed-stat");
    if (totalTimeElement) totalTimeElement.textContent = formatTime(elapsedMs);
    if (limitTimeElement) limitTimeElement.textContent = formatTime(reachedLimitAtMs === null ? elapsedMs : reachedLimitAtMs);
    if (populationElement) populationElement.textContent = balls.length + " / " + populationLimit;
    if (generationElement) generationElement.textContent = String(generation);
    if (speedElement) speedElement.textContent = (activeConfig || currentConfig()).speed.toFixed(1) + "×";
    var status = container.querySelector("#ball-game-status");
    if (status) {
      status.classList.toggle("is-live", running);
      status.classList.toggle("is-limit", atLimit);
      var statusKey = !started ? "ready" : (atLimit ? "limit" : (running ? "running" : "paused"));
      status.querySelector("span:last-child").textContent = t("ballGame.status." + statusKey);
    }
    var live = container.querySelector("#ball-game-live");
    if (live && atLimit && live.dataset.limitAnnounced !== "true") {
      live.dataset.limitAnnounced = "true";
      live.textContent = t("ballGame.status.limit");
    }
  }

  function updateControls() {
    if (!container) return;
    var startButton = container.querySelector("#ball-game-start");
    var pauseButton = container.querySelector("#ball-game-pause");
    startButton.textContent = t(started ? "ballGame.regenerate" : "ballGame.start");
    pauseButton.textContent = t(running ? "ballGame.pause" : "ballGame.resume");
    pauseButton.disabled = !started;
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
    recordPopulationSample();
    drawWorld();
    updateStats();
    frameId = requestAnimationFrame(function (nextTime) { animate(nextTime, version); });
  }

  function syncFullscreenState() {
    if (!container) return;
    var stage = container.querySelector("#ball-game-stage");
    if (!stage) return;
    var active = stage.classList.contains("is-viewport-fullscreen");
    stage.classList.toggle("is-fullscreen", active);
    var enterButton = container.querySelector("#ball-game-fullscreen");
    if (enterButton) enterButton.setAttribute("aria-pressed", String(active));
    setTimeout(resizeCanvas, 60);
  }

  function enterFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#ball-game-stage");
    if (!stage) return;
    stage.classList.add("is-viewport-fullscreen");
    document.body.classList.add("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function exitFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#ball-game-stage");
    if (stage) stage.classList.remove("is-viewport-fullscreen", "is-fullscreen");
    document.body.classList.remove("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function handleKeydown(event) {
    if (event.key !== "Escape" || !container) return;
    var stage = container.querySelector("#ball-game-stage");
    if (stage && stage.classList.contains("is-viewport-fullscreen")) exitFullscreen();
  }

  function updateInputLabels() {
    if (!container) return;
    var countInput = container.querySelector("#ball-game-count");
    var speedInput = container.querySelector("#ball-game-speed");
    var colorInput = container.querySelector("#ball-game-color");
    updateLimitRecommendation();
    container.querySelector("#ball-game-count-value").textContent = countInput.value;
    container.querySelector("#ball-game-speed-value").textContent = Number(speedInput.value).toFixed(1) + "×";
    container.querySelector("#ball-game-color-value").textContent = colorInput.value.toUpperCase();
    var validation = limitValidation();
    showLimitError(validation);
    if (!started && validation.valid) resetWorld(false);
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

  function bindEvents() {
    container.querySelector("#ball-game-start").addEventListener("click", function () { resetWorld(true); });
    container.querySelector("#ball-game-pause").addEventListener("click", function () { setRunning(!running); });
    ["#ball-game-count", "#ball-game-speed", "#ball-game-color", "#ball-game-collision"].forEach(function (selector) {
      container.querySelector(selector).addEventListener("input", updateInputLabels);
    });
    container.querySelector("#ball-game-limit").addEventListener("input", function () {
      limitCustomized = true;
      updateInputLabels();
    });
    container.querySelector("#ball-game-fullscreen").addEventListener("click", enterFullscreen);
    container.querySelector("#ball-game-exit-fullscreen").addEventListener("click", exitFullscreen);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("keydown", handleKeydown);
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement);
    resizeObserver.observe(populationCanvas.parentElement);
    themeObserver = new MutationObserver(function () { readPalette(); drawWorld(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function init(element) {
    deactivate();
    mountVersion += 1;
    container = element;
    container.innerHTML = '<div class="ball-game-tool">' +
      '<div class="ball-game-layout"><aside class="ball-game-config"><section class="ball-game-guide" aria-labelledby="ball-game-guide-title"><h2 id="ball-game-guide-title">' + t("ballGame.guide.title") + '</h2><ul>' +
        '<li>' + t("ballGame.guide.item1") + '</li><li>' + t("ballGame.guide.item2") + '</li><li>' + t("ballGame.guide.item3") + '</li><li>' + t("ballGame.guide.item4") + '</li></ul></section>' +
        '<h3>' + t("ballGame.configTitle") + '</h3>' +
        '<label class="ball-game-control" for="ball-game-count"><span><b>' + t("ballGame.seedCount") + '</b><output id="ball-game-count-value">1</output></span><input id="ball-game-count" type="range" min="1" max="20" step="1" value="1"></label>' +
        '<label class="ball-game-control ball-game-color-control" for="ball-game-color"><span><b>' + t("ballGame.seedColor") + '</b><output id="ball-game-color-value">#3B82F6</output></span><input id="ball-game-color" type="color" value="#3b82f6"></label>' +
        '<label class="ball-game-control" for="ball-game-speed"><span><b>' + t("ballGame.baseSpeed") + '</b><output id="ball-game-speed-value">1.0×</output></span><input id="ball-game-speed" type="range" min="0.1" max="10" step="0.1" value="1"></label>' +
        '<label class="ball-game-control" for="ball-game-limit"><span><b>' + t("ballGame.populationLimit") + '</b><output id="ball-game-limit-recommendation">' + t("ballGame.recommended") + ' 40</output></span><input id="ball-game-limit" type="number" step="1" value="40" inputmode="numeric" aria-describedby="ball-game-limit-error"></label>' +
        '<label class="ball-game-control ball-game-toggle-control" for="ball-game-collision"><span><b>' + t("ballGame.collisionMode") + '</b><input id="ball-game-collision" type="checkbox" checked></span><small>' + t("ballGame.collisionHint") + '</small></label>' +
        '<div class="ball-game-actions"><button id="ball-game-start" class="ball-game-primary" type="button">' + t("ballGame.start") + '</button><button id="ball-game-pause" type="button" disabled aria-pressed="false">' + t("ballGame.resume") + '</button></div>' +
        '<p id="ball-game-limit-error" class="ball-game-config-error hidden" role="alert"></p>' +
        '<p class="ball-game-config-note">' + t("ballGame.configNote") + '</p></aside>' +
        '<main id="ball-game-stage" class="ball-game-stage-card"><div class="ball-game-fullscreen-toolbar"><span>' + t("ballGame.fullscreenTitle") + '</span><button id="ball-game-exit-fullscreen" type="button">' + t("ballGame.exitFullscreen") + '</button></div><div class="ball-game-stats">' +
          '<div><span>' + t("ballGame.totalTime") + '</span><strong id="ball-game-total-time">00:00.000</strong></div>' +
          '<div><span>' + t("ballGame.limitTime") + '</span><strong id="ball-game-limit-time">00:00.000</strong></div>' +
          '<div><span>' + t("ballGame.population") + '</span><strong id="ball-game-population">1 / 40</strong></div>' +
          '<div><span>' + t("ballGame.generation") + '</span><strong id="ball-game-generation">0</strong></div>' +
          '<div><span>' + t("ballGame.currentSpeed") + '</span><strong id="ball-game-speed-stat">1.0×</strong></div></div>' +
          '<div class="ball-game-status-row"><div id="ball-game-status" class="ball-game-status"><span aria-hidden="true"></span><span>' + t("ballGame.status.ready") + '</span></div><div class="ball-game-status-actions"><span>' + t("ballGame.capHint") + '</span><button id="ball-game-fullscreen" type="button" aria-pressed="false">' + t("ballGame.fullscreen") + '</button></div></div>' +
          '<div class="ball-game-canvas-shell"><canvas id="ball-game-canvas" role="img" aria-label="' + t("ballGame.canvasLabel") + '"></canvas></div>' +
          '<section class="ball-game-chart-card"><div><h3>' + t("ballGame.populationChart") + '</h3><span>' + t("ballGame.chartAxes") + '</span></div><div class="ball-game-chart-shell"><canvas id="ball-game-population-chart" class="ball-game-population-chart" role="img" aria-label="' + t("ballGame.chartLabel") + '"></canvas></div></section></main></div>' +
      '<p id="ball-game-live" class="sr-only" aria-live="polite"></p></div>';
    canvas = container.querySelector("#ball-game-canvas");
    context = canvas.getContext("2d");
    populationCanvas = container.querySelector("#ball-game-population-chart");
    populationContext = populationCanvas.getContext("2d");
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
    populationHistory = [];
    generationColors = [];
    activeConfig = null;
    reachedLimitAtMs = null;
    populationLimit = 40;
    recommendedLimit = 40;
    limitCustomized = false;
    canvas = null;
    context = null;
    populationCanvas = null;
    populationContext = null;
    container = null;
    mountVersion += 1;
  }

  return {
    init: init,
    deactivate: deactivate,
    _test: {
      clamp: clamp,
      normalizeConfig: normalizeConfig,
      populationCap: populationCap,
      validatePopulationLimit: validatePopulationLimit,
      collidingBallIndexes: collidingBallIndexes,
      formatTime: formatTime,
      formatAxisTime: formatAxisTime,
      physicsSubstepCount: physicsSubstepCount,
      hexToHsl: hexToHsl,
      nextGenerationColor: nextGenerationColor,
      generationColor: generationColor,
      symmetricAngles: symmetricAngles,
      velocityFor: velocityFor,
      reflectFromWall: reflectFromWall,
      canSplitAtWall: canSplitAtWall
    }
  };
})();
