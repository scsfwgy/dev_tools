// Pelican on a Bicycle: a self-contained coastal ride. Only same-origin scripts are loaded.
var PelicanBikeTool = (function () {
  "use strict";
  var GOAL = 1200, BEST_KEY = "devtools_pelican_bike_best_v2";
  var root, stage, scene, state, course, frame = 0, last = 0, held = {}, audio, alive = false;
  var scriptVersion = (document.currentScript && document.currentScript.src.match(/\?v=[^#]+/)) || [""];
  var scenePromise;
  function t(key) { return (window.__t && window.__t("pelicanBike." + key)) || key; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function scoreFor(meters, caught, tricks) { return Math.floor(meters) + caught * 100 + tricks * 150; }
  function createCourse() {
    var result = [], seed = 31415;
    function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    for (var at = 23, i = 0; at < GOAL / 2 - 14; at += 18 + random() * 8, i++) {
      var lane = Math.floor(random() * 3) - 1;
      result.push({ type: "fish", lane: lane, at: at, golden: i % 5 === 4, taken: false });
      if (i > 1 && i % 2 === 0) {
        var hazardLane = Math.floor(random() * 3) - 1;
        result.push({ type: "hazard", lane: hazardLane, at: at + 8, kind: i % 6 === 0 ? "gull" : "crate", taken: false });
      }
    }
    return result;
  }
  function collisionRule(entity, jump) {
    if (entity.type === "fish") return entity.golden ? jump > .55 : jump < 1.35;
    return entity.kind === "gull" ? jump < .5 : jump < .68;
  }
  function best() { try { return Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0); } catch (_) { return 0; } }
  function storeBest(value) { try { localStorage.setItem(BEST_KEY, String(value)); } catch (_) { /* private browsing */ } }
  function loadScript(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script"); script.src = src + scriptVersion[0]; script.async = true;
      script.onload = function () { window[globalName] ? resolve() : reject(new Error("Missing " + globalName)); };
      script.onerror = function () { reject(new Error("Could not load " + src)); };
      document.head.appendChild(script);
    });
  }
  function loadScene() {
    if (!scenePromise) scenePromise = loadScript("/js/vendor/three-local.js", "PELICAN_THREE")
      .then(function () { return loadScript("/js/pelican-bike-scene.js", "PelicanBikeScene"); });
    return scenePromise;
  }
  function freshState() {
    return { phase: "ready", meters: 0, travel: 0, speed: 24, lane: 0, jump: 0, velocity: 0,
      hearts: 3, caught: 0, tricks: 0, tricking: false, trickUsed: false, clean: true,
      invulnerable: 0, camera: 0, muted: true, elapsed: 0, achievements: {}, best: best() };
  }
  function sound(kind) {
    if (state.muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
      var freq = { fish: 660, gold: 920, hit: 145, jump: 350, trick: 740, finish: 880 }[kind] || 440;
      osc.type = kind === "hit" ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(kind === "hit" ? 70 : freq * 1.4, now + .13);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.11, now + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .22);
      osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + .23);
    } catch (_) { /* sound is optional */ }
  }
  function announce(key) {
    if (state.achievements[key]) return;
    state.achievements[key] = true;
    var el = root.querySelector("#pelican-toast");
    el.textContent = "✦ " + t("badge") + " · " + t(key);
    el.classList.add("is-visible");
    clearTimeout(announce.timer);
    announce.timer = setTimeout(function () { if (el) el.classList.remove("is-visible"); }, 2700);
  }
  function overlay(title, detail, button) {
    var el = root.querySelector("#pelican-overlay");
    el.hidden = false;
    el.querySelector("h3").textContent = t(title);
    el.querySelector("p").textContent = t(detail);
    el.querySelector("button").textContent = t(button);
  }
  function hideOverlay() { root.querySelector("#pelican-overlay").hidden = true; }
  function hud() {
    if (!root || !state) return;
    root.querySelector("#pelican-distance").textContent = Math.floor(state.meters) + " / " + GOAL + " " + t("meters");
    root.querySelector("#pelican-speed").textContent = Math.round(state.speed);
    root.querySelector("#pelican-fish").textContent = state.caught;
    root.querySelector("#pelican-hearts").textContent = "♥".repeat(state.hearts) + "♡".repeat(3 - state.hearts);
    root.querySelector("#pelican-score").textContent = scoreFor(state.meters, state.caught, state.tricks).toLocaleString();
    root.querySelector("#pelican-progress span").style.width = clamp(state.meters / GOAL * 100, 0, 100) + "%";
    root.querySelector("#pelican-camera").textContent = t(["cameraChase", "cameraSide", "cameraFront"][state.camera]);
    root.querySelector("#pelican-sound").textContent = state.muted ? t("soundOff") : t("soundOn");
    root.querySelector("#pelican-pause").textContent = state.phase === "paused" ? t("resume") : t("pause");
    root.querySelector("#pelican-best").textContent = state.best.toLocaleString();
    root.querySelector("#pelican-status").textContent = t({ ready: "liveReady", running: "liveRunning", paused: "livePaused", win: "liveWin", lose: "liveLose" }[state.phase]);
  }
  function render(dt) {
    if (!scene) return;
    scene.update({ travel: state.travel, x: state.lane * 3, jump: state.jump, speed: state.phase === "running" ? state.speed : 0,
      trick: state.tricking, camera: ["chase", "side", "front"][state.camera], hour: 17.4 + state.meters / GOAL * 4.2 }, dt);
  }
  function stopFrame() { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; }
  function finish(won) {
    state.phase = won ? "win" : "lose";
    held = {}; stopFrame();
    var score = scoreFor(state.meters, state.caught, state.tricks);
    if (score > state.best) { state.best = score; storeBest(score); }
    if (won) { announce("badgeFinish"); sound("finish"); }
    overlay(won ? "winTitle" : "loseTitle", won ? "winText" : "loseText", "retry");
    hud();
  }
  function step(dt) {
    state.elapsed += dt;
    var target = held.accelerate ? 42 : held.brake ? 11 : 24;
    state.speed += (target - state.speed) * Math.min(1, dt * 2.8);
    state.meters = Math.min(GOAL, state.meters + state.speed / 3.6 * dt * 3);
    state.travel = state.meters / 2;
    if (state.jump > 0 || state.velocity > 0) {
      state.velocity -= 13 * dt;
      state.jump += state.velocity * dt;
      if (state.jump <= 0) {
        state.jump = 0; state.velocity = 0;
        if (state.tricking) { state.tricks++; announce("badgeTrick"); sound("trick"); }
        state.tricking = false; state.trickUsed = false;
      }
    }
    state.invulnerable = Math.max(0, state.invulnerable - dt);
    for (var entity of course) {
      if (entity.taken || entity.at > state.travel + 1.1 || entity.at < state.travel - 1.1) continue;
      if (entity.lane !== state.lane) continue;
      entity.taken = true;
      var overlaps = collisionRule(entity, state.jump);
      if (entity.type === "fish") {
        if (!overlaps) continue;
        state.caught += entity.golden ? 3 : 1;
        sound(entity.golden ? "gold" : "fish");
        announce("badgeFirstFish");
        if (state.caught >= 10) announce("badgeTenFish");
      } else if (overlaps && state.invulnerable <= 0) {
        state.hearts--; state.clean = false; state.invulnerable = 1.4;
        root.querySelector("#pelican-stage").classList.add("is-hit");
        setTimeout(function () { if (root) root.querySelector("#pelican-stage").classList.remove("is-hit"); }, 380);
        sound("hit");
        if (state.hearts <= 0) { finish(false); return; }
      }
    }
    if (state.clean && state.meters >= 400) announce("badgeClean");
    if (state.meters >= GOAL) finish(true);
  }
  function tick(time) {
    if (!alive || state.phase !== "running") return;
    var dt = last ? clamp((time - last) / 1000, 0, .045) : 0;
    last = time;
    step(dt); render(dt); hud();
    if (state.phase === "running") frame = requestAnimationFrame(tick);
  }
  function start() {
    if (!window.PelicanBikeScene) return;
    if (state.phase === "paused") { state.phase = "running"; hideOverlay(); last = 0; frame = requestAnimationFrame(tick); hud(); return; }
    stopFrame(); held = {};
    if (state.phase === "ready" && scene) {
      state.phase = "running"; hideOverlay(); last = 0; frame = requestAnimationFrame(tick); hud(); return;
    }
    course = createCourse(); state = freshState();
    if (scene) scene.dispose();
    try { scene = window.PelicanBikeScene.create(stage, course); }
    catch (error) { scene = null; overlay("unavailableTitle", "unavailableText", "retry"); return; }
    state.phase = "running"; hideOverlay(); last = 0; render(.2); hud(); frame = requestAnimationFrame(tick);
  }
  function pause() {
    if (state.phase === "paused") { start(); return; }
    if (state.phase !== "running") return;
    state.phase = "paused"; held = {}; stopFrame(); overlay("pausedTitle", "pausedText", "resume"); hud();
  }
  function move(direction) {
    if (state.phase !== "running") return;
    state.lane = clamp(state.lane + direction, -1, 1);
  }
  function jump() {
    if (state.phase !== "running" || state.jump > .02) return;
    state.velocity = 6.3; sound("jump");
  }
  function trick() {
    if (state.phase !== "running" || state.jump < .3 || state.trickUsed) return;
    state.tricking = true; state.trickUsed = true;
  }
  function switchCamera() { state.camera = (state.camera + 1) % 3; hud(); render(.04); }
  function toggleSound() { state.muted = !state.muted; if (!state.muted) sound("fish"); hud(); }
  function keyDown(event) {
    if (!alive || /input|textarea|select/i.test((event.target && event.target.tagName) || "")) return;
    var key = event.code;
    if (["KeyA", "KeyD", "KeyW", "KeyS", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyT", "KeyP", "KeyC", "KeyM"].indexOf(key) < 0) return;
    event.preventDefault();
    if (event.repeat && !["KeyW", "KeyS", "ArrowUp", "ArrowDown"].includes(key)) return;
    if (key === "KeyA" || key === "ArrowLeft") move(-1);
    if (key === "KeyD" || key === "ArrowRight") move(1);
    if (key === "Space") jump();
    if (key === "KeyT") trick();
    if (key === "KeyW" || key === "ArrowUp") held.accelerate = true;
    if (key === "KeyS" || key === "ArrowDown") held.brake = true;
    if (key === "KeyP") pause();
    if (key === "KeyC") switchCamera();
    if (key === "KeyM") toggleSound();
  }
  function keyUp(event) {
    if (event.code === "KeyW" || event.code === "ArrowUp") held.accelerate = false;
    if (event.code === "KeyS" || event.code === "ArrowDown") held.brake = false;
  }
  function visibility() { if (document.hidden) pause(); }
  function bind() {
    root.querySelector("#pelican-overlay button").addEventListener("click", start);
    root.querySelector("#pelican-pause").addEventListener("click", pause);
    root.querySelector("#pelican-camera").addEventListener("click", switchCamera);
    root.querySelector("#pelican-sound").addEventListener("click", toggleSound);
    root.querySelector("#pelican-restart").addEventListener("click", start);
    root.querySelector("#pelican-fullscreen").addEventListener("click", function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (root.querySelector(".pelican-game").requestFullscreen) root.querySelector(".pelican-game").requestFullscreen();
    });
    root.querySelectorAll("[data-pelican-action]").forEach(function (button) {
      var action = button.dataset.pelicanAction;
      button.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        if (action === "left") move(-1); else if (action === "right") move(1);
        else if (action === "jump") jump(); else if (action === "trick") trick();
        else held[action] = true;
        button.classList.add("is-active");
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (name) {
        button.addEventListener(name, function () { held[action] = false; button.classList.remove("is-active"); });
      });
    });
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    document.addEventListener("visibilitychange", visibility);
  }
  function init(container) {
    deactivate(); alive = true; root = container;
    root.innerHTML = '<div class="pelican-game">' +
      '<div class="pelican-hero"><div><div class="pelican-eyebrow">' + t("eyebrow") + '</div><h2>' + t("subtitle") + '</h2></div><div class="pelican-local">' + t("local") + '</div></div>' +
      '<div class="pelican-stage" id="pelican-stage"><div class="pelican-viewport" id="pelican-viewport" data-canvas-label="' + t("canvasLabel") + '"></div>' +
      '<div class="pelican-topline"><span class="pelican-route">◉ ' + t("route") + '</span><span id="pelican-status"></span><span class="pelican-clock">◷ ' + t("clock") + '</span></div>' +
      '<div class="pelican-hud"><div class="pelican-hud-main"><small>' + t("distance") + '</small><strong id="pelican-distance"></strong><div class="pelican-progress" id="pelican-progress"><span></span></div></div>' +
      '<div class="pelican-hud-speed"><strong id="pelican-speed">24</strong><span>km/h</span></div></div>' +
      '<div class="pelican-toast" id="pelican-toast" role="status" aria-live="polite"></div>' +
      '<div class="pelican-overlay" id="pelican-overlay"><div class="pelican-overlay-card"><div class="pelican-overlay-mark">✦</div><span class="pelican-overlay-kicker">' + t("route") + '</span><h3></h3><p></p><button class="pelican-primary" type="button"></button></div></div></div>' +
      '<div class="pelican-dashboard"><div><span>' + t("fish") + '</span><strong id="pelican-fish">0</strong></div><div><span>' + t("score") + '</span><strong id="pelican-score">0</strong></div><div><span>' + t("hearts") + '</span><strong class="pelican-hearts" id="pelican-hearts">♥♥♥</strong></div><div><span>' + t("best") + '</span><strong id="pelican-best">0</strong></div></div>' +
      '<div class="pelican-toolbar"><button id="pelican-camera" type="button"></button><button id="pelican-sound" type="button"></button><button id="pelican-pause" type="button">' + t("pause") + '</button><button id="pelican-restart" type="button">' + t("retry") + '</button><button id="pelican-fullscreen" type="button">' + t("fullscreen") + '</button></div>' +
      '<div class="pelican-controls"><div class="pelican-control-group"><button type="button" data-pelican-action="left" aria-label="' + t("left") + '">←</button><button type="button" data-pelican-action="right" aria-label="' + t("right") + '">→</button></div><div class="pelican-control-group"><button type="button" data-pelican-action="brake">' + t("brake") + '</button><button type="button" data-pelican-action="accelerate">' + t("accelerate") + '</button></div><div class="pelican-control-group"><button type="button" data-pelican-action="jump">' + t("jump") + '</button><button type="button" data-pelican-action="trick">' + t("trick") + '</button></div></div>' +
      '<div class="pelican-footer"><span>' + t("keyboard") + '</span><span>' + t("touch") + '</span></div></div>';
    stage = root.querySelector("#pelican-viewport"); state = freshState(); course = createCourse(); bind(); hud();
    overlay("readyTitle", "readyText", "start");
    root.querySelector("#pelican-overlay button").disabled = true;
    loadScene().then(function () {
      if (!alive || !root || !root.isConnected) return;
      try { scene = window.PelicanBikeScene.create(stage, course); render(.3); root.querySelector("#pelican-overlay button").disabled = false; }
      catch (_) { overlay("unavailableTitle", "unavailableText", "retry"); }
    }).catch(function () { if (alive) overlay("unavailableTitle", "unavailableText", "retry"); });
  }
  function deactivate() {
    alive = false; stopFrame(); held = {};
    window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
    document.removeEventListener("visibilitychange", visibility);
    if (scene) { scene.dispose(); scene = null; }
    root = null; stage = null;
  }
  return { init: init, deactivate: deactivate, _test: { createCourse: createCourse, collisionRule: collisionRule, scoreFor: scoreFor, clamp: clamp } };
})();
