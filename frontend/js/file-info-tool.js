// File Info Tool — metadata, hashes, EXIF, base64, image/video details. crypto.subtle + FileReader.
var FileInfoTool = (function () {
  var HISTORY_KEY = "fileinfo_history";
  var MAX_HISTORY = 20;

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function saveHistory(name, info) {
    var slim = {};
    for (var k in info) { if (k !== "base64" && k !== "base64Preview") slim[k] = info[k]; }
    var list = loadHistory();
    list = list.filter(function (e) { return e.name !== name; });
    list.unshift({ name: name, info: slim, time: Date.now() });
    if (list.length > MAX_HISTORY) list.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }

  function init(parent) {
    parent.innerHTML =
      '<div class="fi-tool">' +
      '  <div id="fi-dropzone" class="fi-dropzone">' +
      '    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
      '    <p class="fi-drop-text">' + t("fileinfo.dropText") + '</p>' +
      '    <p class="fi-or">' + t("fileinfo.or") + '</p>' +
      '    <label class="jt-btn jt-btn-primary">' + t("fileinfo.chooseFile") + '<input type="file" id="fi-file-input" hidden></label>' +
      '  </div>' +
      '  <div id="fi-loading" class="fi-loading hidden">' + t("fileinfo.analyzing") + '</div>' +
      '  <div id="fi-result" class="fi-result"></div>' +
      '  <div id="fileinfo-history" class="history-bar"></div>' +
      '</div>';

    var drop = document.getElementById("fi-dropzone");
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("fi-dragover"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("fi-dragover"); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("fi-dragover"); handleFile(e.dataTransfer.files[0]); });
    document.getElementById("fi-file-input").addEventListener("change", function () {
      if (this.files[0]) handleFile(this.files[0]);
    });

    renderHistory();
  }

  function reset() {
    document.getElementById("fi-dropzone").classList.remove("hidden");
    document.getElementById("fi-loading").classList.add("hidden");
    document.getElementById("fi-result").innerHTML = "";
  }

  function showResultFromCache(entry) {
    document.getElementById("fi-dropzone").classList.add("hidden");
    document.getElementById("fi-loading").classList.add("hidden");
    renderResult(entry.info);
  }

  function handleFile(file) {
    if (!file) return;

    document.getElementById("fi-dropzone").classList.add("hidden");
    document.getElementById("fi-loading").classList.remove("hidden");
    document.getElementById("fi-result").innerHTML = "";

    var reader = new FileReader();
    reader.onload = function () { computeAll(file, reader.result); };
    reader.readAsArrayBuffer(file);
  }

  function computeAll(file, buffer) {
    var bytes = new Uint8Array(buffer);
    var arr = [];
    for (var i = 0; i < bytes.length; i++) arr[i] = bytes[i]; // arr for md5

    var info = {
      name: file.name,
      size: file.size,
      type: file.type || "unknown",
      ext: (file.name.split(".").pop() || "").toLowerCase(),
      lastModified: new Date(file.lastModified).toISOString().replace("T", " ").replace(/\.\d{3}Z/, ""),
    };


    Promise.all([
      digestHex("SHA-256", buffer),
      digestHex("SHA-1", buffer),
    ]).then(function (hashes) {
      info.sha256 = hashes[0];
      info.sha1 = hashes[1];
      info.md5 = md5(arr);

      var chunks = [];
      for (var i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, bytes.length))));
      var base64 = btoa(chunks.join(""));
      info.base64 = base64;
      info.base64Preview = base64.substring(0, 200);

      detectMedia(file, info, function () {
        saveHistory(file.name, info);
        renderHistory();
        renderResult(info);
      });
    });
  }

  // ── MD5 ──
  function md5(input) {
    var msg = input.slice();
    var len = msg.length, ml = len * 8;
    msg.push(0x80);
    while ((msg.length * 8) % 512 !== 448) msg.push(0);
    for (var i = 0; i < 8; i++) msg.push((ml >>> (i * 8)) & 0xff);

    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    var K = []; for (var i = 0; i < 64; i++) K[i] = (Math.abs(Math.sin(i+1)) * 0x100000000) | 0;
    var S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];

    for (var bi = 0; bi < msg.length/64; bi++) {
      var M = []; for (var j = 0; j < 16; j++) { var o = bi*64+j*4; M[j] = msg[o]|(msg[o+1]<<8)|(msg[o+2]<<16)|(msg[o+3]<<24); }
      var A=a0,B=b0,C=c0,D=d0;
      for (var i = 0; i < 64; i++) {
        var f,g;
        if (i<16)      { f=(B&C)|(~B&D); g=i; }
        else if (i<32) { f=(B&D)|(C&~D); g=(5*i+1)%16; }
        else if (i<48) { f=B^C^D;         g=(3*i+5)%16; }
        else           { f=C^(B|~D);       g=(7*i)%16; }
        var tmp=D; D=C; C=B; B=((B+rotl32(A+f+K[i]+M[g],S[i]))|0)>>>0; A=tmp;
      }
      a0=(a0+A)|0; b0=(b0+B)|0; c0=(c0+C)|0; d0=(d0+D)|0;
    }
    function rotl32(x,n) { return ((x<<n)|(x>>>(32-n)))>>>0; }
    function wh(w) { var h=(w>>>0).toString(16); while(h.length<8)h="0"+h; return h; }
    return wh(a0)+wh(b0)+wh(c0)+wh(d0);
  }

  function digestHex(algo, buffer) {
    return crypto.subtle.digest(algo, buffer).then(function (hash) {
      return Array.from(new Uint8Array(hash)).map(function (b) { return b.toString(16).padStart(2,"0"); }).join("");
    });
  }

  // ── media ──
  function detectMedia(file, info, done) {
    var url = URL.createObjectURL(file);
    var pending = 0;

    if (file.type.startsWith("image/")) {
      pending++;
      var img = new Image();
      img.onload = function () {
        info.imageWidth = img.naturalWidth;
        info.imageHeight = img.naturalHeight;
        info.aspectRatio = simplifyRatio(img.naturalWidth, img.naturalHeight);
        info.megapixels = ((img.naturalWidth * img.naturalHeight) / 1000000).toFixed(1) + " MP";
        URL.revokeObjectURL(url);
        if (--pending === 0) done();
      };
      img.onerror = function () { URL.revokeObjectURL(url); if (--pending === 0) done(); };
      img.src = url;
    }

    if (file.type.startsWith("video/")) {
      pending++;
      var vid = document.createElement("video"); vid.preload = "metadata";
      vid.onloadedmetadata = function () {
        info.videoWidth = vid.videoWidth; info.videoHeight = vid.videoHeight;
        info.videoDuration = formatDuration(vid.duration);
        URL.revokeObjectURL(url); if (--pending === 0) done();
      };
      vid.onerror = function () { URL.revokeObjectURL(url); if (--pending === 0) done(); };
      vid.src = url;
    }

    if (file.type.startsWith("audio/")) {
      pending++;
      var aud = document.createElement("audio"); aud.preload = "metadata";
      aud.onloadedmetadata = function () {
        info.audioDuration = formatDuration(aud.duration);
        URL.revokeObjectURL(url); if (--pending === 0) done();
      };
      aud.onerror = function () { URL.revokeObjectURL(url); if (--pending === 0) done(); };
      aud.src = url;
    }

    if (pending === 0) { URL.revokeObjectURL(url); done(); }
  }

  function renderResult(info) {
    document.getElementById("fi-loading").classList.add("hidden");

    var rows = [
      [t("fileinfo.name"),     esc(info.name)],
      [t("fileinfo.size"),     formatSize(info.size) + " (" + info.size.toLocaleString() + " bytes)"],
      [t("fileinfo.type"),     info.type],
      [t("fileinfo.extension"),info.ext || "-"],
      [t("fileinfo.modified"), info.lastModified],
      [t("fileinfo.md5"),      info.md5],
      [t("fileinfo.sha1"),     info.sha1],
      [t("fileinfo.sha256"),   info.sha256],
    ];

    if (info.imageWidth) {
      rows.push([t("fileinfo.dimensions"), info.imageWidth + " × " + info.imageHeight + " (" + info.aspectRatio + ", " + info.megapixels + ")"]);
    }
    if (info.videoWidth) {
      rows.push([t("fileinfo.videoDimensions"), info.videoWidth + " × " + info.videoHeight]);
      rows.push([t("fileinfo.duration"), info.videoDuration]);
    }
    if (info.audioDuration) {
      rows.push([t("fileinfo.duration"), info.audioDuration]);
    }

    var html = '<div class="fi-card">';
    rows.forEach(function (r) {
      html += '<div class="fi-row"><span class="fi-label">' + r[0] + '</span><span class="fi-val">' + r[1] + '</span><button class="ts-copy" data-val="' + esc(r[1]) + '">' + t("fileinfo.copy") + '</button></div>';
    });

    // base64
    if (info.base64Preview) {
      var preview = info.base64Preview;
      if (info.base64 && info.base64.length > 200) preview += "...";
      html += '<div class="fi-row fi-row-col">' +
        '<span class="fi-label">' + t("fileinfo.base64") + (info.base64 ? " (" + formatSize(info.base64.length) + ")" : "") + '</span>' +
        '<pre class="fi-base64-preview">' + esc(preview) + '</pre>';
      if (info.base64) {
        html += '<button id="fi-copy-base64" class="jt-btn jt-btn-primary" style="margin-top:6px">' + t("fileinfo.copyBase64") + '</button>';
      } else {
        html += '<span style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">' + t("fileinfo.reopenForBase64") + '</span>';
      }
      html += '</div>';
    }

    html += '<div style="padding:14px 16px; border-top:1px solid var(--border)">' +
      '<button id="fi-reset" class="jt-btn" style="width:100%">' + t("fileinfo.newFile") + '</button>' +
      '</div>';
    html += '</div>';

    document.getElementById("fi-result").innerHTML = html;

    document.getElementById("fi-result").querySelectorAll(".ts-copy").forEach(function (btn) {
      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(this.dataset.val);
        var orig = this.textContent; this.textContent = "✓";
        setTimeout(function () { btn.textContent = orig; }, 800);
      });
    });

    var copyBtn = document.getElementById("fi-copy-base64");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(info.base64);
        var orig = this.textContent; this.textContent = "✓ " + t("fileinfo.copied");
        setTimeout(function () { copyBtn.textContent = orig; }, 1200);
      });
    }

    document.getElementById("fi-reset").addEventListener("click", reset);
  }

  function simplifyRatio(w, h) { var g = gcd(w, h); return (w/g) + ":" + (h/g); }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function formatDuration(s) {
    if (!s || !isFinite(s)) return "-";
    return Math.floor(s/60) + ":" + String(Math.floor(s%60)).padStart(2,"0");
  }
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes/1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes/1048576).toFixed(1) + " MB";
    return (bytes/1073741824).toFixed(2) + " GB";
  }
  function esc(s) { return typeof s === "string" ? s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") : String(s); }

  function renderHistory() {
    var list = loadHistory();
    var el = document.getElementById("fileinfo-history");
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + '</span>';
    list.forEach(function (entry) {
      html += '<button class="history-chip" data-idx="' + list.indexOf(entry) + '">' + esc(entry.name) + '</button>';
    });
    el.innerHTML = html;
    el.querySelectorAll(".history-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var entry = list[parseInt(this.dataset.idx)];
        if (entry && entry.info) showResultFromCache(entry);
      });
    });
  }

  return { init: init };
})();
