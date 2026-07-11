// Image Tool — resize, rotate, flip, compress and convert locally with Canvas.
var ImageTool = (function () {
  var HISTORY_KEY = "image_tool_history";
  var MAX_HISTORY = 12;
  var MAX_PIXELS = 40000000;
  var EXIFR_URL = "https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.umd.js";
  var HEIC_URL = "https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js";
  var JSZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
  var scriptPromises = {};
  var sourceFile = null;
  var sourceImage = null;
  var sourceUrl = "";
  var outputBlob = null;
  var outputUrl = "";
  var rotation = 0;
  var flipX = false;
  var flipY = false;
  var aspectRatio = 1;
  var syncingSize = false;
  var batchFiles = [];
  var batchResults = [];
  var useRecommended = true;

  function t(key) { return (window.__t && window.__t(key)) || key; }
  function byId(id) { return document.getElementById(id); }

  function init(parent) {
    cleanup();
    parent.innerHTML =
      '<div class="image-tool">' +
      '  <div id="image-dropzone" class="image-dropzone">' +
      '    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' +
      '    <strong>' + t("image.dropTitle") + '</strong>' +
      '    <span>' + t("image.dropHint") + '</span>' +
      '    <label class="jt-btn jt-btn-primary">' + t("image.chooseImage") + '<input id="image-file" type="file" accept="image/*,.heic,.heif" multiple hidden></label>' +
      '    <span id="image-drop-message" class="image-error"></span>' +
      '  </div>' +
      '  <div id="image-workspace" class="image-workspace hidden">' +
      '    <div class="image-preview-panel">' +
      '      <div class="image-preview-head"><strong>' + t("image.preview") + '</strong><button id="image-replace" class="jt-btn">' + t("image.replace") + '</button></div>' +
      '      <div class="image-preview-stage"><img id="image-preview" alt=""><span id="image-preview-empty">' + t("image.emptyPreview") + '</span></div>' +
      '      <div id="image-source-info" class="image-file-info"></div>' +
      '      <div id="image-batch-list" class="image-batch-list"></div>' +
      '      <details id="image-metadata" class="image-metadata hidden"><summary>' + t("image.metadataTitle") + '</summary><div id="image-metadata-grid" class="image-metadata-grid"></div><p id="image-metadata-note" class="image-local-note"></p></details>' +
      '    </div>' +
      '    <div class="image-controls">' +
      '      <div class="image-control-section"><h3>' + t("image.sizeTitle") + '</h3>' +
      '        <div class="image-size-row"><label><span>' + t("image.width") + '</span><input id="image-width" class="crypto-input" type="number" min="1" max="20000"></label><span>×</span><label><span>' + t("image.height") + '</span><input id="image-height" class="crypto-input" type="number" min="1" max="20000"></label></div>' +
      '        <label class="image-check"><input id="image-lock-ratio" type="checkbox" checked> ' + t("image.lockRatio") + '</label>' +
      '        <div class="image-presets"><button class="jt-btn" data-scale="0.25">25%</button><button class="jt-btn" data-scale="0.5">50%</button><button class="jt-btn" data-scale="0.75">75%</button><button class="jt-btn" data-scale="1">100%</button></div>' +
      '        <div class="image-presets image-named-presets"><button class="jt-btn" data-max-edge="512">' + t("image.presetAvatar") + '</button><button class="jt-btn" data-max-edge="1200">' + t("image.presetWeb") + '</button><button class="jt-btn" data-max-edge="1920">' + t("image.presetFullHd") + '</button></div>' +
      '      </div>' +
      '      <div class="image-control-section"><h3>' + t("image.transformTitle") + '</h3><div class="image-action-grid">' +
      '        <button id="image-rotate-left" class="jt-btn">↶ ' + t("image.rotateLeft") + '</button><button id="image-rotate-right" class="jt-btn">↷ ' + t("image.rotateRight") + '</button>' +
      '        <button id="image-flip-x" class="jt-btn">↔ ' + t("image.flipHorizontal") + '</button><button id="image-flip-y" class="jt-btn">↕ ' + t("image.flipVertical") + '</button>' +
      '      </div></div>' +
      '      <div class="image-control-section"><h3>' + t("image.outputTitle") + '</h3>' +
      '        <button id="image-recommended" class="jt-btn image-recommended">★ ' + t("image.recommended") + '</button>' +
      '        <label class="image-field"><span>' + t("image.format") + '</span><select id="image-format" class="settings-select"><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>' +
      '        <label id="image-quality-row" class="image-field"><span>' + t("image.quality") + ' <b id="image-quality-value">85%</b></span><input id="image-quality" type="range" min="10" max="100" value="85"></label>' +
      '        <label class="image-field"><span>' + t("image.targetSize") + '</span><input id="image-target-kb" class="crypto-input" type="number" min="10" max="20480" step="10" placeholder="' + t("image.targetSizePlaceholder") + '"><small>' + t("image.targetSizeHint") + '</small></label>' +
      '        <label class="image-field"><span>' + t("image.background") + '</span><input id="image-background" type="color" value="#ffffff"></label>' +
      '        <p class="image-local-note">🔒 ' + t("image.localNote") + '</p>' +
      '      </div>' +
      '      <div class="image-submit-row"><button id="image-process" class="jt-btn jt-btn-primary">' + t("image.process") + '</button><button id="image-download" class="jt-btn" disabled>' + t("image.download") + '</button><button id="image-download-all" class="jt-btn hidden" disabled>' + t("image.downloadAll") + '</button><button id="image-reset" class="jt-btn">' + t("image.reset") + '</button></div>' +
      '      <div id="image-result-info" class="image-result-info"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div id="image-history" class="history-bar"></div>' +
      '</div>';

    bindEvents();
    renderHistory();
  }

  function bindEvents() {
    var dropzone = byId("image-dropzone");
    dropzone.addEventListener("dragover", function (event) { event.preventDefault(); dropzone.classList.add("dragover"); });
    dropzone.addEventListener("dragleave", function () { dropzone.classList.remove("dragover"); });
    dropzone.addEventListener("drop", function (event) {
      event.preventDefault();
      dropzone.classList.remove("dragover");
      handleFiles(event.dataTransfer.files);
    });
    byId("image-file").addEventListener("change", function () { handleFiles(this.files); });
    byId("image-replace").addEventListener("click", function () { byId("image-file").click(); });
    byId("image-width").addEventListener("input", function () { useRecommended = false; syncDimension("width"); clearOutput(); });
    byId("image-height").addEventListener("input", function () { useRecommended = false; syncDimension("height"); clearOutput(); });
    byId("image-format").addEventListener("change", function () { useRecommended = false; updateQualityVisibility(); clearOutput(); });
    byId("image-quality").addEventListener("input", function () { useRecommended = false; byId("image-quality-value").textContent = this.value + "%"; clearOutput(); });
    byId("image-target-kb").addEventListener("input", function () { useRecommended = false; clearOutput(); });
    byId("image-background").addEventListener("input", clearOutput);
    byId("image-lock-ratio").addEventListener("change", clearOutput);
    document.querySelectorAll("[data-scale]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!sourceImage) return;
        useRecommended = false;
        setDimensions(Math.max(1, Math.round(sourceImage.naturalWidth * Number(this.dataset.scale))), Math.max(1, Math.round(sourceImage.naturalHeight * Number(this.dataset.scale))));
        clearOutput();
      });
    });
    document.querySelectorAll("[data-max-edge]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!sourceImage) return;
        useRecommended = false;
        var scale = Math.min(1, Number(this.dataset.maxEdge) / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight));
        setDimensions(Math.max(1, Math.round(sourceImage.naturalWidth * scale)), Math.max(1, Math.round(sourceImage.naturalHeight * scale)));
        clearOutput();
      });
    });
    byId("image-rotate-left").addEventListener("click", function () { rotation = (rotation + 270) % 360; updateTransformButtons(); clearOutput(); });
    byId("image-rotate-right").addEventListener("click", function () { rotation = (rotation + 90) % 360; updateTransformButtons(); clearOutput(); });
    byId("image-flip-x").addEventListener("click", function () { flipX = !flipX; updateTransformButtons(); clearOutput(); });
    byId("image-flip-y").addEventListener("click", function () { flipY = !flipY; updateTransformButtons(); clearOutput(); });
    byId("image-process").addEventListener("click", processImage);
    byId("image-download").addEventListener("click", downloadOutput);
    byId("image-download-all").addEventListener("click", downloadAll);
    byId("image-reset").addEventListener("click", resetSettings);
    byId("image-recommended").addEventListener("click", applyRecommendedSettings);
  }

  function handleFiles(fileList) {
    var files = Array.from(fileList || []).filter(isImageFile);
    if (!files.length) { showMessage(t("image.invalidFile"), true); return; }
    batchFiles = files;
    batchResults = [];
    renderBatchList();
    handleFile(files[0]);
  }

  function handleFile(file) {
    if (!file) return;
    byId("image-drop-message").textContent = "";
    if (!isImageFile(file)) {
      showMessage(t("image.invalidFile"), true);
      return;
    }
    cleanupUrls();
    sourceFile = file;
    parseMetadata(file);
    loadSourceImage(file);
  }

  function loadSourceImage(file) {
    sourceUrl = URL.createObjectURL(file);
    var image = new Image();
    image.onload = function () {
      if (image.naturalWidth * image.naturalHeight > MAX_PIXELS) {
        URL.revokeObjectURL(sourceUrl);
        sourceUrl = "";
        showMessage(t("image.tooLarge"), true);
        return;
      }
      sourceImage = image;
      aspectRatio = image.naturalWidth / image.naturalHeight;
      rotation = 0;
      flipX = false;
      flipY = false;
      setDimensions(image.naturalWidth, image.naturalHeight);
      byId("image-preview").src = sourceUrl;
      byId("image-preview").style.display = "block";
      byId("image-preview-empty").style.display = "none";
      byId("image-dropzone").classList.add("hidden");
      byId("image-workspace").classList.remove("hidden");
      byId("image-source-info").textContent = file.name + " · " + image.naturalWidth + " × " + image.naturalHeight + " · " + formatBytes(file.size);
      resetSettings();
    };
    image.onerror = function () {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      sourceUrl = "";
      if (isHeic(file)) {
        decodeHeic(file);
      } else {
        showMessage(t("image.loadFailed"), true);
      }
    };
    image.src = sourceUrl;
  }

  function decodeHeic(file) {
    showMessage(t("image.heicDecoding"), false);
    ensureScript("heicTo", HEIC_URL).then(function () {
      return window.HeicTo({ blob: file, type: "image/jpeg", quality: 0.95 });
    }).then(function (result) {
      var blob = Array.isArray(result) ? result[0] : result;
      sourceUrl = URL.createObjectURL(blob);
      var image = new Image();
      image.onload = function () {
        if (image.naturalWidth * image.naturalHeight > MAX_PIXELS) {
          showMessage(t("image.tooLarge"), true);
          return;
        }
        sourceImage = image;
        aspectRatio = image.naturalWidth / image.naturalHeight;
        byId("image-preview").src = sourceUrl;
        byId("image-preview").style.display = "block";
        byId("image-preview-empty").style.display = "none";
        byId("image-dropzone").classList.add("hidden");
        byId("image-workspace").classList.remove("hidden");
        byId("image-source-info").textContent = file.name + " · " + image.naturalWidth + " × " + image.naturalHeight + " · " + formatBytes(file.size) + " · HEIC/HEIF";
        resetSettings();
      };
      image.onerror = function () { showMessage(t("image.heicFailed"), true); };
      image.src = sourceUrl;
    }).catch(function () { showMessage(t("image.heicFailed"), true); });
  }

  function resetSettings() {
    if (!sourceImage) return;
    rotation = 0;
    flipX = false;
    flipY = false;
    aspectRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
    byId("image-lock-ratio").checked = true;
    byId("image-background").value = "#ffffff";
    applyRecommendedSettings();
  }

  function applyRecommendedSettings() {
    if (!sourceImage) return;
    useRecommended = true;
    var scale = Math.min(1, 2560 / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight));
    setDimensions(Math.max(1, Math.round(sourceImage.naturalWidth * scale)), Math.max(1, Math.round(sourceImage.naturalHeight * scale)));
    byId("image-lock-ratio").checked = true;
    byId("image-format").value = "image/webp";
    byId("image-quality").value = 82;
    byId("image-quality-value").textContent = "82%";
    byId("image-target-kb").value = "";
    updateQualityVisibility();
    clearOutput();
    showMessage(t("image.recommendedApplied"), false);
  }

  function parseMetadata(file) {
    var details = byId("image-metadata");
    var grid = byId("image-metadata-grid");
    var note = byId("image-metadata-note");
    details.classList.add("hidden");
    grid.innerHTML = "";
    note.textContent = t("image.metadataReading");
    ensureScript("exifr", EXIFR_URL).then(function () {
      return window.exifr.parse(file, { tiff: true, ifd0: true, exif: true, gps: true, translateValues: true, reviveValues: true });
    }).then(function (metadata) {
      var rows = metadataRows(metadata || {});
      details.classList.remove("hidden");
      if (!rows.length) {
        grid.innerHTML = '<span class="image-metadata-empty">' + t("image.metadataEmpty") + '</span>';
      } else {
        grid.innerHTML = rows.map(function (row) {
          return '<div><span>' + escapeHtml(row[0]) + '</span><strong>' + escapeHtml(row[1]) + '</strong></div>';
        }).join("");
      }
      note.textContent = t("image.metadataLocal");
    }).catch(function () {
      details.classList.remove("hidden");
      grid.innerHTML = '<span class="image-metadata-empty">' + t("image.metadataUnreadable") + '</span>';
      note.textContent = t("image.metadataLocal");
    });
  }

  function metadataRows(metadata) {
    var rows = [];
    addMetadata(rows, t("image.camera"), [metadata.Make, metadata.Model].filter(Boolean).join(" "));
    addMetadata(rows, t("image.lens"), metadata.LensModel || metadata.Lens || metadata.LensInfo);
    addMetadata(rows, t("image.dateTaken"), formatMetadataValue(metadata.DateTimeOriginal || metadata.CreateDate || metadata.DateTimeDigitized || metadata.ModifyDate));
    addMetadata(rows, t("image.software"), metadata.Software);
    addMetadata(rows, t("image.exposure"), exposureText(metadata.ExposureTime));
    addMetadata(rows, t("image.aperture"), metadata.FNumber ? "f/" + trimNumber(metadata.FNumber) : "");
    addMetadata(rows, "ISO", metadata.ISO || metadata.ISOSpeedRatings);
    addMetadata(rows, t("image.focalLength"), metadata.FocalLength ? trimNumber(metadata.FocalLength) + " mm" : "");
    addMetadata(rows, t("image.orientation"), metadata.Orientation);
    var latitude = metadata.latitude != null ? metadata.latitude : metadata.GPSLatitude;
    var longitude = metadata.longitude != null ? metadata.longitude : metadata.GPSLongitude;
    if (typeof latitude === "number" && typeof longitude === "number") {
      addMetadata(rows, t("image.location"), latitude.toFixed(6) + ", " + longitude.toFixed(6));
    }
    return rows;
  }

  function addMetadata(rows, label, value) {
    if (value !== undefined && value !== null && String(value).trim()) rows.push([label, String(value)]);
  }

  function formatMetadataValue(value) {
    if (value instanceof Date && !isNaN(value.getTime())) return value.toLocaleString();
    return value || "";
  }

  function exposureText(value) {
    if (!value) return "";
    if (value < 1) return "1/" + Math.round(1 / value) + " s";
    return trimNumber(value) + " s";
  }

  function trimNumber(value) { return Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"); }
  function isHeic(file) { return /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name); }
  function isImageFile(file) { return !!file && ((file.type && file.type.indexOf("image/") === 0) || isHeic(file)); }

  function ensureScript(name, url) {
    if (scriptPromises[name]) return scriptPromises[name];
    scriptPromises[name] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = function () { delete scriptPromises[name]; reject(new Error("load failed")); };
      document.head.appendChild(script);
    });
    return scriptPromises[name];
  }

  function setDimensions(width, height) {
    syncingSize = true;
    byId("image-width").value = width;
    byId("image-height").value = height;
    syncingSize = false;
  }

  function syncDimension(changed) {
    if (syncingSize || !sourceImage || !byId("image-lock-ratio").checked) return;
    var width = Number(byId("image-width").value);
    var height = Number(byId("image-height").value);
    syncingSize = true;
    if (changed === "width" && width > 0) byId("image-height").value = Math.max(1, Math.round(width / aspectRatio));
    if (changed === "height" && height > 0) byId("image-width").value = Math.max(1, Math.round(height * aspectRatio));
    syncingSize = false;
  }

  function updateTransformButtons() {
    byId("image-flip-x").classList.toggle("active", flipX);
    byId("image-flip-y").classList.toggle("active", flipY);
    var transform = "rotate(" + rotation + "deg) scale(" + (flipX ? -1 : 1) + "," + (flipY ? -1 : 1) + ")";
    byId("image-preview").style.transform = transform;
  }

  function updateQualityVisibility() {
    byId("image-quality-row").classList.toggle("hidden", byId("image-format").value === "image/png");
  }

  async function processImage() {
    if (!sourceImage) return;
    if (batchFiles.length > 1) { processBatch(); return; }
    var processButton = byId("image-process");
    processButton.disabled = true;
    processButton.textContent = t("image.processingButton");
    var width = Math.round(Number(byId("image-width").value));
    var height = Math.round(Number(byId("image-height").value));
    if (!width || !height || width < 1 || height < 1 || width > 20000 || height > 20000 || width * height > MAX_PIXELS) {
      showMessage(t("image.invalidSize"), true);
      processButton.disabled = false;
      processButton.textContent = t("image.process");
      return;
    }
    var rotated = rotation === 90 || rotation === 270;
    var canvas = document.createElement("canvas");
    canvas.width = rotated ? height : width;
    canvas.height = rotated ? width : height;
    var context = canvas.getContext("2d");
    var mime = byId("image-format").value;
    if (mime === "image/jpeg") {
      context.fillStyle = byId("image-background").value;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation * Math.PI / 180);
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.drawImage(sourceImage, -width / 2, -height / 2, width, height);
    var quality = Number(byId("image-quality").value) / 100;
    var targetBytes = Math.max(0, Number(byId("image-target-kb").value) * 1024);
    try {
      var blob = await encodeCanvas(canvas, mime, quality, targetBytes);
      processButton.disabled = false;
      processButton.textContent = t("image.process");
      if (!blob) { showMessage(t("image.exportFailed"), true); return; }
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputBlob = blob;
      outputUrl = URL.createObjectURL(blob);
      byId("image-preview").src = outputUrl;
      byId("image-preview").style.transform = "none";
      byId("image-download").disabled = false;
      var saved = sourceFile.size - blob.size;
      var savingText = saved > 0 ? t("image.savedSize").replace("{percent}", Math.round(saved / sourceFile.size * 100)) : t("image.sizeIncreased");
      var targetText = targetBytes ? " · " + (blob.size <= targetBytes ? t("image.targetReached") : t("image.targetNotReached")) : "";
      byId("image-result-info").innerHTML = '<strong>' + formatBytes(blob.size) + '</strong><span>' + canvas.width + ' × ' + canvas.height + ' · ' + savingText + targetText + ' · ' + t("image.metadataRemoved") + '</span>';
      saveHistory({ name: sourceFile.name, width: canvas.width, height: canvas.height, size: blob.size, format: mime, time: Date.now() });
      renderHistory();
    } catch (error) {
      processButton.disabled = false;
      processButton.textContent = t("image.process");
      showMessage(error.message || t("image.exportFailed"), true);
    }
  }

  async function encodeCanvas(canvas, mime, quality, targetBytes) {
    if (!targetBytes || mime === "image/png") return canvasToBlob(canvas, mime, quality);
    var low = 0.1;
    var high = Math.max(low, Math.min(0.98, quality));
    var best = null;
    for (var attempt = 0; attempt < 7; attempt++) {
      var candidateQuality = (low + high) / 2;
      var candidate = await canvasToBlob(canvas, mime, candidateQuality);
      if (candidate.size <= targetBytes) {
        best = candidate;
        low = candidateQuality;
      } else {
        high = candidateQuality;
      }
    }
    return best || canvasToBlob(canvas, mime, 0.1);
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error(t("image.exportFailed"))); }, mime, quality);
    });
  }

  function downloadOutput() {
    if (!outputBlob || !sourceFile) return;
    var downloadButton = byId("image-download");
    downloadButton.disabled = true;
    downloadButton.textContent = t("image.downloadingButton");
    var extension = byId("image-format").value.split("/")[1].replace("jpeg", "jpg");
    var baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "image";
    var link = document.createElement("a");
    link.href = outputUrl;
    link.download = baseName + "_processed_" + timestampName() + "." + extension;
    link.click();
    showCopyToast(t("image.downloaded"));
    setTimeout(function () {
      if (!outputBlob) return;
      downloadButton.disabled = false;
      downloadButton.textContent = t("image.download");
    }, 800);
  }

  async function processBatch() {
    var button = byId("image-process");
    var scale = Number(byId("image-width").value) / sourceImage.naturalWidth;
    var mime = byId("image-format").value;
    var quality = Number(byId("image-quality").value) / 100;
    var targetBytes = Math.max(0, Number(byId("image-target-kb").value) * 1024);
    var stamp = timestampName();
    batchResults = [];
    button.disabled = true;
    try {
      for (var index = 0; index < batchFiles.length; index++) {
        button.textContent = t("image.batchProgress").replace("{current}", index + 1).replace("{total}", batchFiles.length);
        var file = batchFiles[index];
        var decoded = await decodeFile(file);
        var fileScale = useRecommended ? Math.min(1, 2560 / Math.max(decoded.image.naturalWidth, decoded.image.naturalHeight)) : scale;
        var width = Math.max(1, Math.round(decoded.image.naturalWidth * fileScale));
        var height = Math.max(1, Math.round(decoded.image.naturalHeight * fileScale));
        if (width * height > MAX_PIXELS) throw new Error(t("image.invalidSize"));
        var blob = await renderBlob(decoded.image, width, height, mime, quality, targetBytes);
        URL.revokeObjectURL(decoded.url);
        var extension = mime.split("/")[1].replace("jpeg", "jpg");
        var baseName = file.name.replace(/\.[^.]+$/, "") || "image";
        batchResults.push({ blob: blob, name: baseName + "_compressed_" + stamp + "." + extension });
        renderBatchList();
      }
      byId("image-download-all").classList.remove("hidden");
      byId("image-download-all").disabled = false;
      var totalSize = batchResults.reduce(function (sum, item) { return sum + item.blob.size; }, 0);
      byId("image-result-info").innerHTML = '<strong>' + t("image.batchDone").replace("{count}", batchResults.length) + '</strong><span>' + t("image.batchTotal").replace("{size}", formatBytes(totalSize)) + '</span>';
    } catch (error) {
      showMessage(error.message || t("image.exportFailed"), true);
    } finally {
      button.disabled = false;
      button.textContent = t("image.process");
    }
  }

  async function decodeFile(file) {
    var blob = file;
    if (isHeic(file)) {
      await ensureScript("heicTo", HEIC_URL);
      blob = await window.HeicTo({ blob: file, type: "image/jpeg", quality: 0.95 });
    }
    var url = URL.createObjectURL(blob);
    var image = await new Promise(function (resolve, reject) {
      var element = new Image();
      element.onload = function () { resolve(element); };
      element.onerror = reject;
      element.src = url;
    });
    return { image: image, url: url };
  }

  function renderBlob(image, width, height, mime, quality, targetBytes) {
    var rotated = rotation === 90 || rotation === 270;
    var canvas = document.createElement("canvas");
    canvas.width = rotated ? height : width;
    canvas.height = rotated ? width : height;
    var context = canvas.getContext("2d");
    if (mime === "image/jpeg") { context.fillStyle = byId("image-background").value; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation * Math.PI / 180);
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    return encodeCanvas(canvas, mime, quality, targetBytes);
  }

  async function downloadAll() {
    if (!batchResults.length) return;
    var button = byId("image-download-all");
    button.disabled = true;
    button.textContent = t("image.zippingButton");
    try {
      await ensureScript("JSZip", JSZIP_URL);
      var zip = new window.JSZip();
      batchResults.forEach(function (item) { zip.file(item.name, item.blob); });
      var blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "images_compressed_" + timestampName() + ".zip";
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } finally {
      button.disabled = false;
      button.textContent = t("image.downloadAll");
    }
  }

  function renderBatchList() {
    var target = byId("image-batch-list");
    if (!target) return;
    if (batchFiles.length < 2) { target.innerHTML = ""; return; }
    target.innerHTML = '<strong>' + t("image.batchSelected").replace("{count}", batchFiles.length) + '</strong>' + batchFiles.map(function (file, index) {
      var result = batchResults[index];
      var sizeSummary = "";
      if (result) {
        var difference = file.size - result.blob.size;
        var percentage = file.size ? Math.round(Math.abs(difference) / file.size * 100) : 0;
        var changeText = difference >= 0
          ? t("image.batchReduced").replace("{percent}", percentage)
          : t("image.batchIncreased").replace("{percent}", percentage);
        sizeSummary = ' · ' + t("image.batchSizeSummary")
          .replace("{original}", formatBytes(file.size))
          .replace("{compressed}", formatBytes(result.blob.size))
          .replace("{change}", changeText);
      } else {
        sizeSummary = ' · ' + t("image.batchOriginalSize").replace("{size}", formatBytes(file.size));
      }
      return '<span>' + escapeHtml(file.name) + sizeSummary + '</span>';
    }).join("");
  }

  function clearOutput() {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = "";
    outputBlob = null;
    if (byId("image-download")) {
      byId("image-download").disabled = true;
      byId("image-download").textContent = t("image.download");
    }
    if (byId("image-download-all")) {
      byId("image-download-all").disabled = true;
      byId("image-download-all").textContent = t("image.downloadAll");
      byId("image-download-all").classList.add("hidden");
    }
    batchResults = [];
    renderBatchList();
    if (byId("image-result-info")) byId("image-result-info").innerHTML = "";
    if (sourceUrl && byId("image-preview")) byId("image-preview").src = sourceUrl;
    if (byId("image-preview")) updateTransformButtons();
  }

  function showMessage(message, error) {
    var dropMessage = byId("image-drop-message");
    if (dropMessage && byId("image-workspace").classList.contains("hidden")) {
      dropMessage.textContent = message;
      return;
    }
    var target = byId("image-result-info");
    if (!target) return;
    target.innerHTML = '<span class="' + (error ? "image-error" : "image-success") + '">' + escapeHtml(message) + '</span>';
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function saveHistory(entry) {
    var history = loadHistory();
    history.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  }

  function renderHistory() {
    var target = byId("image-history");
    if (!target) return;
    var history = loadHistory();
    if (!history.length) { target.innerHTML = ""; return; }
    target.innerHTML = '<span class="history-label">' + t("history.label") + '</span>' + history.map(function (item) {
      return '<span class="history-item" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + ' · ' + item.width + '×' + item.height + ' · ' + formatBytes(item.size) + '</span>';
    }).join("");
  }

  function cleanupUrls() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    sourceUrl = "";
    outputUrl = "";
  }

  function cleanup() {
    cleanupUrls();
    sourceFile = null;
    sourceImage = null;
    outputBlob = null;
    batchFiles = [];
    batchResults = [];
  }

  function timestampName() {
    var date = new Date();
    return date.getFullYear() + String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0") + String(date.getHours()).padStart(2, "0") + String(date.getMinutes()).padStart(2, "0") + String(date.getSeconds()).padStart(2, "0") + String(date.getMilliseconds()).padStart(3, "0");
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1) return "0 B";
    var units = ["B", "KB", "MB", "GB"];
    var index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, index)).toFixed(index ? 2 : 0) + " " + units[index];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  return { init: init, cleanup: cleanup };
})();
