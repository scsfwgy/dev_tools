// File Converter — lightweight, local-only document conversion with lazy-loaded format libraries.
var ConverterTool = (function () {
  var HISTORY_KEY = "converter_history";
  var MAX_HISTORY = 15;
  var MAX_FILE_SIZE = 20 * 1024 * 1024;
  var MAMMOTH_URL = "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js";
  var XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  var MARKED_URL = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
  var HTML2PDF_URL = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";
  var YAML_URL = "https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js";
  var scripts = {};
  var selectedFile = null;
  var sourceType = "";
  var outputBlob = null;
  var outputExtension = "";
  var pdfReady = false;
  var conversionId = 0;

  var ROUTES = {
    txt: ["html", "md", "pdf"],
    html: ["txt", "md", "pdf"],
    md: ["html", "txt", "pdf"],
    csv: ["json", "html", "xlsx"],
    xlsx: ["csv", "html"],
    docx: ["html", "txt"],
    json: ["csv", "yaml", "xml"],
    yaml: ["json"],
    xml: ["json"]
  };

  function t(key) { return (window.__t && window.__t(key)) || key; }
  function byId(id) { return document.getElementById(id); }

  function init(parent) {
    selectedFile = null;
    outputBlob = null;
    parent.innerHTML =
      '<div class="converter-tool">' +
      '  <div class="converter-head"><h2>' + t("converter.title") + '</h2><p>' + t("converter.subtitle") + '</p>' +
      '    <div class="converter-routes"><strong>' + t("converter.supportedRoutes") + '</strong><div class="converter-route-list">' + renderSupportedRoutes() + '</div></div>' +
      '    <details class="converter-compat"><summary>' + t("converter.compatibility") + '</summary>' + renderCompatibilityMatrix() + '</details>' +
      '    <div class="converter-examples"><strong>' + t("converter.examples") + '</strong><button class="jt-btn" data-converter-example="json">JSON → YAML</button><button class="jt-btn" data-converter-example="csv-json">CSV → JSON</button><button class="jt-btn" data-converter-example="md">Markdown → PDF</button><button class="jt-btn" data-converter-example="csv">CSV → XLSX</button><button class="jt-btn" data-converter-example="html">HTML → PDF</button></div>' +
      '  </div>' +
      '  <div id="converter-dropzone" class="converter-dropzone">' +
      '    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 15h8M12 11v8"/></svg>' +
      '    <strong>' + t("converter.dropTitle") + '</strong><span>' + t("converter.supported") + '</span>' +
      '    <label class="jt-btn jt-btn-primary">' + t("converter.chooseFile") + '<input id="converter-file" type="file" accept=".txt,.html,.htm,.md,.markdown,.csv,.xlsx,.docx,.json,.yaml,.yml,.xml" hidden></label>' +
      '    <span id="converter-drop-message" class="image-error"></span>' +
      '  </div>' +
      '  <div id="converter-workspace" class="converter-workspace hidden">' +
      '    <div class="converter-toolbar">' +
      '      <div class="converter-file"><strong id="converter-name"></strong><span id="converter-info"></span></div>' +
      '      <div class="converter-arrow">→</div>' +
      '      <label><span>' + t("converter.outputFormat") + '</span><select id="converter-target" class="settings-select"></select></label>' +
      '      <button id="converter-run" class="jt-btn jt-btn-primary">' + t("converter.convert") + '</button>' +
      '      <button id="converter-cancel" class="jt-btn hidden">' + t("converter.cancel") + '</button><button id="converter-reset" class="jt-btn">' + t("converter.reset") + '</button>' +
      '    </div>' +
      '    <div class="converter-memory-note">' + t("converter.memoryNote") + '</div><progress id="converter-progress" class="converter-progress hidden" max="100" value="0"></progress>' +
      '    <div id="converter-status" class="converter-status"></div>' +
      '    <div class="converter-preview-head"><strong>' + t("converter.preview") + '</strong><button id="converter-download" class="jt-btn" disabled>' + t("converter.download") + '</button></div>' +
      '    <iframe id="converter-preview" class="converter-preview" sandbox=""></iframe>' +
      '    <div id="converter-pdf-preview" class="converter-pdf-preview hidden"></div>' +
      '  </div>' +
      '  <div id="converter-history" class="history-bar"></div>' +
      '</div>';
    bindEvents();
    renderHistory();
    var requestedExample = { "markdown-to-pdf": "md", "csv-to-xlsx": "csv" }[window.__toolSubpage];
    if (requestedExample) loadExample(requestedExample);
  }

  function bindEvents() {
    var dropzone = byId("converter-dropzone");
    dropzone.addEventListener("dragover", function (event) { event.preventDefault(); dropzone.classList.add("dragover"); });
    dropzone.addEventListener("dragleave", function () { dropzone.classList.remove("dragover"); });
    dropzone.addEventListener("drop", function (event) { event.preventDefault(); dropzone.classList.remove("dragover"); handleFile(event.dataTransfer.files[0]); });
    byId("converter-file").addEventListener("change", function () { handleFile(this.files[0]); });
    byId("converter-run").addEventListener("click", convert);
    byId("converter-reset").addEventListener("click", reset);
    byId("converter-download").addEventListener("click", download);
    byId("converter-cancel").addEventListener("click", function () { conversionId++; byId("converter-status").textContent = t("converter.cancelled"); finishConversionUi(); });
    document.querySelectorAll("[data-converter-example]").forEach(function (button) { button.addEventListener("click", function () { loadExample(this.dataset.converterExample); }); });
  }

  function renderCompatibilityMatrix() {
    var rows = [
      ["JSON ↔ YAML", "structured", "comments"], ["JSON → CSV", "tabular", "nested"], ["CSV → JSON", "csvValues", "csvTypes"],
      ["JSON ↔ XML", "xmlStructure", "xmlConventions"], ["TXT → HTML/PDF", "plainText", "formatting"], ["TXT → Markdown", "plainText", "semantics"],
      ["HTML → TXT/Markdown", "visibleText", "complexHtml"], ["HTML → PDF", "rendered", "pagination"], ["Markdown → HTML/TXT/PDF", "markdown", "customSyntax"],
      ["CSV ↔ XLSX/HTML", "tableValues", "spreadsheetFeatures"], ["XLSX → CSV/HTML", "firstSheet", "multipleSheets"], ["DOCX → HTML/TXT", "documentBody", "complexDocx"]
    ];
    rows = rows.map(function (row) { return [row[0], t("converter.compatibilityValues." + row[1]), t("converter.compatibilityValues." + row[2])]; });
    return '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("converter.route") + '</th><th>' + t("converter.preserved") + '</th><th>' + t("converter.mayLose") + '</th></tr></thead><tbody>' + rows.map(function (row) { return '<tr><td><code>' + row[0] + '</code></td><td>' + row[1] + '</td><td>' + row[2] + '</td></tr>'; }).join("") + '</tbody></table></div>';
  }

  function loadExample(type) {
    var examples = { json: ["example.json", '{\n  "tools": [\n    { "name": "JSON", "local": true },\n    { "name": "Translate", "local": false }\n  ]\n}', "application/json"], "csv-json": ["example.csv", "name,category,local\nJSON,Developer,true\nTranslate,AI,false", "text/csv"], md: ["example.md", "# Tools24\n\n- Local processing\n- Markdown to PDF", "text/markdown"], csv: ["example.csv", "name,category,local\nJSON,Developer,true\nTranslate,AI,false", "text/csv"], html: ["example.html", "<h1>Tools24</h1><p>Local-first developer tools.</p>", "text/html"] };
    var example = examples[type];
    handleFile(new File([example[1]], example[0], { type: example[2] }));
    byId("converter-target").value = type === "json" ? "yaml" : type === "csv-json" ? "json" : type === "csv" ? "xlsx" : "pdf";
  }

  function renderSupportedRoutes() {
    return Object.keys(ROUTES).map(function (from) {
      return ROUTES[from].map(function (to) {
        return '<span>' + from.toUpperCase() + ' <b>→</b> ' + to.toUpperCase() + '</span>';
      }).join("");
    }).join("");
  }

  function handleFile(file) {
    if (!file) return;
    var type = detectType(file.name);
    if (!ROUTES[type]) { showDropError(t("converter.unsupported")); return; }
    if (file.size > MAX_FILE_SIZE) { showDropError(t("converter.tooLarge")); return; }
    selectedFile = file;
    sourceType = type;
    outputBlob = null;
    byId("converter-name").textContent = file.name;
    byId("converter-info").textContent = type.toUpperCase() + " · " + formatBytes(file.size);
    byId("converter-target").innerHTML = ROUTES[type].map(function (target) { return '<option value="' + target + '">' + target.toUpperCase() + '</option>'; }).join("");
    byId("converter-dropzone").classList.add("hidden");
    byId("converter-workspace").classList.remove("hidden");
    byId("converter-preview").srcdoc = emptyPreview();
    resetResult();
  }

  async function convert() {
    if (!selectedFile) return;
    var target = byId("converter-target").value;
    var button = byId("converter-run");
    button.disabled = true;
    button.textContent = t("converter.converting");
    var currentConversion = ++conversionId;
    byId("converter-cancel").classList.remove("hidden");
    byId("converter-progress").classList.remove("hidden");
    byId("converter-progress").value = 15;
    resetResult();
    try {
      var result = await convertRoute(selectedFile, sourceType, target);
      if (currentConversion !== conversionId) return;
      byId("converter-progress").value = 75;
      if (target === "pdf") {
        preparePdf(result.html);
      } else {
        outputBlob = new Blob([result.content], { type: result.mime + ";charset=utf-8" });
        outputExtension = target;
        showPreview(result.previewHtml || textPreview(result.content));
      }
      byId("converter-download").disabled = false;
      byId("converter-status").textContent = t("converter.done") + (outputBlob ? " · " + formatBytes(outputBlob.size) : "");
      saveHistory(selectedFile.name, sourceType, target, outputBlob ? outputBlob.size : 0);
      renderHistory();
      byId("converter-progress").value = 100;
    } catch (error) {
      byId("converter-status").textContent = t("converter.failed") + ": " + (error.message || error);
      byId("converter-status").classList.add("error");
    } finally {
      finishConversionUi();
    }
  }

  function finishConversionUi() { byId("converter-run").disabled = false; byId("converter-run").textContent = t("converter.convert"); byId("converter-cancel").classList.add("hidden"); setTimeout(function () { byId("converter-progress").classList.add("hidden"); }, 500); }

  async function convertRoute(file, from, to) {
    if (from === "docx") return convertDocx(file, to);
    if (from === "xlsx") return convertXlsx(file, to);
    if (from === "csv" && to === "xlsx") return convertCsvToXlsx(file);
    var text = await file.text();
    if (from === "json") return convertJson(text, to);
    if (from === "yaml" && to === "json") return convertYamlToJson(text);
    if (from === "xml" && to === "json") return convertXmlToJson(text);
    if (from === "csv" && to === "json") return convertCsvToJson(text);
    if (from === "txt" && to === "md") return textResult(text, "text/markdown", textPreview(text));
    if (from === "txt" && (to === "html" || to === "pdf")) {
      var txtHtml = '<pre style="white-space:pre-wrap;word-break:break-word">' + escapeHtml(text) + '</pre>';
      return htmlResult(txtHtml);
    }
    if (from === "html" && to === "txt") return textResult(htmlToText(text), "text/plain");
    if (from === "html" && to === "md") return textResult(htmlToMarkdown(text), "text/markdown");
    if (from === "html" && to === "pdf") return htmlResult(text);
    if (from === "md") {
      await ensureScript("marked", MARKED_URL);
      var markdownHtml = window.marked.parse(text);
      if (to === "html" || to === "pdf") return htmlResult(markdownHtml);
      if (to === "txt") return textResult(htmlToText(markdownHtml), "text/plain");
    }
    if (from === "csv" && to === "html") return csvToHtml(text);
    throw new Error(t("converter.unsupportedRoute"));
  }

  async function convertDocx(file, target) {
    await ensureScript("mammoth", MAMMOTH_URL);
    var buffer = await file.arrayBuffer();
    if (target === "html") {
      var html = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
      return htmlResult(html.value);
    }
    var text = await window.mammoth.extractRawText({ arrayBuffer: buffer });
    return textResult(text.value, "text/plain");
  }

  async function convertXlsx(file, target) {
    await ensureScript("XLSX", XLSX_URL);
    var workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    var sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (target === "csv") return textResult(window.XLSX.utils.sheet_to_csv(sheet), "text/csv");
    var html = window.XLSX.utils.sheet_to_html(sheet);
    return htmlResult(html);
  }

  async function convertCsvToXlsx(file) {
    await ensureScript("XLSX", XLSX_URL);
    var workbook = window.XLSX.read(await file.text(), { type: "string" });
    var array = window.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    return { content: array, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", previewHtml: textPreview(t("converter.binaryPreview")) };
  }

  function csvToHtml(csv) {
    var rows = parseCsv(csv);
    var html = '<table><tbody>' + rows.map(function (row, rowIndex) {
      var tag = rowIndex === 0 ? "th" : "td";
      return '<tr>' + row.map(function (cell) { return '<' + tag + '>' + escapeHtml(cell) + '</' + tag + '>'; }).join("") + '</tr>';
    }).join("") + '</tbody></table>';
    return htmlResult(html);
  }

  function convertJson(text, target) {
    var value;
    try { value = JSON.parse(text); } catch (error) { throw new Error(t("converter.invalidJson") + formatParseError(error)); }
    if (target === "csv") return textResult(jsonToCsv(value), "text/csv");
    if (target === "xml") return textResult(jsonToXml(value), "application/xml");
    if (target === "yaml") {
      return ensureScript("jsyaml", YAML_URL).then(function () {
        return textResult(window.jsyaml.dump(value, { noRefs: true, lineWidth: 120 }), "application/yaml");
      });
    }
    throw new Error(t("converter.unsupportedRoute"));
  }

  async function convertYamlToJson(text) {
    await ensureScript("jsyaml", YAML_URL);
    var value;
    try { value = window.jsyaml.load(text); } catch (error) { throw new Error(t("converter.invalidYaml") + formatParseError(error)); }
    return jsonResult(value);
  }

  function convertCsvToJson(text) {
    var rows = parseCsv(text.replace(/^\uFEFF/, ""));
    if (!rows.length || !rows[0].length || rows[0].every(function (header) { return !header.trim(); })) throw new Error(t("converter.invalidCsv"));
    var headers = rows.shift().map(function (header, index) { return header.trim() || (t("converter.column") + (index + 1)); });
    var values = rows.filter(function (row) { return row.some(function (cell) { return cell !== ""; }); }).map(function (row) {
      var item = {};
      headers.forEach(function (header, index) { item[header] = row[index] === undefined ? "" : row[index]; });
      return item;
    });
    return jsonResult(values);
  }

  function jsonToCsv(value) {
    var rows = Array.isArray(value) ? value : [value];
    if (!rows.length) return "";
    if (rows.some(function (row) { return !row || typeof row !== "object" || Array.isArray(row); })) throw new Error(t("converter.jsonTabularOnly"));
    var flattened = rows.map(flattenObject);
    var headers = [];
    flattened.forEach(function (row) { Object.keys(row).forEach(function (key) { if (headers.indexOf(key) === -1) headers.push(key); }); });
    if (!headers.length) throw new Error(t("converter.jsonTabularOnly"));
    return [headers.map(csvCell).join(",")].concat(flattened.map(function (row) {
      return headers.map(function (header) { return csvCell(row[header] === undefined ? "" : row[header]); }).join(",");
    })).join("\r\n");
  }

  function flattenObject(value, prefix, result) {
    result = result || {};
    Object.keys(value).forEach(function (key) {
      var path = prefix ? prefix + "." + key : key;
      var child = value[key];
      if (child && typeof child === "object" && !Array.isArray(child)) flattenObject(child, path, result);
      else result[path] = child === null ? "" : Array.isArray(child) ? JSON.stringify(child) : child;
    });
    return result;
  }

  function csvCell(value) {
    var text = String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function convertXmlToJson(text) {
    var xml = new DOMParser().parseFromString(text, "application/xml");
    if (xml.querySelector("parsererror") || !xml.documentElement) throw new Error(t("converter.invalidXml"));
    var result = {};
    result[xml.documentElement.nodeName] = xmlNodeToValue(xml.documentElement);
    return jsonResult(result);
  }

  function xmlNodeToValue(node) {
    var result = {};
    Array.from(node.attributes || []).forEach(function (attribute) { result["@" + attribute.name] = attribute.value; });
    var children = Array.from(node.children || []);
    var text = Array.from(node.childNodes).filter(function (child) { return child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE; }).map(function (child) { return child.nodeValue; }).join("").trim();
    children.forEach(function (child) {
      var value = xmlNodeToValue(child);
      if (Object.prototype.hasOwnProperty.call(result, child.nodeName)) {
        if (!Array.isArray(result[child.nodeName])) result[child.nodeName] = [result[child.nodeName]];
        result[child.nodeName].push(value);
      } else result[child.nodeName] = value;
    });
    if (text && (children.length || node.attributes.length)) result["#text"] = text;
    else if (text) return text;
    return Object.keys(result).length ? result : "";
  }

  function jsonToXml(value) {
    var rootName = "root";
    var rootValue = value;
    if (value && !Array.isArray(value) && typeof value === "object") {
      var keys = Object.keys(value);
      if (keys.length === 1 && isXmlName(keys[0]) && keys[0][0] !== "@" && keys[0] !== "#text") { rootName = keys[0]; rootValue = value[rootName]; }
    }
    if (Array.isArray(rootValue)) rootValue = { item: rootValue };
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + buildXmlElement(rootName, rootValue, 0);
  }

  function buildXmlElement(name, value, depth) {
    if (!isXmlName(name)) throw new Error(t("converter.invalidXmlKey") + ": " + name);
    var indent = "  ".repeat(depth);
    if (Array.isArray(value)) return value.map(function (item) { return buildXmlElement(name, item, depth); }).join("\n");
    if (value === null || value === undefined) return indent + "<" + name + "/>";
    if (typeof value !== "object") return indent + "<" + name + ">" + escapeXml(value) + "</" + name + ">";
    var attributes = "";
    Object.keys(value).filter(function (key) { return key[0] === "@"; }).forEach(function (key) {
      var attributeName = key.slice(1);
      if (!isXmlName(attributeName)) throw new Error(t("converter.invalidXmlKey") + ": " + attributeName);
      attributes += " " + attributeName + '=\"' + escapeXml(value[key]) + '\"';
    });
    var content = value["#text"] === undefined ? "" : escapeXml(value["#text"]);
    var childXml = [];
    Object.keys(value).filter(function (key) { return key[0] !== "@" && key !== "#text"; }).forEach(function (key) {
      var childValue = value[key];
      if (Array.isArray(childValue)) childValue.forEach(function (item) { childXml.push(buildXmlElement(key, item, depth + 1)); });
      else childXml.push(buildXmlElement(key, childValue, depth + 1));
    });
    if (!content && !childXml.length) return indent + "<" + name + attributes + "/>";
    if (!childXml.length) return indent + "<" + name + attributes + ">" + content + "</" + name + ">";
    return indent + "<" + name + attributes + ">" + content + "\n" + childXml.join("\n") + "\n" + indent + "</" + name + ">";
  }

  function isXmlName(value) { return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value); }
  function escapeXml(value) { return String(value).replace(/[&<>"']/g, function (character) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]; }); }
  function formatParseError(error) { return error && error.message ? ": " + error.message : ""; }
  function jsonResult(value) { var content = JSON.stringify(value === undefined ? null : value, null, 2); return textResult(content, "application/json"); }

  function parseCsv(text) {
    var rows = [], row = [], value = "", quoted = false;
    for (var index = 0; index < text.length; index++) {
      var character = text[index];
      if (quoted && character === '"' && text[index + 1] === '"') { value += '"'; index++; }
      else if (character === '"') quoted = !quoted;
      else if (!quoted && character === ",") { row.push(value); value = ""; }
      else if (!quoted && (character === "\n" || character === "\r")) {
        if (character === "\r" && text[index + 1] === "\n") index++;
        row.push(value); rows.push(row); row = []; value = "";
      } else value += character;
    }
    if (value || row.length) { row.push(value); rows.push(row); }
    return rows;
  }

  function preparePdf(html) {
    pdfReady = true;
    outputExtension = "pdf";
    byId("converter-preview").classList.add("hidden");
    var preview = byId("converter-pdf-preview");
    preview.innerHTML = html;
    preview.classList.remove("hidden");
  }

  function download() {
    if ((!outputBlob && !pdfReady) || !selectedFile) return;
    if (pdfReady) { downloadPdf(); return; }
    var button = byId("converter-download");
    button.disabled = true;
    button.textContent = t("converter.downloading");
    var url = URL.createObjectURL(outputBlob);
    var link = document.createElement("a");
    link.href = url;
    link.download = (selectedFile.name.replace(/\.[^.]+$/, "") || "converted") + "_converted_" + timestampName() + "." + outputExtension;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); button.disabled = false; button.textContent = t("converter.download"); }, 800);
  }

  async function downloadPdf() {
    var button = byId("converter-download");
    button.disabled = true;
    button.textContent = t("converter.downloading");
    await ensureScript("html2pdf", HTML2PDF_URL);
    var filename = (selectedFile.name.replace(/\.[^.]+$/, "") || "converted") + "_converted_" + timestampName() + ".pdf";
    var options = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: function (clonedDocument) {
          var clonedPreview = clonedDocument.getElementById("converter-pdf-preview");
          if (clonedPreview) {
            clonedPreview.style.background = "#ffffff";
            clonedPreview.style.color = "#24292f";
            clonedPreview.style.width = "800px";
            clonedPreview.style.padding = "24px";
          }
        }
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    window.html2pdf().set(options).from(byId("converter-pdf-preview")).save().then(function () {
      button.disabled = false;
      button.textContent = t("converter.download");
    }).catch(function (error) {
      button.disabled = false;
      button.textContent = t("converter.download");
      byId("converter-status").textContent = t("converter.failed") + ": " + (error.message || error);
      byId("converter-status").classList.add("error");
    });
  }

  function htmlToText(html) {
    var documentValue = new DOMParser().parseFromString(html, "text/html");
    return (documentValue.body.innerText || documentValue.body.textContent || "").trim();
  }

  function htmlToMarkdown(html) {
    var documentValue = new DOMParser().parseFromString(html, "text/html");
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      var content = Array.from(node.childNodes).map(walk).join("");
      var tag = node.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) return "\n" + "#".repeat(Number(tag[1])) + " " + content.trim() + "\n\n";
      if (tag === "p" || tag === "div") return "\n" + content.trim() + "\n\n";
      if (tag === "br") return "\n";
      if (tag === "strong" || tag === "b") return "**" + content + "**";
      if (tag === "em" || tag === "i") return "*" + content + "*";
      if (tag === "code") return "`" + content + "`";
      if (tag === "a") return "[" + content + "](" + (node.getAttribute("href") || "") + ")";
      if (tag === "li") return "\n- " + content.trim();
      if (tag === "blockquote") return "\n> " + content.trim().replace(/\n/g, "\n> ") + "\n";
      return content;
    }
    return walk(documentValue.body).replace(/\n{3,}/g, "\n\n").trim();
  }

  function htmlResult(html) { return { content: documentHtml(html), mime: "text/html", html: html, previewHtml: html }; }
  function textResult(content, mime, preview) { return { content: content, mime: mime, previewHtml: preview || textPreview(content) }; }
  function documentHtml(body) { return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;line-height:1.6;padding:24px;max-width:960px;margin:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}img{max-width:100%}</style></head><body>' + body + '</body></html>'; }
  function textPreview(text) { return '<pre style="white-space:pre-wrap;word-break:break-word">' + escapeHtml(String(text)) + '</pre>'; }
  function showPreview(html) { byId("converter-preview").srcdoc = documentHtml(html); }
  function emptyPreview() { return documentHtml('<p style="color:#888">' + escapeHtml(t("converter.emptyPreview")) + '</p>'); }

  function resetResult() {
    outputBlob = null;
    pdfReady = false;
    if (byId("converter-pdf-preview")) {
      byId("converter-pdf-preview").innerHTML = "";
      byId("converter-pdf-preview").classList.add("hidden");
    }
    if (byId("converter-preview")) byId("converter-preview").classList.remove("hidden");
    byId("converter-download").disabled = true;
    byId("converter-download").textContent = t("converter.download");
    byId("converter-status").textContent = "";
    byId("converter-status").classList.remove("error");
  }

  function reset() {
    selectedFile = null;
    resetResult();
    byId("converter-workspace").classList.add("hidden");
    byId("converter-dropzone").classList.remove("hidden");
    byId("converter-file").value = "";
    byId("converter-drop-message").textContent = "";
  }

  function detectType(name) {
    var extension = (name.split(".").pop() || "").toLowerCase();
    if (extension === "htm") return "html";
    if (extension === "markdown") return "md";
    if (extension === "yml") return "yaml";
    return extension;
  }

  function ensureScript(name, url) {
    if (window[name]) return Promise.resolve();
    if (scripts[name]) return scripts[name];
    scripts[name] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = function () { delete scripts[name]; reject(new Error(t("converter.libraryFailed"))); };
      document.head.appendChild(script);
    });
    return scripts[name];
  }

  function showDropError(message) { byId("converter-drop-message").textContent = message; }
  function formatBytes(bytes) { if (bytes < 1024) return bytes + " B"; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"; return (bytes / 1048576).toFixed(2) + " MB"; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, function (character) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]; }); }
  function timestampName() { var date = new Date(); return date.getFullYear() + String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0") + String(date.getHours()).padStart(2, "0") + String(date.getMinutes()).padStart(2, "0") + String(date.getSeconds()).padStart(2, "0") + String(date.getMilliseconds()).padStart(3, "0"); }

  function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (error) { return []; } }
  function saveHistory(name, from, to, size) { var history = loadHistory(); history.unshift({ name: name, from: from, to: to, size: size, time: Date.now() }); localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY))); }
  function renderHistory() { var target = byId("converter-history"); if (!target) return; var history = loadHistory(); target.innerHTML = history.length ? '<span class="history-label">' + t("history.label") + '</span>' + history.map(function (item) { return '<span class="history-item">' + escapeHtml(item.name) + ' · ' + item.from.toUpperCase() + '→' + item.to.toUpperCase() + ' · ' + formatBytes(item.size) + '</span>'; }).join("") : ""; }

  return { init: init };
})();
