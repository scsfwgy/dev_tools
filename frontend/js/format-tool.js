// Format Tool — pretty-print HTML/CSS/JS/TS/JSON/YAML/XML/Markdown via Prettier standalone (browser).
var FormatTool = (function () {
  var PRETTIER_CDN = "https://cdn.jsdelivr.net/npm/prettier@3.3.3/standalone.js";
  var PARSER_CDNS = {
    babel: "https://cdn.jsdelivr.net/npm/prettier@3.3.3/plugins/babel.js",
    typescript: "https://cdn.jsdelivr.net/npm/prettier@3.3.3/plugins/typescript.js",
    estree: "https://cdn.jsdelivr.net/npm/prettier@3.3.3/plugins/estree.js",
    html: "https://cdn.jsdelivr.net/npm/prettier@3.3.3/plugins/html.js",
    css: "https://cdn.jsdelivr.net/npm/prettier@3.3.3/plugins/postcss.js",
    yaml: "https://cdn.jsdelivr.net/npm/prettier@3.3.3/plugins/yaml.js",
    markdown: "https://cdn.jsdelivr.net/npm/prettier@3.3.3/plugins/markdown.js",
  };
  var _loaded = false;
  var _loading = null;
  var splitRatio = 0.5;

  function t(key) { return (window.__t && window.__t(key)) || key; }

  // ponytail: load Prettier standalone + plugins lazily on first format, cached after
  function ensureLoaded() {
    if (_loaded) return Promise.resolve();
    if (_loading) return _loading;
    var urls = [PRETTIER_CDN, PARSER_CDNS.babel, PARSER_CDNS.typescript, PARSER_CDNS.estree, PARSER_CDNS.html, PARSER_CDNS.css, PARSER_CDNS.yaml, PARSER_CDNS.markdown];
    _loading = urls.reduce(function (p, url) {
      return p.then(function () {
        return new Promise(function (resolve, reject) {
          if (document.querySelector('script[src="' + url + '"]')) return resolve();
          var s = document.createElement("script");
          s.src = url;
          s.onload = resolve;
          s.onerror = function () { reject(new Error("Failed to load " + url)); };
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
    _loading = _loading.then(function () { _loaded = true; }).catch(function (e) { _loading = null; throw e; });
    return _loading;
  }

  function init(parent) {
    parent.innerHTML =
      '<div class="json-tool">' +
      '  <div class="json-toolbar">' +
      '    <select id="fmt-lang" class="settings-select" style="width:auto">' +
      '      <option value="json">JSON</option>' +
      '      <option value="html">HTML</option>' +
      '      <option value="css">CSS</option>' +
      '      <option value="babel">JavaScript</option>' +
      '      <option value="typescript">TypeScript</option>' +
      '      <option value="yaml">YAML</option>' +
      '      <option value="markdown">Markdown</option>' +
      '      <option value="xml">XML</option>' +
      '    </select>' +
      '    <button id="fmt-go" class="jt-btn jt-btn-primary">' + t("format.formatBtn") + '</button>' +
      '    <button id="fmt-copy" class="jt-btn">' + t("format.copy") + '</button>' +
      '    <span id="fmt-msg" class="jt-msg"></span>' +
      '  </div>' +
      '  <div class="json-panes">' +
      '    <div class="json-pane json-pane-left"><textarea id="fmt-input" class="jt-editor" placeholder="' + t("format.placeholder") + '"></textarea></div>' +
      '    <div id="fmt-resizer" class="jt-resizer"></div>' +
      '    <div class="json-pane json-pane-right"><textarea id="fmt-output" class="jt-editor" readonly placeholder="' + t("format.outputPlaceholder") + '"></textarea></div>' +
      '  </div>' +
      '</div>';

    var input = document.getElementById("fmt-input");
    var output = document.getElementById("fmt-output");
    var leftPane = parent.querySelector(".json-pane-left");
    var rightPane = parent.querySelector(".json-pane-right");
    var resizer = document.getElementById("fmt-resizer");

    function applySplit() {
      leftPane.style.flex = "0 0 " + (splitRatio * 100) + "%";
      rightPane.style.flex = "0 0 " + ((1 - splitRatio) * 100) + "%";
    }
    applySplit();

    resizer.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var panes = parent.querySelector(".json-panes");
      var startX = e.clientX, startRatio = splitRatio, w = panes.getBoundingClientRect().width;
      function onMove(ev) { splitRatio = Math.max(0.2, Math.min(0.8, startRatio + (ev.clientX - startX) / w)); applySplit(); }
      function onUp() { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; }
      document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
    });

    function setMsg(text, isError) {
      var el = document.getElementById("fmt-msg");
      el.textContent = text;
      el.className = "jt-msg" + (isError ? " jt-msg-error" : " jt-msg-ok");
    }

    function doFormat() {
      var raw = input.value;
      var lang = document.getElementById("fmt-lang").value;
      if (!raw.trim()) { output.value = ""; setMsg("", false); return; }
      setMsg(t("format.loading"), false);
      ensureLoaded().then(function () {
        return formatWith(lang, raw);  // prettier.format returns a Promise in v3
      }).then(function (formatted) {
        output.value = formatted;
        setMsg("✓ " + t("format.done"), false);
      }).catch(function (e) {
        setMsg("✗ " + (e.message || e), true);
        output.value = "";
      });
    }

    document.getElementById("fmt-go").addEventListener("click", doFormat);
    document.getElementById("fmt-copy").addEventListener("click", function () {
      if (output.value) navigator.clipboard.writeText(output.value).then(function () { setMsg("✓ " + t("format.copied"), false); });
    });
    // Ctrl/Cmd+Enter to format
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doFormat(); } });
    // auto-detect language on paste (not on every keystroke — paste is the strong signal)
    input.addEventListener("paste", function () {
      setTimeout(function () {
        var detected = detectLang(input.value);
        if (detected) {
          document.getElementById("fmt-lang").value = detected;
          setMsg("✓ 已识别为 " + detected.toUpperCase(), false);
          setTimeout(function () { setMsg("", false); }, 1500);
        }
      }, 0);
    });
  }

  // ponytail: heuristic language detection from content shape. Confident signals only — ambiguous stays as-is.
  function detectLang(raw) {
    var s = raw.trim();
    if (!s) return null;
    if (/^<\?xml/.test(s)) return "xml";
    if (/^<!DOCTYPE\s+html/i.test(s) || (/^<html/i.test(s) && /<\/html>/i.test(s))) return "html";
    if (/^<[^!?][^>]*>/.test(s) && /<\/[^>]+>/.test(s) && !/[{};]/.test(s.substring(0, 50))) return "xml";
    // JSON: starts with { or [, parses as JSON
    if (/^[[{]/.test(s)) { try { JSON.parse(s); return "json"; } catch (e) {} }
    // YAML: document marker or key: value lines with indentation, no semicolons/braces
    if (/^---\s*\n/.test(s) || (/^[a-zA-Z_][\w-]*:\s/m.test(s) && !/[{};]/.test(s) && /^\S.*:\s*$/m.test(s) && !/function|const|let|var/.test(s))) return "yaml";
    // CSS: has selectors + { property: value }
    if (/[.#][a-zA-Z][\w-]*\s*\{[^}]*:[^}]+;?/.test(s) || /@media|@keyframes|@import/.test(s)) return "css";
    // TypeScript: has type annotations
    if (/\b(interface|type|enum)\s+\w+|:\s*(string|number|boolean|any|void)\b|<\w+>/.test(s) && /\b(function|const|let|=>|class)\b/.test(s)) return "typescript";
    // JavaScript
    if (/\b(function|const|let|var|=>|class|import|export)\b/.test(s)) return "babel";
    return null;
  }

  function formatWith(lang, raw) {
    var prettier = window.prettier;
    if (lang === "json") {
      // ponytail: Prettier collapses short objects onto one line; JSON tools convention is full expand → use native stringify
      return Promise.resolve(JSON.stringify(JSON.parse(raw), null, 2));
    }
    if (lang === "xml") {
      // ponytail: no Prettier XML plugin for browser — use self-contained indent pretty-printer
      return Promise.resolve(prettyXml(raw));
    }
    // prettier plugin parser names
    var opts = { parser: lang, plugins: getPrettierPlugins(), printWidth: 100, tabWidth: 2 };
    if (lang === "babel" || lang === "typescript") {
      opts.semi = true;
      opts.singleQuote = false;
    }
    return Promise.resolve(prettier.format(raw, opts));
  }

  function getPrettierPlugins() {
    // window-level plugin objects injected by CDN scripts
    return {
      babel: window.prettierPlugins && window.prettierPlugins.babel,
      typescript: window.prettierPlugins && window.prettierPlugins.typescript,
      estree: window.prettierPlugins && window.prettierPlugins.estree,
      html: window.prettierPlugins && window.prettierPlugins.html,
      postcss: window.prettierPlugins && window.prettierPlugins.postcss,
      yaml: window.prettierPlugins && window.prettierPlugins.yaml,
      markdown: window.prettierPlugins && window.prettierPlugins.markdown,
    };
  }

  // ponytail: fallback simple XML pretty-printer (indent by tag depth) when @prettier/sync unavailable
  function prettyXml(xml) {
    var PAD = "  ";
    var reg = /(>)(<)(\/*)/g;
    var xml0 = xml.replace(reg, "$1\n$2$3").trim();
    var lines = xml0.split("\n");
    var indent = 0, out = [];
    lines.forEach(function (line) {
      if (/^<\/\w/.test(line)) indent--;
      out.push(PAD.repeat(Math.max(0, indent)) + line);
      if (/^<\w[^>]*[^/]>.*$/.test(line) && !/^<\?xml/.test(line) && !/<\/.*>/.test(line) && !/\/>$/.test(line)) indent++;
    });
    return out.join("\n");
  }

  return { init: init };
})();
