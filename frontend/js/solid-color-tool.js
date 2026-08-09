// Solid Color Fill — check a screen's rendering by playing solid colors in fullscreen.
var SolidColorTool = (function () {
  "use strict";

  var SWATCHES = [
    "#000000", "#ffffff", "#808080", "#3b82f6",
    "#ef4444", "#22c55e", "#facc15", "#ec4899",
    "#f97316", "#8b5cf6", "#14b8a6", "#f5f5f4"
  ];
  var MODE_IDS = ["single", "preset", "random"];
  var DEFAULT_SINGLE = "#3b82f6";
  var DEFAULT_FRAME_MS = 1000;
  var MIN_FRAME_MS = 300;
  var MAX_FRAME_MS = 3600000;
  var PLAYER_Z = 2147483647;  // cover everything, including the side rail

  var container = null;
  var player = null;          // fullscreen color layer element
  var playTimer = null;       // per-color advance timer
  var countdownTimer = null;  // overall duration countdown
  var palette = [];
  var paletteIndex = 0;
  var playing = false;
  var frameMs = DEFAULT_FRAME_MS;
  var randomSource = Math.random;
  var state = null;           // snapshot of DOM at start time
  var playlist = [];          // preset-mode colors (single source of truth)

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function normalizeHex(value) {
    var hex = String(value == null ? "" : value).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      return "#" + hex.slice(1).split("").map(function (c) { return c + c; }).join("").toLowerCase();
    }
    return DEFAULT_SINGLE;
  }

  function clampFrameMs(value) {
    var ms = Math.round(Number(value));
    if (!Number.isFinite(ms)) return DEFAULT_FRAME_MS;
    return Math.min(MAX_FRAME_MS, Math.max(MIN_FRAME_MS, ms));
  }

  function randomColor(rng) {
    var source = rng || randomSource;
    var hex = "#";
    for (var i = 0; i < 3; i += 1) {
      hex += ("0" + Math.floor(source() * 256).toString(16)).slice(-2);
    }
    return hex;
  }

  function buildPalette(mode, singleHex, colors, rng) {
    if (mode === "single") return [normalizeHex(singleHex)];
    if (mode === "preset") {
      var list = (Array.isArray(colors) ? colors : []).map(normalizeHex).filter(Boolean);
      return list.length ? list : [normalizeHex(singleHex)];
    }
    // random: a fixed group of distinct colors for one run
    var seen = {};
    var out = [];
    var guard = 0;
    while (out.length < 4 && guard < 40) {
      guard += 1;
      var color = randomColor(rng);
      if (!seen[color]) { seen[color] = true; out.push(color); }
    }
    return out;
  }

  function nextIndex(current, length) {
    if (!length) return 0;
    return (current + 1) % length;
  }

  function applyColor(color) {
    if (player) player.style.backgroundColor = color;
  }

  function playColor() {
    if (!player || !playing) return;
    applyColor(palette[paletteIndex] || DEFAULT_SINGLE);
    if (palette.length > 1) {
      playTimer = setTimeout(function () {
        paletteIndex = nextIndex(paletteIndex, palette.length);
        playColor();
      }, frameMs);
    }
  }

  function exit() {
    playing = false;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null; }
    if (state && state.button) { state.button.disabled = false; }
    state = null;
    palette = [];
    paletteIndex = 0;
    if (player && player.parentNode) player.parentNode.removeChild(player);
    player = null;
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      var exitFs = document.exitFullscreen || document.webkitExitFullscreen;
      if (exitFs) { try { exitFs.call(document); } catch (_error) {} }
    }
    if (container) container.classList.remove("solid-color-playing");
    document.body.classList.remove("solid-color-active");
  }

  function handleKeydown(event) {
    if (event.key === "Escape") exit();
  }

  function handleFullscreenChange() {
    // User left fullscreen through the browser UI — end the run.
    if (playing && !document.fullscreenElement && !document.webkitFullscreenElement) exit();
  }

  function currentMode() {
    var mode = MODE_IDS.filter(function (id) {
      var input = container && container.querySelector('#solid-color-mode-' + id);
      return input && input.checked;
    })[0];
    return mode || "single";
  }

  function singleValue() {
    var input = container && container.querySelector("#solid-color-single");
    return input && input.value ? input.value : DEFAULT_SINGLE;
  }

  function setSwatchPressed(hex) {
    if (!container) return;
    var index = SWATCHES.indexOf(hex);
    var button = index !== -1 && container.querySelector('.solid-color-swatch[data-index="' + index + '"]');
    if (button) button.setAttribute("aria-pressed", String(playlist.indexOf(hex) !== -1));
  }

  function updateStartDisabled() {
    if (!container || playing) return;
    var button = container.querySelector("#solid-color-start");
    if (!button) return;
    var mode = currentMode();
    var disabled = mode === "preset" && playlist.length === 0;
    if (button.disabled !== disabled) button.disabled = disabled;
  }

  function renderPlaylist() {
    if (!container) return;
    var list = container.querySelector("#solid-color-playlist");
    if (!list) return;
    var mode = currentMode();
    var colors = mode === "single" ? [normalizeHex(singleValue())] : playlist.slice();
    list.innerHTML = colors.map(function (hex) {
      var remove = mode === "preset"
        ? '<button type="button" class="solid-color-remove" data-color="' + hex + '" aria-label="' + t("solidColor.removeColor").replace("{color}", hex) + '">×</button>'
        : "";
      return '<span class="solid-color-chip"><span class="solid-color-chip-color" aria-hidden="true" style="background-color:' + hex + '"></span><code>' + hex + '</code>' + remove + '</span>';
    }).join("");
    var empty = container.querySelector("#solid-color-playlist-empty");
    if (empty) empty.hidden = mode !== "preset" || playlist.length > 0;
    updateStartDisabled();
  }

  function togglePreset(hex) {
    var index = playlist.indexOf(hex);
    if (index === -1) playlist.push(hex); else playlist.splice(index, 1);
    setSwatchPressed(hex);
    renderPlaylist();
  }

  function addCustomColor() {
    if (!container) return;
    var input = container.querySelector("#solid-color-custom-input");
    var hex = normalizeHex(input.value);
    if (playlist.indexOf(hex) === -1) playlist.push(hex);
    setSwatchPressed(hex);
    renderPlaylist();
    if (input) input.value = DEFAULT_SINGLE;
  }

  function removePlaylistColor(hex) {
    var index = playlist.indexOf(hex);
    if (index !== -1) playlist.splice(index, 1);
    setSwatchPressed(hex);
    renderPlaylist();
  }

  function applyMode(value) {
    if (!container) return;
    var singleRow = container.querySelector("#solid-color-single-row");
    var presetsRow = container.querySelector("#solid-color-presets-row");
    var playlistRow = container.querySelector("#solid-color-playlist-row");
    if (singleRow) singleRow.hidden = value !== "single";
    if (presetsRow) presetsRow.hidden = value !== "preset";
    if (playlistRow) playlistRow.hidden = value === "random";
    if (value === "preset") {
      SWATCHES.forEach(setSwatchPressed);
    }
    renderPlaylist();
  }

  function start() {
    if (!container || playing) return;
    var mode = currentMode();

    var singleHex = singleValue();
    var colors;
    if (mode === "preset") colors = playlist.slice();
    else if (mode === "random") colors = buildPalette("random", null, null);
    else colors = [singleHex];

    palette = buildPalette(mode, singleHex, colors);
    if (!palette.length) palette = [normalizeHex(singleHex)];
    paletteIndex = 0;
    frameMs = clampFrameMs(container.querySelector("#solid-color-frame") && container.querySelector("#solid-color-frame").value);
    playing = true;

    var durationSelect = container.querySelector("#solid-color-duration");
    var durationSeconds = Number(durationSelect && durationSelect.value) || 0;

    var button = container.querySelector("#solid-color-start");
    if (button) button.disabled = true;
    state = { button: button };

    container.classList.add("solid-color-playing");
    document.body.classList.add("solid-color-active");

    var docElement = document.documentElement;
    var enterFs = docElement.requestFullscreen || docElement.webkitRequestFullscreen;
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    function paint() {
      createPlayer();
      playColor();
      if (durationSeconds > 0) {
        countdownTimer = setTimeout(function () { exit(); }, durationSeconds * 1000);
      }
    }
    if (enterFs) {
      enterFs.call(docElement).then(paint, paint);
    } else {
      paint();
    }
  }

  function createPlayer() {
    if (player) return;
    player = document.createElement("div");
    player.className = "solid-color-player";
    player.setAttribute("role", "status");
    player.setAttribute("aria-live", "off");
    document.body.appendChild(player);
  }

  function bindEvents() {
    if (!container) return;
    container.querySelectorAll("#solid-color-presets .solid-color-swatch").forEach(function (button) {
      button.addEventListener("click", function () {
        togglePreset(SWATCHES[Number(button.getAttribute("data-index"))]);
      });
    });
    var list = container.querySelector("#solid-color-playlist");
    if (list) {
      list.addEventListener("click", function (event) {
        var remove = event.target.closest(".solid-color-remove");
        if (remove) removePlaylistColor(remove.getAttribute("data-color"));
      });
    }
    var startButton = container.querySelector("#solid-color-start");
    if (startButton) startButton.addEventListener("click", start);
    var addButton = container.querySelector("#solid-color-custom-add");
    if (addButton) addButton.addEventListener("click", addCustomColor);
    var customInput = container.querySelector("#solid-color-custom-input");
    if (customInput) {
      customInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") { event.preventDefault(); addCustomColor(); }
      });
    }
    var singleInput = container.querySelector("#solid-color-single");
    if (singleInput) singleInput.addEventListener("input", renderPlaylist);
    container.querySelectorAll('input[name="solid-color-mode"]').forEach(function (radio) {
      radio.addEventListener("change", function () { applyMode(radio.value); });
    });
  }

  function init(element) {
    deactivate();
    container = element;
    container.innerHTML =
      '<div class="solid-color-tool">' +
        '<section class="tool-panel solid-color-config" aria-labelledby="solid-color-config-title">' +
          '<h2 id="solid-color-config-title">' + t("solidColor.configTitle") + '</h2>' +
          '<fieldset class="solid-color-field solid-color-modes-wrap" id="solid-color-modes">' +
            '<legend>' + t("solidColor.modeLabel") + '</legend>' +
            '<div class="solid-color-mode-row" role="radiogroup" aria-label="' + t("solidColor.modeLabel") + '">' +
              '<label class="solid-color-mode"><input type="radio" id="solid-color-mode-single" name="solid-color-mode" value="single" checked><span>' + t("solidColor.modeSingle") + '</span></label>' +
              '<label class="solid-color-mode"><input type="radio" id="solid-color-mode-preset" name="solid-color-mode" value="preset"><span>' + t("solidColor.modePreset") + '</span></label>' +
              '<label class="solid-color-mode"><input type="radio" id="solid-color-mode-random" name="solid-color-mode" value="random"><span>' + t("solidColor.modeRandom") + '</span></label>' +
            '</div>' +
          '</fieldset>' +
          '<div class="solid-color-field" id="solid-color-single-row">' +
            '<label class="solid-color-label" for="solid-color-single">' + t("solidColor.singleLabel") + '</label>' +
            '<input id="solid-color-single" type="color" value="' + DEFAULT_SINGLE + '">' +
          '</div>' +
          '<div class="solid-color-field solid-color-presets-wrap" id="solid-color-presets-row" hidden>' +
            '<span class="solid-color-label">' + t("solidColor.presetLabel") + '</span>' +
            '<div class="solid-color-presets" id="solid-color-presets" role="group" aria-label="' + t("solidColor.presetLabel") + '">' +
              SWATCHES.map(function (color, index) {
                return '<button type="button" class="solid-color-swatch" data-index="' + index + '" style="background-color:' + color + '" aria-pressed="false" aria-label="' + color + '"></button>';
              }).join("") +
            '</div>' +
            '<div class="solid-color-custom">' +
              '<span class="solid-color-label">' + t("solidColor.customLabel") + '</span>' +
              '<div class="solid-color-custom-row">' +
                '<input id="solid-color-custom-input" type="color" value="' + DEFAULT_SINGLE + '" aria-label="' + t("solidColor.customInputLabel") + '">' +
                '<button id="solid-color-custom-add" type="button">' + t("solidColor.customAdd") + '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="solid-color-field solid-color-playlist-wrap" id="solid-color-playlist-row">' +
            '<span class="solid-color-label">' + t("solidColor.playlistTitle") + '</span>' +
            '<div class="solid-color-playlist" id="solid-color-playlist" aria-label="' + t("solidColor.playlistTitle") + '"></div>' +
            '<p class="solid-color-playlist-empty" id="solid-color-playlist-empty" hidden>' + t("solidColor.playlistEmpty") + '</p>' +
          '</div>' +
          '<div class="solid-color-field" id="solid-color-frame-row">' +
            '<label class="solid-color-label" for="solid-color-frame">' + t("solidColor.frameLabel") + '</label>' +
            '<input id="solid-color-frame" type="number" min="' + MIN_FRAME_MS + '" max="' + MAX_FRAME_MS + '" step="100" value="' + DEFAULT_FRAME_MS + '" inputmode="numeric" aria-describedby="solid-color-frame-hint">' +
            '<span class="solid-color-unit" id="solid-color-frame-hint">' + t("solidColor.frameUnit") + '</span>' +
          '</div>' +
          '<div class="solid-color-field" id="solid-color-duration-row">' +
            '<label class="solid-color-label" for="solid-color-duration">' + t("solidColor.durationLabel") + '</label>' +
            '<select id="solid-color-duration">' +
              '<option value="0" selected>' + t("solidColor.durationUnlimited") + '</option>' +
              '<option value="10">' + t("solidColor.duration10") + '</option>' +
              '<option value="30">' + t("solidColor.duration30") + '</option>' +
              '<option value="60">' + t("solidColor.duration60") + '</option>' +
            '</select>' +
          '</div>' +
          '<div class="solid-color-actions"><button id="solid-color-start" class="solid-color-start" type="button">' + t("solidColor.start") + '</button></div>' +
          '<p class="solid-color-note">' + t("solidColor.note") + '</p>' +
        '</section>' +
      '</div>';
    bindEvents();
    applyMode("single");
  }

  function deactivate() {
    exit();
    if (container) { container.innerHTML = ""; container = null; }
    playlist = [];
  }

  return {
    init: init,
    deactivate: deactivate,
    _test: {
      normalizeHex: normalizeHex,
      randomColor: randomColor,
      buildPalette: buildPalette,
      nextIndex: nextIndex,
      clampFrameMs: clampFrameMs,
      SWATCHES: SWATCHES
    }
  };
})();
