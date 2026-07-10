// Unit Converter — live conversion across metric, imperial and traditional units.
var UnitConvertTool = (function () {
  var HISTORY_KEY = "unitconvert_history";
  var MAX_HISTORY = 20;
  var activeCategoryId = "length";
  var drafts = {};
  var dirtyInputs = {};

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function ratioUnit(id, labelKey, symbol, factor) {
    return { id: id, labelKey: labelKey, symbol: symbol, factor: factor };
  }

  var CATEGORIES = [
    {
      id: "length", defaultUnit: "m", defaultValue: "1",
      units: [
        ratioUnit("m", "meter", "m", 1), ratioUnit("km", "kilometer", "km", 1000),
        ratioUnit("cm", "centimeter", "cm", 0.01), ratioUnit("mm", "millimeter", "mm", 0.001),
        ratioUnit("in", "inch", "in", 0.0254), ratioUnit("ft", "foot", "ft", 0.3048),
        ratioUnit("yd", "yard", "yd", 0.9144), ratioUnit("mi", "mile", "mi", 1609.344),
        ratioUnit("chi", "chi", "市尺", 1 / 3), ratioUnit("zhang", "zhang", "丈", 10 / 3),
        ratioUnit("li", "li", "华里", 500)
      ]
    },
    {
      id: "area", defaultUnit: "m2", defaultValue: "1",
      units: [
        ratioUnit("m2", "squareMeter", "m²", 1), ratioUnit("km2", "squareKilometer", "km²", 1000000),
        ratioUnit("cm2", "squareCentimeter", "cm²", 0.0001), ratioUnit("ha", "hectare", "ha", 10000),
        ratioUnit("mu", "mu", "亩", 2000 / 3), ratioUnit("in2", "squareInch", "in²", 0.00064516),
        ratioUnit("ft2", "squareFoot", "ft²", 0.09290304), ratioUnit("yd2", "squareYard", "yd²", 0.83612736),
        ratioUnit("acre", "acre", "acre", 4046.8564224)
      ]
    },
    {
      id: "volume", defaultUnit: "l", defaultValue: "1",
      units: [
        ratioUnit("m3", "cubicMeter", "m³", 1), ratioUnit("l", "liter", "L", 0.001),
        ratioUnit("ml", "milliliter", "mL", 0.000001), ratioUnit("cm3", "cubicCentimeter", "cm³", 0.000001),
        ratioUnit("in3", "cubicInch", "in³", 0.000016387064), ratioUnit("ft3", "cubicFoot", "ft³", 0.028316846592),
        ratioUnit("usgal", "usGallon", "US gal", 0.003785411784), ratioUnit("impgal", "imperialGallon", "Imp gal", 0.00454609),
        ratioUnit("usfloz", "usFluidOunce", "US fl oz", 0.0000295735295625), ratioUnit("impfloz", "imperialFluidOunce", "Imp fl oz", 0.0000284130625)
      ]
    },
    {
      id: "mass", defaultUnit: "kg", defaultValue: "1",
      units: [
        ratioUnit("kg", "kilogram", "kg", 1), ratioUnit("g", "gram", "g", 0.001),
        ratioUnit("mg", "milligram", "mg", 0.000001), ratioUnit("tonne", "tonne", "t", 1000),
        ratioUnit("jin", "jin", "市斤", 0.5), ratioUnit("liang", "liang", "两", 0.05),
        ratioUnit("lb", "pound", "lb", 0.45359237), ratioUnit("oz", "avoirdupoisOunce", "oz", 0.028349523125),
        ratioUnit("st", "stone", "st", 6.35029318)
      ]
    },
    {
      id: "speed", defaultUnit: "mps", defaultValue: "1",
      units: [
        ratioUnit("mps", "meterPerSecond", "m/s", 1), ratioUnit("kph", "kilometerPerHour", "km/h", 1 / 3.6),
        ratioUnit("mph", "milePerHour", "mph", 0.44704), ratioUnit("fps", "footPerSecond", "ft/s", 0.3048),
        ratioUnit("knot", "knot", "kn", 0.5144444444444445), ratioUnit("mach", "mach", "Mach", 340.29)
      ]
    },
    {
      id: "temperature", defaultUnit: "c", defaultValue: "20",
      units: [
        { id: "c", labelKey: "celsius", symbol: "°C", toBase: function (v) { return v; }, fromBase: function (v) { return v; } },
        { id: "f", labelKey: "fahrenheit", symbol: "°F", toBase: function (v) { return (v - 32) * 5 / 9; }, fromBase: function (v) { return v * 9 / 5 + 32; } },
        { id: "k", labelKey: "kelvin", symbol: "K", toBase: function (v) { return v - 273.15; }, fromBase: function (v) { return v + 273.15; } },
        { id: "r", labelKey: "rankine", symbol: "°R", toBase: function (v) { return v * 5 / 9 - 273.15; }, fromBase: function (v) { return (v + 273.15) * 9 / 5; } }
      ]
    },
    {
      id: "wind", defaultUnit: "beaufort", defaultValue: "3",
      units: [
        ratioUnit("mps", "meterPerSecond", "m/s", 1), ratioUnit("kph", "kilometerPerHour", "km/h", 1 / 3.6),
        ratioUnit("mph", "milePerHour", "mph", 0.44704), ratioUnit("knot", "knot", "kn", 0.5144444444444445),
        { id: "beaufort", labelKey: "beaufort", symbol: "Bft", beaufort: true }
      ]
    },
    {
      id: "data", defaultUnit: "byte", defaultValue: "1",
      units: [
        ratioUnit("bit", "bit", "bit", 0.125), ratioUnit("byte", "byte", "B", 1),
        ratioUnit("kb", "kilobyte", "KB", 1000), ratioUnit("kib", "kibibyte", "KiB", 1024),
        ratioUnit("mb", "megabyte", "MB", 1000000), ratioUnit("mib", "mebibyte", "MiB", 1048576),
        ratioUnit("gb", "gigabyte", "GB", 1000000000), ratioUnit("gib", "gibibyte", "GiB", 1073741824),
        ratioUnit("tb", "terabyte", "TB", 1000000000000), ratioUnit("tib", "tebibyte", "TiB", 1099511627776)
      ]
    },
    {
      id: "time", defaultUnit: "min", defaultValue: "1",
      units: [
        ratioUnit("ns", "nanosecond", "ns", 1e-9), ratioUnit("us", "microsecond", "µs", 1e-6),
        ratioUnit("ms", "millisecond", "ms", 0.001), ratioUnit("sec", "second", "s", 1),
        ratioUnit("min", "minute", "min", 60), ratioUnit("hour", "hour", "h", 3600),
        ratioUnit("day", "day", "d", 86400), ratioUnit("week", "week", "wk", 604800)
      ]
    },
    {
      id: "pressure", defaultUnit: "atm", defaultValue: "1",
      units: [
        ratioUnit("pa", "pascal", "Pa", 1), ratioUnit("kpa", "kilopascal", "kPa", 1000),
        ratioUnit("mpa", "megapascal", "MPa", 1000000), ratioUnit("bar", "bar", "bar", 100000),
        ratioUnit("atm", "atmosphere", "atm", 101325), ratioUnit("psi", "psi", "psi", 6894.757293168),
        ratioUnit("mmhg", "millimeterMercury", "mmHg", 133.322387415), ratioUnit("torr", "torr", "Torr", 133.322368421)
      ]
    },
    {
      id: "energy", defaultUnit: "kwh", defaultValue: "1",
      units: [
        ratioUnit("j", "joule", "J", 1), ratioUnit("kj", "kilojoule", "kJ", 1000),
        ratioUnit("mj", "megajoule", "MJ", 1000000), ratioUnit("wh", "wattHour", "Wh", 3600),
        ratioUnit("kwh", "kilowattHour", "kWh", 3600000), ratioUnit("cal", "calorie", "cal", 4.184),
        ratioUnit("kcal", "kilocalorie", "kcal", 4184), ratioUnit("btu", "btu", "BTU", 1055.05585262),
        ratioUnit("ev", "electronvolt", "eV", 1.602176634e-19)
      ]
    },
    {
      id: "power", defaultUnit: "kw", defaultValue: "1",
      units: [
        ratioUnit("w", "watt", "W", 1), ratioUnit("kw", "kilowatt", "kW", 1000),
        ratioUnit("mw", "megawatt", "MW", 1000000), ratioUnit("ps", "metricHorsepower", "PS", 735.49875),
        ratioUnit("hp", "mechanicalHorsepower", "hp", 745.699871582), ratioUnit("btuh", "btuPerHour", "BTU/h", 0.293071070172)
      ]
    },
    {
      id: "angle", defaultUnit: "deg", defaultValue: "180",
      units: [
        ratioUnit("rad", "radian", "rad", 1), ratioUnit("deg", "degree", "°", Math.PI / 180),
        ratioUnit("grad", "gradian", "gon", Math.PI / 200), ratioUnit("turn", "turn", "turn", Math.PI * 2),
        ratioUnit("arcmin", "arcminute", "′", Math.PI / 10800), ratioUnit("arcsec", "arcsecond", "″", Math.PI / 648000)
      ]
    },
    {
      id: "flow", defaultUnit: "lpm", defaultValue: "1",
      units: [
        ratioUnit("m3s", "cubicMeterPerSecond", "m³/s", 1), ratioUnit("lps", "literPerSecond", "L/s", 0.001),
        ratioUnit("lpm", "literPerMinute", "L/min", 0.001 / 60), ratioUnit("m3h", "cubicMeterPerHour", "m³/h", 1 / 3600),
        ratioUnit("usgpm", "usGallonPerMinute", "US gal/min", 0.003785411784 / 60), ratioUnit("impgpm", "imperialGallonPerMinute", "Imp gal/min", 0.00454609 / 60),
        ratioUnit("cfm", "cubicFootPerMinute", "CFM", 0.028316846592 / 60)
      ]
    },
    {
      id: "cooking", defaultUnit: "uscup", defaultValue: "1",
      units: [
        ratioUnit("ml", "milliliter", "mL", 1), ratioUnit("l", "liter", "L", 1000),
        ratioUnit("ustsp", "usTeaspoon", "US tsp", 4.92892159375), ratioUnit("ustbsp", "usTablespoon", "US tbsp", 14.78676478125),
        ratioUnit("uscup", "usCup", "US cup", 236.5882365), ratioUnit("uspt", "usPint", "US pt", 473.176473),
        ratioUnit("usqt", "usQuart", "US qt", 946.352946), ratioUnit("metrictsp", "metricTeaspoon", "metric tsp", 5),
        ratioUnit("metrictbsp", "metricTablespoon", "metric tbsp", 15), ratioUnit("metriccup", "metricCup", "metric cup", 250)
      ]
    },
    {
      id: "fuel", defaultUnit: "l100km", defaultValue: "7",
      units: [
        { id: "l100km", labelKey: "literPer100Kilometer", symbol: "L/100 km", fuelBase: true, toBase: function (v) { return v; }, fromBase: function (v) { return v; } },
        { id: "kml", labelKey: "kilometerPerLiter", symbol: "km/L", reciprocal: true, toBase: function (v) { return 100 / v; }, fromBase: function (v) { return 100 / v; } },
        { id: "usmpg", labelKey: "usMpg", symbol: "US mpg", reciprocal: true, toBase: function (v) { return 235.214583 / v; }, fromBase: function (v) { return 235.214583 / v; } },
        { id: "impmpg", labelKey: "imperialMpg", symbol: "Imp mpg", reciprocal: true, toBase: function (v) { return 282.480936 / v; }, fromBase: function (v) { return 282.480936 / v; } }
      ]
    }
  ];

  var BEAUFORT = [
    [0, 0, 0.2, 0.25], [1, 0.3, 1.5, 1.55], [2, 1.6, 3.3, 3.35], [3, 3.4, 5.4, 5.45], [4, 5.5, 7.9, 7.95],
    [5, 8.0, 10.7, 10.75], [6, 10.8, 13.8, 13.85], [7, 13.9, 17.1, 17.15], [8, 17.2, 20.7, 20.75],
    [9, 20.8, 24.4, 24.45], [10, 24.5, 28.4, 28.45], [11, 28.5, 32.6, 32.65], [12, 32.7, Infinity, Infinity]
  ];

  function categoryById(id) { return CATEGORIES.find(function (category) { return category.id === id; }); }
  function unitById(category, id) { return category.units.find(function (unit) { return unit.id === id; }); }
  function unitLabel(unit) { return t("unitconvert.units." + unit.labelKey); }

  function parseNumber(raw) {
    var value = String(raw).trim();
    if (!value || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function toBase(unit, value) { return unit.toBase ? unit.toBase(value) : value * unit.factor; }
  function fromBase(unit, value) { return unit.fromBase ? unit.fromBase(value) : value / unit.factor; }

  function formatNumber(value) {
    if (value === Infinity) return "∞";
    if (!Number.isFinite(value)) return "";
    if (Object.is(value, -0)) value = 0;
    var abs = Math.abs(value);
    if ((abs >= 1e12 || (abs > 0 && abs < 1e-8))) return value.toExponential(7).replace(/\.0+(?=e)/, "").replace(/(\.\d*?)0+(?=e)/, "$1");
    return Number(value.toPrecision(10)).toString();
  }

  function beaufortByLevel(level) {
    if (!Number.isInteger(level) || level < 0 || level > 12) return null;
    return BEAUFORT[level];
  }

  function beaufortBySpeed(speed) {
    if (speed < 0) return null;
    for (var i = 0; i < BEAUFORT.length; i += 1) {
      if (speed < BEAUFORT[i][3] || i === BEAUFORT.length - 1) return BEAUFORT[i];
    }
    return BEAUFORT[12];
  }

  function beaufortRepresentative(item) {
    return item[0] === 12 ? item[1] : (item[1] + item[2]) / 2;
  }

  function rangeText(item) {
    return item[0] === 12 ? "≥ " + formatNumber(item[1]) + " m/s" : formatNumber(item[1]) + "–" + formatNumber(item[2]) + " m/s";
  }

  function classificationRangeText(item) {
    var lower = item[0] === 0 ? 0 : BEAUFORT[item[0] - 1][3];
    return item[0] === 12 ? "≥ " + formatNumber(lower) + " m/s" : formatNumber(lower) + "–< " + formatNumber(item[3]) + " m/s";
  }

  function validateValue(category, unit, value) {
    if (unit.beaufort && !beaufortByLevel(value)) return "beaufort";
    if (category.id === "fuel" && value < 0) return "fuel";
    if (category.id === "fuel" && unit.reciprocal && value === 0) return "fuel";
    return "";
  }

  function convert(category, sourceUnit, value) {
    if (category.id === "wind") {
      var windBand;
      var windBase;
      if (sourceUnit.beaufort) {
        windBand = beaufortByLevel(value);
        if (!windBand) return null;
        windBase = beaufortRepresentative(windBand);
      } else {
        windBase = toBase(sourceUnit, value);
        windBand = beaufortBySpeed(windBase);
        if (!windBand) return null;
      }
      return {
        baseValue: windBase,
        windBand: windBand,
        values: category.units.reduce(function (result, unit) {
          result[unit.id] = unit.beaufort ? String(windBand[0]) : formatNumber(fromBase(unit, windBase));
          return result;
        }, {})
      };
    }

    var baseValue = toBase(sourceUnit, value);
    if (!Number.isFinite(baseValue)) {
      if (!(category.id === "fuel" && sourceUnit.fuelBase && value === 0 && baseValue === 0)) return null;
    }
    var values = {};
    for (var i = 0; i < category.units.length; i += 1) {
      var unit = category.units[i];
      var converted = fromBase(unit, baseValue);
      var allowsInfinity = category.id === "fuel" && sourceUnit.fuelBase && value === 0 && unit.reciprocal && converted === Infinity;
      if (!Number.isFinite(converted) && !allowsInfinity) return null;
      values[unit.id] = formatNumber(converted);
    }
    return {
      baseValue: baseValue,
      values: values
    };
  }

  function loadHistory() {
    try {
      var list = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      return list.filter(function (item) {
        var category = categoryById(item.categoryId);
        return category && unitById(category, item.sourceUnitId) && parseNumber(item.rawValue) !== null;
      }).slice(0, MAX_HISTORY);
    } catch (e) { return []; }
  }

  function saveHistory(categoryId, sourceUnitId, rawValue) {
    var list = loadHistory();
    list = list.filter(function (item) {
      return !(item.categoryId === categoryId && item.sourceUnitId === sourceUnitId && item.rawValue === rawValue);
    });
    list.unshift({ categoryId: categoryId, sourceUnitId: sourceUnitId, rawValue: rawValue });
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))); } catch (e) {}
  }

  function init(parent) {
    var tabs = CATEGORIES.map(function (category) {
      return '<button class="b64-tab uc-tab" data-category="' + category.id + '">' + t("unitconvert.tabs." + category.id) + '</button>';
    }).join("");

    parent.innerHTML =
      '<div class="uc-tool">' +
      '  <div class="b64-tabs uc-tabs">' + tabs + '</div>' +
      '  <div id="uc-note" class="uc-note"></div>' +
      '  <div id="uc-grid" class="uc-grid"></div>' +
      '  <div id="uc-status" class="uc-status" aria-live="polite"></div>' +
      '  <div id="uc-history" class="history-bar"></div>' +
      '</div>';

    parent.querySelectorAll(".uc-tab").forEach(function (button) {
      button.addEventListener("click", function () { switchCategory(this.dataset.category); });
    });

    switchCategory(activeCategoryId);
    renderHistory();
  }

  function switchCategory(categoryId, sourceUnitId, rawValue) {
    var category = categoryById(categoryId);
    if (!category) return;
    activeCategoryId = categoryId;
    var activeButton = null;
    document.querySelectorAll(".uc-tab").forEach(function (button) {
      var isActive = button.dataset.category === categoryId;
      button.classList.toggle("active", isActive);
      if (isActive) activeButton = button;
    });
    if (activeButton) {
      var tabs = activeButton.closest(".uc-tabs");
      var tabsRect = tabs.getBoundingClientRect();
      var buttonRect = activeButton.getBoundingClientRect();
      var targetLeft = tabs.scrollLeft + buttonRect.left - tabsRect.left - Math.max(0, (tabs.clientWidth - buttonRect.width) / 2);
      tabs.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    }
    document.getElementById("uc-note").innerHTML =
      '<strong>' + t("unitconvert.tabs." + category.id) + '</strong><span>' + t("unitconvert.notes." + category.id) + '</span>';
    renderGrid(category);

    var draft = drafts[categoryId] || { sourceUnitId: category.defaultUnit, rawValue: category.defaultValue };
    if (sourceUnitId) draft = { sourceUnitId: sourceUnitId, rawValue: rawValue };
    setSource(category, draft.sourceUnitId, draft.rawValue);
  }

  function renderGrid(category) {
    var grid = document.getElementById("uc-grid");
    grid.innerHTML = category.units.map(function (unit, index) {
      return '<div class="uc-unit" data-unit="' + unit.id + '" style="--uc-index:' + index + '">' +
        '<label for="uc-input-' + unit.id + '"><span class="uc-unit-name">' + unitLabel(unit) + '</span><span class="uc-unit-symbol">' + unit.symbol + '</span></label>' +
        '<div class="uc-input-row"><input id="uc-input-' + unit.id + '" class="uc-input" data-unit="' + unit.id + '" inputmode="decimal" autocomplete="off" aria-label="' + unitLabel(unit) + '">' +
        '<button class="uc-copy" data-unit="' + unit.id + '" title="' + t("unitconvert.copy") + '" aria-label="' + t("unitconvert.copy") + ' ' + unitLabel(unit) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>' +
      '</div>';
    }).join("");

    grid.querySelectorAll(".uc-input").forEach(function (input) {
      input.addEventListener("input", function () {
        dirtyInputs[category.id + ":" + this.dataset.unit] = true;
        updateFromInput(category, this);
      });
      input.addEventListener("focus", function () { markSource(this.dataset.unit); });
      input.addEventListener("blur", function () { persistInput(category, this); });
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") { persistInput(category, this); this.blur(); }
      });
    });

    grid.querySelectorAll(".uc-copy").forEach(function (button) {
      button.addEventListener("click", function () { copyValue(category, this.dataset.unit); });
    });
  }

  function setSource(category, unitId, rawValue) {
    var input = document.querySelector('.uc-input[data-unit="' + unitId + '"]');
    if (!input) return;
    input.value = rawValue;
    updateFromInput(category, input);
  }

  function markSource(unitId) {
    document.querySelectorAll(".uc-unit").forEach(function (card) {
      card.classList.toggle("is-source", card.dataset.unit === unitId);
    });
  }

  function updateFromInput(category, input) {
    var raw = input.value.trim();
    var sourceUnit = unitById(category, input.dataset.unit);
    markSource(sourceUnit.id);
    drafts[category.id] = { sourceUnitId: sourceUnit.id, rawValue: raw };

    if (!raw) {
      document.querySelectorAll(".uc-input").forEach(function (field) { if (field !== input) field.value = ""; });
      setStatus("", "");
      return;
    }

    var value = parseNumber(raw);
    if (value === null) { clearOtherInputs(input); setStatus(t("unitconvert.invalid"), "error"); return; }
    var validationError = validateValue(category, sourceUnit, value);
    if (validationError === "beaufort") { clearOtherInputs(input); setStatus(t("unitconvert.invalidBeaufort"), "error"); return; }
    if (validationError === "fuel") { clearOtherInputs(input); setStatus(t("unitconvert.invalidFuel"), "error"); return; }

    var result = convert(category, sourceUnit, value);
    if (!result) { clearOtherInputs(input); setStatus(t("unitconvert.invalid"), "error"); return; }

    category.units.forEach(function (unit) {
      var field = document.querySelector('.uc-input[data-unit="' + unit.id + '"]');
      if (field && field !== input) field.value = result.values[unit.id];
    });

    if (category.id === "wind") {
      var key = sourceUnit.beaufort ? (result.windBand[0] === 12 ? "windFromLevelOpen" : "windFromLevel") : "windFromSpeed";
      var range = sourceUnit.beaufort ? rangeText(result.windBand) : classificationRangeText(result.windBand);
      setStatus(t("unitconvert." + key).replace("{level}", result.windBand[0]).replace("{range}", range), "info");
    } else if (category.id === "fuel" && sourceUnit.fuelBase && value === 0) {
      setStatus(t("unitconvert.zeroFuel"), "info");
    } else if (category.id === "speed" && sourceUnit.id === "mach") {
      setStatus(t("unitconvert.machNote"), "info");
    } else if (category.id === "temperature" && result.baseValue < -273.15) {
      setStatus(t("unitconvert.absoluteZero"), "warning");
    } else {
      setStatus(t("unitconvert.ready"), "ok");
    }
  }

  function clearOtherInputs(source) {
    document.querySelectorAll(".uc-input").forEach(function (field) { if (field !== source) field.value = ""; });
  }

  function setStatus(message, type) {
    var status = document.getElementById("uc-status");
    if (!status) return;
    status.className = "uc-status" + (type ? " uc-status-" + type : "");
    status.textContent = message;
  }

  function persistInput(category, input) {
    var dirtyKey = category.id + ":" + input.dataset.unit;
    if (!dirtyInputs[dirtyKey]) return;
    delete dirtyInputs[dirtyKey];
    var raw = input.value.trim();
    var unit = unitById(category, input.dataset.unit);
    var value = parseNumber(raw);
    if (value === null || validateValue(category, unit, value) || !convert(category, unit, value)) return;
    saveHistory(category.id, unit.id, raw);
    renderHistory();
  }

  function copyValue(category, unitId) {
    var input = document.querySelector('.uc-input[data-unit="' + unitId + '"]');
    if (!input || !input.value) return;
    var unit = unitById(category, unitId);
    var text = input.value + " " + unit.symbol;
    if (category.id === "wind" && unit.beaufort) {
      var band = beaufortByLevel(Number(input.value));
      if (band) text += " (" + rangeText(band) + "; " + t(band[0] === 12 ? "unitconvert.lowerBound" : "unitconvert.midpoint") + ")";
    }
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      setStatus(t("unitconvert.copyFailed"), "error");
      return;
    }
    navigator.clipboard.writeText(text).then(function () {
      if (window.showCopyToast) window.showCopyToast(t("unitconvert.copied"));
    }).catch(function () {
      setStatus(t("unitconvert.copyFailed"), "error");
    });
  }

  function renderHistory() {
    var history = loadHistory();
    var container = document.getElementById("uc-history");
    if (!container) return;
    if (!history.length) { container.innerHTML = ""; return; }
    container.innerHTML = '<span class="history-label">' + t("history.label") + '</span>' + history.map(function (item, index) {
      var category = categoryById(item.categoryId);
      var unit = unitById(category, item.sourceUnitId);
      var label = item.rawValue + " " + unit.symbol + " · " + t("unitconvert.tabs." + category.id);
      return '<button class="history-chip" data-index="' + index + '" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</button>';
    }).join("");
    container.querySelectorAll(".history-chip").forEach(function (button) {
      button.addEventListener("click", function () {
        var item = history[Number(this.dataset.index)];
        if (item) switchCategory(item.categoryId, item.sourceUnitId, item.rawValue);
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  return { init: init };
})();
