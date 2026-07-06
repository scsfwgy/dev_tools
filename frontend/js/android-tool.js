// Android Tool — API levels, alpha/opacity, dp/px, permissions, icon sizes.
var AndroidTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  var API_LEVELS = [
    { ver: "17",  code: "Cinnamon Bun",         api: 37, year: 2026 },
    { ver: "16",  code: "Baklava",             api: 36, year: 2025 },
    { ver: "15",  code: "Vanilla Ice Cream",   api: 35, year: 2024 },
    { ver: "14",  code: "Upside Down Cake",    api: 34, year: 2023 },
    { ver: "13",  code: "Tiramisu",            api: 33, year: 2022 },
    { ver: "12L", code: "Snow Cone v2",        api: 32, year: 2022 },
    { ver: "12",  code: "Snow Cone",           api: 31, year: 2021 },
    { ver: "11",  code: "Red Velvet Cake",     api: 30, year: 2020 },
    { ver: "10",  code: "Quince Tart",         api: 29, year: 2019 },
    { ver: "9",   code: "Pie",                 api: 28, year: 2018 },
    { ver: "8.1", code: "Oreo MR1",            api: 27, year: 2017 },
    { ver: "8.0", code: "Oreo",                api: 26, year: 2017 },
    { ver: "7.1", code: "Nougat MR1",          api: 25, year: 2016 },
    { ver: "7.0", code: "Nougat",              api: 24, year: 2016 },
    { ver: "6.0", code: "Marshmallow",         api: 23, year: 2015 },
    { ver: "5.1", code: "Lollipop MR1",        api: 22, year: 2015 },
    { ver: "5.0", code: "Lollipop",            api: 21, year: 2014 },
    { ver: "4.4", code: "KitKat",              api: 19, year: 2013 },
    { ver: "4.3", code: "Jelly Bean MR2",      api: 18, year: 2013 },
    { ver: "4.2", code: "Jelly Bean MR1",      api: 17, year: 2012 },
    { ver: "4.1", code: "Jelly Bean",          api: 16, year: 2012 },
    { ver: "4.0", code: "Ice Cream Sandwich",  api: 15, year: 2011 },
    { ver: "2.3", code: "Gingerbread",         api: 10, year: 2011 },
  ];

  // 0% → 100% alpha channel
  var ALPHA_STEPS = [];
  for (var p = 100; p >= 0; p--) {
    var hex = Math.round(p * 255 / 100).toString(16).toUpperCase().padStart(2, "0");
    ALPHA_STEPS.push({ pct: p, hex: hex });
  }

  // Dangerous permissions
  var PERMISSIONS = [
    ["ACCESS_FINE_LOCATION",       "精确定位",        "Precise location",     "dangerous"],
    ["ACCESS_COARSE_LOCATION",     "粗略定位",        "Approximate location", "dangerous"],
    ["CAMERA",                     "相机",            "Camera",               "dangerous"],
    ["RECORD_AUDIO",               "录音",            "Microphone",           "dangerous"],
    ["READ_EXTERNAL_STORAGE",      "读取存储",        "Read storage",         "dangerous"],
    ["WRITE_EXTERNAL_STORAGE",     "写入存储",        "Write storage",        "dangerous"],
    ["READ_MEDIA_IMAGES",          "读取图片",        "Read images",          "dangerous(API33+)"],
    ["READ_MEDIA_VIDEO",           "读取视频",        "Read video",           "dangerous(API33+)"],
    ["READ_MEDIA_AUDIO",           "读取音频",        "Read audio",           "dangerous(API33+)"],
    ["READ_CONTACTS",              "读取联系人",      "Read contacts",        "dangerous"],
    ["WRITE_CONTACTS",             "写入联系人",      "Write contacts",       "dangerous"],
    ["READ_CALENDAR",              "读取日历",        "Read calendar",        "dangerous"],
    ["WRITE_CALENDAR",             "写入日历",        "Write calendar",       "dangerous"],
    ["READ_SMS",                   "读取短信",        "Read SMS",             "dangerous"],
    ["SEND_SMS",                   "发送短信",        "Send SMS",             "dangerous"],
    ["RECEIVE_SMS",                "接收短信",        "Receive SMS",          "dangerous"],
    ["READ_PHONE_STATE",           "读取电话状态",    "Phone state",          "dangerous"],
    ["CALL_PHONE",                 "拨打电话",        "Call phone",           "dangerous"],
    ["READ_CALL_LOG",              "读取通话记录",    "Read call log",        "dangerous"],
    ["WRITE_CALL_LOG",             "写入通话记录",    "Write call log",       "dangerous"],
    ["BODY_SENSORS",               "身体传感器",      "Body sensors",         "dangerous"],
    ["ACTIVITY_RECOGNITION",       "运动识别",        "Activity recognition", "dangerous"],
    ["BLUETOOTH_CONNECT",          "蓝牙连接",        "Bluetooth connect",    "dangerous(API31+)"],
    ["BLUETOOTH_SCAN",             "蓝牙扫描",        "Bluetooth scan",       "dangerous(API31+)"],
    ["POST_NOTIFICATIONS",         "通知权限",        "Notifications",        "dangerous(API33+)"],
    ["NEARBY_WIFI_DEVICES",        "WiFi 设备发现",   "Nearby WiFi",          "dangerous(API33+)"],
  ];

  // Icon sizes by density
  var ICON_SIZES = [
    { bucket: "ldpi", scale: "0.75x", launcher: 36, action: 24, notification: 18 },
    { bucket: "mdpi", scale: "1.0x",  launcher: 48, action: 24, notification: 24 },
    { bucket: "hdpi", scale: "1.5x",  launcher: 72, action: 36, notification: 36 },
    { bucket: "xhdpi", scale: "2.0x", launcher: 96, action: 48, notification: 48 },
    { bucket: "xxhdpi", scale: "3.0x", launcher: 144, action: 72, notification: 72 },
    { bucket: "xxxhdpi", scale: "4.0x", launcher: 192, action: 96, notification: 96 },
  ];

  // Common Implicit Intents
  var INTENTS = [
    ["ACTION_VIEW",             "打开链接",   "Open URL",         "https://...",                        ""],
    ["ACTION_VIEW",             "地图定位",   "Map location",     "geo:lat,lng?q=query",                ""],
    ["ACTION_VIEW",             "拨号盘",     "Show dialer",      "tel:123456",                         ""],
    ["ACTION_DIAL",             "拨号",       "Dial",             "tel:123456",                         ""],
    ["ACTION_CALL",             "直接通话",   "Call directly",    "tel:123456",                         "CALL_PHONE"],
    ["ACTION_SENDTO",           "发送短信",   "Send SMS",         "smsto:123456",                       ""],
    ["ACTION_SEND",             "分享文本",   "Share text",       "text/plain",                         ""],
    ["ACTION_SEND",             "分享图片",   "Share image",      "image/*",                            ""],
    ["ACTION_SEND_MULTIPLE",    "分享多文件", "Share multiple",   "image/*",                            ""],
    ["ACTION_IMAGE_CAPTURE",    "拍照",       "Take photo",       "output: URI",                        ""],
    ["ACTION_VIDEO_CAPTURE",    "录像",       "Record video",     "output: URI",                        ""],
    ["ACTION_PICK",             "选择联系人", "Pick contact",     "content://com.android.contacts/...", ""],
    ["ACTION_GET_CONTENT",      "选择文件",   "Pick file",        "image/*",                            ""],
    ["ACTION_OPEN_DOCUMENT",    "打开文档",   "Open document",    "*/*",                                ""],
    ["ACTION_CREATE_DOCUMENT",  "创建文档",   "Create document",  "application/pdf",                    ""],
    ["ACTION_WEB_SEARCH",       "网页搜索",   "Web search",       "query string",                       ""],
    ["ACTION_SET_ALARM",        "设置闹钟",   "Set alarm",        "hour:min",                           ""],
    ["ACTION_MAIN",             "启动应用",   "Launch app",       "CATEGORY_LAUNCHER",                  ""],
    ["ACTION_INSTALL_PACKAGE",  "安装应用",   "Install APK",      "package: URI / file://",             "REQUEST_INSTALL_PACKAGES"],
    ["ACTION_UNINSTALL_PACKAGE","卸载应用",   "Uninstall",        "package:...",                        "REQUEST_DELETE_PACKAGES"],
  ];

  // AGP ↔ Gradle compatibility
  var AGP_VERSIONS = [
    ["8.9", "8.11.0+", "Ladybug | 2024.2"],
    ["8.8", "8.10.0+", "Ladybug | 2024.2"],
    ["8.7", "8.9+",    "Koala | 2024.1"],
    ["8.6", "8.7+",    "Koala | 2024.1"],
    ["8.5", "8.7+",    "Jellyfish | 2023.3"],
    ["8.4", "8.6+",    "Jellyfish | 2023.3"],
    ["8.3", "8.5+",    "Hedgehog | 2023.1"],
    ["8.2", "8.2+",    "Hedgehog | 2023.1"],
    ["8.1", "8.0+",    "Giraffe | 2022.3"],
    ["8.0", "8.0+",    "Giraffe | 2022.3"],
    ["7.4", "7.5+",    "Flamingo | 2022.2"],
    ["7.3", "7.4+",    "Flamingo | 2022.2"],
    ["7.2", "7.3.3+",  "Electric Eel | 2022.1"],
    ["7.1", "7.2+",    "Electric Eel | 2022.1"],
    ["7.0", "7.0+",    "Arctic Fox | 2020.3"],
    ["4.2", "6.7.1+",  "Arctic Fox | 2020.3"],
  ];

  var alphaMode = "transparency"; // "transparency" | "opacity"

  function init(parent) {
    parent.innerHTML =
      '<div class="android-tool">' +
      '  <div class="b64-tabs">' +
      '    <button class="b64-tab active" data-atab="api">' + t("android.apiLevels") + '</button>' +
      '    <button class="b64-tab" data-atab="alpha">' + t("android.alpha") + '</button>' +
      '    <button class="b64-tab" data-atab="dp">' + t("android.dpPx") + '</button>' +
      '    <button class="b64-tab" data-atab="perm">' + t("android.permissions") + '</button>' +
      '    <button class="b64-tab" data-atab="icon">' + t("android.iconSizes") + '</button>' +
      '    <button class="b64-tab" data-atab="intent">' + t("android.intents") + '</button>' +
      '    <button class="b64-tab" data-atab="agp">' + t("android.agpGradle") + '</button>' +
      '  </div>' +
      '  <div id="atab-api" class="android-section">' + buildApiTable() + '</div>' +
      '  <div id="atab-alpha" class="android-section hidden">' + buildAlphaTable() + '</div>' +
      '  <div id="atab-dp" class="android-section hidden">' + buildDpSection() + '</div>' +
      '  <div id="atab-perm" class="android-section hidden">' + buildPermTable() + '</div>' +
      '  <div id="atab-icon" class="android-section hidden">' + buildIconTable() + '</div>' +
      '  <div id="atab-intent" class="android-section hidden">' + buildIntentTable() + '</div>' +
      '  <div id="atab-agp" class="android-section hidden">' + buildAgpTable() + '</div>' +
      '</div>';

    document.querySelectorAll(".b64-tab[data-atab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchATab(this.dataset.atab); });
    });

    bindEvents();
    renderAlphaBody(); // ponytail: alpha table built dynamically, must render on init
  }

  function switchATab(name) {
    document.querySelectorAll(".b64-tab[data-atab]").forEach(function (b) {
      b.className = "b64-tab" + (b.dataset.atab === name ? " active" : "");
    });
    document.querySelectorAll(".android-section").forEach(function (s) {
      s.classList.toggle("hidden", s.id !== "atab-" + name);
    });
  }

  // ═══ API Levels ═══

  function buildApiTable() {
    var h = '<div class="at-search-wrap"><input id="at-search-api" class="search-input" type="text" placeholder="' + t("android.searchApi") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.version") + '</th><th>' + t("android.codename") + '</th><th>API</th><th>' + t("android.year") + '</th></tr></thead><tbody>';
    API_LEVELS.forEach(function (r) {
      h += '<tr data-search="' + r.ver + ' ' + r.code.toLowerCase() + ' ' + r.api + '"><td><code>' + r.ver + '</code></td><td>' + r.code + '</td><td><code>' + r.api + '</code></td><td>' + r.year + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Alpha / Opacity ═══

  function buildAlphaTable() {
    var h = '<div class="at-search-wrap" style="display:flex;gap:10px;align-items:center">';
    h += '<input id="at-search-alpha" class="search-input" type="text" placeholder="' + t("android.searchAlpha") + '" style="max-width:280px">';
    h += '<button id="at-toggle-alpha" class="jt-btn" style="font-size:0.8rem">' + t("android." + alphaMode) + ' → ' + t("android." + (alphaMode === "transparency" ? "opacity" : "transparency")) + '</button>';
    h += '</div>';
    h += '<div class="at-table-wrap"><table class="at-table at-table-grid"><thead><tr>';
    for (var c = 0; c < 4; c++) {
      h += '<th id="at-alpha-col-' + c + '">' + t("android." + alphaMode) + '</th><th>Hex</th>';
    }
    h += '</tr></thead><tbody id="at-alpha-body"></tbody></table></div>';
    return h;
  }

  function renderAlphaBody() {
    var body = document.getElementById("at-alpha-body");
    if (!body) return;
    var h = "";
    for (var i = 0; i < ALPHA_STEPS.length; i += 4) {
      h += '<tr>';
      for (var j = 0; j < 4 && (i + j) < ALPHA_STEPS.length; j++) {
        var a = ALPHA_STEPS[i + j];
        var display = alphaMode === "opacity" ? (100 - a.pct) : a.pct;
        h += '<td>' + display + '%</td><td><code>#' + a.hex + '</code></td>';
      }
      h += '</tr>';
    }
    body.innerHTML = h;

    // update headers
    for (var c = 0; c < 4; c++) {
      var th = document.getElementById("at-alpha-col-" + c);
      if (th) th.textContent = t("android." + alphaMode);
    }
  }

  function toggleAlpha() {
    alphaMode = alphaMode === "transparency" ? "opacity" : "transparency";
    renderAlphaBody();
    var btn = document.getElementById("at-toggle-alpha");
    if (btn) btn.textContent = t("android." + alphaMode) + ' → ' + t("android." + (alphaMode === "transparency" ? "opacity" : "transparency"));
  }

  // ═══ dp/px ═══

  function buildDpSection() {
    var h = '<div class="at-converter">';
    h += '<div class="at-conv-row"><label class="crypto-inline"><span>dp</span><input id="at-dp" class="crypto-input" type="number" placeholder="' + t("android.dpPlaceholder") + '" style="width:120px"></label>';
    h += '<span style="color:var(--text-muted)">↔</span>';
    h += '<label class="crypto-inline"><span>px</span><input id="at-px" class="crypto-input" type="number" placeholder="' + t("android.pxPlaceholder") + '" style="width:120px"></label></div>';
    h += '<div class="at-conv-row" style="margin-top:10px"><label class="crypto-inline"><span>' + t("android.density") + '</span>';
    h += '<select id="at-density" class="settings-select" style="width:auto">';
    h += '<option value="0.75">ldpi (0.75x)</option><option value="1.0" selected>mdpi (1.0x)</option>';
    h += '<option value="1.5">hdpi (1.5x)</option><option value="2.0">xhdpi (2.0x)</option>';
    h += '<option value="3.0">xxhdpi (3.0x)</option><option value="4.0">xxxhdpi (4.0x)</option>';
    h += '</select></label></div></div>';

    var densities = [
      ["ldpi","0.75x","~120","低端旧设备"],["mdpi","1.0x","~160","早期 Android 手机"],
      ["hdpi","1.5x","~240","低端入门机"],["xhdpi","2.0x","~320","中端手机、小平板"],
      ["xxhdpi","3.0x","~480","高端手机"],["xxxhdpi","4.0x","~640","旗舰 / 4K 设备"],
      ["tvdpi","1.33x","~213","电视"],
    ];
    h += '<div class="at-table-wrap" style="margin-top:20px"><table class="at-table"><thead><tr><th>' + t("android.densityBucket") + '</th><th>' + t("android.density") + '</th><th>dpi</th><th>' + t("android.exampleDevices") + '</th></tr></thead><tbody>';
    densities.forEach(function (r) {
      h += '<tr><td><code>' + r[0] + '</code></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Permissions ═══

  function buildPermTable() {
    var h = '<div class="at-search-wrap"><input id="at-search-perm" class="search-input" type="text" placeholder="' + t("android.searchPerm") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>Permission</th><th>' + t("android.description") + '</th><th>' + t("android.level") + '</th></tr></thead><tbody>';
    PERMISSIONS.forEach(function (r) {
      var desc = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r[0].toLowerCase() + ' ' + desc.toLowerCase() + '"><td><code>' + r[0] + '</code></td><td>' + desc + '</td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Icon Sizes ═══

  function buildIconTable() {
    var h = '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.densityBucket") + '</th><th>' + t("android.density") + '</th><th>Launcher (dp)</th><th>' + t("android.actionBar") + ' (dp)</th><th>' + t("android.notification") + ' (dp)</th></tr></thead><tbody>';
    ICON_SIZES.forEach(function (r) {
      h += '<tr><td><code>' + r.bucket + '</code></td><td>' + r.scale + '</td><td>' + r.launcher + '</td><td>' + r.action + '</td><td>' + r.notification + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Common Intents ═══

  function buildIntentTable() {
    var h = '<div class="at-search-wrap"><input id="at-search-intent" class="search-input" type="text" placeholder="' + t("android.searchIntent") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>Action</th><th>' + t("android.description") + '</th><th>Data / MIME</th><th>' + t("android.permission") + '</th></tr></thead><tbody>';
    INTENTS.forEach(function (r) {
      var desc = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r[0].toLowerCase() + ' ' + desc.toLowerCase() + ' ' + r[3].toLowerCase() + '"><td><code>' + r[0] + '</code></td><td>' + desc + '</td><td><code>' + r[3] + '</code></td><td>' + (r[4] ? '<code>' + r[4] + '</code>' : '—') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ AGP ↔ Gradle ═══

  function buildAgpTable() {
    var h = '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>AGP</th><th>Gradle</th><th>Android Studio</th></tr></thead><tbody>';
    AGP_VERSIONS.forEach(function (r) {
      h += '<tr><td><code>' + r[0] + '</code></td><td><code>' + r[1] + '</code></td><td>' + r[2] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ events ═══

  function currentLang() {
    return (window.__locale && window.__locale.menu && window.__locale.menu.home === "首页") ? "zh" : "en";
  }

  function bindEvents() {
    // dp/px
    var dpEl = document.getElementById("at-dp");
    var pxEl = document.getElementById("at-px");
    var densityEl = document.getElementById("at-density");
    function getDensity() { return densityEl ? parseFloat(densityEl.value) : 1; }
    if (dpEl && pxEl) {
      dpEl.addEventListener("input", function () {
        var dp = parseFloat(this.value);
        if (!isNaN(dp)) pxEl.value = Math.round(dp * getDensity());
      });
      pxEl.addEventListener("input", function () {
        var px = parseFloat(this.value);
        if (!isNaN(px)) dpEl.value = (px / getDensity()).toFixed(1);
      });
    }
    if (densityEl) {
      densityEl.addEventListener("change", function () {
        var dp = parseFloat(dpEl.value);
        if (!isNaN(dp)) pxEl.value = Math.round(dp * getDensity());
      });
    }

    // alpha toggle
    var alphaToggle = document.getElementById("at-toggle-alpha");
    if (alphaToggle) alphaToggle.addEventListener("click", toggleAlpha);

    // search: API
    bindSearch("at-search-api", "#atab-api tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
    // search: alpha
    bindSearch("at-search-alpha", "#atab-alpha tbody tr", function (tr, q) { tr.style.display = q && !tr.textContent.toLowerCase().includes(q) ? "none" : ""; });
    // search: permissions
    bindSearch("at-search-perm", "#atab-perm tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
    // search: intents
    bindSearch("at-search-intent", "#atab-intent tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
  }

  function bindSearch(inputId, rowSelector, filterFn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("input", function () {
      var q = this.value.toLowerCase();
      document.querySelectorAll(rowSelector).forEach(function (tr) { filterFn(tr, q); });
    });
  }

  return { init: init };
})();
