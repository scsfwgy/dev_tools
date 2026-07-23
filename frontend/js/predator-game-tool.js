// Predation & Reproduction — a deliberately simple local ecosystem.
var PredatorGameTool = (function () {
  "use strict";

  var MIN_LIMIT = 1;
  var MAX_LIMIT = 10000;
  var BASE_SPEED = 70;
  var PREY_RADIUS = 5;
  var PREDATOR_RADIUS = 7;
  var RESOURCE_RADIUS = 3;
  var GRID_SIZE = 64;
  var PREDATOR_SIGHT = 240;
  var PREDATOR_STARVE_MS = 18000;
  var NEWBORN_PROTECTION_MS = 360;
  var MAX_DELTA_SECONDS = 0.032;

  var container = null;
  var canvas = null;
  var context = null;
  var chartCanvas = null;
  var chartContext = null;
  var width = 0;
  var height = 0;
  var prey = [];
  var predators = [];
  var resources = [];
  var history = [];
  var historyIntervalMs = 100;
  var nextHistoryAt = 100;
  var activeConfig = null;
  var populationLimit = 320;
  var recommendedLimit = 320;
  var limitCustomized = false;
  var elapsedMs = 0;
  var frameId = 0;
  var lastFrameAt = 0;
  var resourceSpawnBudget = 0;
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

  function normalizeConfig(preyCount, predatorCount, speed, limit, recommendation) {
    var normalizedPrey = clamp(Math.round(Number(preyCount) || 24), 1, 200);
    var normalizedPredators = clamp(Math.round(Number(predatorCount) || 3), 1, 50);
    var fallbackLimit = clamp(Math.round(Number(recommendation) || 320), MIN_LIMIT, MAX_LIMIT);
    return {
      preyCount: normalizedPrey,
      predatorCount: normalizedPredators,
      speed: clamp(Number(speed) || 1, 0.1, 10),
      limit: clamp(
        Math.round(Number(limit) || fallbackLimit),
        normalizedPrey + normalizedPredators,
        MAX_LIMIT
      )
    };
  }

  function populationCap(canvasWidth, canvasHeight) {
    return clamp(
      Math.floor((Math.max(0, canvasWidth) * Math.max(0, canvasHeight)) / 1400),
      160,
      1200
    );
  }

  function validatePopulationLimit(rawValue, startingPopulation) {
    var text = String(rawValue === undefined || rawValue === null ? "" : rawValue).trim();
    var value = Number(text);
    if (!text || !Number.isFinite(value) || !Number.isInteger(value) || value < MIN_LIMIT || value > MAX_LIMIT) {
      return { valid: false, value: null, error: "range" };
    }
    if (value < startingPopulation) return { valid: false, value: null, error: "count" };
    return { valid: true, value: value, error: null };
  }

  function resourceCapacity(canvasWidth, canvasHeight) {
    return clamp(
      Math.floor((Math.max(0, canvasWidth) * Math.max(0, canvasHeight)) / 2400),
      60,
      300
    );
  }

  function velocityFor(speed, angle) {
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  }

  function createAnimal(kind, x, y, speed, angle) {
    var radius = kind === "prey" ? PREY_RADIUS : PREDATOR_RADIUS;
    var velocity = velocityFor(speed, angle === undefined ? randomSource() * Math.PI * 2 : angle);
    return {
      kind: kind,
      x: clamp(x, radius, Math.max(radius, width - radius)),
      y: clamp(y, radius, Math.max(radius, height - radius)),
      vx: velocity.vx,
      vy: velocity.vy,
      radius: radius,
      safeUntil: elapsedMs + NEWBORN_PROTECTION_MS,
      starveAt: kind === "predator" ? elapsedMs + PREDATOR_STARVE_MS : Infinity
    };
  }

  function createResource(rng) {
    var source = rng || randomSource;
    return {
      x: randomBetween(RESOURCE_RADIUS, Math.max(RESOURCE_RADIUS, width - RESOURCE_RADIUS), source),
      y: randomBetween(RESOURCE_RADIUS, Math.max(RESOURCE_RADIUS, height - RESOURCE_RADIUS), source)
    };
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

  function nearbyIndexes(grid, x, y, radius, cellSize) {
    var result = [];
    var minimumX = Math.floor((x - radius) / cellSize);
    var maximumX = Math.floor((x + radius) / cellSize);
    var minimumY = Math.floor((y - radius) / cellSize);
    var maximumY = Math.floor((y + radius) / cellSize);
    for (var cellX = minimumX; cellX <= maximumX; cellX += 1) {
      for (var cellY = minimumY; cellY <= maximumY; cellY += 1) {
        var indexes = grid.get(cellX + ":" + cellY);
        if (indexes) result.push.apply(result, indexes);
      }
    }
    return result;
  }

  function nearestTarget(source, targets, grid, radius, cellSize, excluded) {
    var nearest = -1;
    var nearestDistanceSquared = radius * radius;
    nearbyIndexes(grid, source.x, source.y, radius, cellSize).forEach(function (index) {
      if (excluded && excluded.has(index)) return;
      var target = targets[index];
      if (!target) return;
      var dx = target.x - source.x;
      var dy = target.y - source.y;
      var distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= nearestDistanceSquared) {
        nearest = index;
        nearestDistanceSquared = distanceSquared;
      }
    });
    return nearest;
  }

  function normalizeVelocity(animal, speed) {
    var magnitude = Math.hypot(animal.vx, animal.vy) || 1;
    animal.vx = animal.vx / magnitude * speed;
    animal.vy = animal.vy / magnitude * speed;
  }

  function steerToward(animal, target, speed, deltaSeconds) {
    var dx = target.x - animal.x;
    var dy = target.y - animal.y;
    var distance = Math.hypot(dx, dy);
    if (!distance) return;
    var blend = clamp(4.8 * deltaSeconds, 0, 0.6);
    animal.vx = animal.vx * (1 - blend) + dx / distance * speed * blend;
    animal.vy = animal.vy * (1 - blend) + dy / distance * speed * blend;
    normalizeVelocity(animal, speed);
  }

  function moveAndBounce(animal, deltaSeconds) {
    animal.x += animal.vx * deltaSeconds;
    animal.y += animal.vy * deltaSeconds;
    if (animal.x <= animal.radius) {
      animal.x = animal.radius;
      animal.vx = Math.abs(animal.vx);
    } else if (animal.x >= width - animal.radius) {
      animal.x = width - animal.radius;
      animal.vx = -Math.abs(animal.vx);
    }
    if (animal.y <= animal.radius) {
      animal.y = animal.radius;
      animal.vy = Math.abs(animal.vy);
    } else if (animal.y >= height - animal.radius) {
      animal.y = height - animal.radius;
      animal.vy = -Math.abs(animal.vy);
    }
  }

  function splitAnimal(parent, kind, speed) {
    var heading = Math.atan2(parent.vy, parent.vx);
    var spread = randomBetween(0.42, 0.72);
    var parentVelocity = velocityFor(speed, heading - spread);
    parent.vx = parentVelocity.vx;
    parent.vy = parentVelocity.vy;
    parent.safeUntil = elapsedMs + NEWBORN_PROTECTION_MS;
    var childAngle = heading + spread;
    return createAnimal(
      kind,
      parent.x + Math.cos(childAngle) * parent.radius * 2.2,
      parent.y + Math.sin(childAngle) * parent.radius * 2.2,
      speed,
      childAngle
    );
  }

  function currentConfig() {
    if (!container) return normalizeConfig(24, 3, 1, recommendedLimit, recommendedLimit);
    return normalizeConfig(
      container.querySelector("#predator-game-prey").value,
      container.querySelector("#predator-game-predators").value,
      container.querySelector("#predator-game-speed").value,
      container.querySelector("#predator-game-limit").value,
      recommendedLimit
    );
  }

  function startingPopulation() {
    if (!container) return 27;
    return Math.round(Number(container.querySelector("#predator-game-prey").value) || 24) +
      Math.round(Number(container.querySelector("#predator-game-predators").value) || 3);
  }

  function limitValidation() {
    if (!container) return validatePopulationLimit(recommendedLimit, 27);
    return validatePopulationLimit(container.querySelector("#predator-game-limit").value, startingPopulation());
  }

  function showLimitError(validation) {
    if (!container) return;
    var element = container.querySelector("#predator-game-limit-error");
    if (!element) return;
    element.classList.toggle("hidden", validation.valid);
    element.textContent = validation.valid
      ? ""
      : t("predatorGame.errors." + validation.error) +
        (validation.error === "count" ? " " + startingPopulation() : "");
  }

  function updateLimitRecommendation() {
    if (!container) return;
    var input = container.querySelector("#predator-game-limit");
    var output = container.querySelector("#predator-game-limit-recommendation");
    if (!limitCustomized) input.value = String(recommendedLimit);
    if (output) output.textContent = t("predatorGame.recommended") + " " + recommendedLimit;
  }

  function readPalette() {
    var styles = getComputedStyle(document.documentElement);
    palette = {
      background: styles.getPropertyValue("--ball-game-canvas-bg").trim() || "#10161f",
      text: styles.getPropertyValue("--text-muted").trim() || "#8b949e",
      border: styles.getPropertyValue("--border").trim() || "#30363d",
      prey: styles.getPropertyValue("--ecosystem-prey").trim() || "#38bdf8",
      predator: styles.getPropertyValue("--ecosystem-predator").trim() || "#fb7185",
      resource: styles.getPropertyValue("--ecosystem-resource").trim() || "#4ade80"
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
    var validation = limitValidation();
    if (!started && validation.valid) populationLimit = validation.value;
    var ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    resizeChart(ratio);
    prey.concat(predators).forEach(function (animal) {
      animal.x = clamp(animal.x * width / previousWidth, animal.radius, width - animal.radius);
      animal.y = clamp(animal.y * height / previousHeight, animal.radius, height - animal.radius);
    });
    resources.forEach(function (resource) {
      resource.x = clamp(resource.x * width / previousWidth, RESOURCE_RADIUS, width - RESOURCE_RADIUS);
      resource.y = clamp(resource.y * height / previousHeight, RESOURCE_RADIUS, height - RESOURCE_RADIUS);
    });
    updateStats();
    if (!running) drawWorld();
  }

  function seedWorld(config) {
    prey = [];
    predators = [];
    resources = [];
    elapsedMs = 0;
    resourceSpawnBudget = 0;
    var speed = BASE_SPEED * config.speed;
    for (var preyIndex = 0; preyIndex < config.preyCount; preyIndex += 1) {
      prey.push(createAnimal(
        "prey",
        randomBetween(PREY_RADIUS, width - PREY_RADIUS),
        randomBetween(PREY_RADIUS, height - PREY_RADIUS),
        speed
      ));
    }
    for (var predatorIndex = 0; predatorIndex < config.predatorCount; predatorIndex += 1) {
      predators.push(createAnimal(
        "predator",
        randomBetween(PREDATOR_RADIUS, width - PREDATOR_RADIUS),
        randomBetween(PREDATOR_RADIUS, height - PREDATOR_RADIUS),
        speed
      ));
    }
    var initialResources = Math.round(resourceCapacity(width, height) * 0.55);
    for (var resourceIndex = 0; resourceIndex < initialResources; resourceIndex += 1) {
      resources.push(createResource());
    }
    resetHistory();
  }

  function resetHistory() {
    history = [{ time: 0, prey: prey.length, predators: predators.length, resources: resources.length }];
    historyIntervalMs = 100;
    nextHistoryAt = historyIntervalMs;
  }

  function recordHistory() {
    if (!started || elapsedMs < nextHistoryAt) return;
    history.push({
      time: elapsedMs,
      prey: prey.length,
      predators: predators.length,
      resources: resources.length
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
    populationLimit = validation.value;
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

  function moveAnimals(deltaSeconds) {
    var speed = BASE_SPEED * (activeConfig || currentConfig()).speed;
    var preyGrid = buildSpatialGrid(prey, GRID_SIZE);
    prey.forEach(function (animal) {
      normalizeVelocity(animal, speed);
      moveAndBounce(animal, deltaSeconds);
    });
    predators.forEach(function (animal) {
      var targetIndex = nearestTarget(animal, prey, preyGrid, PREDATOR_SIGHT, GRID_SIZE);
      if (targetIndex !== -1) steerToward(animal, prey[targetIndex], speed, deltaSeconds);
      else normalizeVelocity(animal, speed);
      moveAndBounce(animal, deltaSeconds);
    });
  }

  function feedPrey() {
    if (!prey.length || !resources.length) return;
    var speed = BASE_SPEED * (activeConfig || currentConfig()).speed;
    var grid = buildSpatialGrid(resources, GRID_SIZE);
    var consumed = new Set();
    var newborns = [];
    prey.forEach(function (animal) {
      var reach = animal.radius + RESOURCE_RADIUS + 1;
      var resourceIndex = nearestTarget(animal, resources, grid, reach, GRID_SIZE, consumed);
      if (resourceIndex === -1) return;
      var resource = resources[resourceIndex];
      var dx = resource.x - animal.x;
      var dy = resource.y - animal.y;
      if (dx * dx + dy * dy > reach * reach) return;
      consumed.add(resourceIndex);
      if (prey.length + predators.length + newborns.length < populationLimit) {
        newborns.push(splitAnimal(animal, "prey", speed));
      }
    });
    if (consumed.size) resources = resources.filter(function (_, index) { return !consumed.has(index); });
    prey.push.apply(prey, newborns);
  }

  function feedPredators() {
    if (!predators.length || !prey.length) return;
    var speed = BASE_SPEED * (activeConfig || currentConfig()).speed;
    var grid = buildSpatialGrid(prey, GRID_SIZE);
    var eaten = new Set();
    var newborns = [];
    predators.forEach(function (animal) {
      var reach = animal.radius + PREY_RADIUS + 1;
      var preyIndex = nearestTarget(animal, prey, grid, reach, GRID_SIZE, eaten);
      if (preyIndex === -1 || elapsedMs < prey[preyIndex].safeUntil) return;
      var target = prey[preyIndex];
      var dx = target.x - animal.x;
      var dy = target.y - animal.y;
      if (dx * dx + dy * dy > reach * reach) return;
      eaten.add(preyIndex);
      animal.starveAt = elapsedMs + PREDATOR_STARVE_MS;
      newborns.push(splitAnimal(animal, "predator", speed));
    });
    if (eaten.size) prey = prey.filter(function (_, index) { return !eaten.has(index); });
    predators.push.apply(predators, newborns);
  }

  function removeStarvedPredators() {
    predators = predators.filter(function (animal) { return elapsedMs < animal.starveAt; });
  }

  function replenishResources(deltaSeconds) {
    var capacity = resourceCapacity(width, height);
    var spawnRate = clamp(capacity / 35, 2, 9);
    resourceSpawnBudget += spawnRate * deltaSeconds;
    var additions = Math.floor(resourceSpawnBudget);
    resourceSpawnBudget -= additions;
    while (additions > 0 && resources.length < capacity) {
      resources.push(createResource());
      additions -= 1;
    }
  }

  function updateWorldStep(deltaSeconds) {
    moveAnimals(deltaSeconds);
    feedPrey();
    feedPredators();
    removeStarvedPredators();
    replenishResources(deltaSeconds);
  }

  function physicsSubstepCount(deltaSeconds, speedMultiplier) {
    var maximumStepSeconds = (PREY_RADIUS * 0.5) / Math.max(BASE_SPEED * speedMultiplier, 1);
    return Math.max(1, Math.ceil(deltaSeconds / maximumStepSeconds));
  }

  function updateWorld(deltaSeconds) {
    var speedMultiplier = (activeConfig || currentConfig()).speed;
    var stepCount = physicsSubstepCount(deltaSeconds, speedMultiplier);
    var stepSeconds = deltaSeconds / stepCount;
    for (var step = 0; step < stepCount; step += 1) updateWorldStep(stepSeconds);
  }

  function drawWorld() {
    if (!context || !palette) return;
    context.fillStyle = palette.background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = palette.resource;
    resources.forEach(function (resource) {
      context.beginPath();
      context.arc(resource.x, resource.y, RESOURCE_RADIUS, 0, Math.PI * 2);
      context.fill();
    });
    context.fillStyle = palette.prey;
    prey.forEach(function (animal) {
      context.beginPath();
      context.arc(animal.x, animal.y, PREY_RADIUS, 0, Math.PI * 2);
      context.fill();
    });
    context.fillStyle = palette.predator;
    predators.forEach(function (animal) {
      context.beginPath();
      context.arc(animal.x, animal.y, PREDATOR_RADIUS, 0, Math.PI * 2);
      context.fill();
    });
    if (!started) {
      context.fillStyle = palette.text;
      context.textAlign = "center";
      context.font = "600 13px -apple-system, BlinkMacSystemFont, sans-serif";
      context.fillText(t("predatorGame.previewHint"), width / 2, height - 24);
    }
    drawChart();
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
      points.push({ time: elapsedMs, prey: prey.length, predators: predators.length, resources: resources.length });
    }
    if (!points.length) points.push({ time: 0, prey: prey.length, predators: predators.length, resources: resources.length });
    return points;
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
    var stage = container && container.querySelector("#predator-game-stage");
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
      return Math.max(value, point.prey, point.predators, point.resources);
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
    chartContext.fillText(t("predatorGame.chartTimeAxis"), left + plotWidth / 2, heightValue - 7);
    chartContext.translate(11, top + plotHeight / 2);
    chartContext.rotate(-Math.PI / 2);
    chartContext.fillText(t("predatorGame.chartCountAxis"), 0, 0);
    chartContext.restore();
    drawChartLine(points, "resources", palette.resource, left, top, plotWidth, plotHeight, timeMaximum, countMaximum);
    drawChartLine(points, "prey", palette.prey, left, top, plotWidth, plotHeight, timeMaximum, countMaximum);
    drawChartLine(points, "predators", palette.predator, left, top, plotWidth, plotHeight, timeMaximum, countMaximum);
  }

  function updateStats() {
    if (!container) return;
    var population = prey.length + predators.length;
    var extinct = started && population === 0;
    var atLimit = population >= populationLimit;
    container.querySelector("#predator-game-time").textContent = formatTime(elapsedMs);
    container.querySelector("#predator-game-prey-stat").textContent = String(prey.length);
    container.querySelector("#predator-game-predators-stat").textContent = String(predators.length);
    container.querySelector("#predator-game-resources-stat").textContent = String(resources.length);
    container.querySelector("#predator-game-speed-stat").textContent =
      (activeConfig || currentConfig()).speed.toFixed(1) + "×";
    var status = container.querySelector("#predator-game-status");
    status.classList.toggle("is-live", running && !extinct);
    status.classList.toggle("is-limit", atLimit);
    status.classList.toggle("is-extinct", extinct);
    var key = !started ? "ready" : (extinct ? "extinct" : (atLimit ? "limit" : (running ? "running" : "paused")));
    status.querySelector("span:last-child").textContent = t("predatorGame.status." + key);
  }

  function updateControls() {
    if (!container) return;
    var startButton = container.querySelector("#predator-game-start");
    var pauseButton = container.querySelector("#predator-game-pause");
    var extinct = started && prey.length + predators.length === 0;
    startButton.textContent = t(started ? "predatorGame.regenerate" : "predatorGame.start");
    pauseButton.textContent = t(running ? "predatorGame.pause" : "predatorGame.resume");
    pauseButton.disabled = !started || extinct;
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
    if (prey.length + predators.length === 0) running = false;
    recordHistory();
    drawWorld();
    updateStats();
    updateControls();
    if (running) frameId = requestAnimationFrame(function (nextTime) { animate(nextTime, version); });
    else frameId = 0;
  }

  function syncFullscreenState() {
    if (!container) return;
    var stage = container.querySelector("#predator-game-stage");
    if (!stage) return;
    var active = stage.classList.contains("is-viewport-fullscreen");
    stage.classList.toggle("is-fullscreen", active);
    var enterButton = container.querySelector("#predator-game-fullscreen");
    if (enterButton) enterButton.setAttribute("aria-pressed", String(active));
    setTimeout(resizeCanvas, 60);
  }

  function enterFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#predator-game-stage");
    if (!stage) return;
    stage.classList.add("is-viewport-fullscreen");
    document.body.classList.add("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function exitFullscreen() {
    if (!container) return;
    var stage = container.querySelector("#predator-game-stage");
    if (stage) stage.classList.remove("is-viewport-fullscreen", "is-fullscreen");
    document.body.classList.remove("ball-game-fullscreen-active");
    syncFullscreenState();
  }

  function handleKeydown(event) {
    if (event.key !== "Escape" || !container) return;
    var stage = container.querySelector("#predator-game-stage");
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
    container.querySelector("#predator-game-prey-value").textContent =
      container.querySelector("#predator-game-prey").value;
    container.querySelector("#predator-game-predators-value").textContent =
      container.querySelector("#predator-game-predators").value;
    container.querySelector("#predator-game-speed-value").textContent =
      Number(container.querySelector("#predator-game-speed").value).toFixed(1) + "×";
    updateLimitRecommendation();
    var validation = limitValidation();
    showLimitError(validation);
    if (!started && validation.valid) resetWorld(false);
  }

  function bindEvents() {
    container.querySelector("#predator-game-start").addEventListener("click", function () { resetWorld(true); });
    container.querySelector("#predator-game-pause").addEventListener("click", function () { setRunning(!running); });
    ["#predator-game-prey", "#predator-game-predators", "#predator-game-speed"].forEach(function (selector) {
      container.querySelector(selector).addEventListener("input", updateInputLabels);
    });
    container.querySelector("#predator-game-limit").addEventListener("input", function () {
      limitCustomized = true;
      updateInputLabels();
    });
    container.querySelector("#predator-game-fullscreen").addEventListener("click", enterFullscreen);
    container.querySelector("#predator-game-exit-fullscreen").addEventListener("click", exitFullscreen);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("keydown", handleKeydown);
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement);
    resizeObserver.observe(chartCanvas.parentElement);
    themeObserver = new MutationObserver(function () { readPalette(); drawWorld(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function legendItem(kind) {
    return '<span class="predator-game-legend-item"><i class="predator-game-swatch is-' + kind +
      '" aria-hidden="true"></i>' + t("predatorGame.legend." + kind) + '</span>';
  }

  function init(element) {
    deactivate();
    mountVersion += 1;
    container = element;
    container.innerHTML = '<div class="ball-game-tool predator-game-tool">' +
      '<div class="ball-game-layout"><aside class="ball-game-config"><section class="ball-game-guide" aria-labelledby="predator-game-guide-title"><h2 id="predator-game-guide-title">' + t("predatorGame.guide.title") + '</h2><ul>' +
        '<li>' + t("predatorGame.guide.item1") + '</li><li>' + t("predatorGame.guide.item2") + '</li><li>' + t("predatorGame.guide.item3") + '</li><li>' + t("predatorGame.guide.item4") + '</li></ul></section>' +
        '<h3>' + t("predatorGame.configTitle") + '</h3>' +
        '<label class="ball-game-control" for="predator-game-prey"><span><b>' + t("predatorGame.preyCount") + '</b><output id="predator-game-prey-value">24</output></span><input id="predator-game-prey" type="range" min="1" max="200" step="1" value="24"></label>' +
        '<label class="ball-game-control" for="predator-game-predators"><span><b>' + t("predatorGame.predatorCount") + '</b><output id="predator-game-predators-value">3</output></span><input id="predator-game-predators" type="range" min="1" max="50" step="1" value="3"></label>' +
        '<label class="ball-game-control" for="predator-game-speed"><span><b>' + t("predatorGame.baseSpeed") + '</b><output id="predator-game-speed-value">1.0×</output></span><input id="predator-game-speed" type="range" min="0.1" max="10" step="0.1" value="1"></label>' +
        '<label class="ball-game-control" for="predator-game-limit"><span><b>' + t("predatorGame.populationLimit") + '</b><output id="predator-game-limit-recommendation">' + t("predatorGame.recommended") + ' 320</output></span><input id="predator-game-limit" type="number" step="1" value="320" inputmode="numeric" aria-describedby="predator-game-limit-error"></label>' +
        '<div class="ball-game-actions"><button id="predator-game-start" class="ball-game-primary" type="button">' + t("predatorGame.start") + '</button><button id="predator-game-pause" type="button" disabled aria-pressed="false">' + t("predatorGame.resume") + '</button></div>' +
        '<p id="predator-game-limit-error" class="ball-game-config-error hidden" role="alert"></p>' +
        '<p class="ball-game-config-note">' + t("predatorGame.configNote") + '</p></aside>' +
        '<main id="predator-game-stage" class="ball-game-stage-card predator-game-stage"><div class="ball-game-fullscreen-toolbar"><span>' + t("predatorGame.fullscreenTitle") + '</span><button id="predator-game-exit-fullscreen" type="button">' + t("predatorGame.exitFullscreen") + '</button></div><div class="ball-game-stats">' +
          '<div><span>' + t("predatorGame.totalTime") + '</span><strong id="predator-game-time">00:00.000</strong></div>' +
          '<div><span>' + t("predatorGame.prey") + '</span><strong id="predator-game-prey-stat">24</strong></div>' +
          '<div><span>' + t("predatorGame.predators") + '</span><strong id="predator-game-predators-stat">3</strong></div>' +
          '<div><span>' + t("predatorGame.resources") + '</span><strong id="predator-game-resources-stat">0</strong></div>' +
          '<div><span>' + t("predatorGame.currentSpeed") + '</span><strong id="predator-game-speed-stat">1.0×</strong></div></div>' +
          '<div class="ball-game-status-row"><div id="predator-game-status" class="ball-game-status predator-game-status"><span aria-hidden="true"></span><span>' + t("predatorGame.status.ready") + '</span></div><div class="ball-game-status-actions"><span>' + t("predatorGame.capHint") + '</span><button id="predator-game-fullscreen" type="button" aria-pressed="false">' + t("predatorGame.fullscreen") + '</button></div></div>' +
          '<div class="ball-game-canvas-shell"><canvas id="predator-game-canvas" class="ball-game-canvas" role="img" aria-label="' + t("predatorGame.canvasLabel") + '"></canvas></div>' +
          '<section class="ball-game-chart-card"><div><h3>' + t("predatorGame.populationChart") + '</h3><div class="predator-game-legend">' +
            legendItem("prey") + legendItem("predators") + legendItem("resources") +
          '</div></div><div class="ball-game-chart-shell"><canvas id="predator-game-chart" class="ball-game-population-chart" role="img" aria-label="' + t("predatorGame.chartLabel") + '"></canvas></div></section></main></div>' +
      '</div>';
    canvas = container.querySelector("#predator-game-canvas");
    context = canvas.getContext("2d");
    chartCanvas = container.querySelector("#predator-game-chart");
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
    prey = [];
    predators = [];
    resources = [];
    history = [];
    activeConfig = null;
    elapsedMs = 0;
    populationLimit = 320;
    recommendedLimit = 320;
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
      clamp: clamp,
      normalizeConfig: normalizeConfig,
      populationCap: populationCap,
      validatePopulationLimit: validatePopulationLimit,
      resourceCapacity: resourceCapacity,
      velocityFor: velocityFor,
      buildSpatialGrid: buildSpatialGrid,
      nearbyIndexes: nearbyIndexes,
      nearestTarget: nearestTarget,
      formatTime: formatTime,
      formatAxisTime: formatAxisTime,
      physicsSubstepCount: physicsSubstepCount
    }
  };
})();
