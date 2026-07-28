// Children's Literacy — data-source driven fullscreen learning cards.
var LiteracyTool = (function () {
  "use strict";

  var container = null;
  var timer = null;
  var running = false;
  var isFullscreen = false;
  var activeItems = [];
  var activeSourceId = "";
  var currentItem = null;
  var lastItemId = "";
  var lastRandomColor = "";
  var loadSequence = 0;
  var playbackToken = 0;
  var audioPlayer = null;
  var audioResolve = null;
  var audioTimeoutTimer = null;
  var audioGapTimer = null;
  var audioGapResolve = null;
  var preparedAudio = Object.create(null);
  var sourceOrder = [];
  var sourceRegistry = Object.create(null);
  var manifestPromises = Object.create(null);
  var STORAGE_KEY = "devtools_literacy_preferences";
  var TOOL_ASSET_VERSION = "";
  try {
    if (document.currentScript && document.currentScript.src) {
      TOOL_ASSET_VERSION = new window.URL(document.currentScript.src, window.location.href).searchParams.get("v") || "";
    }
  } catch (error) {}
  function versionedAssetUrl(path) {
    return path + (TOOL_ASSET_VERSION ? "?v=" + encodeURIComponent(TOOL_ASSET_VERSION) : "");
  }

  var CORE_MANIFEST_URL = versionedAssetUrl("/data/literacy/core-manifest.json");
  var REMOTE_MANIFEST_URL = versionedAssetUrl("/data/literacy/manifest.json");
  var FONT_OPTIONS = {
    rounded: {
      family: '"Arial Rounded MT Bold","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
      weight: "800"
    },
    sans: {
      family: '"PingFang SC","Microsoft YaHei",system-ui,sans-serif',
      weight: "800"
    },
    kai: {
      family: '"Kaiti SC","STKaiti","KaiTi",cursive',
      weight: "700"
    },
    serif: {
      family: '"Songti SC","STSong","SimSun",serif',
      weight: "700"
    }
  };
  var RANDOM_COLORS = {
    dark: ["#f87171", "#fbbf24", "#4ade80", "#60a5fa", "#a78bfa", "#f472b6", "#2dd4bf"],
    light: ["#b91c1c", "#a16207", "#15803d", "#1d4ed8", "#6d28d9", "#be185d", "#0f766e"]
  };
  function t(key) {
    return (window.__t && window.__t(key)) || key;
  }

  function localizedText(value) {
    if (value == null) return "";
    if (typeof value !== "object") return String(value);
    var language = (document.documentElement && document.documentElement.lang || "en").toLowerCase();
    var keys = language.indexOf("zh") === 0
      ? ["zh-CN", "zh", "en"]
      : ["en", "en-US", "zh-CN", "zh"];
    for (var i = 0; i < keys.length; i += 1) {
      if (value[keys[i]]) return String(value[keys[i]]);
    }
    var available = Object.keys(value);
    return available.length ? String(value[available[0]]) : "";
  }

  function isValidColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value || "");
  }

  function themeName() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function defaultColor() {
    return themeName() === "light" ? "#0969da" : "#58a6ff";
  }

  function randomColorForTheme(theme, randomValue) {
    var palette = RANDOM_COLORS[theme === "light" ? "light" : "dark"];
    var safeRandom = Math.max(0, Math.min(0.999999, Number(randomValue) || 0));
    return palette[Math.floor(safeRandom * palette.length)];
  }

  function pickRandomColor() {
    var color = randomColorForTheme(themeName(), Math.random());
    if (RANDOM_COLORS[themeName()].length > 1 && color === lastRandomColor) {
      var index = RANDOM_COLORS[themeName()].indexOf(color);
      color = RANDOM_COLORS[themeName()][(index + 1) % RANDOM_COLORS[themeName()].length];
    }
    lastRandomColor = color;
    return color;
  }

  function loadPreferences() {
    var defaults = {
      color: defaultColor(),
      randomColor: false,
      font: "rounded",
      autoSpeak: true,
      speakChinese: true,
      speakEnglish: true
    };
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored || typeof stored !== "object") return defaults;
      return {
        color: isValidColor(stored.color) ? stored.color : defaults.color,
        randomColor: stored.randomColor === true,
        font: FONT_OPTIONS[stored.font] ? stored.font : defaults.font,
        autoSpeak: stored.autoSpeak !== false,
        speakChinese: stored.speakChinese !== false,
        speakEnglish: stored.speakEnglish !== false
      };
    } catch (error) {
      return defaults;
    }
  }

  function currentPreferences() {
    if (!container) return loadPreferences();
    var color = container.querySelector("#literacy-color");
    var randomColor = container.querySelector("#literacy-random-color");
    var font = container.querySelector("#literacy-font");
    var autoSpeak = container.querySelector("#literacy-auto-speak");
    var speakChinese = container.querySelector("#literacy-speak-zh");
    var speakEnglish = container.querySelector("#literacy-speak-en");
    return {
      color: color && isValidColor(color.value) ? color.value : defaultColor(),
      randomColor: Boolean(randomColor && randomColor.checked),
      font: font && FONT_OPTIONS[font.value] ? font.value : "rounded",
      autoSpeak: !autoSpeak || autoSpeak.checked,
      speakChinese: !speakChinese || speakChinese.checked,
      speakEnglish: !speakEnglish || speakEnglish.checked
    };
  }

  function savePreferences(preferences) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {}
  }

  function updateAppearanceControls() {
    if (!container) return;
    var color = container.querySelector("#literacy-color");
    var randomColor = container.querySelector("#literacy-random-color");
    if (color && randomColor) color.disabled = randomColor.checked;
  }

  function applyAppearance(useNewRandomColor) {
    var card = container && container.querySelector("#literacy-card");
    if (!card) return;
    var preferences = currentPreferences();
    var font = FONT_OPTIONS[preferences.font] || FONT_OPTIONS.rounded;
    var color = preferences.color;
    if (preferences.randomColor) {
      color = useNewRandomColor || !lastRandomColor ? pickRandomColor() : lastRandomColor;
    }
    card.style.setProperty("--literacy-card-color", color);
    card.style.setProperty("--literacy-font-family", font.family);
    card.style.setProperty("--literacy-font-weight", font.weight);
  }

  function handleAppearanceChange(useNewRandomColor) {
    updateAppearanceControls();
    applyAppearance(useNewRandomColor);
    savePreferences(currentPreferences());
  }

  function coreManifest() {
    return loadManifest("core", CORE_MANIFEST_URL).then(function (manifest) {
      if (manifest.__audioReady) return manifest;
      manifest.numbers.forEach(function (item) {
        item.pronunciation.audio = {
          "zh-CN": "/audio/literacy/numbers/numbers_" + item.id + "_zh-CN.mp3",
          "en-US": "/audio/literacy/numbers/numbers_" + item.id + "_en-US.mp3"
        };
      });
      manifest.letters.forEach(function (item) {
        item.audio = {
          "en-US": "/audio/literacy/letters/letters_" + item.id + "_en-US.mp3"
        };
      });
      Object.defineProperty(manifest, "__audioReady", { value: true });
      return manifest;
    });
  }

  function remoteManifest() {
    return loadManifest("remote", REMOTE_MANIFEST_URL);
  }

  function remoteCategoryItems(categoryId) {
    return remoteManifest().then(function (manifest) {
      var category = manifest.categories.find(function (candidate) {
        return candidate.id === categoryId;
      });
      if (!category) throw new Error("Missing remote literacy category: " + categoryId);
      return mapRemoteItems(category);
    });
  }

  function mapRemoteItems(category) {
    return category.items.map(function (item) {
      var imageUrl = item.image && item.image.url;
      if (imageUrl) {
        return {
          id: item.id,
          kind: "image",
          src: imageUrl,
          label: item.label,
          caption: item.label,
          pronunciation: item.pronunciation
        };
      }
      return {
        id: item.id,
        kind: "text",
        value: item.label["zh-CN"],
        label: item.label,
        pronunciation: item.pronunciation
      };
    });
  }

  function letterItems(letters, lowercase) {
    return letters.map(function (letter) {
      var value = lowercase ? letter.value.toLowerCase() : letter.value;
      return {
        id: value,
        kind: "text",
        value: value,
        label: value,
        displayPronunciation: false,
        pronunciation: {
          english: letter.value,
          ipa: letter.ipa,
          audio: letter.audio || {}
        }
      };
    });
  }

  function loadManifest(sourceId, url) {
    if (!manifestPromises[sourceId]) {
      manifestPromises[sourceId] = fetch(url).then(function (response) {
        if (!response.ok) throw new Error(sourceId + " card manifest returned " + response.status);
        return response.json();
      }).catch(function (error) {
        manifestPromises[sourceId] = null;
        throw error;
      });
    }
    return manifestPromises[sourceId];
  }

  function registerDataSource(source) {
    if (!source || !/^[a-z0-9][a-z0-9-]*$/i.test(source.id || "")) {
      throw new TypeError("A literacy data source requires a valid id");
    }
    if (!Array.isArray(source.items) && typeof source.load !== "function") {
      throw new TypeError("Literacy data source " + source.id + " requires items or load()");
    }

    var exists = Boolean(sourceRegistry[source.id]);
    sourceRegistry[source.id] = {
      id: source.id,
      label: source.label || "",
      labelKey: source.labelKey || "",
      defaultKind: source.defaultKind || "text",
      creditsUrl: source.creditsUrl || "",
      items: Array.isArray(source.items) ? source.items.slice() : null,
      load: typeof source.load === "function" ? source.load : null,
      cachedItems: null
    };
    if (!exists) sourceOrder.push(source.id);

    if (container && container.querySelector("#literacy-source")) {
      renderSourceOptions();
    }
    return source.id;
  }

  function registerBuiltInSources() {
    registerDataSource({
      id: "numbers",
      labelKey: "literacy.sourceNumbers",
      load: function () {
        return coreManifest().then(function (manifest) { return manifest.numbers; });
      }
    });
    registerDataSource({
      id: "uppercase",
      labelKey: "literacy.sourceUppercase",
      load: function () {
        return coreManifest().then(function (manifest) {
          return letterItems(manifest.letters, false);
        });
      }
    });
    registerDataSource({
      id: "lowercase",
      labelKey: "literacy.sourceLowercase",
      load: function () {
        return coreManifest().then(function (manifest) {
          return letterItems(manifest.letters, true);
        });
      }
    });
    registerDataSource({
      id: "mixed",
      labelKey: "literacy.sourceMixed",
      load: function () {
        return coreManifest().then(function (manifest) {
          return manifest.numbers.concat(
            letterItems(manifest.letters, false),
            letterItems(manifest.letters, true)
          );
        });
      }
    });
    registerDataSource({
      id: "animals",
      labelKey: "literacy.sourceAnimals",
      defaultKind: "image",
      creditsUrl: REMOTE_MANIFEST_URL,
      load: function () {
        return remoteCategoryItems("animals");
      }
    });
    registerDataSource({
      id: "fruits",
      labelKey: "literacy.sourceFruits",
      defaultKind: "image",
      creditsUrl: REMOTE_MANIFEST_URL,
      load: function () {
        return remoteCategoryItems("fruits");
      }
    });
    registerDataSource({
      id: "plants",
      labelKey: "literacy.sourcePlants",
      defaultKind: "image",
      creditsUrl: REMOTE_MANIFEST_URL,
      load: function () {
        return remoteCategoryItems("plants");
      }
    });
    registerDataSource({
      id: "vehicles",
      labelKey: "literacy.sourceVehicles",
      defaultKind: "image",
      creditsUrl: REMOTE_MANIFEST_URL,
      load: function () {
        return remoteCategoryItems("vehicles");
      }
    });
  }

  function sourceLabel(source) {
    return source.labelKey ? t(source.labelKey) : (source.label || source.id);
  }

  function renderSourceOptions(preferredId) {
    var select = container && container.querySelector("#literacy-source");
    if (!select) return;
    var selectedId = preferredId || select.value || sourceOrder[0] || "";
    select.innerHTML = "";
    sourceOrder.forEach(function (sourceId) {
      var source = sourceRegistry[sourceId];
      var option = document.createElement("option");
      option.value = source.id;
      option.textContent = sourceLabel(source);
      select.appendChild(option);
    });
    if (sourceRegistry[selectedId]) select.value = selectedId;
    updateCreditsLink(sourceRegistry[select.value]);
  }

  function updateCreditsLink(source) {
    var link = container && container.querySelector("#literacy-credits");
    if (!link) return;
    var creditsUrl = source && source.creditsUrl;
    link.hidden = !creditsUrl;
    if (creditsUrl) link.href = creditsUrl;
    else link.removeAttribute("href");
  }

  function normalizeItem(item, index, source) {
    var raw = item;
    if (typeof raw === "string" || typeof raw === "number") {
      raw = { value: String(raw) };
    }
    if (!raw || typeof raw !== "object") return null;

    var kind = raw.kind || raw.type || source.defaultKind || "text";
    var label = raw.label || raw.alt || raw.caption || "";
    var id = String(raw.id != null ? raw.id : source.id + "-" + index);
    var pronunciation = normalizePronunciation(raw);

    if (kind === "image") {
      var src = raw.src || raw.value || "";
      if (!src) return null;
      return {
        id: id,
        kind: "image",
        src: String(src),
        label: label || t("literacy.imageFallback"),
        caption: raw.caption || "",
        primaryText: raw.primaryText || localizedChineseText(raw.caption || raw.label),
        pronunciation: pronunciation,
        displayPronunciation: raw.displayPronunciation !== false
      };
    }

    var value = raw.value;
    if (value == null) value = raw.text;
    if (value == null) value = raw.content;
    if (value == null) return null;
    return {
      id: id,
      kind: kind === "emoji" ? "emoji" : "text",
      value: String(value),
      label: label || String(value),
      caption: raw.caption || "",
      primaryText: raw.primaryText || "",
      pronunciation: pronunciation,
      displayPronunciation: raw.displayPronunciation !== false
    };
  }

  function localizedChineseText(value) {
    if (value == null) return "";
    if (typeof value !== "object") return String(value);
    return String(value["zh-CN"] || value.zh || localizedText(value) || "");
  }

  function normalizePronunciation(raw) {
    var pronunciation = raw.pronunciation && typeof raw.pronunciation === "object"
      ? raw.pronunciation
      : {};
    var english = raw.english || pronunciation.english || "";
    if (!english && raw.label && typeof raw.label === "object") {
      english = raw.label.en || raw.label["en-US"] || "";
    }
    var audio = pronunciation.audio && typeof pronunciation.audio === "object"
      ? pronunciation.audio
      : (raw.audio && typeof raw.audio === "object" ? raw.audio : {});
    return {
      chinese: String(raw.chinese || pronunciation.chinese || ""),
      pinyin: String(raw.pinyin || pronunciation.pinyin || ""),
      english: String(english),
      ipa: String(raw.ipa || raw.phonetic || pronunciation.ipa || pronunciation.phonetic || ""),
      audio: {
        "zh-CN": typeof audio["zh-CN"] === "string" ? audio["zh-CN"] : "",
        "en-US": typeof audio["en-US"] === "string" ? audio["en-US"] : ""
      }
    };
  }

  function normalizeItems(result, source) {
    var rawItems = Array.isArray(result) ? result : (result && result.items);
    if (!Array.isArray(rawItems)) {
      throw new TypeError("Literacy data source " + source.id + " did not return an item array");
    }
    return rawItems.map(function (item, index) {
      return normalizeItem(item, index, source);
    }).filter(Boolean);
  }

  function resolveSource(source) {
    if (source.cachedItems) return Promise.resolve(source.cachedItems.slice());
    var result;
    try {
      result = source.load ? source.load() : source.items;
    } catch (error) {
      return Promise.reject(error);
    }
    return Promise.resolve(result).then(function (items) {
      source.cachedItems = normalizeItems(items, source);
      return source.cachedItems.slice();
    });
  }

  function setStatus(key, isError) {
    var status = container && container.querySelector("#literacy-source-status");
    if (!status) return;
    status.textContent = key ? t(key) : "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  function setLoading(loading) {
    if (!container) return;
    var source = container.querySelector("#literacy-source");
    var start = container.querySelector("#literacy-start");
    if (source) source.disabled = loading;
    if (start) start.disabled = loading;
    if (loading) setStatus("literacy.loadingSource", false);
  }

  function renderItem(item) {
    var card = container && container.querySelector("#literacy-card");
    if (!card || !item) return;
    var label = localizedText(item.label) || t("literacy.imageFallback");
    var primaryText = item.primaryText || localizedText(item.caption);
    var pronunciation = item.pronunciation || {};
    var spokenParts = [
      item.kind === "image" ? primaryText : item.value,
      pronunciation.pinyin,
      pronunciation.chinese,
      pronunciation.english,
      pronunciation.ipa
    ].filter(Boolean);
    clearPreparedAudio();
    card.innerHTML = "";
    card.classList.remove("has-image-error");
    card.classList.toggle(
      "is-word-only",
      item.kind === "text" && Boolean(pronunciation.chinese) && String(item.value) === pronunciation.chinese
    );
    card.setAttribute("aria-label", spokenParts.length ? spokenParts.join(", ") : label);
    applyAppearance(true);

    if (item.kind === "image") {
      var image = document.createElement("img");
      image.className = "literacy-image";
      image.src = item.src;
      image.alt = label;
      image.addEventListener("error", function () {
        image.hidden = true;
        card.classList.add("has-image-error");
        setStatus("literacy.imageLoadFailed", true);
      }, { once: true });
      card.appendChild(image);
    } else {
      var content = document.createElement("div");
      content.className = "literacy-char literacy-card-content";
      if (item.kind === "emoji") content.classList.add("is-emoji");
      content.textContent = item.value;
      card.appendChild(content);
    }

    if (item.kind === "image" && (primaryText || pronunciation.pinyin || pronunciation.english || pronunciation.ipa)) {
      var vocabulary = document.createElement("div");
      vocabulary.className = "literacy-vocab";
      if (pronunciation.pinyin) appendCardLine(vocabulary, "literacy-pinyin", pronunciation.pinyin);
      if (primaryText) appendCardLine(vocabulary, "literacy-caption", primaryText);
      if (pronunciation.english) appendCardLine(vocabulary, "literacy-english", pronunciation.english);
      if (pronunciation.ipa) appendCardLine(vocabulary, "literacy-phonetic", pronunciation.ipa);
      card.appendChild(vocabulary);
    } else if (pronunciation.chinese) {
      var numberPronunciation = document.createElement("div");
      numberPronunciation.className = "literacy-number-pronunciation";
      if (pronunciation.pinyin) appendCardLine(numberPronunciation, "literacy-pinyin", pronunciation.pinyin);
      if (String(item.value) !== pronunciation.chinese) {
        appendCardLine(numberPronunciation, "literacy-caption", pronunciation.chinese);
      }
      if (pronunciation.english) appendCardLine(numberPronunciation, "literacy-english", pronunciation.english);
      if (pronunciation.ipa) appendCardLine(numberPronunciation, "literacy-phonetic", pronunciation.ipa);
      card.appendChild(numberPronunciation);
    } else if (item.displayPronunciation && (pronunciation.english || pronunciation.ipa)) {
      var textPronunciation = document.createElement("div");
      textPronunciation.className = "literacy-number-pronunciation";
      if (pronunciation.english) appendCardLine(textPronunciation, "literacy-english", pronunciation.english);
      if (pronunciation.ipa) appendCardLine(textPronunciation, "literacy-phonetic", pronunciation.ipa);
      card.appendChild(textPronunciation);
    } else if (primaryText) {
      var caption = document.createElement("p");
      caption.className = "literacy-caption";
      caption.textContent = primaryText;
      card.appendChild(caption);
    }
    prepareItemAudio(item);
    renderSpeechControls(card, item);
  }

  function appendCardLine(parent, className, text) {
    var line = document.createElement("p");
    line.className = className;
    line.textContent = text;
    parent.appendChild(line);
  }

  function renderSpeechControls(card, item) {
    var audio = item.pronunciation && item.pronunciation.audio || {};
    if (!audio["zh-CN"] && !audio["en-US"]) return;
    var controls = document.createElement("div");
    controls.className = "literacy-speech-controls";
    if (audio["zh-CN"]) {
      controls.appendChild(createSpeechButton("zh-CN", t("literacy.speakChinese")));
    }
    if (audio["en-US"]) {
      controls.appendChild(createSpeechButton("en-US", t("literacy.speakEnglish")));
    }
    card.appendChild(controls);
  }

  function createSpeechButton(locale, text) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "literacy-speech-button";
    button.setAttribute("data-locale", locale);
    button.setAttribute("aria-label", text);
    button.textContent = "🔊 " + text;
    button.addEventListener("click", function () {
      speakCurrent(locale);
    });
    return button;
  }

  function prepareItemAudio(item) {
    if (!window.Audio || !item || !item.pronunciation) return;
    var audio = item.pronunciation.audio || {};
    ["zh-CN", "en-US"].forEach(function (locale) {
      if (!audio[locale]) return;
      var clip = new window.Audio(audio[locale]);
      clip.preload = "auto";
      preparedAudio[locale] = clip;
      if (clip.load) clip.load();
    });
  }

  function clearPreparedAudio() {
    Object.keys(preparedAudio).forEach(function (locale) {
      var clip = preparedAudio[locale];
      clip.onended = null;
      clip.onerror = null;
      if (clip.pause) clip.pause();
      try { clip.currentTime = 0; } catch (error) {}
      if (clip.removeAttribute) clip.removeAttribute("src");
      if (clip.load) clip.load();
    });
    preparedAudio = Object.create(null);
  }

  function cancelAudio() {
    playbackToken += 1;
    if (audioTimeoutTimer) {
      clearTimeout(audioTimeoutTimer);
      audioTimeoutTimer = null;
    }
    if (audioGapTimer) {
      clearTimeout(audioGapTimer);
      audioGapTimer = null;
    }
    if (audioGapResolve) {
      var resolveGap = audioGapResolve;
      audioGapResolve = null;
      resolveGap(false);
    }
    if (audioPlayer) {
      audioPlayer.onended = null;
      audioPlayer.onerror = null;
      if (audioPlayer.pause) audioPlayer.pause();
      try { audioPlayer.currentTime = 0; } catch (error) {}
      audioPlayer = null;
    }
    if (audioResolve) {
      var resolveAudio = audioResolve;
      audioResolve = null;
      resolveAudio(false);
    }
  }

  function playPreparedClip(locale, token) {
    var clip = preparedAudio[locale];
    if (!clip || token !== playbackToken) return Promise.resolve(false);
    audioPlayer = clip;
    try { clip.currentTime = 0; } catch (error) {}
    return new Promise(function (resolve) {
      var settled = false;
      function finish(success) {
        if (settled) return;
        settled = true;
        if (audioTimeoutTimer) {
          clearTimeout(audioTimeoutTimer);
          audioTimeoutTimer = null;
        }
        clip.onended = null;
        clip.onerror = null;
        if (audioPlayer === clip) audioPlayer = null;
        if (audioResolve === finish) audioResolve = null;
        resolve(success && token === playbackToken);
      }
      audioResolve = finish;
      clip.onended = function () { finish(true); };
      clip.onerror = function () {
        setStatus("literacy.audioLoadFailed", true);
        finish(false);
      };
      audioTimeoutTimer = setTimeout(function () {
        if (clip.pause) clip.pause();
        setStatus("literacy.audioLoadFailed", true);
        finish(false);
      }, 10000);
      var playResult;
      try {
        playResult = clip.play();
      } catch (error) {
        setStatus("literacy.audioPlayFailed", true);
        finish(false);
        return;
      }
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(function () {
          setStatus("literacy.audioPlayFailed", true);
          finish(false);
        });
      }
    });
  }

  function waitForAudioGap(token) {
    if (token !== playbackToken) return Promise.resolve(false);
    return new Promise(function (resolve) {
      audioGapResolve = resolve;
      audioGapTimer = setTimeout(function () {
        audioGapTimer = null;
        audioGapResolve = null;
        resolve(token === playbackToken);
      }, 350);
    });
  }

  function playPronunciationSequence(item, locales) {
    cancelAudio();
    var token = playbackToken;
    var available = locales.filter(function (locale) {
      return Boolean(item && item.pronunciation && item.pronunciation.audio[locale]);
    });
    function playAt(index) {
      if (token !== playbackToken || index >= available.length) {
        return Promise.resolve(token === playbackToken);
      }
      return playPreparedClip(available[index], token).then(function () {
        if (token !== playbackToken || index === available.length - 1) {
          return token === playbackToken;
        }
        return waitForAudioGap(token).then(function (continuePlayback) {
          return continuePlayback ? playAt(index + 1) : false;
        });
      });
    }
    return playAt(0);
  }

  function runCardCycle(item) {
    if (!running || !item) return;
    var prefs = currentPreferences();
    if (!prefs.autoSpeak) {
      scheduleNext();
      return;
    }
    var locales = [];
    if (prefs.speakChinese) locales.push("zh-CN");
    if (prefs.speakEnglish) locales.push("en-US");
    if (!locales.length) {
      scheduleNext();
      return;
    }
    playPronunciationSequence(item, locales).then(function (completed) {
      if (completed && running && currentItem === item) scheduleNext();
    });
  }

  function speakCurrent(locale) {
    if (!currentItem || !currentItem.pronunciation.audio[locale]) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    var item = currentItem;
    playPronunciationSequence(item, [locale]).then(function (completed) {
      if (completed && running && currentItem === item) scheduleNext();
    });
  }

  function showRandom() {
    if (!activeItems.length) return null;
    var candidates = activeItems;
    if (activeItems.length > 1 && lastItemId) {
      candidates = activeItems.filter(function (item) { return item.id !== lastItemId; });
    }
    var item = candidates[Math.floor(Math.random() * candidates.length)];
    lastItemId = item.id;
    currentItem = item;
    renderItem(item);
    return item;
  }

  function loadSelectedSource(showCard) {
    if (!container) return Promise.resolve(false);
    var select = container.querySelector("#literacy-source");
    var source = select && sourceRegistry[select.value];
    updateCreditsLink(source);
    if (!source) {
      activeItems = [];
      setStatus("literacy.emptySource", true);
      return Promise.resolve(false);
    }

    var sequence = ++loadSequence;
    setLoading(true);
    return resolveSource(source).then(function (items) {
      if (!container || sequence !== loadSequence) return false;
      activeSourceId = source.id;
      activeItems = items;
      currentItem = null;
      lastItemId = "";
      setLoading(false);
      if (!items.length) {
        setStatus("literacy.emptySource", true);
        return false;
      }
      setStatus("", false);
      if (showCard) showRandom();
      return true;
    }).catch(function (error) {
      if (!container || sequence !== loadSequence) return false;
      activeItems = [];
      currentItem = null;
      setLoading(false);
      setStatus("literacy.sourceLoadFailed", true);
      console.error("[literacy] data source failed:", source.id, error);
      return false;
    });
  }

  function getInterval() {
    if (!container) return 3000;
    var input = container.querySelector("#literacy-interval");
    var value = input ? parseInt(input.value, 10) : 3;
    return (value >= 1 && value <= 30) ? value * 1000 : 3000;
  }

  function updateIntervalLabel() {
    var output = container && container.querySelector("#literacy-interval-value");
    if (output) output.textContent = getInterval() / 1000 + "s";
  }

  function scheduleNext() {
    if (!running) return;
    timer = setTimeout(function () {
      timer = null;
      runCardCycle(showRandom());
    }, getInterval());
  }

  function updatePlaybackControls() {
    if (!container) return;
    var start = container.querySelector("#literacy-start");
    var stop = container.querySelector("#literacy-stop");
    if (start) start.textContent = t(running ? "literacy.pause" : "literacy.start");
    if (stop) stop.disabled = !running && !lastItemId;
  }

  function start() {
    if (running || !container) return;
    var sourceId = container.querySelector("#literacy-source").value;
    var ready = sourceId === activeSourceId && activeItems.length;
    function beginPlayback() {
      if (!container) return;
      running = true;
      var item = currentItem || showRandom();
      updatePlaybackControls();
      runCardCycle(item);
    }
    if (ready) {
      beginPlayback();
      return;
    }
    loadSelectedSource(false).then(function (loaded) {
      if (loaded) beginPlayback();
    });
  }

  function pause() {
    running = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    cancelAudio();
    updatePlaybackControls();
  }

  function stop() {
    pause();
    clearPreparedAudio();
    currentItem = null;
    lastItemId = "";
    var card = container && container.querySelector("#literacy-card");
    if (card) {
      card.innerHTML = "";
      card.removeAttribute("aria-label");
    }
    updatePlaybackControls();
  }

  function handleSourceChange() {
    var shouldResume = running;
    pause();
    clearPreparedAudio();
    loadSelectedSource(true).then(function (loaded) {
      if (shouldResume && loaded && container) {
        running = true;
        updatePlaybackControls();
        runCardCycle(currentItem);
      }
    });
  }

  function toggleFullscreen() {
    var stage = container && container.querySelector("#literacy-stage");
    if (!stage) return;
    var wasFullscreen = isFullscreen;
    isFullscreen = !isFullscreen;
    stage.classList.toggle("is-viewport-fullscreen", isFullscreen);
    stage.classList.toggle("is-fullscreen", isFullscreen);
    document.body.classList.toggle("ball-game-fullscreen-active", isFullscreen);
    var button = container.querySelector("#literacy-fullscreen");
    if (button) button.setAttribute("aria-pressed", String(isFullscreen));
    resizeStage();
    if (wasFullscreen && running) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      cancelAudio();
      scheduleNext();
    }
  }

  function nativeFullscreen() {
    var stage = container && container.querySelector("#literacy-stage");
    if (!stage) return;
    var toolElement = container.querySelector(".literacy-tool");
    var button = container.querySelector("#literacy-native-fs");
    if (window.Tools24 && window.Tools24.nativeFullscreen) {
      window.Tools24.nativeFullscreen.toggle(stage, toolElement, button);
    } else if (stage.requestFullscreen) {
      stage.requestFullscreen().catch(function () {});
    }
  }

  function resizeStage() {
    var stage = container && container.querySelector("#literacy-stage");
    if (!stage) return;
    if (isFullscreen) {
      stage.style.height = "";
      return;
    }
    var minimumHeight = window.innerWidth <= 760 ? 520 : 260;
    stage.style.height = Math.max(minimumHeight, window.innerHeight - stage.getBoundingClientRect().top - 20) + "px";
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && isFullscreen) toggleFullscreen();
  }

  function handleNativeFullscreenChange() {
    if (!document.fullscreenElement && running) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      cancelAudio();
      scheduleNext();
    }
  }

  function bindEvents() {
    container.querySelector("#literacy-source").addEventListener("change", handleSourceChange);
    container.querySelector("#literacy-color").addEventListener("input", function () {
      handleAppearanceChange(false);
    });
    container.querySelector("#literacy-random-color").addEventListener("change", function () {
      handleAppearanceChange(this.checked);
    });
    container.querySelector("#literacy-font").addEventListener("change", function () {
      handleAppearanceChange(false);
    });
    function onSpeakPrefChange() {
      savePreferences(currentPreferences());
      if (running && currentItem) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        cancelAudio();
        runCardCycle(currentItem);
      }
    }
    container.querySelector("#literacy-auto-speak").addEventListener("change", onSpeakPrefChange);
    container.querySelector("#literacy-speak-zh").addEventListener("change", onSpeakPrefChange);
    container.querySelector("#literacy-speak-en").addEventListener("change", onSpeakPrefChange);
    container.querySelector("#literacy-interval").addEventListener("input", function () {
      updateIntervalLabel();
      if (running && timer) {
        clearTimeout(timer);
        timer = null;
        scheduleNext();
      }
    });
    container.querySelector("#literacy-start").addEventListener("click", function () {
      if (running) pause();
      else start();
    });
    container.querySelector("#literacy-stop").addEventListener("click", stop);
    container.querySelector("#literacy-fullscreen").addEventListener("click", toggleFullscreen);
    container.querySelector("#literacy-exit-fs").addEventListener("click", toggleFullscreen);
    container.querySelector("#literacy-native-fs").addEventListener("click", nativeFullscreen);
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("fullscreenchange", handleNativeFullscreenChange);
    window.addEventListener("resize", resizeStage);
  }

  function init(element) {
    deactivate();
    container = element;
    container.innerHTML =
      '<div class="ball-game-tool literacy-tool">' +
        '<div class="ball-game-layout">' +
          '<aside class="ball-game-config">' +
            '<h3>' + t("literacy.guideTitle") + '</h3>' +
            '<p class="math-curiosities-desc">' + t("literacy.guideText") + '</p>' +
            '<label class="fn-expression-label" for="literacy-source">' + t("literacy.source") + '</label>' +
            '<select id="literacy-source" class="settings-select"></select>' +
            '<a id="literacy-credits" class="literacy-credits-link" target="_blank" rel="noopener" hidden>' + t("literacy.imageCredits") + '</a>' +
            '<div class="literacy-appearance-grid">' +
              '<label class="fn-expression-label" for="literacy-color">' + t("literacy.textColor") + '</label>' +
              '<input id="literacy-color" class="literacy-color-input" type="color">' +
              '<label class="fn-expression-label" for="literacy-font">' + t("literacy.font") + '</label>' +
              '<select id="literacy-font" class="settings-select">' +
                '<option value="rounded">' + t("literacy.fontRounded") + '</option>' +
                '<option value="sans">' + t("literacy.fontSans") + '</option>' +
                '<option value="kai">' + t("literacy.fontKai") + '</option>' +
                '<option value="serif">' + t("literacy.fontSerif") + '</option>' +
              '</select>' +
              '<label class="literacy-random-color" for="literacy-random-color">' +
                '<input id="literacy-random-color" type="checkbox">' +
                '<span>' + t("literacy.randomColor") + '</span>' +
              '</label>' +
              '<label class="literacy-auto-speak" for="literacy-auto-speak">' +
                '<input id="literacy-auto-speak" type="checkbox" checked>' +
                '<span>' + t("literacy.autoSpeak") + '</span>' +
              '</label>' +
              '<label class="literacy-speak-option" for="literacy-speak-zh">' +
                '<input id="literacy-speak-zh" type="checkbox" checked>' +
                '<span>' + t("literacy.speakChinese") + '</span>' +
              '</label>' +
              '<label class="literacy-speak-option" for="literacy-speak-en">' +
                '<input id="literacy-speak-en" type="checkbox" checked>' +
                '<span>' + t("literacy.speakEnglish") + '</span>' +
              '</label>' +
            '</div>' +
            '<p id="literacy-source-status" class="literacy-source-status" role="status" aria-live="polite"></p>' +
            '<label class="fn-expression-label" for="literacy-interval">' + t("literacy.interval") + ' <output id="literacy-interval-value">3s</output></label>' +
            '<input id="literacy-interval" type="range" min="1" max="30" value="3" step="1">' +
            '<div class="ball-game-actions">' +
              '<button id="literacy-start" class="ball-game-primary" type="button">' + t("literacy.start") + '</button>' +
              '<button id="literacy-stop" type="button" disabled>' + t("literacy.stop") + '</button>' +
              '<button id="literacy-fullscreen" type="button" aria-pressed="false">' + t("literacy.fullscreen") + '</button>' +
              '<button id="literacy-native-fs" class="native-fullscreen-btn" type="button" aria-pressed="false">' + t("literacy.nativeFullscreen") + '</button>' +
            '</div>' +
          '</aside>' +
          '<main id="literacy-stage" class="ball-game-stage-card literacy-stage">' +
            '<div class="ball-game-fullscreen-toolbar"><span>' + t("literacy.fullscreenTitle") + '</span><button id="literacy-exit-fs" type="button">' + t("literacy.exitFullscreen") + '</button></div>' +
            '<div id="literacy-card" class="literacy-card" aria-live="polite" aria-atomic="true"></div>' +
          '</main>' +
        '</div>' +
      '</div>';

    renderSourceOptions();
    var preferences = loadPreferences();
    container.querySelector("#literacy-color").value = preferences.color;
    container.querySelector("#literacy-random-color").checked = preferences.randomColor;
    container.querySelector("#literacy-font").value = preferences.font;
    container.querySelector("#literacy-auto-speak").checked = preferences.autoSpeak;
    container.querySelector("#literacy-speak-zh").checked = preferences.speakChinese;
    container.querySelector("#literacy-speak-en").checked = preferences.speakEnglish;
    updateAppearanceControls();
    applyAppearance(false);
    updateIntervalLabel();
    bindEvents();
    resizeStage();
    loadSelectedSource(true);
  }

  function deactivate() {
    ++loadSequence;
    running = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    cancelAudio();
    clearPreparedAudio();
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("fullscreenchange", handleNativeFullscreenChange);
    window.removeEventListener("resize", resizeStage);
    document.body.classList.remove("ball-game-fullscreen-active");
    container = null;
    activeItems = [];
    activeSourceId = "";
    currentItem = null;
    lastItemId = "";
    lastRandomColor = "";
    isFullscreen = false;
  }

  function getDataSources() {
    return sourceOrder.map(function (sourceId) {
      var source = sourceRegistry[sourceId];
      return {
        id: source.id,
        label: source.label,
        labelKey: source.labelKey,
        creditsUrl: source.creditsUrl,
        async: Boolean(source.load),
        itemCount: source.cachedItems ? source.cachedItems.length : (source.items ? source.items.length : null)
      };
    });
  }

  registerBuiltInSources();

  return {
    init: init,
    deactivate: deactivate,
    registerDataSource: registerDataSource,
    getDataSources: getDataSources,
    refreshDataSource: function (sourceId) {
      if (!sourceRegistry[sourceId]) return false;
      sourceRegistry[sourceId].cachedItems = null;
      if (container && container.querySelector("#literacy-source").value === sourceId) {
        loadSelectedSource(true);
      }
      return true;
    },
    __test: {
      normalizeItems: normalizeItems,
      normalizePronunciation: normalizePronunciation,
      letterItems: letterItems,
      mapRemoteItems: mapRemoteItems,
      localizedText: localizedText,
      randomColorForTheme: randomColorForTheme,
      isValidColor: isValidColor,
      setPreparedAudio: function (audio) {
        clearPreparedAudio();
        preparedAudio = audio || Object.create(null);
      },
      playPronunciationSequence: playPronunciationSequence,
      cancelAudio: cancelAudio
    }
  };
})();
