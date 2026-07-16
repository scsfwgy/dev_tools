// Data Visualization Tool — local table/JSON parsing with Apache ECharts.
var VisualizationTool = (function () {
  var ECHARTS_URL = "https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js";
  var MAX_ROWS = 5000;
  var MAX_DEPTH = 5;
  var DEBOUNCE_MS = 300;
  var SAMPLE_TABLE_ZH = [
    "月份,收入,成本,订单",
    "1月,128,82,320",
    "2月,156,91,368",
    "3月,142,88,351",
    "4月,189,104,426",
    "5月,218,119,492",
    "6月,246,132,538"
  ].join("\n");
  var SAMPLE_TABLE_EN = [
    "Month,Income,Cost,Orders",
    "Jan,128,82,320",
    "Feb,156,91,368",
    "Mar,142,88,351",
    "Apr,189,104,426",
    "May,218,119,492",
    "Jun,246,132,538"
  ].join("\n");
  var SAMPLE_JSON = JSON.stringify({
    status: "ok",
    data: {
      items: [
        { timestamp: 1767225600, metrics: { income: 128, cost: 82 }, orders: 320 },
        { timestamp: 1767312000, metrics: { income: 156, cost: 91 }, orders: 368 },
        { timestamp: 1767398400, metrics: { income: 142, cost: 88 }, orders: 351 },
        { timestamp: 1767484800, metrics: { income: 189, cost: 104 }, orders: 426 },
        { timestamp: 1767571200, metrics: { income: 218, cost: 119 }, orders: 492 },
        { timestamp: 1767657600, metrics: { income: 246, cost: 132 }, orders: 538 }
      ]
    }
  }, null, 2);

  var root = null;
  var chart = null;
  var dataset = null;
  var activeMode = "table";
  var chartType = "line";
  var xField = "__index";
  var selectedSeries = [];
  var seriesFormats = Object.create(null);
  var customPalette = [];
  var jsonCandidates = [];
  var selectedJsonCandidateId = null;
  var debounceTimer = null;
  var resizeObserver = null;
  var themeObserver = null;
  var resizeHandler = null;
  var keydownHandler = null;
  var echartsPromise = null;

  function t(key) {
    return (window.__t && window.__t(key)) || key;
  }

  function sampleTable() {
    return document.documentElement.lang === "en" ? SAMPLE_TABLE_EN : SAMPLE_TABLE_ZH;
  }

  function tx(key, values) {
    var text = t(key);
    Object.keys(values || {}).forEach(function (name) {
      text = text.replace(new RegExp("\\{" + name + "\\}", "g"), String(values[name]));
    });
    return text;
  }

  function byId(id) {
    return root ? root.querySelector("#" + id) : null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(message, isError) {
    var status = byId("viz-status");
    if (!status) return;
    status.textContent = message || "";
    status.className = "viz-status" + (isError ? " is-error" : "");
  }

  function setChartState(state, message) {
    var loading = byId("viz-loading");
    var failure = byId("viz-failure");
    var empty = byId("viz-empty");
    var chartElement = byId("viz-chart");
    if (!loading || !failure || !empty || !chartElement) return;
    loading.classList.toggle("hidden", state !== "loading");
    failure.classList.toggle("hidden", state !== "failure");
    empty.classList.toggle("hidden", state !== "empty");
    chartElement.classList.toggle("hidden", state !== "ready");
    if (state === "failure") {
      var failureText = byId("viz-failure-text");
      if (failureText) failureText.textContent = message || t("visualization.chartLoadFailed");
    }
  }

  function detectDelimiter(text) {
    var candidates = ["\t", ",", ";"];
    var counts = [0, 0, 0];
    var quoted = false;
    for (var index = 0; index < text.length; index++) {
      var char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') {
          index++;
        } else {
          quoted = !quoted;
        }
        continue;
      }
      if (!quoted && (char === "\n" || char === "\r")) break;
      if (!quoted) {
        var candidateIndex = candidates.indexOf(char);
        if (candidateIndex !== -1) counts[candidateIndex]++;
      }
    }
    var bestIndex = 0;
    for (var countIndex = 1; countIndex < counts.length; countIndex++) {
      if (counts[countIndex] > counts[bestIndex]) bestIndex = countIndex;
    }
    return counts[bestIndex] ? candidates[bestIndex] : ",";
  }

  function parseDelimitedRows(text, delimiter) {
    var rows = [];
    var row = [];
    var cell = "";
    var quoted = false;
    for (var index = 0; index < text.length; index++) {
      var char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && char === delimiter) {
        row.push(cell);
        cell = "";
      } else if (!quoted && (char === "\n" || char === "\r")) {
        if (char === "\r" && text[index + 1] === "\n") index++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    if (quoted) throw new Error(t("visualization.errors.unclosedQuote"));
    row.push(cell);
    rows.push(row);
    return rows.filter(function (values) {
      return values.some(function (value) { return String(value).trim() !== ""; });
    });
  }

  function uniqueHeaders(rawHeaders) {
    var used = Object.create(null);
    return rawHeaders.map(function (raw, index) {
      var base = String(raw).trim() || tx("visualization.generatedColumn", { index: index + 1 });
      var count = (used[base] || 0) + 1;
      used[base] = count;
      return count === 1 ? base : base + " (" + count + ")";
    });
  }

  function parseTable(text) {
    var raw = String(text || "").trim();
    if (!raw) throw new Error(t("visualization.errors.emptyInput"));
    var delimiter = detectDelimiter(raw);
    var parsedRows = parseDelimitedRows(raw, delimiter);
    if (parsedRows.length < 2) throw new Error(t("visualization.errors.needDataRows"));
    var headers = uniqueHeaders(parsedRows[0]);
    var body = parsedRows.slice(1);
    if (body.length > MAX_ROWS) throw new Error(tx("visualization.errors.tooManyRows", { max: MAX_ROWS }));
    var rows = body.map(function (values, index) {
      if (values.length !== headers.length) {
        throw new Error(tx("visualization.errors.columnMismatch", {
          row: index + 2,
          expected: headers.length,
          actual: values.length
        }));
      }
      var item = Object.create(null);
      headers.forEach(function (header, columnIndex) {
        var value = String(values[columnIndex]).trim();
        item[header] = value === "" ? null : value;
      });
      return item;
    });
    return normalizeDataset(rows, headers);
  }

  function flattenObject(value, prefix, depth, output, fields) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      if (prefix) {
        if (fields.indexOf(prefix) === -1) fields.push(prefix);
        output[prefix] = Array.isArray(value) ? JSON.stringify(value) : value;
      }
      return;
    }
    var keys = Object.keys(value);
    if (!keys.length && prefix) {
      if (fields.indexOf(prefix) === -1) fields.push(prefix);
      output[prefix] = "{}";
      return;
    }
    if (depth >= MAX_DEPTH) {
      if (prefix) {
        if (fields.indexOf(prefix) === -1) fields.push(prefix);
        output[prefix] = JSON.stringify(value);
      }
      return;
    }
    keys.forEach(function (key) {
      var path = prefix ? prefix + "." + key : key;
      flattenObject(value[key], path, depth + 1, output, fields);
    });
  }

  function jsonPathLabel(segments) {
    return segments.length ? segments.map(function (segment) {
      return /^[A-Za-z_$][\w$]*$/.test(segment) ? segment : "[" + JSON.stringify(segment) + "]";
    }).join(".").replace(/\.\[/g, "[") : "$";
  }

  function addJsonCandidate(candidates, kind, segments, value, keys) {
    candidates.push({
      id: kind + ":" + JSON.stringify(segments),
      kind: kind,
      segments: segments.slice(),
      label: jsonPathLabel(segments),
      value: value,
      keys: keys || null
    });
  }

  function discoverJsonCandidates(value, segments, depth, candidates) {
    if (depth > MAX_DEPTH || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      if (!value.length) return;
      var objectRows = value.every(function (item) {
        return item && typeof item === "object" && !Array.isArray(item);
      });
      var scalarRows = value.every(function (item) {
        return item === null || typeof item !== "object";
      });
      if (objectRows || scalarRows) addJsonCandidate(candidates, "rows", segments, value);
      return;
    }
    var keys = Object.keys(value);
    var arrayKeys = keys.filter(function (key) { return Array.isArray(value[key]); });
    if (arrayKeys.length >= 2) {
      var length = value[arrayKeys[0]].length;
      if (arrayKeys.every(function (key) { return value[key].length === length; })) {
        addJsonCandidate(candidates, "columns", segments, value, arrayKeys);
      }
    }
    keys.forEach(function (key) {
      var child = value[key];
      if (child && typeof child === "object") {
        discoverJsonCandidates(child, segments.concat(key), depth + 1, candidates);
      }
    });
  }

  function parseJsonSource(text) {
    var raw = String(text || "").trim();
    if (!raw) throw new Error(t("visualization.errors.emptyInput"));
    var value;
    try {
      value = JSON.parse(raw);
    } catch (error) {
      throw new Error(t("visualization.errors.invalidJson") + " " + error.message);
    }
    var candidates = [];
    discoverJsonCandidates(value, [], 0, candidates);
    if (!candidates.length) throw new Error(t("visualization.errors.noJsonArrays"));
    return { value: value, candidates: candidates };
  }

  function rowsFromJsonCandidate(candidate) {
    var sourceRows;
    if (candidate.kind === "columns") {
      var keys = candidate.keys;
      var length = candidate.value[keys[0]].length;
      sourceRows = Array.from({ length: length }, function (_, rowIndex) {
        var row = Object.create(null);
        keys.forEach(function (key) { row[key] = candidate.value[key][rowIndex]; });
        return row;
      });
    } else {
      sourceRows = candidate.value.map(function (item) {
        if (item && typeof item === "object" && !Array.isArray(item)) return item;
        var row = Object.create(null);
        row.value = item;
        return row;
      });
    }
    if (!sourceRows.length) throw new Error(t("visualization.errors.needDataRows"));
    if (sourceRows.length > MAX_ROWS) throw new Error(tx("visualization.errors.tooManyRows", { max: MAX_ROWS }));
    var fields = [];
    var rows = sourceRows.map(function (source) {
      var flattened = Object.create(null);
      flattenObject(source, "", 0, flattened, fields);
      return flattened;
    });
    rows.forEach(function (row) {
      fields.forEach(function (field) {
        if (!Object.prototype.hasOwnProperty.call(row, field)) row[field] = null;
      });
    });
    return normalizeDataset(rows, fields);
  }

  function parseJsonDataset(text, candidateId) {
    var source = parseJsonSource(text);
    var candidate = source.candidates.find(function (item) { return item.id === candidateId; }) || source.candidates[0];
    return rowsFromJsonCandidate(candidate);
  }

  function parseNumber(value) {
    if (typeof value === "number") return isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    var normalized = value.trim();
    if (!normalized) return null;
    if (normalized.endsWith("%")) normalized = normalized.slice(0, -1).trim();
    normalized = normalized.replace(/,/g, "");
    if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(normalized)) return null;
    var number = Number(normalized);
    return isFinite(number) ? number : null;
  }

  function normalizeDataset(rows, fields) {
    if (!fields.length) throw new Error(t("visualization.errors.noFields"));
    var fieldMeta = fields.map(function (field) {
      var nonEmpty = 0;
      var numeric = 0;
      rows.forEach(function (row) {
        var value = row[field];
        if (value === null || value === undefined || String(value).trim() === "") return;
        nonEmpty++;
        if (parseNumber(value) !== null) numeric++;
      });
      return {
        name: field,
        type: nonEmpty > 0 && numeric / nonEmpty >= 0.8 ? "number" : "text",
        emptyCount: rows.length - nonEmpty,
        invalidCount: nonEmpty > 0 && numeric / nonEmpty >= 0.8 ? nonEmpty - numeric : 0
      };
    });
    var numericFields = fieldMeta.filter(function (field) { return field.type === "number"; }).map(function (field) { return field.name; });
    if (!numericFields.length) throw new Error(t("visualization.errors.noNumericFields"));
    var normalizedRows = rows.map(function (row) {
      var normalized = Object.create(null);
      fieldMeta.forEach(function (field) {
        var value = row[field.name];
        if (value === null || value === undefined || String(value).trim() === "") {
          normalized[field.name] = null;
        } else if (field.type === "number") {
          normalized[field.name] = parseNumber(value);
        } else if (typeof value === "object") {
          normalized[field.name] = JSON.stringify(value);
        } else {
          normalized[field.name] = String(value);
        }
      });
      return normalized;
    });
    return {
      rows: normalizedRows,
      fields: fieldMeta,
      numericFields: numericFields,
      textFields: fieldMeta.filter(function (field) { return field.type === "text"; }).map(function (field) { return field.name; })
    };
  }

  function isTimeFieldName(field) {
    return /(^|[._-])(timestamp|time|datetime|date|createdat|updatedat|日期|时间)([._-]|$)/i.test(String(field || "").replace(/\s+/g, ""));
  }

  function defaultMapping(nextDataset) {
    var timeField = nextDataset.fields.map(function (field) { return field.name; }).find(isTimeFieldName);
    xField = nextDataset.textFields[0] || timeField || "__index";
    selectedSeries = nextDataset.numericFields.filter(function (field) {
      return field !== xField;
    }).slice(0, 6);
    if (!selectedSeries.length) {
      xField = "__index";
      selectedSeries = nextDataset.numericFields.slice(0, 1);
    }
    var formatSelect = byId("viz-x-format");
    if (formatSelect) formatSelect.value = timeField && xField === timeField ? "date" : "raw";
  }

  function defaultSeriesFormat() {
    return { type: "number", digits: "auto", currency: "CNY", prefix: "", suffix: "" };
  }

  function ensureSeriesFormat(field) {
    if (!seriesFormats[field]) seriesFormats[field] = defaultSeriesFormat();
    return seriesFormats[field];
  }

  function formatNumber(value, digits) {
    if (value === null || value === undefined || !isFinite(value)) return "—";
    var localeName = document.documentElement.lang === "en" ? "en-US" : "zh-CN";
    var options = digits === "auto"
      ? { maximumFractionDigits: 6 }
      : { minimumFractionDigits: Number(digits), maximumFractionDigits: Number(digits) };
    return new Intl.NumberFormat(localeName, options).format(value);
  }

  function formatSeriesValue(field, value) {
    if (value === null || value === undefined || !isFinite(value)) return "—";
    var config = ensureSeriesFormat(field);
    var localeName = document.documentElement.lang === "en" ? "en-US" : "zh-CN";
    var digits = config.digits === "auto" ? null : Number(config.digits);
    if (config.type === "percentRatio") {
      return new Intl.NumberFormat(localeName, {
        style: "percent",
        minimumFractionDigits: digits === null ? 0 : digits,
        maximumFractionDigits: digits === null ? 2 : digits
      }).format(value);
    }
    if (config.type === "percentValue") {
      return formatNumber(value, config.digits) + "%";
    }
    if (config.type === "currency") {
      try {
        return new Intl.NumberFormat(localeName, {
          style: "currency",
          currency: String(config.currency || "CNY").toUpperCase(),
          minimumFractionDigits: digits === null ? undefined : digits,
          maximumFractionDigits: digits === null ? 2 : digits
        }).format(value);
      } catch (error) {
        return formatNumber(value, config.digits) + " " + String(config.currency || "").toUpperCase();
      }
    }
    if (config.type === "custom") {
      return String(config.prefix || "") + formatNumber(value, config.digits) + String(config.suffix || "");
    }
    return formatNumber(value, config.digits);
  }

  function renderSeriesFormatControls() {
    var container = byId("viz-series-formats");
    if (!container) return;
    if (!dataset || !selectedSeries.length) {
      container.innerHTML = '<span class="viz-field-empty">' + escapeHtml(t("visualization.waitingForSeries")) + "</span>";
      return;
    }
    container.innerHTML = selectedSeries.map(function (field, index) {
      var config = ensureSeriesFormat(field);
      var extra = "";
      if (config.type === "currency") {
        extra = '<label class="viz-mini-control"><span>' + escapeHtml(t("visualization.currencyCode")) + '</span><input data-series-index="' + index + '" data-format-key="currency" type="text" maxlength="3" value="' + escapeHtml(config.currency) + '" aria-label="' + escapeHtml(field + " " + t("visualization.currencyCode")) + '"></label>';
      } else if (config.type === "custom") {
        extra = '<label class="viz-mini-control"><span>' + escapeHtml(t("visualization.prefix")) + '</span><input data-series-index="' + index + '" data-format-key="prefix" type="text" value="' + escapeHtml(config.prefix) + '" aria-label="' + escapeHtml(field + " " + t("visualization.prefix")) + '"></label>' +
          '<label class="viz-mini-control"><span>' + escapeHtml(t("visualization.suffix")) + '</span><input data-series-index="' + index + '" data-format-key="suffix" type="text" value="' + escapeHtml(config.suffix) + '" aria-label="' + escapeHtml(field + " " + t("visualization.suffix")) + '"></label>';
      }
      return '<div class="viz-series-format-row">' +
        '<strong title="' + escapeHtml(field) + '">' + escapeHtml(field) + "</strong>" +
        '<label class="viz-mini-control"><span>' + escapeHtml(t("visualization.valueFormat")) + '</span><select data-series-index="' + index + '" data-format-key="type" aria-label="' + escapeHtml(field + " " + t("visualization.valueFormat")) + '">' +
          '<option value="number"' + (config.type === "number" ? " selected" : "") + ">" + escapeHtml(t("visualization.formatNumber")) + "</option>" +
          '<option value="percentRatio"' + (config.type === "percentRatio" ? " selected" : "") + ">" + escapeHtml(t("visualization.formatPercentRatio")) + "</option>" +
          '<option value="percentValue"' + (config.type === "percentValue" ? " selected" : "") + ">" + escapeHtml(t("visualization.formatPercentValue")) + "</option>" +
          '<option value="currency"' + (config.type === "currency" ? " selected" : "") + ">" + escapeHtml(t("visualization.formatCurrency")) + "</option>" +
          '<option value="custom"' + (config.type === "custom" ? " selected" : "") + ">" + escapeHtml(t("visualization.formatPrefixSuffix")) + "</option>" +
        "</select></label>" +
        '<label class="viz-mini-control"><span>' + escapeHtml(t("visualization.decimalDigits")) + '</span><select data-series-index="' + index + '" data-format-key="digits" aria-label="' + escapeHtml(field + " " + t("visualization.decimalDigits")) + '">' +
          '<option value="auto"' + (config.digits === "auto" ? " selected" : "") + ">" + escapeHtml(t("visualization.unitAuto")) + "</option>" +
          [0, 1, 2, 3, 4, 5, 6].map(function (digits) {
            return '<option value="' + digits + '"' + (String(config.digits) === String(digits) ? " selected" : "") + ">" + digits + "</option>";
          }).join("") +
        "</select></label>" +
        '<div class="viz-format-extra">' + extra + "</div>" +
      "</div>";
    }).join("");
  }

  function renderPaletteControls() {
    var container = byId("viz-palette-colors");
    var resetButton = byId("viz-reset-colors");
    if (!container) return;
    var palette = activePalette();
    container.innerHTML = palette.map(function (color, index) {
      var label = selectedSeries[index] || tx("visualization.paletteSlot", { index: index + 1 });
      return '<label class="viz-color-swatch" title="' + escapeHtml(label) + '">' +
        '<span>' + escapeHtml(label) + '</span>' +
        '<input type="color" data-color-index="' + index + '" value="' + escapeHtml(color) + '" aria-label="' + escapeHtml(label + " " + t("visualization.color")) + '">' +
      "</label>";
    }).join("");
    if (resetButton) resetButton.disabled = !customPalette.length;
  }

  function renderMappingControls() {
    var xSelect = byId("viz-x-field");
    var seriesContainer = byId("viz-series-fields");
    if (!xSelect || !seriesContainer) return;
    if (!dataset) {
      xSelect.innerHTML = "";
      xSelect.disabled = true;
      seriesContainer.innerHTML = '<span class="viz-field-empty">' + escapeHtml(t("visualization.waitingForData")) + '</span>';
      renderSeriesFormatControls();
      renderPaletteControls();
      return;
    }
    xSelect.disabled = false;
    var options = [{ name: "__index", label: t("visualization.rowIndex") }].concat(
      dataset.fields.map(function (field) { return { name: field.name, label: field.name }; })
    );
    xSelect.innerHTML = options.map(function (option) {
      return '<option value="' + escapeHtml(option.name) + '"' + (option.name === xField ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>";
    }).join("");
    seriesContainer.innerHTML = dataset.numericFields.map(function (field, index) {
      var checked = selectedSeries.indexOf(field) !== -1;
      var disabled = field === xField;
      return '<label class="viz-series-option' + (disabled ? " is-disabled" : "") + '">' +
        '<input type="' + (chartType === "pie" ? "radio" : "checkbox") + '" name="viz-series" data-field-index="' + index + '"' +
        (checked && !disabled ? " checked" : "") + (disabled ? " disabled" : "") + ">" +
        '<span>' + escapeHtml(field) + "</span></label>";
    }).join("");
    renderSeriesFormatControls();
    renderPaletteControls();
  }

  function readSelectedSeries() {
    if (!dataset) return;
    var inputs = root.querySelectorAll('#viz-series-fields input[name="viz-series"]:checked');
    selectedSeries = Array.from(inputs).map(function (input) {
      return dataset.numericFields[Number(input.dataset.fieldIndex)];
    }).filter(Boolean);
    renderSeriesFormatControls();
    renderPaletteControls();
    renderChart();
  }

  function renderTransformControls() {
    var sortSelect = byId("viz-sort-field");
    var topInput = byId("viz-top-n");
    if (!sortSelect || !topInput) return;
    var previous = sortSelect.value || "none";
    var options = [{ value: "none", label: t("visualization.sortNone") }];
    if (dataset) {
      dataset.fields.forEach(function (field) {
        options.push({ value: field.name, label: field.name });
      });
    }
    sortSelect.innerHTML = options.map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '"' + (option.value === previous ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>";
    }).join("");
    if (!options.some(function (option) { return option.value === previous; })) sortSelect.value = "none";
    topInput.max = dataset ? String(dataset.rows.length) : "5000";
  }

  function effectiveRows() {
    if (!dataset) return [];
    var rows = dataset.rows.slice();
    var sortField = byId("viz-sort-field") ? byId("viz-sort-field").value : "none";
    var direction = byId("viz-sort-direction") ? byId("viz-sort-direction").value : "asc";
    if (sortField && sortField !== "none") {
      rows.sort(function (left, right) {
        var a = left[sortField];
        var b = right[sortField];
        if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
        if (b === null || b === undefined) return -1;
        var result = typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
        return direction === "desc" ? -result : result;
      });
    }
    var topN = byId("viz-top-n") ? Math.max(0, Math.floor(Number(byId("viz-top-n").value) || 0)) : 0;
    if (topN > 0) rows = rows.slice(0, topN);
    return rows;
  }

  function renderDataPreview() {
    var container = byId("viz-data-preview-content");
    var summaryCount = byId("viz-data-preview-count");
    if (!container || !summaryCount) return;
    if (!dataset) {
      summaryCount.textContent = "";
      container.innerHTML = '<div class="viz-preview-empty">' + escapeHtml(t("visualization.waitingForData")) + "</div>";
      return;
    }
    var rows = effectiveRows();
    var fields = dataset.fields.slice(0, 8);
    var emptyCount = dataset.fields.reduce(function (total, field) { return total + field.emptyCount; }, 0);
    var invalidCount = dataset.fields.reduce(function (total, field) { return total + field.invalidCount; }, 0);
    var duplicateCount = 0;
    if (xField !== "__index") {
      var seen = Object.create(null);
      rows.forEach(function (row) {
        var value = row[xField];
        if (value === null || value === undefined) return;
        var key = typeof value + ":" + String(value);
        if (seen[key]) duplicateCount++;
        else seen[key] = true;
      });
    }
    var unsortedTime = false;
    if (xField !== "__index" && (isTimeFieldName(xField) || (byId("viz-x-format") && byId("viz-x-format").value !== "raw"))) {
      var previousTime = null;
      rows.forEach(function (row) {
        var date = dateFromValue(row[xField]);
        if (!date) return;
        if (previousTime !== null && date.getTime() < previousTime) unsortedTime = true;
        previousTime = date.getTime();
      });
    }
    summaryCount.textContent = tx("visualization.previewRows", { count: rows.length });
    var quality = [];
    if (emptyCount) quality.push(tx("visualization.emptyValues", { count: emptyCount }));
    if (invalidCount) quality.push(tx("visualization.invalidValues", { count: invalidCount }));
    if (duplicateCount) quality.push(tx("visualization.duplicateCategories", { count: duplicateCount }));
    if (unsortedTime) quality.push(t("visualization.timeNotSorted"));
    if (!quality.length) quality.push(t("visualization.dataQualityGood"));
    var tableRows = rows.slice(0, 20);
    container.innerHTML =
      '<div class="viz-quality-list">' + quality.map(function (item, index) {
        return '<span class="' + (quality.length === 1 && !emptyCount && !invalidCount && !duplicateCount && !unsortedTime ? "is-good" : "is-warning") + '">' + escapeHtml(item) + "</span>";
      }).join("") + "</div>" +
      '<div class="viz-data-table-wrap"><table class="viz-data-table"><thead><tr>' +
        fields.map(function (field) {
          return "<th><span>" + escapeHtml(field.name) + '</span><small>' + escapeHtml(t(field.type === "number" ? "visualization.typeNumber" : "visualization.typeText")) + "</small></th>";
        }).join("") +
      "</tr></thead><tbody>" +
        tableRows.map(function (row) {
          return "<tr>" + fields.map(function (field) {
            var value = row[field.name];
            return "<td>" + escapeHtml(value === null || value === undefined ? "—" : value) + "</td>";
          }).join("") + "</tr>";
        }).join("") +
      "</tbody></table></div>" +
      (rows.length > tableRows.length ? '<div class="viz-preview-note">' + escapeHtml(tx("visualization.previewLimited", { count: tableRows.length })) + "</div>" : "") +
      (dataset.fields.length > fields.length ? '<div class="viz-preview-note">' + escapeHtml(tx("visualization.fieldsLimited", { count: fields.length })) + "</div>" : "");
  }

  function updateDataSummary() {
    if (!dataset) return;
    var rows = effectiveRows();
    var summary = tx("visualization.dataSummary", {
      rows: dataset.rows.length,
      fields: dataset.fields.length,
      series: dataset.numericFields.length
    });
    if (rows.length !== dataset.rows.length) {
      summary += " · " + tx("visualization.displayedRows", { count: rows.length });
    }
    setStatus(summary, false);
  }

  function refreshDataView() {
    updateDataSummary();
    renderDataPreview();
    renderChart();
  }

  function applyDataset(nextDataset) {
    dataset = nextDataset;
    defaultMapping(dataset);
    renderMappingControls();
    renderTransformControls();
    refreshDataView();
  }

  function renderJsonCandidates() {
    var control = byId("viz-json-path-control");
    var select = byId("viz-json-path");
    if (!control || !select) return;
    control.classList.toggle("hidden", activeMode !== "json" || !jsonCandidates.length);
    select.innerHTML = jsonCandidates.map(function (candidate) {
      var kindLabel = t(candidate.kind === "columns" ? "visualization.jsonColumnsCandidate" : "visualization.jsonRowsCandidate");
      return '<option value="' + escapeHtml(candidate.id) + '"' + (candidate.id === selectedJsonCandidateId ? " selected" : "") + ">" +
        escapeHtml(candidate.label + " · " + kindLabel) + "</option>";
    }).join("");
  }

  function applySelectedJsonCandidate() {
    var candidate = jsonCandidates.find(function (item) { return item.id === selectedJsonCandidateId; }) || jsonCandidates[0];
    if (!candidate) throw new Error(t("visualization.errors.noJsonArrays"));
    selectedJsonCandidateId = candidate.id;
    renderJsonCandidates();
    applyDataset(rowsFromJsonCandidate(candidate));
  }

  function parseActiveInput() {
    if (!root) return;
    var textarea = byId(activeMode === "json" ? "viz-json-input" : "viz-table-input");
    try {
      if (activeMode === "json") {
        var source = parseJsonSource(textarea.value);
        jsonCandidates = source.candidates;
        if (!jsonCandidates.some(function (candidate) { return candidate.id === selectedJsonCandidateId; })) {
          selectedJsonCandidateId = jsonCandidates[0].id;
        }
        applySelectedJsonCandidate();
      } else {
        renderJsonCandidates();
        applyDataset(parseTable(textarea.value));
      }
    } catch (error) {
      dataset = null;
      selectedSeries = [];
      if (activeMode === "json") {
        jsonCandidates = [];
        selectedJsonCandidateId = null;
        renderJsonCandidates();
      }
      renderMappingControls();
      setStatus(error.message || t("visualization.errors.unknown"), true);
      if (chart) chart.clear();
      setChartState(window.echarts ? "empty" : "loading");
      updateExportState();
    }
  }

  function scheduleParse() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(parseActiveInput, DEBOUNCE_MS);
  }

  function ensureEcharts(forceReload) {
    if (window.echarts) return Promise.resolve(window.echarts);
    if (forceReload) {
      var existing = document.getElementById("visualization-echarts-script");
      if (existing) existing.remove();
      echartsPromise = null;
    }
    if (echartsPromise) return echartsPromise;
    echartsPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.id = "visualization-echarts-script";
      script.src = ECHARTS_URL;
      script.crossOrigin = "anonymous";
      script.onload = function () {
        if (window.echarts) resolve(window.echarts);
        else reject(new Error("ECharts global missing"));
      };
      script.onerror = function () {
        echartsPromise = null;
        reject(new Error("Failed to load ECharts"));
      };
      document.head.appendChild(script);
    });
    return echartsPromise;
  }

  function cssValue(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function defaultPalette() {
    return [
      cssValue("--accent"),
      cssValue("--green"),
      cssValue("--orange"),
      cssValue("--chart-purple"),
      cssValue("--chart-cyan"),
      cssValue("--chart-red"),
      cssValue("--amber")
    ];
  }

  function activePalette() {
    return customPalette.length ? customPalette.slice() : defaultPalette();
  }

  function normalizeCustomPalette(colors) {
    if (!Array.isArray(colors) || colors.length !== 7) return [];
    var palette = colors.map(function (color) { return String(color).trim().toLowerCase(); });
    return palette.every(function (color) { return /^#[0-9a-f]{6}$/.test(color); }) ? palette : [];
  }

  function padNumber(value, length) {
    return String(value).padStart(length || 2, "0");
  }

  function dateFromValue(value) {
    if (value === null || value === undefined || value === "") return null;
    var unit = byId("viz-time-unit") ? byId("viz-time-unit").value : "auto";
    var numeric = parseNumber(value);
    var date;
    if (numeric !== null) {
      var milliseconds = numeric;
      if (unit === "seconds" || (unit === "auto" && Math.abs(numeric) < 100000000000)) {
        milliseconds = numeric * 1000;
      }
      date = new Date(milliseconds);
    } else {
      date = new Date(String(value));
    }
    return isNaN(date.getTime()) ? null : date;
  }

  function formatDateValue(date, pattern, useUtc) {
    var values = useUtc ? {
      YYYY: date.getUTCFullYear(),
      MM: date.getUTCMonth() + 1,
      DD: date.getUTCDate(),
      HH: date.getUTCHours(),
      mm: date.getUTCMinutes(),
      ss: date.getUTCSeconds(),
      SSS: date.getUTCMilliseconds()
    } : {
      YYYY: date.getFullYear(),
      MM: date.getMonth() + 1,
      DD: date.getDate(),
      HH: date.getHours(),
      mm: date.getMinutes(),
      ss: date.getSeconds(),
      SSS: date.getMilliseconds()
    };
    return String(pattern || "YYYY-MM-DD HH:mm:ss").replace(/YYYY|SSS|MM|DD|HH|mm|ss/g, function (token) {
      return token === "YYYY" ? String(values[token]) : padNumber(values[token], token === "SSS" ? 3 : 2);
    });
  }

  function formatCategoryValue(value) {
    if (value === null || value === undefined || value === "") return "—";
    var format = byId("viz-x-format") ? byId("viz-x-format").value : "raw";
    if (format === "raw") return String(value);
    var date = dateFromValue(value);
    if (!date) return String(value);
    var pattern = format === "date"
      ? "YYYY-MM-DD"
      : (format === "datetime" ? "YYYY-MM-DD HH:mm:ss" : byId("viz-date-pattern").value.trim());
    return formatDateValue(date, pattern, byId("viz-timezone").value === "utc");
  }

  function categoryValues(rows) {
    return rows.map(function (row, index) {
      if (xField === "__index") return String(index + 1);
      return formatCategoryValue(row[xField]);
    });
  }

  function seriesValues(field, rows) {
    return rows.map(function (row) {
      var value = row[field];
      return typeof value === "number" && isFinite(value) ? value : null;
    });
  }

  function chartOption() {
    var rows = effectiveRows();
    var categories = categoryValues(rows);
    var text = cssValue("--text");
    var textSecondary = cssValue("--text-secondary");
    var border = cssValue("--border");
    var background = cssValue("--bg-card");
    var palette = activePalette();
    var showLegend = byId("viz-show-legend").checked;
    var showLabels = byId("viz-show-labels").checked;
    var smooth = byId("viz-smooth").checked;
    var showPoints = byId("viz-show-points").checked;
    var title = byId("viz-title").value.trim();
    var base = {
      backgroundColor: background,
      animation: rows.length <= 1000,
      color: palette,
      aria: {
        enabled: true,
        description: title || t("visualization.defaultTitle")
      },
      title: {
        text: title,
        left: "center",
        top: 14,
        textStyle: { color: text, fontSize: 16, fontWeight: 600 }
      },
      legend: {
        show: showLegend,
        top: title ? 48 : 16,
        textStyle: { color: textSecondary }
      },
      tooltip: {
        trigger: chartType === "pie" ? "item" : "axis",
        renderMode: "richText",
        confine: true,
        backgroundColor: cssValue("--panel-bg"),
        borderColor: border,
        textStyle: { color: text }
      }
    };
    if (chartType === "pie") {
      var pieField = selectedSeries[0];
      var pieValues = seriesValues(pieField, rows);
      base.series = [{
        name: pieField,
        type: "pie",
        radius: ["28%", "68%"],
        center: ["50%", "56%"],
        minAngle: 2,
        label: {
          show: showLabels,
          color: text,
          formatter: function (params) {
            return params.name + ": " + formatSeriesValue(pieField, params.value) + " (" + params.percent + "%)";
          }
        },
        labelLine: { show: showLabels },
        tooltip: { valueFormatter: function (value) { return formatSeriesValue(pieField, value); } },
        data: categories.map(function (category, index) {
          return { name: category, value: pieValues[index] };
        }).filter(function (item) { return item.value !== null; })
      }];
      return base;
    }
    base.grid = {
      left: 54,
      right: 24,
      top: title ? (showLegend ? 86 : 62) : (showLegend ? 56 : 30),
      bottom: 52,
      containLabel: true
    };
    base.xAxis = {
      type: "category",
      data: categories,
      boundaryGap: chartType !== "line",
      axisLine: { lineStyle: { color: border } },
      axisTick: { lineStyle: { color: border } },
      axisLabel: { color: textSecondary, hideOverlap: true }
    };
    base.yAxis = {
      type: "value",
      axisLine: { show: false },
      axisLabel: {
        color: textSecondary,
        formatter: function (value) {
          return selectedSeries.length === 1 ? formatSeriesValue(selectedSeries[0], value) : formatNumber(value, "auto");
        }
      },
      splitLine: { lineStyle: { color: border, type: "dashed" } }
    };
    base.series = selectedSeries.map(function (field) {
      if (chartType === "line") {
        return {
          name: field,
          type: "line",
          data: seriesValues(field, rows),
          smooth: smooth,
          connectNulls: false,
          showSymbol: showPoints,
          symbolSize: 7,
          label: {
            show: showLabels,
            color: text,
            formatter: function (params) { return formatSeriesValue(field, params.value); }
          },
          tooltip: { valueFormatter: function (value) { return formatSeriesValue(field, value); } },
          emphasis: { focus: "series" }
        };
      }
      return {
        name: field,
        type: "bar",
        data: seriesValues(field, rows),
        stack: chartType === "stacked" ? "total" : null,
        large: dataset.rows.length > 1000,
        label: {
          show: showLabels,
          position: "top",
          color: text,
          formatter: function (params) { return formatSeriesValue(field, params.value); }
        },
        tooltip: { valueFormatter: function (value) { return formatSeriesValue(field, value); } },
        emphasis: { focus: "series" }
      };
    });
    return base;
  }

  function updateControlVisibility() {
    var smoothOption = byId("viz-smooth-option");
    var pointsOption = byId("viz-points-option");
    var dateOptions = byId("viz-date-options");
    var patternControl = byId("viz-date-pattern-control");
    var xFormat = byId("viz-x-format");
    if (smoothOption) smoothOption.classList.toggle("hidden", chartType !== "line");
    if (pointsOption) pointsOption.classList.toggle("hidden", chartType !== "line");
    if (dateOptions && xFormat) dateOptions.classList.toggle("hidden", xFormat.value === "raw");
    if (patternControl && xFormat) patternControl.classList.toggle("hidden", xFormat.value !== "custom");
  }

  function updateExportState() {
    var button = byId("viz-export");
    var fullscreenButton = byId("viz-fullscreen");
    var exportConfigButton = byId("viz-export-config");
    var importConfigButton = byId("viz-import-config");
    if (button) button.disabled = !chart || !dataset || !selectedSeries.length;
    if (fullscreenButton) fullscreenButton.disabled = !chart || !dataset || !selectedSeries.length;
    if (exportConfigButton) exportConfigButton.disabled = !dataset;
    if (importConfigButton) importConfigButton.disabled = !dataset;
  }

  function renderChart() {
    updateControlVisibility();
    updateExportState();
    if (!root || !dataset || !selectedSeries.length) {
      if (window.echarts) setChartState("empty");
      return;
    }
    if (!window.echarts) {
      setChartState("loading");
      ensureEcharts(false).then(function () {
        if (!root) return;
        renderChart();
      }).catch(function () {
        if (!root) return;
        setChartState("failure", t("visualization.chartLoadFailed"));
      });
      return;
    }
    var chartElement = byId("viz-chart");
    if (!chartElement) return;
    setChartState("ready");
    if (!chart) chart = window.echarts.init(chartElement, null, { renderer: "canvas" });
    chart.setOption(chartOption(), true);
    chart.resize();
    updateExportState();
  }

  function switchMode(mode) {
    activeMode = mode;
    root.querySelectorAll("[data-viz-mode]").forEach(function (button) {
      var active = button.dataset.vizMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    byId("viz-table-wrap").classList.toggle("hidden", mode !== "table");
    byId("viz-json-wrap").classList.toggle("hidden", mode !== "json");
    parseActiveInput();
  }

  function switchChartType(type) {
    chartType = type;
    syncChartTypeButtons();
    if (chartType === "pie" && selectedSeries.length > 1) selectedSeries = selectedSeries.slice(0, 1);
    renderMappingControls();
    renderPaletteControls();
    renderChart();
  }

  function loadExample() {
    var textarea = byId(activeMode === "json" ? "viz-json-input" : "viz-table-input");
    textarea.value = activeMode === "json" ? SAMPLE_JSON : sampleTable();
    parseActiveInput();
    textarea.focus();
  }

  function clearInput() {
    var textarea = byId(activeMode === "json" ? "viz-json-input" : "viz-table-input");
    textarea.value = "";
    if (activeMode === "json") {
      jsonCandidates = [];
      selectedJsonCandidateId = null;
      renderJsonCandidates();
    }
    dataset = null;
    selectedSeries = [];
    seriesFormats = Object.create(null);
    customPalette = [];
    renderMappingControls();
    renderTransformControls();
    renderDataPreview();
    if (chart) chart.clear();
    setStatus("", false);
    setChartState(window.echarts ? "empty" : "loading");
    updateExportState();
    textarea.focus();
  }

  function safeFilename(value) {
    var name = String(value || t("visualization.defaultTitle")).trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "");
    return (name || "chart") + ".png";
  }

  function exportPng() {
    if (!chart || !dataset || !selectedSeries.length) return;
    var dataUrl = chart.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: cssValue("--bg-card")
    });
    var link = document.createElement("a");
    link.href = dataUrl;
    link.download = safeFilename(byId("viz-title").value);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus(t("visualization.exported"), false);
  }

  function currentConfig() {
    var formats = Object.create(null);
    selectedSeries.forEach(function (field) {
      formats[field] = Object.assign({}, ensureSeriesFormat(field));
    });
    return {
      version: 1,
      chartType: chartType,
      xField: xField,
      selectedSeries: selectedSeries.slice(),
      title: byId("viz-title").value,
      showLegend: byId("viz-show-legend").checked,
      smooth: byId("viz-smooth").checked,
      showPoints: byId("viz-show-points").checked,
      showLabels: byId("viz-show-labels").checked,
      xFormat: byId("viz-x-format").value,
      timeUnit: byId("viz-time-unit").value,
      timezone: byId("viz-timezone").value,
      datePattern: byId("viz-date-pattern").value,
      sortField: byId("viz-sort-field").value,
      sortDirection: byId("viz-sort-direction").value,
      topN: Math.max(0, Math.floor(Number(byId("viz-top-n").value) || 0)),
      seriesFormats: formats,
      colors: customPalette.slice()
    };
  }

  function exportConfig() {
    if (!dataset) return;
    var link = document.createElement("a");
    link.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig(), null, 2));
    link.download = safeFilename(byId("viz-title").value).replace(/\.png$/, ".chart.json");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus(t("visualization.configExported"), false);
  }

  function syncChartTypeButtons() {
    root.querySelectorAll("[data-chart-type]").forEach(function (button) {
      var active = button.dataset.chartType === chartType;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function applyImportedConfig(config) {
    if (!dataset || !config || typeof config !== "object") throw new Error(t("visualization.errors.invalidConfig"));
    var availableFields = dataset.fields.map(function (field) { return field.name; });
    var validChartTypes = ["line", "bar", "stacked", "pie"];
    chartType = validChartTypes.indexOf(config.chartType) !== -1 ? config.chartType : "line";
    xField = config.xField === "__index" || availableFields.indexOf(config.xField) !== -1 ? config.xField : "__index";
    selectedSeries = Array.isArray(config.selectedSeries)
      ? config.selectedSeries.filter(function (field) {
        return dataset.numericFields.indexOf(field) !== -1 && field !== xField;
      }).slice(0, chartType === "pie" ? 1 : 6)
      : [];
    if (!selectedSeries.length) {
      selectedSeries = dataset.numericFields.filter(function (field) { return field !== xField; }).slice(0, chartType === "pie" ? 1 : 6);
    }
    if (!selectedSeries.length) throw new Error(t("visualization.errors.configFieldsMissing"));

    byId("viz-title").value = typeof config.title === "string" ? config.title : t("visualization.defaultTitle");
    byId("viz-show-legend").checked = config.showLegend !== false;
    byId("viz-smooth").checked = config.smooth === true;
    byId("viz-show-points").checked = config.showPoints !== false;
    byId("viz-show-labels").checked = config.showLabels === true;
    ["raw", "date", "datetime", "custom"].includes(config.xFormat) && (byId("viz-x-format").value = config.xFormat);
    ["auto", "seconds", "milliseconds"].includes(config.timeUnit) && (byId("viz-time-unit").value = config.timeUnit);
    ["local", "utc"].includes(config.timezone) && (byId("viz-timezone").value = config.timezone);
    if (typeof config.datePattern === "string" && config.datePattern.length <= 80) byId("viz-date-pattern").value = config.datePattern;

    seriesFormats = Object.create(null);
    var allowedFormatTypes = ["number", "percentRatio", "percentValue", "currency", "custom"];
    selectedSeries.forEach(function (field) {
      var source = config.seriesFormats && config.seriesFormats[field];
      var next = defaultSeriesFormat();
      if (source && typeof source === "object") {
        if (allowedFormatTypes.indexOf(source.type) !== -1) next.type = source.type;
        if (source.digits === "auto" || /^[0-6]$/.test(String(source.digits))) next.digits = String(source.digits);
        if (/^[A-Za-z]{3}$/.test(String(source.currency || ""))) next.currency = String(source.currency).toUpperCase();
        if (typeof source.prefix === "string") next.prefix = source.prefix.slice(0, 20);
        if (typeof source.suffix === "string") next.suffix = source.suffix.slice(0, 20);
      }
      seriesFormats[field] = next;
    });
    customPalette = normalizeCustomPalette(config.colors);

    renderMappingControls();
    renderTransformControls();
    if (config.sortField === "none" || availableFields.indexOf(config.sortField) !== -1) byId("viz-sort-field").value = config.sortField;
    byId("viz-sort-direction").value = config.sortDirection === "desc" ? "desc" : "asc";
    byId("viz-top-n").value = Math.min(dataset.rows.length, Math.max(0, Math.floor(Number(config.topN) || 0)));
    syncChartTypeButtons();
    renderSeriesFormatControls();
    refreshDataView();
    setStatus(t("visualization.configImported"), false);
  }

  function importConfigFile(file) {
    if (!file) return;
    if (file.size > 100000) {
      setStatus(t("visualization.errors.configTooLarge"), true);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        applyImportedConfig(JSON.parse(String(reader.result || "")));
      } catch (error) {
        setStatus(error.message || t("visualization.errors.invalidConfig"), true);
      }
    };
    reader.onerror = function () {
      setStatus(t("visualization.errors.configReadFailed"), true);
    };
    reader.readAsText(file);
  }

  function syncFullscreenState() {
    var panel = byId("viz-preview-panel");
    if (!panel) return;
    var active = panel.classList.contains("is-viewport-fullscreen");
    panel.classList.toggle("is-fullscreen", active);
    var enterButton = byId("viz-fullscreen");
    var exitButton = byId("viz-exit-fullscreen");
    if (enterButton) enterButton.setAttribute("aria-pressed", String(active));
    if (exitButton) exitButton.classList.toggle("hidden", !active);
    setTimeout(function () {
      if (chart) chart.resize();
    }, 60);
  }

  function enterFullscreen() {
    var panel = byId("viz-preview-panel");
    if (!panel || !chart) return;
    panel.classList.add("is-viewport-fullscreen");
    document.body.classList.add("viz-fullscreen-active");
    syncFullscreenState();
  }

  function exitFullscreen() {
    var panel = byId("viz-preview-panel");
    if (!panel) return;
    panel.classList.remove("is-viewport-fullscreen", "is-fullscreen");
    document.body.classList.remove("viz-fullscreen-active");
    syncFullscreenState();
  }

  function setPanelWidth(leftWidth) {
    var workspace = root ? root.querySelector(".viz-workspace") : null;
    var resizer = byId("viz-resizer");
    if (!workspace || !resizer || getComputedStyle(resizer).display === "none") return;
    var rect = workspace.getBoundingClientRect();
    var dividerWidth = resizer.getBoundingClientRect().width || 16;
    var minLeft = Math.min(320, rect.width * 0.45);
    var minRight = Math.min(420, rect.width * 0.5);
    var maxLeft = rect.width - dividerWidth - minRight;
    if (maxLeft < minLeft) return;
    var next = Math.max(minLeft, Math.min(maxLeft, leftWidth));
    workspace.style.setProperty("--viz-left", next + "px");
    resizer.setAttribute("aria-valuenow", String(Math.round(next / Math.max(1, rect.width - dividerWidth) * 100)));
    if (chart) chart.resize();
  }

  function bindPanelResizer() {
    var resizer = byId("viz-resizer");
    var workspace = root.querySelector(".viz-workspace");
    var inputPanel = root.querySelector(".viz-input-panel");
    if (!resizer || !workspace || !inputPanel) return;
    var dragging = false;

    resizer.addEventListener("pointerdown", function (event) {
      if (getComputedStyle(resizer).display === "none") return;
      dragging = true;
      resizer.classList.add("is-dragging");
      resizer.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    resizer.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      setPanelWidth(event.clientX - workspace.getBoundingClientRect().left);
    });
    function stopDragging(event) {
      if (!dragging) return;
      dragging = false;
      resizer.classList.remove("is-dragging");
      if (resizer.hasPointerCapture(event.pointerId)) resizer.releasePointerCapture(event.pointerId);
    }
    resizer.addEventListener("pointerup", stopDragging);
    resizer.addEventListener("pointercancel", stopDragging);
    resizer.addEventListener("dblclick", function () {
      workspace.style.removeProperty("--viz-left");
      resizer.setAttribute("aria-valuenow", "40");
      if (chart) chart.resize();
    });
    resizer.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") return;
      event.preventDefault();
      if (event.key === "Home") {
        workspace.style.removeProperty("--viz-left");
        resizer.setAttribute("aria-valuenow", "40");
        if (chart) chart.resize();
        return;
      }
      setPanelWidth(inputPanel.getBoundingClientRect().width + (event.key === "ArrowRight" ? 24 : -24));
    });
  }

  function bindEvents() {
    root.querySelectorAll("[data-viz-mode]").forEach(function (button) {
      button.addEventListener("click", function () { switchMode(this.dataset.vizMode); });
      button.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        switchMode(this.dataset.vizMode === "table" ? "json" : "table");
        root.querySelector('[data-viz-mode="' + activeMode + '"]').focus();
      });
    });
    root.querySelectorAll("[data-chart-type]").forEach(function (button) {
      button.addEventListener("click", function () { switchChartType(this.dataset.chartType); });
    });
    byId("viz-table-input").addEventListener("input", scheduleParse);
    byId("viz-json-input").addEventListener("input", scheduleParse);
    byId("viz-json-path").addEventListener("change", function () {
      selectedJsonCandidateId = this.value;
      try {
        applySelectedJsonCandidate();
      } catch (error) {
        setStatus(error.message || t("visualization.errors.unknown"), true);
      }
    });
    byId("viz-example").addEventListener("click", loadExample);
    byId("viz-clear").addEventListener("click", clearInput);
    byId("viz-retry").addEventListener("click", function () {
      setChartState("loading");
      ensureEcharts(true).then(renderChart).catch(function () {
        setChartState("failure", t("visualization.chartLoadFailed"));
      });
    });
    byId("viz-x-field").addEventListener("change", function () {
      xField = this.value;
      byId("viz-x-format").value = isTimeFieldName(xField) ? "date" : "raw";
      selectedSeries = selectedSeries.filter(function (field) { return field !== xField; });
      if (!selectedSeries.length && dataset) {
        selectedSeries = dataset.numericFields.filter(function (field) { return field !== xField; }).slice(0, chartType === "pie" ? 1 : 6);
      }
      renderMappingControls();
      refreshDataView();
    });
    byId("viz-series-fields").addEventListener("change", readSelectedSeries);
    function updateSeriesFormat(event) {
      var target = event.target.closest("[data-format-key]");
      if (!target) return;
      var field = selectedSeries[Number(target.dataset.seriesIndex)];
      if (!field) return;
      var config = ensureSeriesFormat(field);
      config[target.dataset.formatKey] = target.dataset.formatKey === "currency" ? target.value.toUpperCase() : target.value;
      if (target.dataset.formatKey === "type") renderSeriesFormatControls();
      renderChart();
    }
    byId("viz-series-formats").addEventListener("change", updateSeriesFormat);
    byId("viz-series-formats").addEventListener("input", updateSeriesFormat);
    byId("viz-palette-colors").addEventListener("input", function (event) {
      var input = event.target.closest("[data-color-index]");
      if (!input) return;
      if (!customPalette.length) customPalette = defaultPalette();
      customPalette[Number(input.dataset.colorIndex)] = input.value;
      byId("viz-reset-colors").disabled = false;
      renderChart();
    });
    byId("viz-reset-colors").addEventListener("click", function () {
      customPalette = [];
      renderPaletteControls();
      renderChart();
    });
    ["viz-title", "viz-show-legend", "viz-smooth", "viz-show-points", "viz-show-labels", "viz-date-pattern"].forEach(function (id) {
      byId(id).addEventListener(id === "viz-title" || id === "viz-date-pattern" ? "input" : "change", renderChart);
    });
    ["viz-x-format", "viz-time-unit", "viz-timezone"].forEach(function (id) {
      byId(id).addEventListener("change", refreshDataView);
    });
    ["viz-sort-field", "viz-sort-direction", "viz-top-n"].forEach(function (id) {
      byId(id).addEventListener(id === "viz-top-n" ? "input" : "change", refreshDataView);
    });
    byId("viz-export").addEventListener("click", exportPng);
    byId("viz-export-config").addEventListener("click", exportConfig);
    byId("viz-import-config").addEventListener("click", function () { byId("viz-config-file").click(); });
    byId("viz-config-file").addEventListener("change", function () {
      importConfigFile(this.files && this.files[0]);
      this.value = "";
    });
    byId("viz-fullscreen").addEventListener("click", enterFullscreen);
    byId("viz-exit-fullscreen").addEventListener("click", exitFullscreen);
    bindPanelResizer();

    resizeHandler = function () {
      if (chart) chart.resize();
    };
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resizeHandler);
      resizeObserver.observe(byId("viz-preview-panel"));
    } else {
      window.addEventListener("resize", resizeHandler);
    }
    themeObserver = new MutationObserver(function () {
      renderPaletteControls();
      if (dataset) renderChart();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    keydownHandler = function (event) {
      var panel = byId("viz-preview-panel");
      if (event.key === "Escape" && panel && panel.classList.contains("is-viewport-fullscreen")) exitFullscreen();
    };
    document.addEventListener("keydown", keydownHandler);
  }

  function init(container) {
    deactivate();
    activeMode = "table";
    chartType = "line";
    xField = "__index";
    seriesFormats = Object.create(null);
    customPalette = [];
    jsonCandidates = [];
    selectedJsonCandidateId = null;
    root = container;
    root.innerHTML =
      '<div class="viz-tool">' +
      '  <div class="viz-workspace">' +
      '    <section class="tool-panel viz-input-panel" aria-labelledby="viz-data-title">' +
      '      <div class="viz-section-heading"><div><h2 id="viz-data-title">' + escapeHtml(t("visualization.dataTitle")) + '</h2><p>' + escapeHtml(t("visualization.dataHint")) + '</p></div>' +
      '        <div class="viz-small-actions"><button id="viz-example" type="button">' + escapeHtml(t("visualization.loadExample")) + '</button><button id="viz-clear" type="button">' + escapeHtml(t("visualization.clear")) + '</button></div></div>' +
      '      <div class="viz-tabs" role="tablist" aria-label="' + escapeHtml(t("visualization.inputMode")) + '">' +
      '        <button class="viz-tab active" type="button" role="tab" data-viz-mode="table" aria-selected="true">' + escapeHtml(t("visualization.tableMode")) + '</button>' +
      '        <button class="viz-tab" type="button" role="tab" data-viz-mode="json" aria-selected="false" tabindex="-1">' + escapeHtml(t("visualization.jsonMode")) + '</button>' +
      '      </div>' +
      '      <label id="viz-table-wrap" class="viz-editor-label" for="viz-table-input"><span>' + escapeHtml(t("visualization.tableLabel")) + '</span>' +
      '        <textarea id="viz-table-input" class="viz-editor" spellcheck="false" autocomplete="off" placeholder="' + escapeHtml(t("visualization.tablePlaceholder")) + '">' + escapeHtml(sampleTable()) + '</textarea></label>' +
      '      <div id="viz-json-wrap" class="hidden"><label class="viz-editor-label" for="viz-json-input"><span>' + escapeHtml(t("visualization.jsonLabel")) + '</span>' +
      '        <textarea id="viz-json-input" class="viz-editor" spellcheck="false" autocomplete="off" placeholder="' + escapeHtml(t("visualization.jsonPlaceholder")) + '">' + escapeHtml(SAMPLE_JSON) + '</textarea></label>' +
      '        <label id="viz-json-path-control" class="viz-control viz-json-path-control hidden"><span>' + escapeHtml(t("visualization.jsonArrayField")) + '</span><select id="viz-json-path" class="settings-select"></select></label></div>' +
      '      <div id="viz-status" class="viz-status" role="status" aria-live="polite"></div>' +
      '      <details id="viz-data-preview" class="viz-collapsible viz-data-preview"><summary><span>' + escapeHtml(t("visualization.dataPreview")) + '</span><small id="viz-data-preview-count"></small></summary><div id="viz-data-preview-content" class="viz-data-preview-content"></div></details>' +
      '      <div class="viz-mapping">' +
      '        <label class="viz-control"><span>' + escapeHtml(t("visualization.xField")) + '</span><select id="viz-x-field" class="settings-select"></select></label>' +
      '        <fieldset class="viz-series"><legend>' + escapeHtml(t("visualization.seriesFields")) + '</legend><div id="viz-series-fields" class="viz-series-fields"></div></fieldset>' +
      '      </div>' +
      '      <div class="viz-options">' +
      '        <label class="viz-control viz-title-control"><span>' + escapeHtml(t("visualization.chartTitle")) + '</span><input id="viz-title" class="crypto-input" type="text" value="' + escapeHtml(t("visualization.defaultTitle")) + '" autocomplete="off"></label>' +
      '        <label class="viz-check"><input id="viz-show-legend" type="checkbox" checked><span>' + escapeHtml(t("visualization.showLegend")) + '</span></label>' +
      '        <label id="viz-smooth-option" class="viz-check"><input id="viz-smooth" type="checkbox"><span>' + escapeHtml(t("visualization.smoothLine")) + '</span></label>' +
      '        <label id="viz-points-option" class="viz-check"><input id="viz-show-points" type="checkbox" checked><span>' + escapeHtml(t("visualization.showPoints")) + '</span></label>' +
      '        <label class="viz-check"><input id="viz-show-labels" type="checkbox"><span>' + escapeHtml(t("visualization.showLabels")) + '</span></label>' +
      '      </div>' +
      '      <details id="viz-advanced" class="viz-collapsible viz-advanced"><summary><span>' + escapeHtml(t("visualization.advanced")) + '</span><small>' + escapeHtml(t("visualization.advancedHint")) + '</small></summary>' +
      '        <div class="viz-advanced-content">' +
      '          <section class="viz-advanced-section"><h3>' + escapeHtml(t("visualization.xAxisFormatting")) + '</h3><div class="viz-formatting">' +
      '            <label class="viz-control"><span>' + escapeHtml(t("visualization.xDisplayFormat")) + '</span><select id="viz-x-format" class="settings-select"><option value="raw">' + escapeHtml(t("visualization.formatRaw")) + '</option><option value="date">' + escapeHtml(t("visualization.formatDate")) + '</option><option value="datetime">' + escapeHtml(t("visualization.formatDateTime")) + '</option><option value="custom">' + escapeHtml(t("visualization.formatCustom")) + '</option></select></label>' +
      '            <div id="viz-date-options" class="viz-date-options hidden">' +
      '              <label class="viz-control"><span>' + escapeHtml(t("visualization.timestampUnit")) + '</span><select id="viz-time-unit" class="settings-select"><option value="auto">' + escapeHtml(t("visualization.unitAuto")) + '</option><option value="seconds">' + escapeHtml(t("visualization.unitSeconds")) + '</option><option value="milliseconds">' + escapeHtml(t("visualization.unitMilliseconds")) + '</option></select></label>' +
      '              <label class="viz-control"><span>' + escapeHtml(t("visualization.timezone")) + '</span><select id="viz-timezone" class="settings-select"><option value="local">' + escapeHtml(t("visualization.timezoneLocal")) + '</option><option value="utc">UTC</option></select></label>' +
      '              <label id="viz-date-pattern-control" class="viz-control hidden"><span>' + escapeHtml(t("visualization.datePattern")) + '</span><input id="viz-date-pattern" type="text" value="YYYY-MM-DD HH:mm:ss" autocomplete="off"></label>' +
      '            </div><small class="viz-format-hint">' + escapeHtml(t("visualization.dateFormatHint")) + '</small></div></section>' +
      '          <section class="viz-advanced-section"><h3>' + escapeHtml(t("visualization.colorPalette")) + '</h3><p>' + escapeHtml(t("visualization.colorPaletteHint")) + '</p><div class="viz-palette-editor"><div id="viz-palette-colors" class="viz-palette-colors"></div><button id="viz-reset-colors" type="button" disabled>' + escapeHtml(t("visualization.resetColors")) + '</button></div></section>' +
      '          <section class="viz-advanced-section"><h3>' + escapeHtml(t("visualization.seriesFormatting")) + '</h3><div id="viz-series-formats" class="viz-series-formats"></div></section>' +
      '          <section class="viz-advanced-section"><h3>' + escapeHtml(t("visualization.sortAndTopN")) + '</h3><div class="viz-transform-controls">' +
      '            <label class="viz-control"><span>' + escapeHtml(t("visualization.sortField")) + '</span><select id="viz-sort-field" class="settings-select"><option value="none">' + escapeHtml(t("visualization.sortNone")) + '</option></select></label>' +
      '            <label class="viz-control"><span>' + escapeHtml(t("visualization.sortDirection")) + '</span><select id="viz-sort-direction" class="settings-select"><option value="asc">' + escapeHtml(t("visualization.ascending")) + '</option><option value="desc">' + escapeHtml(t("visualization.descending")) + '</option></select></label>' +
      '            <label class="viz-control"><span>' + escapeHtml(t("visualization.topN")) + '</span><input id="viz-top-n" type="number" min="0" max="5000" step="1" value="0" inputmode="numeric"><small>' + escapeHtml(t("visualization.topNHint")) + '</small></label>' +
      '          </div></section>' +
      '          <section class="viz-advanced-section"><h3>' + escapeHtml(t("visualization.configTitle")) + '</h3><p>' + escapeHtml(t("visualization.configHint")) + '</p><div class="viz-config-actions"><button id="viz-export-config" type="button">' + escapeHtml(t("visualization.exportConfig")) + '</button><button id="viz-import-config" type="button">' + escapeHtml(t("visualization.importConfig")) + '</button><input id="viz-config-file" class="hidden" type="file" accept="application/json,.json"></div></section>' +
      '        </div>' +
      '      </details>' +
      '    </section>' +
      '    <div id="viz-resizer" class="viz-resizer" role="separator" aria-orientation="vertical" aria-valuemin="25" aria-valuemax="70" aria-valuenow="40" aria-label="' + escapeHtml(t("visualization.resizePanels")) + '" title="' + escapeHtml(t("visualization.resizePanelsHint")) + '" tabindex="0"></div>' +
      '    <section id="viz-preview-panel" class="tool-panel viz-preview-panel" aria-labelledby="viz-preview-title">' +
      '      <div class="viz-preview-toolbar"><div><h2 id="viz-preview-title">' + escapeHtml(t("visualization.previewTitle")) + '</h2><p>' + escapeHtml(t("visualization.previewHint")) + '</p></div>' +
      '        <div class="viz-preview-actions"><button id="viz-fullscreen" class="viz-fullscreen" type="button" aria-pressed="false" disabled>' + escapeHtml(t("visualization.fullscreen")) + '</button><button id="viz-export" class="viz-export" type="button" disabled>' + escapeHtml(t("visualization.exportPng")) + '</button></div></div>' +
      '      <div class="viz-chart-types" role="group" aria-label="' + escapeHtml(t("visualization.chartType")) + '">' +
      '        <button class="active" type="button" data-chart-type="line" aria-pressed="true">' + escapeHtml(t("visualization.line")) + '</button>' +
      '        <button type="button" data-chart-type="bar" aria-pressed="false">' + escapeHtml(t("visualization.bar")) + '</button>' +
      '        <button type="button" data-chart-type="stacked" aria-pressed="false">' + escapeHtml(t("visualization.stackedBar")) + '</button>' +
      '        <button type="button" data-chart-type="pie" aria-pressed="false">' + escapeHtml(t("visualization.pie")) + '</button>' +
      '      </div>' +
      '      <div class="viz-chart-shell">' +
      '        <div id="viz-loading" class="viz-chart-message"><span class="viz-spinner" aria-hidden="true"></span><strong>' + escapeHtml(t("visualization.loadingChart")) + '</strong></div>' +
      '        <div id="viz-failure" class="viz-chart-message hidden"><strong id="viz-failure-text">' + escapeHtml(t("visualization.chartLoadFailed")) + '</strong><button id="viz-retry" type="button">' + escapeHtml(t("visualization.retry")) + '</button></div>' +
      '        <div id="viz-empty" class="viz-chart-message hidden"><strong>' + escapeHtml(t("visualization.emptyPreview")) + '</strong><span>' + escapeHtml(t("visualization.emptyPreviewHint")) + '</span></div>' +
      '        <div id="viz-chart" class="viz-chart hidden" role="img" aria-label="' + escapeHtml(t("visualization.previewTitle")) + '"></div>' +
      '      </div>' +
      '      <button id="viz-exit-fullscreen" class="viz-exit-fullscreen hidden" type="button">' + escapeHtml(t("visualization.exitFullscreen")) + '</button>' +
      '    </section>' +
      '  </div>' +
      '</div>';
    bindEvents();
    renderMappingControls();
    setChartState("loading");
    parseActiveInput();
    ensureEcharts(false).then(function () {
      if (root) renderChart();
    }).catch(function () {
      if (root) setChartState("failure", t("visualization.chartLoadFailed"));
    });
  }

  function deactivate() {
    var panel = byId("viz-preview-panel");
    if (panel && panel.classList.contains("is-viewport-fullscreen")) {
      exitFullscreen();
    }
    clearTimeout(debounceTimer);
    debounceTimer = null;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    if (themeObserver) themeObserver.disconnect();
    themeObserver = null;
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
    if (keydownHandler) document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
    document.body.classList.remove("viz-fullscreen-active");
    if (chart) chart.dispose();
    chart = null;
    dataset = null;
    selectedSeries = [];
    seriesFormats = Object.create(null);
    customPalette = [];
    root = null;
  }

  return {
    init: init,
    deactivate: deactivate,
    __test: {
      detectDelimiter: detectDelimiter,
      parseDelimitedRows: parseDelimitedRows,
      parseTable: parseTable,
      parseJsonSource: parseJsonSource,
      parseJsonDataset: parseJsonDataset,
      rowsFromJsonCandidate: rowsFromJsonCandidate,
      formatDateValue: formatDateValue,
      normalizeDataset: normalizeDataset,
      normalizeCustomPalette: normalizeCustomPalette
    }
  };
})();
