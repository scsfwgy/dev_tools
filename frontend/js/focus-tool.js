// Schulte Grid focus game — runs entirely in the browser.
var FocusTool = (function () {
  var STORAGE_KEY = "devtools_focus_scores";
  var SIZES = [3, 4, 5, 6];
  var selectedSize = 5;
  var target = 1;
  var mistakes = 0;
  var startedAt = 0;
  var elapsedMs = 0;
  var running = false;
  var frameId = 0;
  var mountVersion = 0;
  var container = null;

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function interpolate(value, params) {
    return Object.keys(params || {}).reduce(function (text, key) {
      return String(text).replace(new RegExp("\\{" + key + "\\}", "g"), params[key]);
    }, value);
  }

  function byId(id) { return container && container.querySelector("#" + id); }

  function shuffledNumbers(size) {
    var values = Array.from({ length: size * size }, function (_, index) { return index + 1; });
    for (var i = values.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = values[i];
      values[i] = values[j];
      values[j] = swap;
    }
    return values;
  }

  function loadScores() {
    try {
      var value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(value) ? value.filter(function (item) {
        return item && SIZES.indexOf(item.size) !== -1 && Number.isFinite(item.time) && Number.isFinite(item.mistakes);
      }).slice(0, 12) : [];
    } catch (error) {
      return [];
    }
  }

  function saveScore(result) {
    var scores = loadScores();
    scores.unshift(result);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scores.slice(0, 12))); } catch (error) { /* storage unavailable */ }
  }

  function bestForSize(size) {
    var matching = loadScores().filter(function (item) { return item.size === size; });
    if (!matching.length) return null;
    return Math.min.apply(null, matching.map(function (item) { return item.time; }));
  }

  function formatTime(ms) {
    return (Math.max(0, ms) / 1000).toFixed(2) + "s";
  }

  function levelName(size) { return t("focus.levels." + size + ".name"); }

  function levelButtons() {
    return SIZES.map(function (size) {
      var active = size === selectedSize ? " is-active" : "";
      return '<button class="focus-level' + active + '" type="button" data-focus-size="' + size + '" aria-pressed="' + String(size === selectedSize) + '">' +
        '<strong>' + t("focus.levels." + size + ".name") + '</strong>' +
        '<span>' + t("focus.levels." + size + ".detail") + '</span>' +
      '</button>';
    }).join("");
  }

  function renderHistory() {
    var list = byId("focus-history-list");
    var clear = byId("focus-clear-history");
    if (!list) return;
    var scores = loadScores().slice(0, 6);
    clear.hidden = !scores.length;
    if (!scores.length) {
      list.innerHTML = '<p class="focus-history-empty">' + t("focus.historyEmpty") + '</p>';
      return;
    }
    list.innerHTML = scores.map(function (item, index) {
      var text = interpolate(t("focus.historyEntry"), {
        level: levelName(item.size), time: formatTime(item.time), mistakes: item.mistakes
      });
      return '<div class="focus-history-item"><span class="focus-history-rank">' + String(index + 1).padStart(2, "0") + '</span>' +
        '<span>' + text + '</span></div>';
    }).join("");
  }

  function updateBest() {
    var best = bestForSize(selectedSize);
    var bestElement = byId("focus-best");
    if (bestElement) bestElement.textContent = best === null ? t("focus.notSet") : formatTime(best);
  }

  function updateStatus() {
    var timer = byId("focus-time");
    var targetElement = byId("focus-target");
    var mistakesElement = byId("focus-mistakes");
    if (timer) timer.textContent = formatTime(elapsedMs);
    if (targetElement) targetElement.textContent = target > selectedSize * selectedSize ? "—" : target;
    if (mistakesElement) mistakesElement.textContent = mistakes;
  }

  function cancelTimer() {
    running = false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function tick(version) {
    if (!running || version !== mountVersion || !container || !document.body.contains(container)) {
      cancelTimer();
      return;
    }
    elapsedMs = performance.now() - startedAt;
    updateStatus();
    frameId = requestAnimationFrame(function () { tick(version); });
  }

  function setAnnouncement(message) {
    var live = byId("focus-live");
    if (live) live.textContent = message;
  }

  function renderGrid() {
    var grid = byId("focus-grid");
    if (!grid) return;
    grid.style.setProperty("--focus-grid-size", selectedSize);
    grid.setAttribute("aria-label", interpolate(t("focus.gridLabel"), { size: selectedSize }));
    grid.innerHTML = shuffledNumbers(selectedSize).map(function (number) {
      return '<button class="focus-cell" type="button" data-number="' + number + '" aria-label="' +
        interpolate(t("focus.numberLabel"), { number: number }) + '">' + number + '</button>';
    }).join("");
    grid.querySelectorAll(".focus-cell").forEach(function (button) {
      button.addEventListener("click", handleNumber);
    });
  }

  function showReady() {
    var overlay = byId("focus-overlay");
    overlay.classList.remove("is-result");
    overlay.hidden = false;
    overlay.innerHTML = '<div class="focus-overlay-mark" aria-hidden="true">1→' + (selectedSize * selectedSize) + '</div>' +
      '<strong>' + t("focus.ready") + '</strong><span>' + t("focus.readyHint") + '</span>' +
      '<button id="focus-start" class="focus-primary-btn" type="button">' + t("focus.start") + '</button>';
    byId("focus-start").addEventListener("click", startGame);
  }

  function prepareRound(showOverlay) {
    cancelTimer();
    target = 1;
    mistakes = 0;
    elapsedMs = 0;
    renderGrid();
    updateStatus();
    updateBest();
    if (showOverlay !== false) showReady();
    setAnnouncement(t("focus.ready"));
  }

  function startGame() {
    prepareRound(false);
    var overlay = byId("focus-overlay");
    overlay.hidden = true;
    running = true;
    startedAt = performance.now();
    setAnnouncement(interpolate(t("focus.nextTarget"), { number: target }));
    tick(mountVersion);
  }

  function handleNumber(event) {
    if (!running) return;
    var button = event.currentTarget;
    var number = Number(button.dataset.number);
    if (number !== target) {
      mistakes += 1;
      updateStatus();
      button.classList.remove("is-wrong");
      void button.offsetWidth;
      button.classList.add("is-wrong");
      setAnnouncement(interpolate(t("focus.wrongTarget"), { number: target }));
      return;
    }

    button.classList.add("is-done");
    button.disabled = true;
    button.setAttribute("aria-label", interpolate(t("focus.doneLabel"), { number: number }));
    target += 1;
    if (target > selectedSize * selectedSize) {
      finishGame();
      return;
    }
    updateStatus();
    setAnnouncement(interpolate(t("focus.nextTarget"), { number: target }));
  }

  function finishGame() {
    elapsedMs = performance.now() - startedAt;
    var previousBest = bestForSize(selectedSize);
    var isNewBest = previousBest === null || elapsedMs < previousBest;
    cancelTimer();
    updateStatus();
    saveScore({ size: selectedSize, time: Math.round(elapsedMs), mistakes: mistakes, date: Date.now() });
    updateBest();
    renderHistory();

    var overlay = byId("focus-overlay");
    overlay.hidden = false;
    overlay.classList.add("is-result");
    overlay.innerHTML = '<div class="focus-result-check" aria-hidden="true">✓</div>' +
      '<strong>' + t("focus.completed") + '</strong><span>' + t("focus.completedHint") + '</span>' +
      (isNewBest ? '<em>' + t("focus.newBest") + '</em>' : '') +
      '<div class="focus-result-values"><b>' + formatTime(elapsedMs) + '</b><small>' + t("focus.average") + ' · ' + formatTime(elapsedMs / (selectedSize * selectedSize)) + '</small></div>' +
      '<button id="focus-again" class="focus-primary-btn" type="button">' + t("focus.newRound") + '</button>';
    byId("focus-again").addEventListener("click", startGame);
    setAnnouncement(t("focus.completed") + ". " + formatTime(elapsedMs));
  }

  function bindEvents() {
    container.querySelectorAll("[data-focus-size]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectedSize = Number(this.dataset.focusSize);
        var orbitEnd = byId("focus-orbit-end");
        if (orbitEnd) orbitEnd.textContent = selectedSize * selectedSize;
        container.querySelectorAll("[data-focus-size]").forEach(function (item) {
          var active = Number(item.dataset.focusSize) === selectedSize;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        prepareRound(true);
      });
    });
    byId("focus-restart").addEventListener("click", function () {
      if (running) startGame(); else prepareRound(true);
    });
    byId("focus-clear-history").addEventListener("click", function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* storage unavailable */ }
      updateBest();
      renderHistory();
    });
  }

  function init(element) {
    cancelTimer();
    mountVersion += 1;
    container = element;
    container.innerHTML = '<div class="focus-tool">' +
      '<section class="focus-intro"><div><span class="focus-eyebrow">' + t("focus.eyebrow") + '</span>' +
        '<h2>' + t("focus.headline") + '</h2><p>' + t("focus.subtitle") + '</p></div>' +
        '<div class="focus-orbit" aria-hidden="true"><span>1</span><i></i><span id="focus-orbit-end">' + (selectedSize * selectedSize) + '</span></div></section>' +
      '<section class="focus-level-section"><div class="focus-section-label">' + t("focus.levelLabel") + '</div>' +
        '<div class="focus-levels">' + levelButtons() + '</div></section>' +
      '<div class="focus-layout"><main class="focus-game-card">' +
        '<div class="focus-stats">' +
          '<div><span>' + t("focus.time") + '</span><strong id="focus-time">0.00s</strong></div>' +
          '<div><span>' + t("focus.target") + '</span><strong id="focus-target">1</strong></div>' +
          '<div><span>' + t("focus.mistakes") + '</span><strong id="focus-mistakes">0</strong></div>' +
          '<div><span>' + t("focus.best") + '</span><strong id="focus-best">' + t("focus.notSet") + '</strong></div>' +
        '</div>' +
        '<div class="focus-board"><div id="focus-grid" class="focus-grid"></div><div id="focus-overlay" class="focus-overlay"></div></div>' +
        '<div class="focus-game-actions"><button id="focus-restart" type="button">↻ ' + t("focus.restart") + '</button></div>' +
      '</main><aside class="focus-side">' +
        '<section class="focus-info-card"><h3>' + t("focus.howTitle") + '</h3><ol>' + t("focus.howSteps").map(function (step) { return '<li>' + step + '</li>'; }).join("") + '</ol></section>' +
        '<section class="focus-info-card focus-science"><h3>' + t("focus.scienceTitle") + '</h3><p>' + t("focus.scienceNote") + '</p></section>' +
        '<section class="focus-info-card focus-history"><div class="focus-history-head"><h3>' + t("focus.historyTitle") + '</h3><button id="focus-clear-history" type="button" hidden>' + t("focus.clearHistory") + '</button></div><div id="focus-history-list"></div></section>' +
      '</aside></div><p id="focus-live" class="sr-only" aria-live="polite"></p></div>';
    bindEvents();
    prepareRound(true);
    renderHistory();
  }

  return { init: init };
})();
