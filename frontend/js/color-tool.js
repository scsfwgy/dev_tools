// Color Converter — automatic parsing, live conversion and browser-native eyedropper.
var ColorTool = (function () {
  var current = { r: 88, g: 166, b: 255, a: 1 };
  var inputTimer = null;
  var opacityValue = 100;

  function t(key) { return (window.__t && window.__t(key)) || key; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function round(value, digits) {
    var factor = Math.pow(10, digits || 0);
    var result = Math.round(value * factor) / factor;
    return Object.is(result, -0) ? 0 : result;
  }
  function alphaText(value) { return String(round(value, 3)); }
  function channel(value) { return Math.round(clamp(value, 0, 255)); }
  function normalize(color) {
    return { r: channel(color.r), g: channel(color.g), b: channel(color.b), a: clamp(Number(color.a == null ? 1 : color.a), 0, 1) };
  }
  function hexByte(value) { return channel(value).toString(16).padStart(2, "0").toUpperCase(); }
  function toRgbHex(color) { return "#" + hexByte(color.r) + hexByte(color.g) + hexByte(color.b); }
  function toArgbHex(color) { return "#" + hexByte(color.a * 255) + hexByte(color.r) + hexByte(color.g) + hexByte(color.b); }

  function splitFunction(raw) {
    var match = String(raw).trim().match(/^([a-z]+)\((.*)\)$/i);
    if (!match) return null;
    var body = match[2].trim().replace(/\s*\/\s*/g, " / ");
    var pieces = body.indexOf(",") !== -1 ? body.split(/\s*,\s*/) : body.split(/\s+/);
    return { name: match[1].toLowerCase(), values: pieces.filter(Boolean) };
  }
  function parseNumeric(token, percentBase) {
    if (token == null) return null;
    var text = String(token).trim();
    var value = parseFloat(text);
    if (!Number.isFinite(value)) return null;
    return text.endsWith("%") ? value * percentBase / 100 : value;
  }
  function parseAlpha(token) {
    if (token == null) return 1;
    var value = parseNumeric(token, 1);
    return value == null ? null : clamp(value, 0, 1);
  }
  function parseHue(token) {
    var text = String(token || "0").toLowerCase();
    var value = parseFloat(text);
    if (!Number.isFinite(value)) return null;
    if (text.endsWith("turn")) value *= 360;
    else if (text.endsWith("rad")) value *= 180 / Math.PI;
    else if (text.endsWith("grad")) value *= 0.9;
    return ((value % 360) + 360) % 360;
  }
  function components(parts, count) {
    var slash = parts.indexOf("/");
    var alpha = slash === -1 ? null : parts[slash + 1];
    var values = slash === -1 ? parts : parts.slice(0, slash);
    if (alpha == null && values.length === count + 1) alpha = values.pop();
    var parsedAlpha = parseAlpha(alpha);
    return values.length === count && parsedAlpha != null ? { values: values, alpha: parsedAlpha } : null;
  }

  function hslToRgb(h, s, l, a) {
    h /= 360;
    var r; var g; var b;
    if (s === 0) r = g = b = l;
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      function hue(n) {
        if (n < 0) n += 1;
        if (n > 1) n -= 1;
        if (n < 1 / 6) return p + (q - p) * 6 * n;
        if (n < 1 / 2) return q;
        if (n < 2 / 3) return p + (q - p) * (2 / 3 - n) * 6;
        return p;
      }
      r = hue(h + 1 / 3); g = hue(h); b = hue(h - 1 / 3);
    }
    return normalize({ r: r * 255, g: g * 255, b: b * 255, a: a });
  }
  function hsvToRgb(h, s, v, a) {
    var c = v * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = v - c;
    var parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return normalize({ r: (parts[0] + m) * 255, g: (parts[1] + m) * 255, b: (parts[2] + m) * 255, a: a });
  }
  function hwbToRgb(h, w, b, a) {
    if (w + b >= 1) {
      var gray = w / (w + b);
      return normalize({ r: gray * 255, g: gray * 255, b: gray * 255, a: a });
    }
    var base = hsvToRgb(h, 1, 1, a);
    var factor = 1 - w - b;
    return normalize({ r: (base.r / 255 * factor + w) * 255, g: (base.g / 255 * factor + w) * 255, b: (base.b / 255 * factor + w) * 255, a: a });
  }
  function cmykToRgb(c, m, y, k, a) {
    return normalize({ r: 255 * (1 - c) * (1 - k), g: 255 * (1 - m) * (1 - k), b: 255 * (1 - y) * (1 - k), a: a });
  }

  function rgbToXyz(color) {
    function linear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    var r = linear(color.r); var g = linear(color.g); var b = linear(color.b);
    return { x: r * 0.4123908 + g * 0.3575843 + b * 0.1804808, y: r * 0.212639 + g * 0.7151687 + b * 0.0721923, z: r * 0.0193308 + g * 0.1191948 + b * 0.9505322 };
  }
  function xyzToRgb(x, y, z, a) {
    var r = x * 3.2409699 + y * -1.5373832 + z * -0.4986108;
    var g = x * -0.9692436 + y * 1.8759675 + z * 0.0415551;
    var b = x * 0.0556301 + y * -0.203977 + z * 1.0569715;
    function gamma(v) { return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055); }
    return normalize({ r: gamma(r), g: gamma(g), b: gamma(b), a: a });
  }
  function d65ToD50(xyz) {
    return { x: xyz.x * 1.0479298 + xyz.y * 0.0229468 - xyz.z * 0.0501922, y: xyz.x * 0.0296278 + xyz.y * 0.9904345 - xyz.z * 0.0170738, z: -xyz.x * 0.009243 + xyz.y * 0.0150552 + xyz.z * 0.7518743 };
  }
  function d50ToD65(xyz) {
    return { x: xyz.x * 0.9554734 - xyz.y * 0.0230985 + xyz.z * 0.0632593, y: -xyz.x * 0.0283697 + xyz.y * 1.0099955 + xyz.z * 0.0210414, z: xyz.x * 0.012314 + xyz.y * -0.0205077 + xyz.z * 1.3303659 };
  }
  function xyzToLab(xyz65) {
    var xyz = d65ToD50(xyz65);
    function f(v) { var d = 6 / 29; return v > d * d * d ? Math.cbrt(v) : v / (3 * d * d) + 4 / 29; }
    var fx = f(xyz.x / 0.96422); var fy = f(xyz.y); var fz = f(xyz.z / 0.82521);
    return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }
  function labToXyz(l, a, b) {
    var fy = (l + 16) / 116; var fx = fy + a / 500; var fz = fy - b / 200;
    function inv(v) { var d = 6 / 29; return v > d ? v * v * v : 3 * d * d * (v - 4 / 29); }
    return d50ToD65({ x: 0.96422 * inv(fx), y: inv(fy), z: 0.82521 * inv(fz) });
  }
  function xyzToOklab(xyz) {
    var l = Math.cbrt(0.8190224 * xyz.x + 0.3619063 * xyz.y - 0.1288738 * xyz.z);
    var m = Math.cbrt(0.0329837 * xyz.x + 0.9292868 * xyz.y + 0.0361447 * xyz.z);
    var s = Math.cbrt(0.0481772 * xyz.x + 0.2642395 * xyz.y + 0.6335478 * xyz.z);
    return { l: 0.2104543 * l + 0.7936178 * m - 0.004072 * s, a: 1.9779985 * l - 2.4285922 * m + 0.4505937 * s, b: 0.025904 * l + 0.7827718 * m - 0.8086758 * s };
  }
  function oklabToXyz(l, a, b) {
    var ll = Math.pow(l + 0.3963378 * a + 0.2158038 * b, 3);
    var mm = Math.pow(l - 0.1055613 * a - 0.0638542 * b, 3);
    var ss = Math.pow(l - 0.0894842 * a - 1.2914855 * b, 3);
    return { x: 1.2268799 * ll - 0.557815 * mm - 0.281391 * ss, y: -0.0405757 * ll + 1.1122868 * mm - 0.0717111 * ss, z: -0.0763729 * ll - 0.4214933 * mm + 1.586924 * ss };
  }

  function parseColor(raw) {
    var value = String(raw || "").trim();
    if (!value) return null;
    var hex = value.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hex) {
      var h = hex[1];
      if (h.length < 5) h = h.split("").map(function (v) { return v + v; }).join("");
      if (h.length === 8) return normalize({ a: parseInt(h.slice(0, 2), 16) / 255, r: parseInt(h.slice(2, 4), 16), g: parseInt(h.slice(4, 6), 16), b: parseInt(h.slice(6, 8), 16) });
      return normalize({ r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 });
    }
    var fn = splitFunction(value);
    if (fn) {
      var data; var v; var hValue; var xyz;
      if (fn.name === "rgb" || fn.name === "rgba") {
        data = components(fn.values, 3); if (!data) return null;
        v = data.values.map(function (part) { return parseNumeric(part, 255); });
        if (v.some(function (item) { return item == null; })) return null;
        return normalize({ r: v[0], g: v[1], b: v[2], a: data.alpha });
      }
      if (["hsl", "hsla", "hsv", "hsb", "hwb"].indexOf(fn.name) !== -1) {
        data = components(fn.values, 3); if (!data) return null;
        hValue = parseHue(data.values[0]);
        v = [parseNumeric(data.values[1], 1), parseNumeric(data.values[2], 1)];
        if (hValue == null || v.some(function (item) { return item == null; })) return null;
        v = v.map(function (item) { return clamp(item, 0, 1); });
        return fn.name.indexOf("hsl") === 0 ? hslToRgb(hValue, v[0], v[1], data.alpha) : (fn.name === "hwb" ? hwbToRgb(hValue, v[0], v[1], data.alpha) : hsvToRgb(hValue, v[0], v[1], data.alpha));
      }
      if (fn.name === "cmyk") {
        data = components(fn.values, 4); if (!data) return null;
        v = data.values.map(function (part) { return parseNumeric(part, 1); });
        if (v.some(function (item) { return item == null; })) return null;
        v = v.map(function (item) { return clamp(item, 0, 1); });
        return cmykToRgb(v[0], v[1], v[2], v[3], data.alpha);
      }
      if (["lab", "lch", "oklab", "oklch", "xyz"].indexOf(fn.name) !== -1) {
        data = components(fn.values, 3); if (!data) return null;
        v = data.values.map(function (part, index) { return parseNumeric(part, index === 0 && fn.name !== "xyz" ? (fn.name.indexOf("ok") === 0 ? 1 : 100) : 1); });
        if (v.some(function (item) { return item == null; })) return null;
        if (fn.name === "xyz") return xyzToRgb(v[0], v[1], v[2], data.alpha);
        if (fn.name === "lch" || fn.name === "oklch") { hValue = parseHue(data.values[2]); v = [v[0], v[1] * Math.cos(hValue * Math.PI / 180), v[1] * Math.sin(hValue * Math.PI / 180)]; }
        xyz = fn.name.indexOf("ok") === 0 ? oklabToXyz(v[0], v[1], v[2]) : labToXyz(v[0], v[1], v[2]);
        return xyzToRgb(xyz.x, xyz.y, xyz.z, data.alpha);
      }
    }
    if (typeof document !== "undefined" && window.CSS && CSS.supports && CSS.supports("color", value)) {
      var probe = document.createElement("span");
      probe.style.color = value; probe.style.display = "none";
      document.body.appendChild(probe);
      var computed = getComputedStyle(probe).color;
      probe.remove();
      if (computed && computed.toLowerCase() !== value.toLowerCase()) return parseColor(computed);
      var canvas = document.createElement("canvas").getContext("2d");
      canvas.fillStyle = "#010203"; canvas.fillStyle = value;
      if (canvas.fillStyle !== "#010203" || value.toLowerCase() === "#010203") return parseColor(canvas.fillStyle);
    }
    return value.toLowerCase() === "transparent" ? { r: 0, g: 0, b: 0, a: 0 } : null;
  }

  function rgbToHsl(color) {
    var r = color.r / 255; var g = color.g / 255; var b = color.b / 255;
    var max = Math.max(r, g, b); var min = Math.min(r, g, b); var d = max - min;
    var h = 0; var l = (max + min) / 2; var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    return { h: (h + 360) % 360, s: s, l: l };
  }
  function rgbToHsv(color) {
    var r = color.r / 255; var g = color.g / 255; var b = color.b / 255;
    var max = Math.max(r, g, b); var min = Math.min(r, g, b); var d = max - min; var h = 0;
    if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
  }
  function formatResults(color) {
    var hsl = rgbToHsl(color); var hsv = rgbToHsv(color);
    var white = Math.min(color.r, color.g, color.b) / 255; var black = 1 - Math.max(color.r, color.g, color.b) / 255;
    var k = black; var denom = 1 - k;
    var c = denom === 0 ? 0 : (1 - color.r / 255 - k) / denom; var m = denom === 0 ? 0 : (1 - color.g / 255 - k) / denom; var y = denom === 0 ? 0 : (1 - color.b / 255 - k) / denom;
    var xyz = rgbToXyz(color); var lab = xyzToLab(xyz); var oklab = xyzToOklab(xyz);
    var lchC = Math.hypot(lab.a, lab.b); var lchH = (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360;
    var okC = Math.hypot(oklab.a, oklab.b); var okH = (Math.atan2(oklab.b, oklab.a) * 180 / Math.PI + 360) % 360;
    var suffix = color.a < 1 ? " / " + alphaText(color.a) : "";
    return [
      { id: "hex", label: "HEX / ARGB", value: toArgbHex(color) },
      { id: "rgb", label: "RGB / RGBA", value: "rgb(" + color.r + " " + color.g + " " + color.b + suffix + ")" },
      { id: "hsl", label: "HSL", value: "hsl(" + round(hsl.h, 1) + " " + round(hsl.s * 100, 1) + "% " + round(hsl.l * 100, 1) + "%" + suffix + ")" },
      { id: "hsv", label: "HSV / HSB", value: "hsv(" + round(hsv.h, 1) + " " + round(hsv.s * 100, 1) + "% " + round(hsv.v * 100, 1) + "%" + suffix + ")" },
      { id: "hwb", label: "HWB", value: "hwb(" + round(hsv.h, 1) + " " + round(white * 100, 1) + "% " + round(black * 100, 1) + "%" + suffix + ")" },
      { id: "cmyk", label: "CMYK", value: "cmyk(" + [c, m, y, k].map(function (item) { return round(item * 100, 1) + "%"; }).join(" ") + suffix + ")" },
      { id: "lab", label: "CIELAB", value: "lab(" + round(lab.l, 2) + "% " + round(lab.a, 2) + " " + round(lab.b, 2) + suffix + ")" },
      { id: "lch", label: "CIELCH", value: "lch(" + round(lab.l, 2) + "% " + round(lchC, 2) + " " + round(lchH, 2) + suffix + ")" },
      { id: "oklab", label: "OKLab", value: "oklab(" + round(oklab.l, 4) + " " + round(oklab.a, 4) + " " + round(oklab.b, 4) + suffix + ")" },
      { id: "oklch", label: "OKLCH", value: "oklch(" + round(oklab.l, 4) + " " + round(okC, 4) + " " + round(okH, 2) + suffix + ")" },
      { id: "xyz", label: "CIE XYZ (D65)", value: "xyz(" + round(xyz.x, 5) + " " + round(xyz.y, 5) + " " + round(xyz.z, 5) + suffix + ")" }
    ];
  }

  function setStatus(message, error) {
    var element = document.getElementById("color-status");
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("is-error", Boolean(error));
  }
  function updateUi(updateInput, skipOpacitySync) {
    var preview = document.getElementById("color-preview");
    var picker = document.getElementById("color-native-picker");
    var alpha = document.getElementById("color-alpha");
    var alphaValue = document.getElementById("color-alpha-value");
    var solidHex = toRgbHex(current);
    if (preview) preview.style.setProperty("--preview-color", "rgba(" + current.r + "," + current.g + "," + current.b + "," + current.a + ")");
    var previewHex = document.getElementById("color-preview-hex");
    if (previewHex) previewHex.textContent = toArgbHex(current);
    if (picker) picker.value = solidHex;
    if (alpha) alpha.value = String(Math.round(current.a * 100));
    if (alphaValue) alphaValue.textContent = Math.round(current.a * 100) + "%";
    ["r", "g", "b"].forEach(function (key) {
      var range = document.getElementById("color-" + key); var value = document.getElementById("color-" + key + "-value");
      if (range) range.value = current[key]; if (value) value.textContent = current[key];
    });
    if (updateInput) document.getElementById("color-input").value = toArgbHex(current);
    var results = formatResults(current);
    document.getElementById("color-results").innerHTML = results.map(function (item) {
      return '<button class="color-result-card" type="button" data-copy="' + item.value.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"><span><strong>' + item.label + '</strong><small>' + t("color.formats." + item.id) + '</small></span><code>' + item.value + '</code><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg></button>';
    }).join("");
    bindCopyButtons();
    setStatus(t("color.ready").replace("{format}", results[0].value), false);
    if (!skipOpacitySync && document.getElementById("color-opacity-results")) {
      renderOpacityResults(current.a * 100, false);
    }
  }
  function applyInput() {
    var input = document.getElementById("color-input");
    var parsed = parseColor(input.value);
    input.classList.toggle("is-invalid", !parsed);
    if (!parsed) { setStatus(t("color.invalid"), true); return; }
    current = parsed; updateUi(false);
  }
  function bindCopyButtons() {
    document.querySelectorAll(".color-result-card").forEach(function (button) {
      button.addEventListener("click", function () {
        var text = this.dataset.copy;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { if (window.showCopyToast) window.showCopyToast(t("color.copied")); });
      });
    });
  }
  function rangeChanged() {
    current = normalize({ r: Number(document.getElementById("color-r").value), g: Number(document.getElementById("color-g").value), b: Number(document.getElementById("color-b").value), a: Number(document.getElementById("color-alpha").value) / 100 });
    updateUi(true);
  }

  function opacityText(value) { return String(round(value, 2)); }

  function opacityResults(opacity) {
    var alpha = opacity / 100;
    var alphaByte = Math.round(alpha * 255);
    var alphaHex = hexByte(alphaByte);
    var rgbHex = "#" + hexByte(current.r) + hexByte(current.g) + hexByte(current.b);
    return [
      { id: "opacityPercent", label: t("color.opacityFormats.opacityPercent"), value: opacityText(opacity) + "%" },
      { id: "transparencyPercent", label: t("color.opacityFormats.transparencyPercent"), value: opacityText(100 - opacity) + "%" },
      { id: "cssAlpha", label: t("color.opacityFormats.cssAlpha"), value: alphaText(alpha) },
      { id: "alphaByte", label: t("color.opacityFormats.alphaByte"), value: String(alphaByte) },
      { id: "alphaHex", label: t("color.opacityFormats.alphaHex"), value: "#" + alphaHex },
      { id: "hexArgb", label: t("color.opacityFormats.hexArgb"), value: "#" + alphaHex + rgbHex.slice(1) },
      { id: "cssRgba", label: t("color.opacityFormats.cssRgba"), value: "rgb(" + current.r + " " + current.g + " " + current.b + " / " + alphaText(alpha) + ")" }
    ];
  }

  function renderOpacityResults(opacity, syncColor) {
    opacityValue = clamp(opacity, 0, 100);
    var transparency = 100 - opacityValue;
    var opacityInput = document.getElementById("color-opacity-input");
    var transparencyInput = document.getElementById("color-transparency-input");
    var slider = document.getElementById("color-opacity-range");
    var status = document.getElementById("color-opacity-status");
    if (opacityInput) opacityInput.value = opacityText(opacityValue);
    if (transparencyInput) transparencyInput.value = opacityText(transparency);
    if (opacityInput) opacityInput.classList.remove("is-invalid");
    if (transparencyInput) transparencyInput.classList.remove("is-invalid");
    if (slider) slider.value = String(opacityValue);
    if (status) { status.textContent = t("color.opacityReady").replace("{opacity}", opacityText(opacityValue)).replace("{transparency}", opacityText(transparency)); status.classList.remove("is-error"); }
    if (syncColor) { current.a = opacityValue / 100; updateUi(true, true); }
    var results = opacityResults(opacityValue);
    var container = document.getElementById("color-opacity-results");
    if (container) {
      container.innerHTML = results.map(function (item) {
        return '<button class="color-result-card" type="button" data-opacity-copy="' + item.value.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"><span><strong>' + item.label + '</strong></span><code>' + item.value + '</code><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg></button>';
      }).join("");
      container.querySelectorAll("[data-opacity-copy]").forEach(function (button) {
        button.addEventListener("click", function () {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(this.dataset.opacityCopy).then(function () { if (window.showCopyToast) window.showCopyToast(t("color.copied")); });
        });
      });
    }
    var swatch = document.getElementById("color-opacity-swatch");
    if (swatch) swatch.style.setProperty("--opacity-color", "rgba(" + current.r + "," + current.g + "," + current.b + "," + opacityValue / 100 + ")");
  }

  function applyOpacityInput(input, isTransparency) {
    var value = Number(input.value);
    var status = document.getElementById("color-opacity-status");
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      input.classList.add("is-invalid");
      if (status) { status.textContent = t("color.opacityInvalid"); status.classList.add("is-error"); }
      return;
    }
    input.classList.remove("is-invalid");
    renderOpacityResults(isTransparency ? 100 - value : value, true);
  }

  function init(parent) {
    opacityValue = current.a * 100;
    parent.innerHTML =
      '<div class="color-tool">' +
      ' <section class="color-workbench">' +
      '  <div id="color-preview" class="color-preview"><div class="color-preview-value"><span>' + t("color.preview") + '</span><strong id="color-preview-hex"></strong></div></div>' +
      '  <div class="color-controls">' +
      '   <label class="color-input-label" for="color-input"><span>' + t("color.inputLabel") + '</span><small>' + t("color.inputHint") + '</small></label>' +
      '   <div class="color-input-row"><input id="color-input" class="color-input" type="text" value="#58A6FF" spellcheck="false" autocomplete="off"><label class="color-picker-button" title="' + t("color.openPicker") + '"><input id="color-native-picker" type="color" value="#58A6FF"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 3-8.5 8.5-4 1 1-4L12 2Z"/><path d="m14 4 6 6"/><path d="M14 14h7v7h-7z"/></svg></label><button id="color-eyedropper" class="color-action-button" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 3 2 2-8.5 8.5-3-3L18 2l1 1Z"/><path d="m9.5 10.5-6 6V20h3.5l6-6"/></svg><span>' + t("color.eyedropper") + '</span></button></div>' +
      '   <div id="color-status" class="color-status" aria-live="polite"></div>' +
      '   <div class="color-channels">' +
      '    <label class="color-channel color-channel-a"><span>A</span><input id="color-alpha" type="range" min="0" max="100" value="100"><output id="color-alpha-value">100%</output></label>' +
      ["r", "g", "b"].map(function (key) { return '<label class="color-channel color-channel-' + key + '"><span>' + key.toUpperCase() + '</span><input id="color-' + key + '" type="range" min="0" max="255" value="' + current[key] + '"><output id="color-' + key + '-value">' + current[key] + '</output></label>'; }).join("") +
      '   </div>' +
      '  </div>' +
      ' </section>' +
      ' <div class="color-results-head"><div><h2>' + t("color.resultsTitle") + '</h2><p>' + t("color.resultsHint") + '</p></div><span>' + t("color.clickToCopy") + '</span></div>' +
      ' <section id="color-results" class="color-results" aria-label="' + t("color.resultsTitle") + '"></section>' +
      ' <section class="color-support"><h2>' + t("color.supportedTitle") + '</h2><p>' + t("color.supportedText") + '</p><div class="color-examples"><button type="button" data-color-example="#7C3AED">#7C3AED</button><button type="button" data-color-example="rgb(34 197 94 / 80%)">rgb(34 197 94 / 80%)</button><button type="button" data-color-example="hsl(198 93% 60%)">hsl(198 93% 60%)</button><button type="button" data-color-example="oklch(0.7 0.18 35)">oklch(0.7 0.18 35)</button></div></section>' +
      ' <div class="color-opacity-panel">' +
      '  <section class="color-opacity-workbench">' +
      '   <div id="color-opacity-swatch" class="color-opacity-swatch"><span>' + t("color.opacityPreview") + '</span></div>' +
      '   <div class="color-opacity-controls"><h2>' + t("color.opacityTitle") + '</h2><p>' + t("color.opacityHint") + '</p>' +
      '    <div class="color-opacity-inputs"><label><span>' + t("color.opacityLabel") + '</span><div><input id="color-opacity-input" class="color-input" type="number" min="0" max="100" step="0.1" value="100"><b>%</b></div></label><label><span>' + t("color.transparencyLabel") + '</span><div><input id="color-transparency-input" class="color-input" type="number" min="0" max="100" step="0.1" value="0"><b>%</b></div></label></div>' +
      '    <input id="color-opacity-range" class="color-opacity-range" type="range" min="0" max="100" step="0.1" value="100" aria-label="' + t("color.opacityLabel") + '">' +
      '    <div id="color-opacity-status" class="color-status" aria-live="polite"></div>' +
      '   </div>' +
      '  </section>' +
      '  <div class="color-results-head"><div><h2>' + t("color.opacityResultsTitle") + '</h2><p>' + t("color.opacityResultsHint") + '</p></div><span>' + t("color.clickToCopy") + '</span></div>' +
      '  <section id="color-opacity-results" class="color-results" aria-label="' + t("color.opacityResultsTitle") + '"></section>' +
      ' </div>' +
      '</div>';

    document.getElementById("color-opacity-input").addEventListener("input", function () { applyOpacityInput(this, false); });
    document.getElementById("color-transparency-input").addEventListener("input", function () { applyOpacityInput(this, true); });
    document.getElementById("color-opacity-range").addEventListener("input", function () { renderOpacityResults(Number(this.value), true); });

    var input = document.getElementById("color-input");
    input.addEventListener("input", function () { clearTimeout(inputTimer); inputTimer = setTimeout(applyInput, 80); });
    input.addEventListener("keydown", function (event) { if (event.key === "Enter") { clearTimeout(inputTimer); applyInput(); } });
    document.getElementById("color-native-picker").addEventListener("input", function () { var parsed = parseColor(this.value); if (parsed) { parsed.a = current.a; current = parsed; updateUi(true); } });
    document.querySelectorAll(".color-channel input").forEach(function (range) { range.addEventListener("input", rangeChanged); });
    document.querySelectorAll("[data-color-example]").forEach(function (button) { button.addEventListener("click", function () { input.value = this.dataset.colorExample; applyInput(); }); });
    var eyeButton = document.getElementById("color-eyedropper");
    if (!("EyeDropper" in window)) { eyeButton.disabled = true; eyeButton.title = t("color.eyedropperUnsupported"); }
    eyeButton.addEventListener("click", function () {
      if (!("EyeDropper" in window)) return;
      new EyeDropper().open().then(function (result) { var parsed = parseColor(result.sRGBHex); if (parsed) { parsed.a = current.a; current = parsed; updateUi(true); } }).catch(function () {});
    });
    updateUi(false);
    renderOpacityResults(opacityValue, false);
  }

  return { init: init, parseColor: parseColor, formatResults: formatResults, opacityResults: opacityResults };
})();
