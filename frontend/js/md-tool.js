// Markdown Tool — live preview, file upload, download as HTML/DOC/MD.
var MdTool = (function () {
  var container, editor, preview, resizer, leftPane, rightPane;
  var splitRatio = 0.5;
  var HISTORY_KEY = "md_history";
  var MAX_HISTORY = 20;

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function saveHistory(input) {
    var list = loadHistory();
    var idx = list.indexOf(input);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(input);
    if (list.length > MAX_HISTORY) list.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }

  function init(parent) {
    container = parent;
    container.innerHTML =
      '<div class="md-tool">' +
      '  <div class="md-toolbar">' +
      '    <button id="md-upload-btn" class="jt-btn">' + t("markdown.upload") + '</button>' +
      '    <input type="file" id="md-file-input" accept=".md,.markdown,.txt" style="display:none">' +
      '    <button id="md-dl-html" class="jt-btn jt-btn-primary">' + t("markdown.downloadHtml") + '</button>' +
      '    <button id="md-dl-doc" class="jt-btn">' + t("markdown.downloadDoc") + '</button>' +
      '    <button id="md-dl-pdf" class="jt-btn">' + t("markdown.downloadPdf") + '</button>' +
      '    <button id="md-dl-md" class="jt-btn">' + t("markdown.downloadMd") + '</button>' +
      '    <button id="md-copy-html" class="jt-btn">' + t("markdown.copyHtml") + '</button>' +
      '    <span id="md-msg" class="jt-msg"></span>' +
      '  </div>' +
      '  <div class="md-panes">' +
      '    <div class="md-pane md-pane-left">' +
      '      <textarea id="md-editor" class="jt-editor" placeholder="' + t("markdown.placeholder") + '"></textarea>' +
      '    </div>' +
      '    <div id="md-resizer" class="jt-resizer"></div>' +
      '    <div class="md-pane md-pane-right">' +
      '      <div id="md-preview" class="jt-output md-preview"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div id="md-history" class="history-bar"></div>' +
      '</div>';

    editor = document.getElementById("md-editor");
    preview = document.getElementById("md-preview");
    resizer = document.getElementById("md-resizer");
    leftPane = container.querySelector(".md-pane-left");
    rightPane = container.querySelector(".md-pane-right");

    applySplit();

    document.getElementById("md-upload-btn").addEventListener("click", function () {
      document.getElementById("md-file-input").click();
    });
    document.getElementById("md-file-input").addEventListener("change", handleFileUpload);
    document.getElementById("md-dl-html").addEventListener("click", downloadHtml);
    document.getElementById("md-dl-doc").addEventListener("click", downloadDoc);
    document.getElementById("md-dl-pdf").addEventListener("click", downloadPdf);
    document.getElementById("md-dl-md").addEventListener("click", downloadMd);
    document.getElementById("md-copy-html").addEventListener("click", copyHtml);

    editor.addEventListener("input", function () {
      renderPreview();
    });

    // Ctrl+Enter saves to history
    editor.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        var raw = editor.value.trim();
        if (raw) {
          saveHistory(raw);
          renderHistory();
          setMsg("✓ " + t("markdown.saved"), false);
        }
      }
    });

    // drag resizer — same pattern as JSON tool
    resizer.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var panes = container.querySelector(".md-panes");
      var startX = e.clientX;
      var startRatio = splitRatio;
      var panesWidth = panes.getBoundingClientRect().width;

      function onMove(ev) {
        var newRatio = startRatio + (ev.clientX - startX) / panesWidth;
        splitRatio = Math.max(0.2, Math.min(0.8, newRatio));
        applySplit();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    // ponytail: render empty state
    preview.innerHTML = '<div class="md-empty">' + t("markdown.emptyPreview") + '</div>';
    renderHistory();
  }

  function applySplit() {
    leftPane.style.flex = "0 0 " + (splitRatio * 100) + "%";
    rightPane.style.flex = "0 0 " + ((1 - splitRatio) * 100) + "%";
  }

  function setMsg(text, isError) {
    var el = document.getElementById("md-msg");
    if (!el) return;
    el.textContent = text;
    el.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  function renderPreview() {
    var raw = editor.value;
    if (!raw.trim()) {
      preview.innerHTML = '<div class="md-empty">' + t("markdown.emptyPreview") + '</div>';
      return;
    }
    try {
      preview.innerHTML = marked.parse(raw);
    } catch (e) {
      preview.innerHTML = '<div class="jt-error">' + escapeHtml(e.message) + '</div>';
    }
  }

  function handleFileUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      editor.value = reader.result;
      renderPreview();
      saveHistory(reader.result);
      renderHistory();
      setMsg("✓ " + t("markdown.uploaded"), false);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function getRenderedHtml() {
    var raw = editor.value;
    if (!raw.trim()) return "";
    try { return marked.parse(raw); } catch (e) { return ""; }
  }

  function downloadHtml() {
    var md = editor.value.trim();
    if (!md) { setMsg(t("markdown.emptyInput"), true); return; }
    var rendered = getRenderedHtml();
    var fullHtml = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>\n' +
      'body{max-width:900px;margin:0 auto;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:#24292f;background:#fff;}\n' +
      'pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto;}\ncode{font-family:"SF Mono",monospace;font-size:0.9em;}\n' +
      'table{border-collapse:collapse;width:100%;}th,td{border:1px solid #d0d7de;padding:8px 12px;text-align:left;}\n' +
      'blockquote{border-left:4px solid #d0d7de;padding-left:16px;color:#656d76;margin-left:0;}\n' +
      'img{max-width:100%;}\n</style>\n</head>\n<body>\n' + rendered + '\n</body>\n</html>';
    downloadBlob(fullHtml, "document.html", "text/html");
    setMsg("✓ " + t("markdown.htmlDownloaded"), false);
  }

  function downloadPdf() {
    var md = editor.value.trim();
    if (!md) { setMsg(t("markdown.emptyInput"), true); return; }
    var el = document.getElementById("md-preview");
    setMsg("⏳ " + t("markdown.generating"), false);
    var opt = {
      margin: [10, 10, 10, 10],
      filename: "document.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        // ponytail: onclone runs on the temp doc html2canvas creates — apply print styles there
        onclone: function (clonedDoc) {
          var clonedEl = clonedDoc.getElementById("md-preview");
          if (clonedEl) {
            clonedEl.style.background = "#ffffff";
            clonedEl.style.color = "#24292f";
            clonedEl.style.width = "800px";
            clonedEl.style.padding = "20px";
          }
        },
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(opt).from(el).save().then(function () {
      setMsg("✓ " + t("markdown.pdfDownloaded"), false);
    }).catch(function (err) {
      console.error("PDF failed:", err);
      setMsg("✗ " + t("markdown.pdfFailed"), true);
    });
  }

  function downloadDoc() {
    var md = editor.value.trim();
    if (!md) { setMsg(t("markdown.emptyInput"), true); return; }
    var rendered = getRenderedHtml();
    // ponytail: Word opens HTML files — wrap with Office namespace for .doc
    var docHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->\n<style>\n' +
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;}\n' +
      'pre{background:#f6f8fa;padding:12px;border-radius:4px;}code{font-family:"SF Mono",monospace;}\n' +
      'table{border-collapse:collapse;}th,td{border:1px solid #999;padding:6px 10px;}\n' +
      'blockquote{border-left:3px solid #ccc;padding-left:12px;color:#666;}\n' +
      '</style>\n</head>\n<body>\n' + rendered + '\n</body>\n</html>';
    downloadBlob(docHtml, "document.doc", "application/msword");
    setMsg("✓ " + t("markdown.docDownloaded"), false);
  }

  function downloadMd() {
    var md = editor.value.trim();
    if (!md) { setMsg(t("markdown.emptyInput"), true); return; }
    downloadBlob(md, "document.md", "text/markdown");
    setMsg("✓ " + t("markdown.mdDownloaded"), false);
  }

  function copyHtml() {
    var rendered = getRenderedHtml();
    if (!rendered) { setMsg(t("markdown.emptyInput"), true); return; }
    navigator.clipboard.writeText(rendered).then(function () {
      setMsg("✓ " + t("markdown.htmlCopied"), false);
    }).catch(function () {
      setMsg("✗ " + t("markdown.copyFailed"), true);
    });
  }

  function downloadBlob(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function renderHistory() {
    var list = loadHistory();
    var el = document.getElementById("md-history");
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + '</span>';
    list.forEach(function (item) {
      html += '<button class="history-chip" title="' + escapeHtml(item) + '">' + escapeHtml(item.substring(0, 80)) + '</button>';
    });
    el.innerHTML = html;
    el.querySelectorAll(".history-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        editor.value = this.getAttribute("title");
        renderPreview();
      });
    });
  }

  return { init: init };
})();
