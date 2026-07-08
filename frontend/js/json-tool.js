// JSON Tool — format, tree view, convert to/from JS/Kotlin/Java/Go/CSV/YAML/XML.
var JsonTool = (function () {
  var container, editor, output, resizer, leftPane, rightPane;
  var splitRatio = 0.5;
  var tab = "format";
  var HISTORY_KEY = "json_history";
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

  // ═══ Init ═══

  function init(parent) {
    container = parent;
    container.innerHTML =
      '<div class="json-tool">' +
      // tabs
      '  <div class="b64-tabs">' +
      '    <button id="jt-tab-format" class="b64-tab active">' + t("json.format") + '</button>' +
      '    <button id="jt-tab-convert" class="b64-tab">' + t("json.convert") + '</button>' +
      '  </div>' +
      // ── format pane ──
      '  <div id="jt-pane-format" class="b64-pane">' +
      '    <div class="json-toolbar">' +
      '      <button id="jt-format" class="jt-btn jt-btn-primary">' + t("json.formatBtn") + '</button>' +
      '      <button id="jt-compact" class="jt-btn">' + t("json.compact") + '</button>' +
      '      <button id="jt-copy" class="jt-btn">' + t("json.copy") + '</button>' +
      '      <span id="jt-msg" class="jt-msg"></span>' +
      '    </div>' +
      '    <div class="json-panes">' +
      '      <div class="json-pane json-pane-left">' +
      '        <textarea id="jt-editor" class="jt-editor" placeholder="' + t("json.placeholder") + '"></textarea>' +
      '      </div>' +
      '      <div id="jt-resizer" class="jt-resizer"></div>' +
      '      <div class="json-pane json-pane-right">' +
      '        <div id="jt-output" class="jt-output"></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      // ── convert pane ──
      '  <div id="jt-pane-convert" class="b64-pane hidden">' +
      '    <div class="json-panes">' +
      '      <div class="json-pane json-pane-left">' +
      '        <textarea id="jt-cv-input" class="jt-editor" placeholder="' + t("json.cvPlaceholder") + '"></textarea>' +
      '      </div>' +
      '      <div id="jt-cv-resizer" class="jt-resizer"></div>' +
      '      <div class="json-pane json-pane-right">' +
      '        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
      '          <select id="jt-cv-format" class="settings-select" style="width:auto">' +
      '            <optgroup label="JSON →">' +
      '              <option value="j2yaml">JSON → YAML</option>' +
      '              <option value="j2xml">JSON → XML</option>' +
      '              <option value="j2csv">JSON → CSV</option>' +
      '              <option value="j2js">JSON → JS Object</option>' +
      '              <option value="j2kotlin">JSON → Kotlin</option>' +
      '              <option value="j2java">JSON → Java</option>' +
      '              <option value="j2go">JSON → Go</option>' +
      '            </optgroup>' +
      '            <optgroup label="→ JSON">' +
      '              <option value="yaml2j">YAML → JSON</option>' +
      '              <option value="xml2j">XML → JSON</option>' +
      '              <option value="csv2j">CSV → JSON</option>' +
      '              <option value="js2j">JS Object → JSON</option>' +
      '            </optgroup>' +
      '          </select>' +
      '          <button id="jt-cv-go" class="jt-btn jt-btn-primary">' + t("json.convertBtn") + '</button>' +
      '          <button id="jt-cv-copy" class="jt-btn">' + t("json.copy") + '</button>' +
      '          <span id="jt-cv-msg" class="jt-msg"></span>' +
      '        </div>' +
      '        <textarea id="jt-cv-output" class="jt-editor" readonly placeholder="' + t("json.cvOutputPlaceholder") + '" style="height:calc(100% - 42px)"></textarea>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div id="json-history" class="history-bar"></div>' +
      '</div>';

    editor = document.getElementById("jt-editor");
    output = document.getElementById("jt-output");
    resizer = document.getElementById("jt-resizer");
    leftPane = container.querySelector(".json-pane-left");
    rightPane = container.querySelector(".json-pane-right");

    applySplit();

    // tab switching
    document.getElementById("jt-tab-format").addEventListener("click", function () { switchTab("format"); });
    document.getElementById("jt-tab-convert").addEventListener("click", function () { switchTab("convert"); });

    // format tab buttons
    document.getElementById("jt-format").addEventListener("click", function () { formatJson(); });
    document.getElementById("jt-compact").addEventListener("click", function () { compactJson(); });
    document.getElementById("jt-copy").addEventListener("click", function () { copyOutput(); });

    editor.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); formatJson(); }
    });

    // format resize
    resizer.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var panes = container.querySelector(".json-panes");
      var startX = e.clientX, startRatio = splitRatio, w = panes.getBoundingClientRect().width;
      function onMove(ev) { splitRatio = Math.max(0.2, Math.min(0.8, startRatio + (ev.clientX - startX) / w)); applySplit(); }
      function onUp() { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; }
      document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
    });

    // convert resize — shares splitRatio with format pane
    var cvResizer = document.getElementById("jt-cv-resizer");
    if (cvResizer) {
      cvResizer.addEventListener("mousedown", function (e) {
        e.preventDefault();
        var panes = document.querySelector("#jt-pane-convert .json-panes");
        var startX = e.clientX, startRatio = splitRatio, w = panes.getBoundingClientRect().width;
        function onMove(ev) { splitRatio = Math.max(0.2, Math.min(0.8, startRatio + (ev.clientX - startX) / w)); applyCvSplit(); }
        function onUp() { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; }
        document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
      });
    }

    // convert tab
    document.getElementById("jt-cv-go").addEventListener("click", doConvert);
    document.getElementById("jt-cv-copy").addEventListener("click", function () {
      var v = document.getElementById("jt-cv-output").value;
      if (v) navigator.clipboard.writeText(v).then(function () { showCopyToast(t("json.copied")); });
    });
    document.getElementById("jt-cv-format").addEventListener("change", doConvert);
    document.getElementById("jt-cv-input").addEventListener("input", function () { doConvert(); });

    renderHistory();
  }

  function switchTab(mode) {
    tab = mode;
    document.getElementById("jt-tab-format").className = "b64-tab" + (mode === "format" ? " active" : "");
    document.getElementById("jt-tab-convert").className = "b64-tab" + (mode === "convert" ? " active" : "");
    document.getElementById("jt-pane-format").classList.toggle("hidden", mode !== "format");
    document.getElementById("jt-pane-convert").classList.toggle("hidden", mode !== "convert");
  }

  function applySplit() {
    leftPane.style.flex = "0 0 " + (splitRatio * 100) + "%";
    rightPane.style.flex = "0 0 " + ((1 - splitRatio) * 100) + "%";
    applyCvSplit();
  }

  function applyCvSplit() {
    var cvLeft = document.querySelector("#jt-pane-convert .json-pane-left");
    var cvRight = document.querySelector("#jt-pane-convert .json-pane-right");
    if (cvLeft) cvLeft.style.flex = "0 0 " + (splitRatio * 100) + "%";
    if (cvRight) cvRight.style.flex = "0 0 " + ((1 - splitRatio) * 100) + "%";
  }

  // ═══ Format tab ═══

  function setMsg(text, isError) {
    var el = document.getElementById("jt-msg");
    el.textContent = text;
    el.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  function setCvMsg(text, isError) {
    var el = document.getElementById("jt-cv-msg");
    if (!el) return;
    el.textContent = text;
    el.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
  }

  function formatJson() {
    var raw = editor.value.trim();
    if (!raw) { output.innerHTML = ""; setMsg("", false); return; }
    try {
      var obj = JSON.parse(raw);
      editor.value = JSON.stringify(obj, null, 2);
      setMsg("✓ " + t("json.valid"), false);
      saveHistory(raw);
      renderHistory();
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
      setMsg("✓ " + t("json.compacted"), false);
      saveHistory(raw);
      renderHistory();
      renderTree(obj);
    } catch (e) {
      setMsg("✗ " + e.message, true);
    }
  }

  function copyOutput() {
    try {
      var obj = JSON.parse(editor.value.trim());
      navigator.clipboard.writeText(JSON.stringify(obj, null, 2)).then(function () {
        showCopyToast(t("json.copied"));
      });
    } catch (e) {
      setMsg("✗ " + t("json.copyFailed"), true);
    }
  }

  function renderTree(obj) {
    output.innerHTML = buildNode(obj, 0);
    output.querySelectorAll(".jt-toggle").forEach(function (tog) {
      tog.addEventListener("click", function (e) {
        e.stopPropagation();
        this.parentElement.classList.toggle("jt-collapsed");
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
      var html = '<div class="jt-row jt-collapsible"><span class="jt-toggle">▼</span><span class="jt-bracket">[</span><span class="jt-count">' + val.length + " " + t("json.items") + "</span></div>";
      html += '<div class="jt-children">';
      val.forEach(function (item, i) {
        html += '<div class="jt-row"><span class="jt-key">' + i + '</span>: ' + buildNode(item, depth + 1) + (i < val.length - 1 ? '<span class="jt-comma">,</span>' : "") + "</div>";
      });
      return html + '</div><div class="jt-row"><span class="jt-bracket">]</span></div>';
    }

    if (typeof val === "object") {
      var keys = Object.keys(val);
      if (keys.length === 0) return '<span class="jt-bracket">{}</span>';
      var html = '<div class="jt-row jt-collapsible"><span class="jt-toggle">▼</span><span class="jt-bracket">{</span><span class="jt-count">' + keys.length + " " + t("json.keys") + "</span></div>";
      html += '<div class="jt-children">';
      keys.forEach(function (k, i) {
        html += '<div class="jt-row"><span class="jt-key">"' + escapeHtml(k) + '"</span>: ' + buildNode(val[k], depth + 1) + (i < keys.length - 1 ? '<span class="jt-comma">,</span>' : "") + "</div>";
      });
      return html + '</div><div class="jt-row"><span class="jt-bracket">}</span></div>';
    }

    return String(val);
  }

  // ═══ Convert tab ═══

  function doConvert() {
    var text = document.getElementById("jt-cv-input").value.trim();
    var out = document.getElementById("jt-cv-output");
    if (!text) { out.value = ""; setCvMsg("", false); return; }

    var fmt = document.getElementById("jt-cv-format").value;
    try {
      var result;
      switch (fmt) {
        case "j2yaml":   result = jsonToYaml(JSON.parse(text)); break;
        case "j2xml":    result = jsonToXml(JSON.parse(text)); break;
        case "j2csv":    result = jsonToCsv(JSON.parse(text)); break;
        case "j2js":     result = jsonToJs(JSON.parse(text)); break;
        case "j2kotlin": result = jsonToKotlin(JSON.parse(text)); break;
        case "j2java":   result = jsonToJava(JSON.parse(text)); break;
        case "j2go":     result = jsonToGo(JSON.parse(text)); break;
        case "yaml2j":   result = yamlToJson(text); break;
        case "xml2j":    result = xmlToJson(text); break;
        case "csv2j":    result = csvToJson(text); break;
        case "js2j":     result = jsToJson(text); break;
        default: throw new Error("Unknown conversion: " + fmt);
      }
      out.value = result;
      setCvMsg("✓", false);
    } catch (e) {
      setCvMsg("✗ " + e.message, true);
    }
  }

  // ── JSON → YAML ──
  function jsonToYaml(obj, indent) {
    if (indent === undefined) indent = 0;
    var pad = "  ".repeat(indent);
    if (obj === null) return "null";
    if (typeof obj === "boolean") return String(obj);
    if (typeof obj === "number") return String(obj);
    if (typeof obj === "string") return quoteYaml(obj);
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      return obj.map(function (item) {
        return pad + "- " + jsonToYaml(item, indent + 1).replace(/^  /, "");
      }).join("\n");
    }
    // object
    var keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    return keys.map(function (k) {
      var v = obj[k];
      if (v === null || typeof v !== "object" || (Array.isArray(v) && v.length === 0) || (!Array.isArray(v) && Object.keys(v).length === 0)) {
        return pad + k + ": " + jsonToYaml(v);
      }
      return pad + k + ":\n" + jsonToYaml(v, indent + 1);
    }).join("\n");
  }

  function quoteYaml(s) {
    if (/[#&*!|>'"%@`,\[\]{}]/.test(s) || /^\s|\s$/.test(s)) return '"' + s.replace(/"/g, '\\"') + '"';
    if (/^(\d|true|false|null|yes|no|on|off)/i.test(s)) return '"' + s + '"';
    return s;
  }

  // ── YAML → JSON ──
  function yamlToJson(yaml) {
    // pony tail: basic YAML parser for flat & nested key:value, lists, simple strings
    var lines = yaml.split("\n");
    var root = {};
    var stack = [{ obj: root, indent: -1 }];
    var currentKey = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim() || line.trim().startsWith("#")) continue;
      var indent = line.search(/\S/);
      var content = line.trim();

      // list item
      if (content.startsWith("- ")) {
        content = content.substring(2);
        // pop to correct indent
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
        var parent = stack[stack.length - 1].obj;
        var val = parseYamlScalar(content);
        if (Array.isArray(parent)) {
          if (typeof val === "object" && val !== null) {
            parent.push(val);
            stack.push({ obj: val, indent: indent });
          } else {
            parent.push(val);
          }
        } else if (currentKey) {
          parent[currentKey] = parent[currentKey] || [];
          if (typeof val === "object" && val !== null) {
            parent[currentKey].push(val);
            stack.push({ obj: val, indent: indent });
          } else {
            parent[currentKey].push(val);
          }
        }
        continue;
      }

      // key: value
      var colonIdx = content.indexOf(":");
      if (colonIdx > 0 && (content[colonIdx + 1] === " " || content[colonIdx + 1] === undefined || colonIdx === content.length - 1)) {
        var key = content.substring(0, colonIdx).trim();
        var rest = colonIdx + 1 < content.length ? content.substring(colonIdx + 1).trim() : "";

        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
        var parent = stack[stack.length - 1].obj;

        if (rest) {
          parent[key] = parseYamlScalar(rest);
        } else {
          // nested object — check if next line is more indented
          var nextIndent = Infinity;
          for (var j = i + 1; j < lines.length; j++) {
            var nl = lines[j].trim();
            if (nl && !nl.startsWith("#")) { nextIndent = lines[j].search(/\S/); break; }
          }
          if (nextIndent > indent) {
            // check if next line starts with "- "
            var nextContent = "";
            for (var k = i + 1; k < lines.length; k++) { var nl2 = lines[k].trim(); if (nl2) { nextContent = nl2; break; } }
            if (nextContent.startsWith("- ")) {
              parent[key] = [];
              stack.push({ obj: parent[key], indent: indent });
            } else {
              parent[key] = {};
              stack.push({ obj: parent[key], indent: indent });
            }
          } else {
            parent[key] = null;
          }
        }
        currentKey = key;
      }
    }
    return JSON.stringify(root, null, 2);
  }

  function parseYamlScalar(s) {
    if (s === "null" || s === "~") return null;
    if (s === "true" || s === "yes" || s === "on") return true;
    if (s === "false" || s === "no" || s === "off") return false;
    if (/^-?\d+\.?\d*$/.test(s) && !/^0\d/.test(s)) return Number(s);
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
    return s;
  }

  // ── JSON → XML ──
  function jsonToXml(obj, rootName) {
    rootName = rootName || "root";
    function toXml(v, name, depth) {
      var pad = "  ".repeat(depth);
      if (v === null) return pad + "<" + name + " />";
      if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") {
        return pad + "<" + name + ">" + escapeXml(String(v)) + "</" + name + ">";
      }
      if (Array.isArray(v)) {
        return v.map(function (item) { return toXml(item, name, depth); }).join("\n");
      }
      // object
      var attrs = "", children = [];
      Object.keys(v).forEach(function (k) {
        var val = v[k];
        if (k === "@attrs" && typeof val === "object") {
          attrs = " " + Object.keys(val).map(function (ak) { return ak + '="' + escapeXml(String(val[ak])) + '"'; }).join(" ");
        } else if (k === "#text") {
          children.push({ inline: escapeXml(String(val)) });
        } else if (Array.isArray(val)) {
          val.forEach(function (item) { children.push({ xml: toXml(item, k, depth + 1) }); });
        } else {
          children.push({ xml: toXml(val, k, depth + 1) });
        }
      });
      if (!children.length) return pad + "<" + name + attrs + " />";
      var inline = children.map(function (c) { return c.inline; }).filter(Boolean).join("");
      if (inline && children.every(function (c) { return c.inline; })) {
        return pad + "<" + name + attrs + ">" + inline + "</" + name + ">";
      }
      var body = children.map(function (c) { return c.inline ? null : c.xml; }).filter(function (s) { return s !== null; }).join("\n");
      return pad + "<" + name + attrs + ">\n" + body + "\n" + pad + "</" + name + ">";
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + toXml(obj, rootName, 0);
  }

  // ── XML → JSON ──
  function xmlToJson(xml) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xml, "text/xml");
    var err = doc.querySelector("parsererror");
    if (err) throw new Error("Invalid XML: " + err.textContent);
    return JSON.stringify(xmlNodeToJson(doc.documentElement), null, 2);
  }

  function xmlNodeToJson(node) {
    var obj = {};
    // attributes
    if (node.attributes && node.attributes.length) {
      var attrs = {};
      for (var i = 0; i < node.attributes.length; i++) { attrs[node.attributes[i].name] = node.attributes[i].value; }
      obj["@attrs"] = attrs;
    }
    // children
    var childElements = [];
    for (var i = 0; i < node.childNodes.length; i++) {
      var child = node.childNodes[i];
      if (child.nodeType === 1) childElements.push(child);
    }
    if (childElements.length === 0) {
      var text = node.textContent.trim();
      if (text) return text;
      return obj;
    }
    childElements.forEach(function (child) {
      var tag = child.tagName;
      var val = xmlNodeToJson(child);
      if (obj[tag] === undefined) {
        obj[tag] = val;
      } else {
        if (!Array.isArray(obj[tag])) obj[tag] = [obj[tag]];
        obj[tag].push(val);
      }
    });
    // flatten: if only @attrs and one other key, use that
    return obj;
  }

  // ── JSON → CSV ──
  function jsonToCsv(obj) {
    var arr = Array.isArray(obj) ? obj : [obj];
    if (!arr.length) return "";
    // one-level flatten: nested objects expand to dotted keys; arrays/objects stay as-is in cell
    var flatRows = arr.map(function (row) { return flattenRow(row); });
    var keys = [];
    flatRows.forEach(function (fr) { Object.keys(fr).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); }); });
    if (!keys.length) return "";
    var lines = [keys.map(csvCell).join(",")];
    flatRows.forEach(function (fr) {
      lines.push(keys.map(function (k) { return csvCell(fr[k]); }).join(","));
    });
    return lines.join("\n");
  }

  // one-level flatten: only expand direct nested objects; arrays and deeper objects become JSON strings
  function flattenRow(val) {
    var out = {};
    if (val === null || typeof val !== "object") return out;
    Object.keys(val).forEach(function (k) {
      var v = val[k];
      if (v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) {
        Object.keys(v).forEach(function (k2) { out[k + "." + k2] = v[k2]; });
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  function csvCell(v) {
    if (v === null || v === undefined) return "";
    var s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // ── CSV → JSON ──
  function csvToJson(csv) {
    var lines = csv.trim().split("\n");
    if (lines.length < 2) throw new Error("CSV needs at least header + 1 data row");
    var headers = parseCsvLine(lines[0]);
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var vals = parseCsvLine(lines[i]);
      var row = {};
      headers.forEach(function (h, j) { row[h] = vals[j] || ""; });
      rows.push(row);
    }
    return JSON.stringify(rows, null, 2);
  }

  function parseCsvLine(line) {
    var result = [], current = "", inQuote = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuote) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
          else inQuote = false;
        } else current += ch;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === ",") { result.push(current); current = ""; }
        else current += ch;
      }
    }
    result.push(current);
    return result;
  }

  // ── JSON → JavaScript Object ──
  function jsonToJs(obj) {
    var s = JSON.stringify(obj, null, 2);
    // strip quotes from keys that are valid JS identifiers (letters/digits/_/$, not starting with digit)
    return s.replace(/^(\s*)"([a-zA-Z_$][a-zA-Z0-9_$]*)":/gm, '$1$2:');
  }

  // ── JS Object → JSON ──
  function jsToJson(js) {
    // use eval in a controlled way — wrap in parentheses
    var obj = (new Function("return (" + js + ")"))();
    return JSON.stringify(obj, null, 2);
  }

  // ── JSON → Kotlin data class ──
  function jsonToKotlin(obj) {
    var classes = [];
    buildKotlinClass("Root", obj, classes, 0);
    return classes.join("\n\n");
  }

  function buildKotlinClass(name, obj, classes, depth) {
    if (obj === null || typeof obj !== "object") return kotlinScalarType(obj);
    var arr = Array.isArray(obj);
    var fields = arr ? obj : [obj];
    // collect unique keys
    var seen = {};
    fields.forEach(function (row) { if (row && typeof row === "object") Object.keys(row).forEach(function (k) { seen[k] = true; }); });
    var keys = Object.keys(seen);
    if (!keys.length) return arr ? "List<Any>" : "Object";

    var fieldLines = [];
    keys.forEach(function (k, i) {
      var sampleVal = null, found = false;
      for (var j = 0; j < fields.length; j++) {
        if (fields[j] && fields[j][k] !== undefined) { sampleVal = fields[j][k]; found = true; break; }
      }
      var type;
      if (!found || sampleVal === null) type = "String?";
      else if (Array.isArray(sampleVal)) type = kotlinArrayType(name + toPascal(k), sampleVal, classes, depth);
      else if (typeof sampleVal === "object") {
        var nestedName = name + toPascal(k);
        buildKotlinClass(nestedName, sampleVal, classes, depth + 1);
        type = nestedName;
      } else type = kotlinScalarType(sampleVal);
      fieldLines.push("    val " + toCamel(k) + ": " + type + (i === 0 ? " = null" : ""));
    });

    if (arr) {
      // define element class, then list wrapper uses it
      var elemName = name + "Item";
      classes.unshift(buildDataClassString(elemName, fieldLines));
      return "List<" + elemName + ">";
    }
    classes.unshift(buildDataClassString(name, fieldLines));
    return name;
  }

  function buildDataClassString(name, fieldLines) {
    return "data class " + name + "(\n" + fieldLines.join(",\n") + "\n)";
  }

  function kotlinArrayType(key, arr, classes, depth) {
    if (!arr.length) return "List<Any>";
    var first = arr[0];
    if (Array.isArray(first)) return "List<List<Any>>";
    if (first !== null && typeof first === "object") {
      buildKotlinClass(key + "Item", first, classes, depth + 1);
      return "List<" + key + "Item>";
    }
    return "List<" + kotlinScalarType(first) + ">";
  }

  function kotlinScalarType(v) {
    if (v === null) return "String?";
    switch (typeof v) {
      case "string": return "String";
      case "number": return Number.isInteger(v) ? "Int" : "Double";
      case "boolean": return "Boolean";
      default: return "Any";
    }
  }

  // ── JSON → Java POJO ──
  function jsonToJava(obj) {
    var classes = [];
    buildJavaClass("Root", obj, classes, 0);
    return classes.join("\n\n");
  }

  function buildJavaClass(name, obj, classes, depth) {
    if (obj === null || typeof obj !== "object") return javaScalarType(obj);
    var arr = Array.isArray(obj);
    var fields = arr ? obj : [obj];
    var seen = {};
    fields.forEach(function (row) { if (row && typeof row === "object") Object.keys(row).forEach(function (k) { seen[k] = true; }); });
    var keys = Object.keys(seen);
    if (!keys.length) return arr ? "List<Object>" : "Object";

    var decls = [], getters = [];
    keys.forEach(function (k) {
      var sampleVal = null, found = false;
      for (var j = 0; j < fields.length; j++) {
        if (fields[j] && fields[j][k] !== undefined) { sampleVal = fields[j][k]; found = true; break; }
      }
      var type;
      if (!found || sampleVal === null) type = "String";
      else if (Array.isArray(sampleVal)) type = javaArrayType(name + toPascal(k), sampleVal, classes, depth);
      else if (typeof sampleVal === "object") {
        var nestedName = name + toPascal(k);
        buildJavaClass(nestedName, sampleVal, classes, depth + 1);
        type = nestedName;
      } else type = javaScalarType(sampleVal);
      var camel = toCamel(k), Pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
      decls.push("    private " + type + " " + camel + ";");
      getters.push("    public " + type + " get" + Pascal + "() { return " + camel + "; }");
      getters.push("    public void set" + Pascal + "(" + type + " " + camel + ") { this." + camel + " = " + camel + "; }");
    });

    if (arr) {
      var elemName = name + "Item";
      classes.unshift(javaClassString(elemName, decls, getters));
      return "List<" + elemName + ">";
    }
    classes.unshift(javaClassString(name, decls, getters));
    return name;
  }

  function javaClassString(name, decls, getters) {
    return "public class " + name + " {\n" + decls.join("\n") + "\n\n" + getters.join("\n") + "\n}";
  }

  function javaArrayType(key, arr, classes, depth) {
    if (!arr.length) return "List<Object>";
    var first = arr[0];
    if (Array.isArray(first)) return "List<List<Object>>";
    if (first !== null && typeof first === "object") {
      buildJavaClass(key + "Item", first, classes, depth + 1);
      return "List<" + key + "Item>";
    }
    return "List<" + javaScalarType(first) + ">";
  }

  function javaScalarType(v) {
    if (v === null) return "String";
    switch (typeof v) {
      case "string": return "String";
      case "number": return Number.isInteger(v) ? "int" : "double";
      case "boolean": return "boolean";
      default: return "Object";
    }
  }

  // ── JSON → Go struct ──
  function jsonToGo(obj) {
    var structs = [];
    buildGoStruct("Root", obj, structs, 0);
    return structs.join("\n\n");
  }

  function buildGoStruct(name, obj, structs, depth) {
    if (obj === null || typeof obj !== "object") return goScalarType(obj);
    var arr = Array.isArray(obj);
    var fields = arr ? obj : [obj];
    var seen = {};
    fields.forEach(function (row) { if (row && typeof row === "object") Object.keys(row).forEach(function (k) { seen[k] = true; }); });
    var keys = Object.keys(seen);
    if (!keys.length) return arr ? "[]interface{}" : "struct{}";

    var fieldLines = [];
    keys.forEach(function (k) {
      var sampleVal = null, found = false;
      for (var j = 0; j < fields.length; j++) {
        if (fields[j] && fields[j][k] !== undefined) { sampleVal = fields[j][k]; found = true; break; }
      }
      var type;
      if (!found || sampleVal === null) type = "string";
      else if (Array.isArray(sampleVal)) type = goArrayType(name + toPascal(k), sampleVal, structs, depth);
      else if (typeof sampleVal === "object") {
        var nestedName = name + toPascal(k);
        buildGoStruct(nestedName, sampleVal, structs, depth + 1);
        type = nestedName;
      } else type = goScalarType(sampleVal);
      fieldLines.push("    " + toPascal(k) + " " + type + ' `json:"' + k + '"`');
    });

    if (arr) {
      var elemName = name + "Item";
      structs.unshift(goStructString(elemName, fieldLines));
      return "[]" + elemName;
    }
    structs.unshift(goStructString(name, fieldLines));
    return name;
  }

  function goStructString(name, fieldLines) {
    return "type " + name + " struct {\n" + fieldLines.join("\n") + "\n}";
  }

  function goArrayType(key, arr, structs, depth) {
    if (!arr.length) return "[]interface{}";
    var first = arr[0];
    if (Array.isArray(first)) return "[][]interface{}";
    if (first !== null && typeof first === "object") {
      buildGoStruct(key + "Item", first, structs, depth + 1);
      return "[]" + key + "Item";
    }
    return "[]" + goScalarType(first);
  }

  function goScalarType(v) {
    if (v === null) return "string";
    switch (typeof v) {
      case "string": return "string";
      case "number": return Number.isInteger(v) ? "int" : "float64";
      case "boolean": return "bool";
      default: return "interface{}";
    }
  }

  // ── helpers ──

  function toCamel(s) { return s.replace(/[_-](.)/g, function (_, c) { return c.toUpperCase(); }); }
  function toPascal(s) { var c = toCamel(s); return c.charAt(0).toUpperCase() + c.slice(1); }

  function escapeHtml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function escapeXml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }

  function renderHistory() {
    var list = loadHistory();
    var el = document.getElementById("json-history");
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
        formatJson();
      });
    });
  }

  return { init: init };
})();
