// JSON Tool — format, validate, tree view, folding. Zero deps.
var JsonTool = (function () {
  var container, editor, output, resizer, leftPane, rightPane;
  var splitRatio = 0.5; // ponytail: simple ratio, no per-pixel storage needed

  function init(parent) {
    container = parent;
    container.innerHTML =
      '<div class="json-tool">' +
      '  <div class="json-toolbar">' +
      '    <button id="jt-format" class="jt-btn jt-btn-primary">格式化</button>' +
      '    <button id="jt-compact" class="jt-btn">压缩</button>' +
      '    <button id="jt-copy" class="jt-btn">复制</button>' +
      '    <span id="jt-msg" class="jt-msg"></span>' +
      '  </div>' +
      '  <div class="json-panes">' +
      '    <div class="json-pane json-pane-left">' +
      '      <textarea id="jt-editor" class="jt-editor" placeholder="粘贴 JSON..."></textarea>' +
      '    </div>' +
      '    <div id="jt-resizer" class="jt-resizer"></div>' +
      '    <div class="json-pane json-pane-right">' +
      '      <div id="jt-output" class="jt-output"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    editor = document.getElementById("jt-editor");
    output = document.getElementById("jt-output");
    resizer = document.getElementById("jt-resizer");
    leftPane = container.querySelector(".json-pane-left");
    rightPane = container.querySelector(".json-pane-right");

    applySplit();

    document.getElementById("jt-format").addEventListener("click", function () {
      formatJson();
    });
    document.getElementById("jt-compact").addEventListener("click", function () {
      compactJson();
    });
    document.getElementById("jt-copy").addEventListener("click", function () {
      copyOutput();
    });

    editor.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        formatJson();
      }
    });

    // ── drag resizer ──
    resizer.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var panes = container.querySelector(".json-panes");
      var startX = e.clientX;
      var startRatio = splitRatio;
      var panesWidth = panes.getBoundingClientRect().width;

      function onMove(ev) {
        var dx = ev.clientX - startX;
        var newRatio = startRatio + dx / panesWidth;
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
  }

  function applySplit() {
    leftPane.style.flex = "0 0 " + (splitRatio * 100) + "%";
    rightPane.style.flex = "0 0 " + ((1 - splitRatio) * 100) + "%";
  }

  function setMsg(text, isError) {
    var el = document.getElementById("jt-msg");
    el.textContent = text;
    el.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  function formatJson() {
    var raw = editor.value.trim();
    if (!raw) { output.innerHTML = ""; setMsg("", false); return; }
    try {
      var obj = JSON.parse(raw);
      var formatted = JSON.stringify(obj, null, 2);
      setMsg("✓ 有效 JSON", false);
      renderTree(obj);
    } catch (e) {
      setMsg("✗ " + e.message, true);
      output.innerHTML = '<pre class="jt-error">' + escapeHtml(e.message) + "</pre>";
    }
  }

  function compactJson() {
    var raw = editor.value.trim();
    if (!raw) return;
    try {
      var obj = JSON.parse(raw);
      editor.value = JSON.stringify(obj);
      setMsg("✓ 已压缩", false);
      renderTree(obj);
    } catch (e) {
      setMsg("✗ " + e.message, true);
    }
  }

  function copyOutput() {
    try {
      var obj = JSON.parse(editor.value.trim());
      navigator.clipboard.writeText(JSON.stringify(obj, null, 2)).then(function () {
        setMsg("✓ 已复制", false);
      });
    } catch (e) {
      setMsg("✗ 无法复制：JSON 无效", true);
    }
  }

  // ── tree view with folding ──
  function renderTree(obj) {
    output.innerHTML = buildNode(obj, 0);
    // bind fold toggles
    output.querySelectorAll(".jt-toggle").forEach(function (tog) {
      tog.addEventListener("click", function (e) {
        e.stopPropagation();
        var row = this.parentElement;
        row.classList.toggle("jt-collapsed");
      });
    });
  }

  function buildNode(val, depth) {
    if (val === null) return '<span class="jt-null">null</span>';
    if (typeof val === "boolean") return '<span class="jt-bool">' + val + "</span>";
    if (typeof val === "number") return '<span class="jt-number">' + val + "</span>";
    if (typeof val === "string") return '<span class="jt-string">"' + escapeHtml(val) + '"</span>';

    if (Array.isArray(val)) {
      if (val.length === 0) return '<span class="jt-bracket">[]</span>';
      var html = '<div class="jt-row jt-collapsible"><span class="jt-toggle">▼</span><span class="jt-bracket">[</span><span class="jt-count">' + val.length + " items</span></div>";
      html += '<div class="jt-children">';
      val.forEach(function (item, i) {
        html += '<div class="jt-row"><span class="jt-key">' + i + '</span>: ' + buildNode(item, depth + 1) + (i < val.length - 1 ? '<span class="jt-comma">,</span>' : "") + "</div>";
      });
      html += '</div><div class="jt-row"><span class="jt-bracket">]</span></div>';
      return html;
    }

    if (typeof val === "object") {
      var keys = Object.keys(val);
      if (keys.length === 0) return '<span class="jt-bracket">{}</span>';
      var html = '<div class="jt-row jt-collapsible"><span class="jt-toggle">▼</span><span class="jt-bracket">{</span><span class="jt-count">' + keys.length + " keys</span></div>";
      html += '<div class="jt-children">';
      keys.forEach(function (k, i) {
        html += '<div class="jt-row"><span class="jt-key">"' + escapeHtml(k) + '"</span>: ' + buildNode(val[k], depth + 1) + (i < keys.length - 1 ? '<span class="jt-comma">,</span>' : "") + "</div>";
      });
      html += '</div><div class="jt-row"><span class="jt-bracket">}</span></div>';
      return html;
    }

    return String(val);
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  return { init: init };
})();
