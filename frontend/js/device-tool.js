// Device Environment Tool — comprehensive browser-local environment diagnostics.
var DeviceTool = (function () {
  var root = null;
  var clockTimer = null;
  var resizeTimer = null;
  var cleanups = [];
  var report = null;
  var advancedRunning = false;

  var SECTION_META = {
    locale: { icon: "◷", title: "device.sections.locale", hint: "device.sectionHints.locale" },
    browser: { icon: "◎", title: "device.sections.browser", hint: "device.sectionHints.browser" },
    display: { icon: "▣", title: "device.sections.display", hint: "device.sectionHints.display" },
    hardware: { icon: "◇", title: "device.sections.hardware", hint: "device.sectionHints.hardware" },
    network: { icon: "⇄", title: "device.sections.network", hint: "device.sectionHints.network" },
    privacy: { icon: "◈", title: "device.sections.privacy", hint: "device.sectionHints.privacy" }
  };

  function t(key) {
    return (window.__t && window.__t(key)) || key;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function byId(id) {
    return root ? root.querySelector("#" + id) : null;
  }

  function formatNow(date) {
    var d = date || new Date();
    var y = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var hour = String(d.getHours()).padStart(2, "0");
    var minute = String(d.getMinutes()).padStart(2, "0");
    var second = String(d.getSeconds()).padStart(2, "0");
    var milliseconds = String(d.getMilliseconds()).padStart(3, "0");
    return y + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second + "." + milliseconds;
  }

  function timezoneOffset() {
    var minutes = -new Date().getTimezoneOffset();
    var sign = minutes >= 0 ? "+" : "-";
    minutes = Math.abs(minutes);
    return "UTC" + sign + String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
  }

  function detectBrowser(ua) {
    var value = ua || navigator.userAgent || "";
    var match;
    if ((match = value.match(/Edg\/(\S+)/))) return { name: "Microsoft Edge", version: match[1], engine: "Blink" };
    if ((match = value.match(/OPR\/(\S+)/))) return { name: "Opera", version: match[1], engine: "Blink" };
    if ((match = value.match(/Chrome\/(\S+)/))) return { name: "Google Chrome", version: match[1], engine: "Blink" };
    if ((match = value.match(/Firefox\/(\S+)/))) return { name: "Mozilla Firefox", version: match[1], engine: "Gecko" };
    if ((match = value.match(/Version\/(\S+).*Safari/))) return { name: "Safari", version: match[1], engine: "WebKit" };
    return { name: t("device.values.unknown"), version: "", engine: t("device.values.unknown") };
  }

  function detectOS(ua) {
    var value = ua || navigator.userAgent || "";
    var match;
    if ((match = value.match(/Windows NT ([\d.]+)/))) {
      var versions = { "10.0": "Windows 10 / 11", "6.3": "Windows 8.1", "6.1": "Windows 7" };
      return versions[match[1]] || "Windows NT " + match[1];
    }
    if ((match = value.match(/Android ([\d.]+)/))) return "Android " + match[1];
    if ((match = value.match(/(?:iPhone OS|CPU OS) ([\d_]+)/))) return "iOS / iPadOS " + match[1].replace(/_/g, ".");
    if ((match = value.match(/Mac OS X ([\d_]+)/))) return "macOS " + match[1].replace(/_/g, ".");
    if (/CrOS/.test(value)) return "ChromeOS";
    if (/Linux/.test(value)) return "Linux";
    return t("device.values.unknown");
  }

  function yesNo(value) {
    return t(value ? "device.values.yes" : "device.values.no");
  }

  function available(value) {
    return t(value ? "device.values.supported" : "device.values.unsupported");
  }

  function formatBytes(bytes) {
    if (typeof bytes !== "number" || !isFinite(bytes)) return t("device.values.unavailable");
    var units = ["B", "KB", "MB", "GB", "TB"];
    var index = 0;
    var value = bytes;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return (value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(2)) + " " + units[index];
  }

  function mediaMatches(query) {
    try {
      return window.matchMedia(query).matches;
    } catch (error) {
      return false;
    }
  }

  function mediaValue(candidates, fallback) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (mediaMatches(candidates[i][0])) return candidates[i][1];
    }
    return fallback || t("device.values.none");
  }

  function storageAvailable(name) {
    try {
      var storage = window[name];
      var key = "__device_test__";
      storage.setItem(key, key);
      storage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function displayMode() {
    if (window.navigator.standalone === true) return "standalone (iOS)";
    return mediaValue([
      ["(display-mode: fullscreen)", "fullscreen"],
      ["(display-mode: standalone)", "standalone"],
      ["(display-mode: minimal-ui)", "minimal-ui"],
      ["(display-mode: window-controls-overlay)", "window-controls-overlay"]
    ], "browser");
  }

  function qualityLabel(quality) {
    return t("device.quality." + (quality || "detected"));
  }

  function fact(key, labelKey, value, options) {
    var config = options || {};
    return {
      key: key,
      label: t(labelKey),
      value: value === null || value === undefined || value === "" ? t("device.values.unavailable") : String(value),
      quality: config.quality || "detected",
      note: config.note || "",
      sensitive: config.sensitive === true
    };
  }

  function sectionFacts(section) {
    return report && report.sections[section] ? report.sections[section] : [];
  }

  function renderFact(item) {
    return '<button class="device-fact" type="button" data-device-copy="' + escapeHtml(item.value) + '">' +
      '<span class="device-fact-top"><span class="device-fact-label">' + escapeHtml(item.label) + '</span>' +
      '<span class="device-quality device-quality-' + escapeHtml(item.quality) + '">' + escapeHtml(qualityLabel(item.quality)) + '</span></span>' +
      '<strong data-device-fact-value="' + escapeHtml(item.key) + '">' + escapeHtml(item.value) + '</strong>' +
      (item.note ? '<small>' + escapeHtml(item.note) + '</small>' : "") +
      (item.sensitive ? '<span class="device-sensitive" title="' + escapeHtml(t("device.sensitive")) + '" aria-label="' + escapeHtml(t("device.sensitive")) + '">◆</span>' : "") +
    "</button>";
  }

  function renderSection(section) {
    var container = byId("device-section-" + section);
    if (!container) return;
    container.innerHTML = sectionFacts(section).map(renderFact).join("");
  }

  function setSection(section, facts) {
    if (!report) return;
    report.sections[section] = facts;
    renderSection(section);
    renderSummary();
  }

  function updateFact(section, key, value, options) {
    var facts = sectionFacts(section);
    var item = facts.find(function (candidate) { return candidate.key === key; });
    if (!item) return;
    item.value = value === null || value === undefined || value === "" ? t("device.values.unavailable") : String(value);
    if (options && options.quality) item.quality = options.quality;
    if (options && options.note !== undefined) item.note = options.note;
    var valueNode = root && root.querySelector('[data-device-fact-value="' + key + '"]');
    if (valueNode) {
      valueNode.textContent = item.value;
      var button = valueNode.closest(".device-fact");
      if (button) button.dataset.deviceCopy = item.value;
    }
  }

  function renderSummary() {
    if (!root || !report) return;
    var browser = detectBrowser(navigator.userAgent);
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var summary = [
      { label: t("device.summary.browser"), value: browser.name + (browser.version ? " " + browser.version.split(".")[0] : ""), icon: "◎" },
      { label: t("device.summary.system"), value: detectOS(navigator.userAgent), icon: "◇" },
      { label: t("device.summary.display"), value: screen.width + "×" + screen.height + " @" + (window.devicePixelRatio || 1) + "x", icon: "▣" },
      { label: t("device.summary.network"), value: connection ? (connection.effectiveType || connection.type || t("device.values.online")) : (navigator.onLine ? t("device.values.online") : t("device.values.offline")), icon: "⇄" }
    ];
    var summaryNode = byId("device-summary");
    if (summaryNode) {
      summaryNode.innerHTML = summary.map(function (item) {
        return '<div class="device-summary-card"><span aria-hidden="true">' + item.icon + '</span><div><small>' + escapeHtml(item.label) + '</small><strong>' + escapeHtml(item.value) + "</strong></div></div>";
      }).join("");
    }
    var factCount = Object.keys(report.sections).reduce(function (count, section) {
      return count + report.sections[section].length;
    }, 0);
    var supportedCount = report.capabilities.filter(function (item) { return item.supported; }).length;
    var status = byId("device-report-status");
    if (status) status.textContent = factCount + " " + t("device.factCount") + " · " + supportedCount + "/" + report.capabilities.length + " " + t("device.capabilityCount");
  }

  function collectLocaleFacts() {
    var resolved = Intl.DateTimeFormat().resolvedOptions();
    var now = new Date();
    setSection("locale", [
      fact("currentTime", "device.fields.currentTime", formatNow(now), { quality: "live" }),
      fact("timestamp", "device.fields.timestamp", now.getTime(), { quality: "live" }),
      fact("timezone", "device.fields.timezone", (resolved.timeZone || t("device.values.unknown")) + " (" + timezoneOffset() + ")"),
      fact("primaryLanguage", "device.fields.primaryLanguage", navigator.language || t("device.values.unavailable")),
      fact("languages", "device.fields.languages", (navigator.languages || []).join(", ") || t("device.values.unavailable")),
      fact("locale", "device.fields.locale", resolved.locale || navigator.language || t("device.values.unavailable")),
      fact("calendar", "device.fields.calendar", resolved.calendar || t("device.values.unavailable")),
      fact("numberingSystem", "device.fields.numberingSystem", resolved.numberingSystem || t("device.values.unavailable")),
      fact("hourCycle", "device.fields.hourCycle", resolved.hourCycle || t("device.values.unavailable"))
    ]);
  }

  function collectBrowserFacts() {
    var ua = navigator.userAgent || "";
    var browser = detectBrowser(ua);
    var uaData = navigator.userAgentData;
    var brands = uaData && uaData.brands ? uaData.brands.map(function (item) { return item.brand + " " + item.version; }).join(", ") : "";
    setSection("browser", [
      fact("browser", "device.fields.browser", browser.name + (browser.version ? " " + browser.version : ""), { quality: "inferred" }),
      fact("engine", "device.fields.engine", browser.engine, { quality: "inferred" }),
      fact("os", "device.fields.os", detectOS(ua), { quality: "inferred" }),
      fact("platform", "device.fields.platform", (uaData && uaData.platform) || navigator.platform || t("device.values.unavailable"), { quality: uaData ? "detected" : "legacy" }),
      fact("mobile", "device.fields.mobile", uaData ? yesNo(uaData.mobile) : (/Mobi|Android|iPhone|iPad/i.test(ua) ? yesNo(true) : yesNo(false)), { quality: uaData ? "detected" : "inferred" }),
      fact("brands", "device.fields.uaBrands", brands || t("device.values.unavailable")),
      fact("vendor", "device.fields.vendor", navigator.vendor || t("device.values.unavailable")),
      fact("pdfViewer", "device.fields.pdfViewer", navigator.pdfViewerEnabled === undefined ? t("device.values.unavailable") : yesNo(navigator.pdfViewerEnabled)),
      fact("displayMode", "device.fields.displayMode", displayMode()),
      fact("secureContext", "device.fields.secureContext", yesNo(window.isSecureContext)),
      fact("crossOriginIsolated", "device.fields.crossOriginIsolated", yesNo(window.crossOriginIsolated)),
      fact("automation", "device.fields.automation", yesNo(navigator.webdriver === true), { sensitive: true })
    ]);
  }

  function collectDisplayFacts() {
    var orientation = screen.orientation;
    var visual = window.visualViewport;
    var primaryPointer = mediaValue([
      ["(pointer: fine)", t("device.values.fine")],
      ["(pointer: coarse)", t("device.values.coarse")],
      ["(pointer: none)", t("device.values.none")]
    ]);
    var colorGamut = mediaValue([
      ["(color-gamut: rec2020)", "Rec. 2020"],
      ["(color-gamut: p3)", "Display P3"],
      ["(color-gamut: srgb)", "sRGB"]
    ], t("device.values.unknown"));
    setSection("display", [
      fact("screenResolution", "device.fields.screenResolution", screen.width + "×" + screen.height + " CSS px"),
      fact("availableScreen", "device.fields.availableScreen", screen.availWidth + "×" + screen.availHeight + " CSS px"),
      fact("pixelRatio", "device.fields.pixelRatio", (window.devicePixelRatio || 1) + "x"),
      fact("colorDepth", "device.fields.colorDepth", screen.colorDepth + " bit"),
      fact("pixelDepth", "device.fields.pixelDepth", screen.pixelDepth + " bit"),
      fact("orientation", "device.fields.orientation", orientation ? orientation.type + " · " + orientation.angle + "°" : (window.innerWidth > window.innerHeight ? "landscape" : "portrait")),
      fact("layoutViewport", "device.fields.layoutViewport", window.innerWidth + "×" + window.innerHeight + " CSS px", { quality: "live" }),
      fact("visualViewport", "device.fields.visualViewport", visual ? Math.round(visual.width) + "×" + Math.round(visual.height) + " CSS px" : t("device.values.unsupported"), { quality: visual ? "live" : "unsupported" }),
      fact("zoom", "device.fields.zoom", visual ? visual.scale.toFixed(2) + "x" : t("device.values.unavailable"), { quality: visual ? "live" : "unsupported" }),
      fact("outerWindow", "device.fields.outerWindow", window.outerWidth + "×" + window.outerHeight + " CSS px"),
      fact("touchPoints", "device.fields.touchPoints", String(navigator.maxTouchPoints || 0)),
      fact("pointer", "device.fields.pointer", primaryPointer),
      fact("hover", "device.fields.hover", yesNo(mediaMatches("(hover: hover)"))),
      fact("colorGamut", "device.fields.colorGamut", colorGamut),
      fact("dynamicRange", "device.fields.dynamicRange", mediaMatches("(dynamic-range: high)") ? "high" : "standard"),
      fact("multiScreen", "device.fields.multiScreen", screen.isExtended === undefined ? t("device.values.unavailable") : yesNo(screen.isExtended))
    ]);
  }

  function collectHardwareFacts() {
    var posture = navigator.devicePosture && navigator.devicePosture.type;
    setSection("hardware", [
      fact("cpuCores", "device.fields.cpuCores", navigator.hardwareConcurrency || t("device.values.unavailable"), { quality: "approximate" }),
      fact("memory", "device.fields.memory", navigator.deviceMemory ? navigator.deviceMemory + " GB" : t("device.values.unavailable"), { quality: navigator.deviceMemory ? "approximate" : "unsupported" }),
      fact("devicePosture", "device.fields.devicePosture", posture || (navigator.devicePosture ? t("device.values.unknown") : t("device.values.unsupported")), { quality: navigator.devicePosture ? "detected" : "unsupported" }),
      fact("webgl", "device.fields.webgl", available(supportsWebGL(1))),
      fact("webgl2", "device.fields.webgl2", available(supportsWebGL(2))),
      fact("webgpu", "device.fields.webgpu", available("gpu" in navigator)),
      fact("wasm", "device.fields.wasm", available(typeof WebAssembly !== "undefined")),
      fact("sharedArrayBuffer", "device.fields.sharedArrayBuffer", available(typeof SharedArrayBuffer !== "undefined"))
    ]);
  }

  function collectNetworkFacts() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var localStorageEnabled = storageAvailable("localStorage");
    var sessionStorageEnabled = storageAvailable("sessionStorage");
    setSection("network", [
      fact("online", "device.fields.online", navigator.onLine ? t("device.values.online") : t("device.values.offline"), { quality: "live" }),
      fact("connectionType", "device.fields.connectionType", connection ? (connection.type || t("device.values.unavailable")) : t("device.values.unsupported"), { quality: connection ? "approximate" : "unsupported" }),
      fact("effectiveType", "device.fields.effectiveType", connection ? (connection.effectiveType || t("device.values.unavailable")) : t("device.values.unsupported"), { quality: connection ? "approximate" : "unsupported" }),
      fact("downlink", "device.fields.downlink", connection && connection.downlink !== undefined ? connection.downlink + " Mb/s" : t("device.values.unavailable"), { quality: connection ? "approximate" : "unsupported" }),
      fact("rtt", "device.fields.rtt", connection && connection.rtt !== undefined ? connection.rtt + " ms" : t("device.values.unavailable"), { quality: connection ? "approximate" : "unsupported" }),
      fact("saveData", "device.fields.saveData", connection && connection.saveData !== undefined ? yesNo(connection.saveData) : t("device.values.unavailable")),
      fact("localStorage", "device.fields.localStorage", available(localStorageEnabled)),
      fact("sessionStorage", "device.fields.sessionStorage", available(sessionStorageEnabled)),
      fact("indexedDb", "device.fields.indexedDb", available("indexedDB" in window)),
      fact("cacheStorage", "device.fields.cacheStorage", available("caches" in window))
    ]);
  }

  function collectPrivacyFacts() {
    var contrast = mediaValue([
      ["(prefers-contrast: more)", t("device.values.more")],
      ["(prefers-contrast: less)", t("device.values.less")],
      ["(prefers-contrast: custom)", t("device.values.custom")]
    ], t("device.values.normal"));
    setSection("privacy", [
      fact("systemColorScheme", "device.fields.systemColorScheme", mediaMatches("(prefers-color-scheme: dark)") ? "dark" : "light", { quality: "live" }),
      fact("reducedMotion", "device.fields.reducedMotion", yesNo(mediaMatches("(prefers-reduced-motion: reduce)"))),
      fact("contrast", "device.fields.contrast", contrast),
      fact("forcedColors", "device.fields.forcedColors", yesNo(mediaMatches("(forced-colors: active)"))),
      fact("reducedData", "device.fields.reducedData", yesNo(mediaMatches("(prefers-reduced-data: reduce)"))),
      fact("cookies", "device.fields.cookies", yesNo(navigator.cookieEnabled)),
      fact("globalPrivacyControl", "device.fields.globalPrivacyControl", navigator.globalPrivacyControl === undefined ? t("device.values.unavailable") : yesNo(navigator.globalPrivacyControl)),
      fact("doNotTrack", "device.fields.doNotTrack", navigator.doNotTrack || t("device.values.unavailable")),
      fact("notifications", "device.fields.notifications", "Notification" in window ? Notification.permission : t("device.values.unsupported")),
      fact("serviceWorker", "device.fields.serviceWorker", available("serviceWorker" in navigator)),
      fact("clipboard", "device.fields.clipboard", available(Boolean(navigator.clipboard))),
      fact("fullscreen", "device.fields.fullscreen", available(Boolean(document.fullscreenEnabled))),
      fact("userAgent", "device.fields.userAgent", navigator.userAgent || t("device.values.unavailable"), { quality: "legacy", sensitive: true })
    ]);
  }

  function supportsWebGL(version) {
    try {
      var canvas = document.createElement("canvas");
      return Boolean(canvas.getContext(version === 2 ? "webgl2" : "webgl"));
    } catch (error) {
      return false;
    }
  }

  function capability(name, group, supported, note) {
    return { name: name, group: group, supported: Boolean(supported), note: note || "" };
  }

  function collectCapabilities() {
    var canvas = document.createElement("canvas");
    var video = document.createElement("video");
    report.capabilities = [
      capability("Canvas 2D", "graphics", Boolean(canvas.getContext && canvas.getContext("2d"))),
      capability("WebGL", "graphics", supportsWebGL(1)),
      capability("WebGL 2", "graphics", supportsWebGL(2)),
      capability("WebGPU", "graphics", "gpu" in navigator),
      capability("WebAssembly", "graphics", typeof WebAssembly !== "undefined"),
      capability("Media Capabilities", "media", "mediaCapabilities" in navigator),
      capability("WebCodecs", "media", "VideoDecoder" in window && "AudioDecoder" in window),
      capability("MediaRecorder", "media", "MediaRecorder" in window),
      capability("Picture-in-Picture", "media", Boolean(document.pictureInPictureEnabled)),
      capability("Screen Capture", "media", Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)),
      capability("File API", "storage", "FileReader" in window && "Blob" in window),
      capability("File System Access", "storage", "showOpenFilePicker" in window),
      capability("OPFS", "storage", Boolean(navigator.storage && navigator.storage.getDirectory)),
      capability("IndexedDB", "storage", "indexedDB" in window),
      capability("Cache Storage", "storage", "caches" in window),
      capability("WebSocket", "connectivity", "WebSocket" in window),
      capability("WebRTC", "connectivity", "RTCPeerConnection" in window),
      capability("WebTransport", "connectivity", "WebTransport" in window),
      capability("Web Bluetooth", "connectivity", "bluetooth" in navigator),
      capability("WebUSB", "connectivity", "usb" in navigator),
      capability("Web Serial", "connectivity", "serial" in navigator),
      capability("WebHID", "connectivity", "hid" in navigator),
      capability("Web NFC", "connectivity", "NDEFReader" in window),
      capability("Clipboard", "platform", Boolean(navigator.clipboard)),
      capability("Web Share", "platform", Boolean(navigator.share)),
      capability("Notifications", "platform", "Notification" in window),
      capability("Push API", "platform", "PushManager" in window),
      capability("Service Worker", "platform", "serviceWorker" in navigator),
      capability("Wake Lock", "platform", "wakeLock" in navigator),
      capability("WebAuthn / Passkeys", "platform", "PublicKeyCredential" in window),
      capability("Payment Request", "platform", "PaymentRequest" in window),
      capability("EyeDropper", "platform", "EyeDropper" in window),
      capability("Speech Synthesis", "platform", "speechSynthesis" in window),
      capability("PDF Viewer", "platform", navigator.pdfViewerEnabled === true),
      capability("AV1", "media", video.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== ""),
      capability("VP9", "media", video.canPlayType('video/webm; codecs="vp09.00.10.08"') !== ""),
      capability("H.264", "media", video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== "")
    ];
    renderCapabilities();
  }

  function renderCapabilities() {
    var container = byId("device-capabilities");
    if (!container) return;
    var groups = ["graphics", "media", "storage", "connectivity", "platform"];
    container.innerHTML = groups.map(function (group) {
      var items = report.capabilities.filter(function (item) { return item.group === group; });
      return '<section class="device-capability-group"><h3>' + escapeHtml(t("device.capabilityGroups." + group)) + '</h3><div class="device-capability-list">' +
        items.map(function (item) {
          return '<div class="device-capability ' + (item.supported ? "is-supported" : "is-unsupported") + '">' +
            '<span aria-hidden="true">' + (item.supported ? "✓" : "–") + '</span><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.supported ? t("device.values.supported") : t("device.values.unsupported")) + "</small></div>";
        }).join("") +
      "</div></section>";
    }).join("");
    renderSummary();
  }

  function advancedFact(group, key, labelKey, value, options) {
    if (!report.advanced[group]) report.advanced[group] = [];
    report.advanced[group].push(fact(key, labelKey, value, options));
  }

  function renderAdvanced() {
    var container = byId("device-advanced-results");
    if (!container) return;
    var groups = ["ua", "storage", "graphics", "power", "devices"];
    container.innerHTML = groups.map(function (group) {
      var facts = report.advanced[group] || [];
      if (!facts.length) return "";
      return '<section class="device-advanced-group"><h3>' + escapeHtml(t("device.advancedGroups." + group)) + '</h3><div class="device-fact-grid">' + facts.map(renderFact).join("") + "</div></section>";
    }).join("");
  }

  async function collectUaDetails() {
    if (!navigator.userAgentData || !navigator.userAgentData.getHighEntropyValues) {
      advancedFact("ua", "uaHighEntropy", "device.fields.uaHighEntropy", t("device.values.unsupported"), { quality: "unsupported" });
      return;
    }
    try {
      var values = await navigator.userAgentData.getHighEntropyValues([
        "architecture", "bitness", "formFactors", "fullVersionList", "model", "platformVersion", "wow64"
      ]);
      advancedFact("ua", "architecture", "device.fields.architecture", values.architecture || t("device.values.unavailable"), { sensitive: true });
      advancedFact("ua", "bitness", "device.fields.bitness", values.bitness || t("device.values.unavailable"), { sensitive: true });
      advancedFact("ua", "platformVersion", "device.fields.platformVersion", values.platformVersion || t("device.values.unavailable"), { sensitive: true });
      advancedFact("ua", "model", "device.fields.deviceModel", values.model || t("device.values.unavailable"), { sensitive: true });
      advancedFact("ua", "formFactors", "device.fields.formFactors", (values.formFactors || []).join(", ") || t("device.values.unavailable"), { sensitive: true });
      advancedFact("ua", "fullVersionList", "device.fields.fullVersionList", (values.fullVersionList || []).map(function (item) { return item.brand + " " + item.version; }).join(", ") || t("device.values.unavailable"), { sensitive: true });
      advancedFact("ua", "wow64", "device.fields.wow64", values.wow64 === undefined ? t("device.values.unavailable") : yesNo(values.wow64), { sensitive: true });
    } catch (error) {
      advancedFact("ua", "uaHighEntropy", "device.fields.uaHighEntropy", error.name || t("device.values.unavailable"), { quality: "blocked" });
    }
  }

  async function collectStorageDetails() {
    if (!navigator.storage) {
      advancedFact("storage", "storageEstimate", "device.fields.storageEstimate", t("device.values.unsupported"), { quality: "unsupported" });
      return;
    }
    try {
      if (navigator.storage.estimate) {
        var estimate = await navigator.storage.estimate();
        advancedFact("storage", "storageUsage", "device.fields.storageUsage", formatBytes(estimate.usage), { quality: "approximate" });
        advancedFact("storage", "storageQuota", "device.fields.storageQuota", formatBytes(estimate.quota), { quality: "approximate" });
        if (estimate.usageDetails) {
          advancedFact("storage", "storageDetails", "device.fields.storageDetails", Object.keys(estimate.usageDetails).map(function (key) {
            return key + ": " + formatBytes(estimate.usageDetails[key]);
          }).join(" · ") || t("device.values.unavailable"), { quality: "approximate" });
        }
      }
      if (navigator.storage.persisted) {
        advancedFact("storage", "persistentStorage", "device.fields.persistentStorage", yesNo(await navigator.storage.persisted()));
      }
    } catch (error) {
      advancedFact("storage", "storageEstimate", "device.fields.storageEstimate", error.name || t("device.values.unavailable"), { quality: "blocked" });
    }
  }

  async function collectGraphicsDetails() {
    try {
      var canvas = document.createElement("canvas");
      var gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) {
        advancedFact("graphics", "graphicsApi", "device.fields.graphicsApi", t("device.values.unsupported"), { quality: "unsupported" });
      } else {
        var debug = gl.getExtension("WEBGL_debug_renderer_info");
        advancedFact("graphics", "webglVersion", "device.fields.webglVersion", gl.getParameter(gl.VERSION));
        advancedFact("graphics", "shadingLanguage", "device.fields.shadingLanguage", gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
        advancedFact("graphics", "maxTextureSize", "device.fields.maxTextureSize", gl.getParameter(gl.MAX_TEXTURE_SIZE) + " px");
        advancedFact("graphics", "webglVendor", "device.fields.gpuVendor", debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), { quality: debug ? "detected" : "masked", sensitive: true });
        advancedFact("graphics", "webglRenderer", "device.fields.gpuRenderer", debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), { quality: debug ? "detected" : "masked", sensitive: true });
        advancedFact("graphics", "webglExtensions", "device.fields.webglExtensions", (gl.getSupportedExtensions() || []).length);
      }
      if (navigator.gpu && navigator.gpu.requestAdapter) {
        var adapter = await navigator.gpu.requestAdapter();
        if (adapter && adapter.info) {
          advancedFact("graphics", "webgpuInfo", "device.fields.webgpuInfo", [
            adapter.info.vendor, adapter.info.architecture, adapter.info.device, adapter.info.description
          ].filter(Boolean).join(" · ") || t("device.values.available"), { sensitive: true });
        }
      }
    } catch (error) {
      advancedFact("graphics", "graphicsApi", "device.fields.graphicsApi", error.name || t("device.values.unavailable"), { quality: "blocked" });
    }
  }

  async function collectPowerDetails() {
    if (!navigator.getBattery) {
      advancedFact("power", "battery", "device.fields.battery", t("device.values.unsupported"), { quality: "unsupported" });
      return;
    }
    try {
      var battery = await navigator.getBattery();
      advancedFact("power", "batteryLevel", "device.fields.batteryLevel", Math.round(battery.level * 100) + "%", { quality: "live" });
      advancedFact("power", "charging", "device.fields.charging", yesNo(battery.charging), { quality: "live" });
      advancedFact("power", "chargingTime", "device.fields.chargingTime", isFinite(battery.chargingTime) ? Math.round(battery.chargingTime / 60) + " min" : "∞", { quality: "live" });
      advancedFact("power", "dischargingTime", "device.fields.dischargingTime", isFinite(battery.dischargingTime) ? Math.round(battery.dischargingTime / 60) + " min" : "∞", { quality: "live" });
    } catch (error) {
      advancedFact("power", "battery", "device.fields.battery", error.name || t("device.values.unavailable"), { quality: "blocked" });
    }
  }

  async function collectDeviceDetails() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      advancedFact("devices", "mediaDevices", "device.fields.mediaDevices", t("device.values.unsupported"), { quality: "unsupported" });
      return;
    }
    try {
      var devices = await navigator.mediaDevices.enumerateDevices();
      var counts = devices.reduce(function (result, item) {
        result[item.kind] = (result[item.kind] || 0) + 1;
        return result;
      }, {});
      advancedFact("devices", "cameraCount", "device.fields.cameraCount", counts.videoinput || 0, { quality: "permission" });
      advancedFact("devices", "microphoneCount", "device.fields.microphoneCount", counts.audioinput || 0, { quality: "permission" });
      advancedFact("devices", "audioOutputCount", "device.fields.audioOutputCount", counts.audiooutput || 0, { quality: "permission" });
      advancedFact("devices", "screenDetailsSupport", "device.fields.screenDetailsSupport", available("getScreenDetails" in window), { quality: "permission" });
    } catch (error) {
      advancedFact("devices", "mediaDevices", "device.fields.mediaDevices", error.name || t("device.values.unavailable"), { quality: "blocked" });
    }
  }

  async function collectPermissionDetails() {
    var permissions = [
      "geolocation", "notifications", "camera", "microphone", "clipboard-read",
      "clipboard-write", "persistent-storage", "push", "screen-wake-lock", "window-management"
    ];
    report.permissions = [];
    if (!navigator.permissions || !navigator.permissions.query) {
      renderPermissions();
      return;
    }
    await Promise.all(permissions.map(async function (name) {
      try {
        var status = await navigator.permissions.query({ name: name });
        report.permissions.push({ name: name, state: status.state });
      } catch (error) {
        report.permissions.push({ name: name, state: "unsupported" });
      }
    }));
    report.permissions.sort(function (a, b) { return permissions.indexOf(a.name) - permissions.indexOf(b.name); });
    renderPermissions();
  }

  function renderPermissions() {
    var container = byId("device-permissions");
    if (!container) return;
    if (!report.permissions.length) {
      container.innerHTML = '<p class="device-empty">' + escapeHtml(t("device.permissionUnavailable")) + "</p>";
      return;
    }
    container.innerHTML = report.permissions.map(function (item) {
      return '<div class="device-permission"><strong>' + escapeHtml(item.name) + '</strong><span class="device-permission-' + escapeHtml(item.state) + '">' + escapeHtml(t("device.permissionStates." + item.state)) + "</span></div>";
    }).join("");
  }

  async function runAdvancedDetection() {
    if (advancedRunning) return;
    advancedRunning = true;
    report.advanced = {};
    report.permissions = [];
    var button = byId("device-run-advanced");
    var status = byId("device-advanced-status");
    if (button) {
      button.disabled = true;
      button.textContent = t("device.advancedRunning");
    }
    if (status) status.textContent = t("device.advancedPrivacyNote");
    await Promise.allSettled([
      collectUaDetails(),
      collectStorageDetails(),
      collectGraphicsDetails(),
      collectPowerDetails(),
      collectDeviceDetails(),
      collectPermissionDetails()
    ]);
    if (!root) return;
    renderAdvanced();
    renderPermissions();
    if (button) {
      button.disabled = false;
      button.textContent = t("device.advancedRefresh");
    }
    if (status) status.textContent = t("device.advancedDone");
    advancedRunning = false;
  }

  function reportData(safe) {
    var output = {
      generatedAt: new Date().toISOString(),
      source: location.origin,
      safe: Boolean(safe),
      sections: {},
      capabilities: report.capabilities.map(function (item) {
        return { group: item.group, name: item.name, supported: item.supported };
      })
    };
    Object.keys(report.sections).forEach(function (section) {
      output.sections[section] = report.sections[section].filter(function (item) {
        return !safe || !item.sensitive;
      }).map(function (item) {
        return { label: item.label, value: item.value, quality: qualityLabel(item.quality) };
      });
    });
    if (!safe) {
      output.advanced = {};
      Object.keys(report.advanced).forEach(function (group) {
        output.advanced[group] = report.advanced[group].map(function (item) {
          return { label: item.label, value: item.value, quality: qualityLabel(item.quality), sensitive: item.sensitive };
        });
      });
      output.permissions = report.permissions.slice();
    }
    return output;
  }

  function reportMarkdown(safe) {
    var data = reportData(safe);
    var lines = ["# " + t("device.reportTitle"), "", t("device.generatedAt") + ": " + data.generatedAt, ""];
    Object.keys(data.sections).forEach(function (section) {
      lines.push("## " + t("device.sections." + section), "");
      data.sections[section].forEach(function (item) {
        lines.push("- **" + item.label + "**: " + item.value + " _[" + item.quality + "]_");
      });
      lines.push("");
    });
    lines.push("## " + t("device.capabilities"), "");
    data.capabilities.forEach(function (item) {
      lines.push("- " + (item.supported ? "✓" : "–") + " " + item.name);
    });
    if (!safe && data.advanced) {
      Object.keys(data.advanced).forEach(function (group) {
        lines.push("", "## " + t("device.advancedGroups." + group), "");
        data.advanced[group].forEach(function (item) {
          lines.push("- **" + item.label + "**: " + item.value);
        });
      });
    }
    return lines.join("\n");
  }

  function downloadText(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function copySafeReport() {
    var text = reportMarkdown(true);
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(text).then(function () {
      if (window.showCopyToast) window.showCopyToast(t("device.safeCopied"));
    }).catch(function () {});
  }

  function bindFactCopy() {
    root.addEventListener("click", function (event) {
      var item = event.target.closest("[data-device-copy]");
      if (!item || !navigator.clipboard) return;
      navigator.clipboard.writeText(item.dataset.deviceCopy).then(function () {
        if (window.showCopyToast) window.showCopyToast(t("welcome.copied"));
      }).catch(function () {});
    });
  }

  function addCleanup(target, event, handler) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(event, handler);
    cleanups.push(function () { target.removeEventListener(event, handler); });
  }

  function bindLiveUpdates() {
    function refreshDisplaySoon() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (root) collectDisplayFacts();
      }, 120);
    }
    addCleanup(window, "resize", refreshDisplaySoon);
    addCleanup(window, "online", collectNetworkFacts);
    addCleanup(window, "offline", collectNetworkFacts);
    if (window.visualViewport) addCleanup(window.visualViewport, "resize", refreshDisplaySoon);
    if (screen.orientation) addCleanup(screen.orientation, "change", collectDisplayFacts);
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) addCleanup(connection, "change", collectNetworkFacts);
    [
      "(prefers-color-scheme: dark)", "(prefers-reduced-motion: reduce)",
      "(prefers-contrast: more)", "(forced-colors: active)", "(prefers-reduced-data: reduce)"
    ].forEach(function (query) {
      var media = window.matchMedia(query);
      addCleanup(media, "change", collectPrivacyFacts);
    });
  }

  function renderShell() {
    var sections = Object.keys(SECTION_META).map(function (section) {
      var meta = SECTION_META[section];
      return '<section class="device-section">' +
        '<div class="device-section-heading"><span class="device-section-icon" aria-hidden="true">' + meta.icon + '</span><div><h2>' + escapeHtml(t(meta.title)) + '</h2><p>' + escapeHtml(t(meta.hint)) + '</p></div></div>' +
        '<div id="device-section-' + section + '" class="device-fact-grid"></div>' +
      "</section>";
    }).join("");
    root.innerHTML =
      '<div class="device-tool">' +
      '  <section class="device-hero">' +
      '    <div class="device-hero-copy"><span class="device-local-badge">✓ ' + escapeHtml(t("device.localBadge")) + '</span><h2>' + escapeHtml(t("device.environmentTitle")) + '</h2><p>' + escapeHtml(t("device.environmentHint")) + '</p></div>' +
      '    <div class="device-actions"><button id="device-copy-safe" type="button">' + escapeHtml(t("device.copySafe")) + '</button><button id="device-export-json" type="button">' + escapeHtml(t("device.exportJson")) + '</button><button id="device-export-md" type="button">' + escapeHtml(t("device.exportMarkdown")) + '</button><button id="device-refresh" type="button">' + escapeHtml(t("device.refresh")) + '</button></div>' +
      '    <div id="device-summary" class="device-summary"></div><div id="device-report-status" class="device-report-status" role="status"></div>' +
      '  </section>' +
      '  <div class="device-sections">' + sections + "</div>" +
      '  <section class="device-section device-capabilities-section"><div class="device-section-heading"><span class="device-section-icon" aria-hidden="true">⌘</span><div><h2>' + escapeHtml(t("device.capabilities")) + '</h2><p>' + escapeHtml(t("device.capabilitiesHint")) + '</p></div></div><div id="device-capabilities" class="device-capabilities"></div></section>' +
      '  <details class="device-advanced">' +
      '    <summary><span><strong>' + escapeHtml(t("device.advancedTitle")) + '</strong><small>' + escapeHtml(t("device.advancedSummary")) + '</small></span></summary>' +
      '    <div class="device-advanced-body"><div class="device-advanced-intro"><p>' + escapeHtml(t("device.advancedIntro")) + '</p><button id="device-run-advanced" type="button">' + escapeHtml(t("device.runAdvanced")) + '</button><span id="device-advanced-status" role="status"></span></div>' +
      '      <div id="device-advanced-results" class="device-advanced-results"></div>' +
      '      <section class="device-permissions-section"><h3>' + escapeHtml(t("device.permissions")) + '</h3><p>' + escapeHtml(t("device.permissionsHint")) + '</p><div id="device-permissions" class="device-permissions"><p class="device-empty">' + escapeHtml(t("device.permissionWaiting")) + '</p></div></section>' +
      '    </div>' +
      '  </details>' +
      '  <p class="device-privacy-note">' + escapeHtml(t("device.privacyNote")) + '</p>' +
      '</div>';
  }

  function init(container) {
    deactivate();
    root = container;
    report = {
      generatedAt: new Date().toISOString(),
      sections: {},
      capabilities: [],
      advanced: {},
      permissions: []
    };
    renderShell();
    collectLocaleFacts();
    collectBrowserFacts();
    collectDisplayFacts();
    collectHardwareFacts();
    collectNetworkFacts();
    collectPrivacyFacts();
    collectCapabilities();
    renderSummary();
    bindFactCopy();
    bindLiveUpdates();
    clockTimer = setInterval(function () {
      if (!root) return;
      var now = new Date();
      updateFact("locale", "currentTime", formatNow(now));
      updateFact("locale", "timestamp", now.getTime());
    }, 100);
    byId("device-run-advanced").addEventListener("click", runAdvancedDetection);
    byId("device-copy-safe").addEventListener("click", copySafeReport);
    byId("device-export-json").addEventListener("click", function () {
      downloadText("device-environment.json", JSON.stringify(reportData(false), null, 2), "application/json;charset=utf-8");
    });
    byId("device-export-md").addEventListener("click", function () {
      downloadText("device-environment-safe.md", reportMarkdown(true), "text/markdown;charset=utf-8");
    });
    byId("device-refresh").addEventListener("click", function () {
      collectLocaleFacts();
      collectBrowserFacts();
      collectDisplayFacts();
      collectHardwareFacts();
      collectNetworkFacts();
      collectPrivacyFacts();
      collectCapabilities();
      if (window.showCopyToast) window.showCopyToast(t("device.refreshed"));
    });
  }

  function deactivate() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
    clearTimeout(resizeTimer);
    resizeTimer = null;
    cleanups.forEach(function (cleanup) { cleanup(); });
    cleanups = [];
    advancedRunning = false;
    report = null;
    root = null;
  }

  return {
    init: init,
    deactivate: deactivate,
    __test: {
      detectBrowser: detectBrowser,
      detectOS: detectOS,
      formatBytes: formatBytes,
      timezoneOffset: timezoneOffset
    }
  };
})();
