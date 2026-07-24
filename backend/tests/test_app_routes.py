import json
import logging
import re
import shutil
import subprocess
from pathlib import Path
from unittest.mock import Mock

import requests

from app import TOOLS, TOOL_REGISTRY, content_last_modified, public_tool_ids
from routes import exchange_rates as exchange_rates_route
from routes import site as site_route


def assert_tool_is_lazy_loaded(frontend_dir, filename):
    index_html = (frontend_dir / "index.html").read_text()
    assert filename not in index_html
    assert any((config["script"] or "").split("?", 1)[0].endswith(filename) for config in TOOL_REGISTRY.values())


def test_health_and_ip_routes(client, caplog):
    caplog.set_level(logging.INFO, logger="app")
    health = client.get("/api/health")
    ip = client.get("/api/ip", headers={"X-Forwarded-For": "203.0.113.10, 10.0.0.1"})

    assert health.status_code == 200
    assert health.get_json() == {"status": "ok"}
    assert re.fullmatch(r"[0-9a-f]{12}", health.headers["X-Request-ID"])
    assert ip.get_json() == {"ip": "203.0.113.10"}
    assert any(
        "event=http_request" in record.message
        and "path=/api/health" in record.message
        and "status=200" in record.message
        for record in caplog.records
    )


def test_exchange_rate_tool_is_registered_and_localized(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    app_script = client.get("/js/app.js").get_data(as_text=True)
    exchange_script = client.get("/js/exchange-tool.js").get_data(as_text=True)

    assert TOOL_REGISTRY["exchange"]["processing"] == "hybrid"
    assert TOOL_REGISTRY["exchange"]["indexable"] is True
    assert zh_locale["menu"]["exchange"] == "汇率计算"
    assert en_locale["menu"]["exchange"] == "Exchange Rates"
    assert zh_locale["exchange"]["currencies"]["KRW"] == "韩元"
    assert zh_locale["exchange"]["recommendedCurrencies"] == "常用币种"
    assert en_locale["exchange"]["searchCurrency"] == "Search by code, name or symbol…"
    assert "new Intl.DisplayNames" in exchange_script
    assert "exchange-picker-search" in exchange_script
    assert "exchange.recommendedCurrencies" in exchange_script
    assert 'typeof ExchangeTool !== "undefined"' in app_script
    assert '{ id: "data", tools: ["visualization", "function", "timestamp", "unitconvert", "color", "exchange", "tax", "mortgage"] }' in app_script
    assert_tool_is_lazy_loaded(frontend_dir, "exchange-tool.js")
    assert 'var reverseRate = oneRate === null ? null : 1 / oneRate;' in exchange_script
    assert 'exchange-rate-reverse' in exchange_script


def test_device_environment_tool_is_local_lazy_loaded_and_comprehensive(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)
    script_response = client.get("/js/device-tool.js")
    script = script_response.get_data(as_text=True)

    assert script_response.status_code == 200
    assert TOOL_REGISTRY["device"]["processing"] == "local"
    assert TOOL_REGISTRY["device"]["global"] == "DeviceTool"
    assert zh_locale["device"]["environmentTitle"] == "浏览器环境诊断报告"
    assert en_locale["device"]["localBadge"] == "Strict local mode · No analytics or session replay"
    assert zh_locale["device"]["authorized"]["checks"]["location"]["title"] == "定位"
    assert en_locale["device"]["authorized"]["checks"]["camera"]["title"] == "Camera"
    assert 'typeof DeviceTool !== "undefined"' in app_script
    assert "DeviceTool.deactivate" in app_script
    assert_tool_is_lazy_loaded(frontend_dir, "device-tool.js")
    assert "navigator.storage.estimate()" in script
    assert "getHighEntropyValues" in script
    assert "WEBGL_debug_renderer_info" in script
    assert "enumerateDevices()" in script
    assert "navigator.permissions.query" in script
    assert "navigator.geolocation.getCurrentPosition" in script
    assert "navigator.mediaDevices.getUserMedia" in script
    assert "window.getScreenDetails()" in script
    assert "navigator.bluetooth.requestDevice" in script
    assert "navigator.usb.requestDevice" in script
    assert "navigator.usb.requestDevice({ filters: [{}] })" in script
    assert "navigator.hid.requestDevice" in script
    assert "navigator.hid.requestDevice({ filters: [] })" in script
    assert "navigator.serial.requestPort" in script
    assert "activeMediaStreams.slice().forEach(stopMediaStream)" in script
    assert 'data-clarity-mask="true"' in script
    assert 'output.authorized = {}' in script
    assert "reportMarkdown" in script
    assert "reportData" in script
    assert "fetch(" not in script
    assert "/api/ip" not in script
    assert ".device-hero" in app_css
    assert ".device-capabilities" in app_css
    assert ".device-advanced" in app_css
    assert ".device-authorized-grid" in app_css
    assert "@media (max-width: 640px)" in app_css
    assert 'id === "device" && !isDeviceRoutePath()' in app_script
    assert 'strictLocalDeviceSession && id !== "device"' in app_script
    assert "window.location.assign(buildPathForMenu(id, currentLang))" in app_script
    assert '(routed.menuId === "device") !== strictLocalDeviceSession' in app_script
    assert 'toolId === "device" || strictLocalDeviceSession' in app_script

    page = client.get("/zh/tool/device").get_data(as_text=True)
    assert "浏览器本地处理，数据不上传" in page
    assert "部分信息需要请求服务端" not in page
    device_response = client.get("/zh/tool/device")
    assert "connect-src 'self'" in device_response.headers["Content-Security-Policy"]
    assert "googletagmanager.com" not in device_response.headers["Content-Security-Policy"]
    assert "Content-Security-Policy" not in client.get("/zh/tool/json").headers

    node = shutil.which("node")
    if node:
        program = r'''
const fs = require("fs");
const vm = require("vm");
const context = { window: { __t: key => key }, navigator: {}, console, Date, String, Number, Object, Array, JSON, RegExp, isFinite };
vm.createContext(context);
vm.runInContext(fs.readFileSync("frontend/js/device-tool.js", "utf8"), context);
const core = context.DeviceTool.__test;
const values = {
  chrome: core.detectBrowser("Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36").name === "Google Chrome",
  edge: core.detectBrowser("Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36 Edg/150.0").name === "Microsoft Edge",
  mac: core.detectOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)") === "macOS 10.15.7",
  android: core.detectOS("Mozilla/5.0 (Linux; Android 16)") === "Android 16",
  bytes: core.formatBytes(1073741824) === "1.00 GB",
  offset: /^UTC[+-]\d{2}:\d{2}$/.test(core.timezoneOffset()),
  usbId: core.formatHexIdentifier(0x46d) === "0x046D",
  cancelled: core.authorizationErrorState({ name: "NotFoundError" }) === "cancelled",
  denied: core.authorizationErrorState({ name: "NotAllowedError" }) === "denied"
};
process.stdout.write(JSON.stringify(values));
'''
        completed = subprocess.run(
            [node, "-e", program],
            cwd=frontend_dir.parent,
            check=True,
            capture_output=True,
            text=True,
        )
        assert all(json.loads(completed.stdout).values())


def test_visualization_tool_is_local_lazy_loaded_and_localized(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)
    script_response = client.get("/js/visualization-tool.js")
    script = script_response.get_data(as_text=True)

    assert script_response.status_code == 200
    assert TOOL_REGISTRY["visualization"]["processing"] == "local"
    assert TOOL_REGISTRY["visualization"]["indexable"] is True
    assert TOOL_REGISTRY["visualization"]["icon"] == "chart"
    assert zh_locale["menu"]["visualization"] == "数据可视化"
    assert en_locale["menu"]["visualization"] == "Data Visualization"
    assert zh_locale["visualization"]["line"] == "折线图"
    assert en_locale["visualization"]["exportPng"] == "Export PNG"
    assert zh_locale["visualization"]["advanced"] == "高级自定义"
    assert zh_locale["visualization"]["colorPalette"] == "图表配色"
    assert zh_locale["visualization"]["animation"] == "动画"
    assert zh_locale["visualization"]["replayAnimation"] == "重播动画"
    assert zh_locale["visualization"]["animationDuration"] == "动画时长（毫秒）"
    assert zh_locale["visualization"]["animationDurationHint"] == "0 表示无动画"
    assert zh_locale["visualization"]["animationStyle"] == "动画样式"
    assert zh_locale["visualization"]["animationDraw"] == "常规动画"
    assert zh_locale["visualization"]["animationStagger"] == "依次呈现"
    assert zh_locale["visualization"]["animationBounce"] == "弹性回弹"
    assert zh_locale["visualization"]["animationDisabledReduced"] == "已根据系统“减少动态效果”设置关闭动画"
    assert en_locale["visualization"]["formatCurrency"] == "Currency"
    assert en_locale["visualization"]["fullscreen"] == "Expand preview"
    assert en_locale["visualization"]["animation"] == "Animation"
    assert en_locale["visualization"]["replayAnimation"] == "Replay animation"
    assert en_locale["visualization"]["animationDuration"] == "Animation duration (ms)"
    assert en_locale["visualization"]["animationDurationHint"] == "0 disables animation"
    assert en_locale["visualization"]["animationStyle"] == "Animation style"
    assert en_locale["visualization"]["animationDraw"] == "Standard animation"
    assert en_locale["visualization"]["animationZoom"] == "Zoom and reveal"
    assert 'typeof VisualizationTool !== "undefined"' in app_script
    assert "VisualizationTool.deactivate" in app_script
    assert '{ id: "data", tools: ["visualization", "function", "timestamp", "unitconvert", "color", "exchange", "tax", "mortgage"] }' in app_script
    assert_tool_is_lazy_loaded(frontend_dir, "visualization-tool.js")
    assert "echarts@6.1.0/dist/echarts.min.js" in script
    assert "MAX_ROWS = 5000" in script
    assert 'renderer: "canvas"' in script
    assert 'renderMode: "richText"' in script
    assert "getDataURL" in script
    assert "pixelRatio: 2" in script
    assert "chart.dispose()" in script
    assert "requestFullscreen" not in script
    assert "document.fullscreenElement" not in script
    assert "is-viewport-fullscreen" in script
    assert 'showSymbol: showPoints' in script
    assert "discoverJsonCandidates" in script
    assert 'id="viz-json-path"' in script
    assert "formatDateValue" in script
    assert 'id="viz-date-pattern"' in script
    assert 'role="separator"' in script
    assert "bindPanelResizer" in script
    assert "renderDataPreview" in script
    assert "effectiveRows" in script
    assert "formatSeriesValue" in script
    assert "renderPaletteControls" in script
    assert "normalizeCustomPalette" in script
    assert "colors: customPalette.slice()" in script
    assert "Intl.NumberFormat" in script
    assert "exportConfig" in script
    assert "applyImportedConfig" in script
    assert '"data:application/json;charset=utf-8,"' in script
    assert 'id="viz-advanced"' in script
    assert 'id="viz-data-preview"' in script
    assert 'id="viz-animate"' in script
    assert 'id="viz-animate-fs"' in script
    assert 'id="viz-animation-duration"' in script
    assert 'id="viz-animation-style"' in script
    assert "animationStyleProgress" in script
    assert "staggerItemProgress" in script
    assert "progressivePolylineSegments" in script
    assert "lineDrawGraphics" in script
    assert "pieSweepData" in script
    assert "replayAnimation" in script
    assert "updateToolbarState" in script
    assert "animationDuration" in script
    assert "animationDurationUpdate" in script
    assert 'animationType: "expansion"' in script
    assert 'animationTypeUpdate: "transition"' in script
    assert 'id: "viz-pie-" + pieField' in script
    assert 'id: "viz-line-" + field' in script
    assert "replayChartOption" in script
    assert "replayFrameOption" in script
    assert "window.requestAnimationFrame(renderReplayFrame)" in script
    assert "cancelReplayAnimation" in script
    assert "legend: { selected: selectedMap }" not in script
    assert "animationEnabled" in script
    assert "config.animationDuration" in script
    assert "config.animationStyle" in script
    assert ".viz-resizer" in app_css
    assert ".viz-preview-panel.is-fullscreen" in app_css
    assert ".viz-preview-panel.is-viewport-fullscreen" in app_css
    assert ".viz-preview-panel.is-fullscreen .viz-exit-fullscreen::before" in app_css
    assert ".viz-animate" in app_css
    assert ".viz-animate-fs" in app_css
    assert ".viz-fs-actions" in app_css
    assert ".viz-fs-toolbar" in app_css
    assert ".viz-preview-panel.is-fullscreen .viz-fs-actions" in app_css
    assert ".viz-preview-panel.is-fullscreen .viz-chart-shell { position: absolute; inset: 50px 0 0;" in app_css
    assert ".viz-palette-colors" in app_css
    assert ".viz-series-format-row" in app_css
    assert ".viz-animation-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));" in app_css
    assert ".viz-series-format-row, .viz-transform-controls, .viz-animation-controls { grid-template-columns: 1fr; }" in app_css
    assert ".viz-data-table" in app_css
    assert 'activeMode = "table";\n    chartType = "line";' in script
    assert "localStorage" not in script
    assert "fetch(" not in script

    page = client.get("/zh/tool/visualization").get_data(as_text=True)
    assert "数据可视化工具" in page
    assert "浏览器本地处理，数据不上传" in page
    assert "https://dev.tools24.uk/zh/tool/visualization" in page


def test_function_plotter_is_local_lazy_loaded_and_localized(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)
    script_response = client.get("/js/function-tool.js")
    script = script_response.get_data(as_text=True)

    assert script_response.status_code == 200
    assert TOOL_REGISTRY["function"]["processing"] == "local"
    assert TOOL_REGISTRY["function"]["global"] == "FunctionTool"
    assert TOOL_REGISTRY["function"]["indexable"] is True
    assert TOOL_REGISTRY["function"]["icon"] == "function"
    assert zh_locale["menu"]["function"] == "函数绘图"
    assert en_locale["menu"]["function"] == "Function Plotter"
    assert zh_locale["functionTool"]["replay"] == "重播动画"
    assert zh_locale["functionTool"]["fullscreen"] == "浏览器内全屏"
    assert zh_locale["functionTool"]["reset"] == "重置"
    assert en_locale["functionTool"]["commonFunctions"] == "Common functions"
    assert zh_locale["functionTool"]["examples"]["damped"]["name"] == "阻尼振荡"
    assert zh_locale["functionTool"]["examples"]["piecewise"]["name"] == "分段函数"
    assert zh_locale["functionTool"]["examples"]["heart"]["name"] == "心形参数曲线"
    assert zh_locale["functionTool"]["examples"]["threePiece"]["name"] == "三段函数"
    assert en_locale["functionTool"]["syntaxNestedLabel"] == "More cases"
    assert en_locale["functionTool"]["examples"]["quadratic"]["description"] == "A parabola symmetric about the Y axis"
    assert 'typeof FunctionTool !== "undefined"' in app_script
    assert "FunctionTool.deactivate" in app_script
    assert_tool_is_lazy_loaded(frontend_dir, "function-tool.js")
    assert "requestAnimationFrame" in script
    assert "compileExpression" in script
    assert "sampleFunction" in script
    assert "eval(" not in script
    assert "new Function" not in script
    assert "fetch(" not in script
    assert "localStorage" not in script
    assert '{ key: "sine", label: "y = sin(x)", expression: "y = sin(x)" }' in script
    assert '{ key: "damped", label: "y = e⁻|x|/4 cos(4x)", expression: "y = exp(-abs(x)/4) * cos(4x)" }' in script
    assert '{ key: "piecewise", label: "if(x<0) -x else x", expression: "y = if(x < 0) -x else x" }' in script
    assert 'expression: "y = if(x < -2) -1\\n    else if(x <= 2) x^2/4\\n    else 1"' in script
    assert 'expression: "y = if(x < 0) -1\\n    else if(x == 0) 0\\n    else 1"' in script
    assert 'expression: "y = if(x < 0) 0\\n    else if(x <= 4) 1\\n    else 0"' in script
    assert 'label: "x(t); y(t)"' in script
    assert 'expression: "x = 16sin(t)^3; y = 13cos(t)-5cos(2t)-2cos(3t)-cos(4t)"' in script
    assert "compilePlotExpression" in script
    assert "sampleParametric" in script
    assert "fitBoundsToCanvas" in script
    assert '<textarea id="fn-expression" rows="2" maxlength="200"' in script
    assert 'class="fn-syntax-guide"' in script
    assert "event.ctrlKey || event.metaKey" in script
    assert '<table class="fn-examples-table">' in script
    assert 't("functionTool.functionDescription")' in script
    assert 't("functionTool.functionFormula")' in script
    assert "drawAxisArrowheads" in script
    assert "context.lineTo(plotRight - arrowSize, axisY - 4);" in script
    assert "context.lineTo(axisX - 4, metrics.top + arrowSize);" in script
    assert 'id="fn-replay"' in script
    assert 'id="fn-fullscreen"' in script
    assert 'id="fn-toolbar-reset"' in script
    assert 'id="fn-fullscreen-reset"' in script
    assert 'id="fn-chart" class="fn-chart"' in script
    assert 'id="fn-advanced"' not in script
    assert '<details class="fn-advanced">' in script
    assert ".fn-tool" in app_css
    assert ".fn-chart" in app_css
    assert "position: absolute;" in app_css
    assert ".fn-preview.is-fullscreen" in app_css
    assert ".fn-fullscreen-toolbar" in app_css
    assert ".fn-preview-help" in app_css
    assert ".fn-chart-help" not in app_css
    assert 'class="fn-preview-help"' in script
    assert 'class="fn-fullscreen-toolbar"' in script
    assert ".fn-preview.is-fullscreen .fn-chart-shell {\n  position: absolute;\n  inset: 50px 0 0;" in app_css
    assert ".fn-preview.is-fullscreen .fn-chart-shell { inset: 61px 0 0; }" in app_css
    assert "body.fn-fullscreen-active" in app_css
    assert "requestFullscreen" not in script
    assert "document.fullscreenElement" not in script
    assert "@media (max-width: 760px)" in app_css

    page = client.get("/zh/tool/function")
    page_text = page.get_data(as_text=True)
    assert page.status_code == 200
    assert "函数绘图工具" in page_text
    assert "浏览器本地处理，数据不上传" in page_text
    assert "https://dev.tools24.uk/zh/tool/function" in page_text


def test_function_plotter_parser_supports_math_and_rejects_code():
    node = shutil.which("node")
    if node is None:
        return
    project_root = Path(__file__).resolve().parents[2]
    program = r'''
const fs = require("fs");
const vm = require("vm");
const context = {
  window: { __t: key => key },
  console, Math, Array, Object, String, Number, JSON, RegExp, isFinite
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("frontend/js/function-tool.js", "utf8"), context);
const core = context.FunctionTool.__test;
const value = expression => core.compileExpression(expression).evaluate(2);
const throws = expression => { try { core.compileExpression(expression); return false; } catch (_) { return true; } };
const throwsPlot = expression => { try { core.compilePlotExpression(expression); return false; } catch (_) { return true; } };
const heart = core.compilePlotExpression("x=16sin(t)^3; y=13cos(t)-5cos(2t)-2cos(3t)-cos(4t)");
const circleMultiline = core.compilePlotExpression("x=cos(t)\ny=sin(t)");
const heartPoints = core.sampleParametric(heart, 0, 2 * Math.PI);
const heartBounds = core.calculateParametricBounds(heartPoints);
const results = {
  square: value("y=x^2") === 4,
  superscript: value("f(x)=x²") === 4,
  implicit: value("2x + 2(x+1)") === 10,
  negativePrecedence: value("-x^2") === -4,
  constants: Math.abs(value("sin(pi/2) + e^0") - 2) < 1e-12,
  log: Math.abs(value("log(100)") - 2) < 1e-12,
  damped: Math.abs(value("exp(-abs(x)/4) * cos(4x)") - (Math.exp(-0.5) * Math.cos(8))) < 1e-12,
  piecewisePositive: value("x < 0 ? -x : x") === 2,
  piecewiseNegative: core.compileExpression("x < 0 ? -x : x").evaluate(-3) === 3,
  friendlyIfPositive: value("if(x < 0, -x, x)") === 2,
  friendlyIfNegative: core.compileExpression("if(x < 0, -x, x)").evaluate(-3) === 3,
  nestedIf: value("if(x < 0, -1, if(x == 2, 2, 1))") === 2,
  readableIfPositive: value("if(x < 0) -x else x") === 2,
  readableIfNegative: core.compileExpression("if(x < 0) -x else x").evaluate(-3) === 3,
  readableThreePieceLeft: core.compileExpression("y = if(x < -2) -1\n    else if(x <= 2) x^2/4\n    else 1").evaluate(-3) === -1,
  readableThreePieceMiddle: Math.abs(core.compileExpression("y = if(x < -2) -1\n    else if(x <= 2) x^2/4\n    else 1").evaluate(2) - 1) < 1e-12,
  readableThreePieceRight: core.compileExpression("y = if(x < -2) -1\n    else if(x <= 2) x^2/4\n    else 1").evaluate(3) === 1,
  inclusiveComparison: value("x >= 2 ? 10 : 0") === 10,
  nestedConditional: value("x < 0 ? -1 : x == 2 ? 2 : 1") === 2,
  parametricMode: heart.mode === "parametric",
  multilineParametric: circleMultiline.mode === "parametric" &&
    Math.abs(circleMultiline.x.evaluate(0) - 1) < 1e-12 &&
    Math.abs(circleMultiline.y.evaluate(Math.PI / 2) - 1) < 1e-12,
  parametricVariable: Math.abs(core.compileExpression("sin(t)").evaluate(Math.PI / 2) - 1) < 1e-12,
  heartClosed: Math.abs(heartPoints[0].x - heartPoints[heartPoints.length - 1].x) < 1e-9 &&
    Math.abs(heartPoints[0].y - heartPoints[heartPoints.length - 1].y) < 1e-9,
  heartBounds: heartBounds.xMin < -16 && heartBounds.xMax > 16 && heartBounds.yMin < -17 && heartBounds.yMax > 11,
  rejectIncompleteParametric: throwsPlot("x=sin(t); z=cos(t)"),
  rejectMissingConditionalColon: throws("x < 0 ? -x"),
  rejectBadIf: throws("if(x < 0, -x)"),
  rejectReadableIfWithoutElse: throws("if(x < 0) -x"),
  rejectMemberAccess: throws("window.alert(1)"),
  rejectUnknownFunction: throws("random(x)"),
  rejectAssignment: throws("x=2"),
  rejectUnclosed: throws("sin(x"),
  integerTick: core.formatTick(10, 5) === "10",
  decimalTick: core.formatTick(0.5, 0.2) === "0.5"
};
console.log(JSON.stringify(results));
'''
    completed = subprocess.run(
        [node, "-e", program],
        cwd=project_root,
        check=True,
        capture_output=True,
        text=True,
    )
    assert all(json.loads(completed.stdout).values())


def test_visualization_parser_handles_supported_shapes_and_limits():
    node = shutil.which("node")
    if node is None:
        return
    project_root = Path(__file__).resolve().parents[2]
    program = r'''
const fs = require("fs");
const vm = require("vm");
const context = {
  window: { __t: key => key },
  console, Array, Object, String, Number, JSON, RegExp, isFinite,
  setTimeout, clearTimeout
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("frontend/js/visualization-tool.js", "utf8"), context);
const core = context.VisualizationTool.__test;
const throws = fn => { try { fn(); return false; } catch (_) { return true; } };
const csv = core.parseTable('name,value,note\n"A, one",12,"hello ""world"""\nB,18,ok');
const tsv = core.parseTable("month\tsales\nJan\t12\nFeb\t18");
const duplicate = core.parseTable("name,name,value\nA,B,1");
const nested = core.parseJsonDataset('[{"month":"Jan","metrics":{"sales":12}},{"month":"Feb","metrics":{"sales":18}}]');
const columns = core.parseJsonDataset('{"month":["Jan","Feb"],"sales":[12,18]}');
const nestedSource = core.parseJsonSource('{"status":"ok","data":{"items":[{"timestamp":1767225600,"value":12},{"timestamp":1767312000,"value":18}]},"backup":[1,2]}');
const nestedCandidate = nestedSource.candidates.find(candidate => candidate.label === "data.items");
const nestedSelected = core.rowsFromJsonCandidate(nestedCandidate);
const nullable = core.parseTable("month,value\nJan,12\nFeb,\nMar,bad\nApr,16\nMay,20\nJun,24");
const palette = ["#112233", "#223344", "#334455", "#445566", "#556677", "#667788", "#778899"];
const animation = core.animationConfig(12, 900, false);
const reducedAnimation = core.animationConfig(12, 900, true);
const largeAnimation = core.animationConfig(1001, 900, false);
const zeroAnimation = core.animationConfig(12, 0, false);
const growProgress = core.animationStyleProgress(0.5, "grow");
const bounceProgress = core.animationStyleProgress(0.7, "bounce");
const invalidStyle = core.normalizeAnimationStyle("spin");
const drawProgress = core.animationStyleProgress(0.5, "draw");
const partialLine = core.progressivePolylineSegments([[0, 0], [10, 0], [20, 10]], 0.25);
const replayOption = {
  legend: {},
  series: [{
    type: "pie",
    radius: ["28%", "68%"],
    label: { show: true },
    labelLine: { show: true },
    data: [{ name: "Jan", value: 12 }]
  }]
};
const replayResult = core.replayChartOption({
  getOption: () => ({ legend: [{ selected: { Jan: false, Feb: true } }] }),
}, replayOption);
const pieReplayStart = core.replayFrameOption(replayResult, 0);
const pieReplayHalf = core.replayFrameOption(replayResult, 0.5);
const pieReplayEnd = core.replayFrameOption(replayResult, 1);
const lineReplayOption = { yAxis: { type: "value" }, series: [{ type: "line", data: [12, null, 18] }] };
const lineReplayStart = core.replayFrameOption(lineReplayOption, 0);
const lineReplayHalf = core.replayFrameOption(lineReplayOption, 0.5);
const staggerReplayHalf = core.replayFrameOption(lineReplayOption, 0.5, "stagger", false);
const zoomReplayStart = core.replayFrameOption(lineReplayOption, 0, "zoom", false);
const bounceReplay = core.replayFrameOption(lineReplayOption, bounceProgress, "bounce", false);
const drawGraphics = core.lineDrawGraphics({
  convertToPixel: (_finder, point) => [point[0] * 10, point[1]]
}, {
  color: ["#123456"],
  series: [{ type: "line", smooth: false, data: [12, 18, 15] }]
}, 0.5);
const drawReplay = core.replayFrameOption(lineReplayOption, 0.5, "draw", false, drawGraphics);
const standardBar = core.replayFrameOption({
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [10, 20] }]
}, 0.5, "draw", false);
const pieSweepStart = core.pieSweepData([{ name: "A", value: 10 }, { name: "B", value: 20 }, { name: "C", value: 30 }], 0);
const pieSweepHalf = core.pieSweepData([{ name: "A", value: 10 }, { name: "B", value: 20 }, { name: "C", value: 30 }], 0.5);
const pieSweepFrame = core.replayFrameOption(replayResult, 0.5, "draw", false);
const pieStaggerHalf = core.replayFrameOption(replayResult, 0.5, "stagger", false);
const stackedBounds = core.replayAxisBounds([
  { type: "bar", stack: "total", data: [10, -3] },
  { type: "bar", stack: "total", data: [15, -7] }
]);
const tooMany = "name,value\n" + Array.from({ length: 5001 }, (_, index) => "R" + index + "," + index).join("\n");
const result = {
  quotedCsv: csv.rows[0].name === "A, one" && csv.rows[0].note === 'hello "world"',
  tsv: tsv.rows.length === 2 && tsv.numericFields[0] === "sales",
  duplicateHeaders: duplicate.fields.map(field => field.name).join("|") === "name|name (2)|value",
  nestedJson: nested.fields.some(field => field.name === "metrics.sales"),
  objectArrays: columns.rows.length === 2 && columns.rows[1].sales === 18,
  nestedArrayDiscovery: nestedSource.candidates.some(candidate => candidate.label === "data.items") && nestedSource.candidates.some(candidate => candidate.label === "backup"),
  nestedArraySelection: nestedSelected.rows[1].value === 18,
  invalidNumericBecomesNull: nullable.rows[2].value === null,
  qualityMetadata: nullable.fields.find(field => field.name === "value").emptyCount === 1 && nullable.fields.find(field => field.name === "value").invalidCount === 1,
  noNumericRejected: throws(() => core.parseTable("name,city\nA,Paris\nB,London")),
  noArrayRejected: throws(() => core.parseJsonDataset('{"status":"ok","data":{"value":3}}')),
  customUtcDate: core.formatDateValue(new Date("2026-01-02T03:04:05.006Z"), "YYYY/MM/DD HH:mm:ss.SSS", true) === "2026/01/02 03:04:05.006",
  validPalette: core.normalizeCustomPalette(palette).join("|") === palette.join("|"),
  invalidPaletteRejected: core.normalizeCustomPalette(palette.slice(0, 6)).length === 0 && core.normalizeCustomPalette(palette.slice(0, 6).concat("red")).length === 0,
  animationConfig: animation.enabled && animation.duration === 900 && !reducedAnimation.enabled && !largeAnimation.enabled && !zeroAnimation.enabled,
  animationStyles: growProgress > 0.5 && growProgress < 1 && bounceProgress > 1 && drawProgress === 0.5 && invalidStyle === "draw",
  linePathDrawing: partialLine.length === 1 && partialLine[0].length === 2 && partialLine[0][1][0] > 6 && partialLine[0][1][0] < 7 && drawGraphics.length === 1 && drawGraphics[0].shape.points.length >= 2 && drawReplay.series[0].data[0] === 12 && drawReplay.series[0].lineStyle.opacity === 0 && drawReplay.graphic.length === 1,
  standardBarFromZero: standardBar.series[0].data.join("|") === "5|10",
  standardPieByAngle: pieSweepStart.slice(0, 3).every(item => item.value === 0) && pieSweepStart[3].value === 60 && pieSweepHalf.slice(0, 3).map(item => item.value).join("|") === "10|20|0" && pieSweepHalf[3].value === 30 && pieSweepFrame.series[0].radius.join("|") === "28%|68%" && pieSweepFrame.series[0].data.length === 2 && pieSweepFrame.series[0].data[1].name === "__viz-angle-mask__",
  replayUsesFreshOption: replayResult.series[0].data[0].value === 12,
  replayPreservesLegend: replayResult.legend.selected.Jan === false && replayResult.legend.selected.Feb === true,
  pieReplayFrames: pieReplayStart.series[0].radius.join("|") === "0%|0%" && pieReplayHalf.series[0].radius.join("|") === "14%|34%" && pieReplayEnd.series[0].radius.join("|") === "28%|68%",
  lineReplayFrames: lineReplayStart.series[0].data.join("|") === "0||0" && lineReplayHalf.series[0].data.join("|") === "6||9" && lineReplayStart.yAxis.min === 0 && lineReplayStart.yAxis.max > 18 && lineReplayOption.series[0].data[0] === 12,
  staggerReplayFrames: staggerReplayHalf.series[0].data[0] > staggerReplayHalf.series[0].data[2] && staggerReplayHalf.series[0].data[2] === 0 && pieStaggerHalf.series[0].data[0].value > 0,
  zoomReplayFrames: zoomReplayStart.series[0].data[0] > 9 && zoomReplayStart.series[0].data[0] < 12 && zoomReplayStart.series[0].lineStyle.opacity === 0,
  bounceReplayFrames: bounceReplay.series[0].data[0] > 12 && bounceReplay.yAxis.max > lineReplayStart.yAxis.max,
  stackedReplayBounds: stackedBounds.max > 25 && stackedBounds.min < -10,
  rowLimitRejected: throws(() => core.parseTable(tooMany))
};
process.stdout.write(JSON.stringify(result));
'''
    completed = subprocess.run(
        [node, "-e", program],
        cwd=project_root,
        check=True,
        capture_output=True,
        text=True,
    )
    assert all(json.loads(completed.stdout).values())


def test_exchange_rate_endpoint_normalizes_and_caches_remote_data(client, monkeypatch):
    currency_codes = [
        "EUR", "CNY", "USD", "JPY", "KRW", "HKD", "GBP", "AUD", "CAD", "SGD",
        "CHF", "THB", "AED", "AFN", "ALL", "AMD", "ANG", "ARS", "BAM", "BDT",
        "BGN", "BHD", "BIF", "BND", "BOB",
    ]
    rows = [
        {"date": "2026-07-13", "base": "EUR", "quote": code, "rate": index + 1.0}
        for index, code in enumerate(currency_codes)
    ]
    rate_response = Mock()
    rate_response.raise_for_status.return_value = None
    rate_response.json.return_value = rows
    currency_response = Mock()
    currency_response.raise_for_status.return_value = None
    currency_response.json.return_value = [
        {"iso_code": code, "name": f"Currency {code}", "symbol": code}
        for code in currency_codes
    ]
    remote_get = Mock(side_effect=[rate_response, currency_response])
    monkeypatch.setattr(exchange_rates_route.requests, "get", remote_get)
    monkeypatch.setattr(exchange_rates_route.cache_store, "cache_get", lambda _key: None)
    cache_set = Mock(return_value=True)
    monkeypatch.setattr(exchange_rates_route.cache_store, "cache_set", cache_set)
    monkeypatch.setitem(exchange_rates_route.app_settings._EXCHANGE_RATE_CACHE, "payload", None)
    monkeypatch.setitem(exchange_rates_route.app_settings._EXCHANGE_RATE_CACHE, "expires_at", 0.0)

    first = client.get("/api/exchange-rates")
    second = client.get("/api/exchange-rates")

    assert first.status_code == 200
    assert first.get_json()["rates"]["EUR"] == 1.0
    assert first.get_json()["rates"]["CNY"] > 0
    assert len(first.get_json()["currencies"]) == len(currency_codes)
    assert first.get_json()["currencies"][0]["code"] == "AED"
    assert first.get_json()["date"] == "2026-07-13"
    assert first.get_json()["cached"] is False
    assert second.get_json()["cached"] is True
    assert remote_get.call_count == 2
    cache_set.assert_called_once()


def test_exchange_rate_endpoint_uses_stale_local_cache_on_timeout(client, monkeypatch):
    currency_codes = [
        "EUR", "CNY", "USD", "JPY", "KRW", "HKD", "GBP", "AUD", "CAD", "SGD",
        "CHF", "THB", "AED", "AFN", "ALL", "AMD", "ANG", "ARS", "BAM", "BDT",
    ]
    payload = {
        "date": "2026-07-12",
        "base": "EUR",
        "rates": {code: 1.0 for code in currency_codes},
        "currencies": [{"code": code, "name": code, "symbol": code} for code in currency_codes],
        "fetched_at": exchange_rates_route.time.time(),
    }
    monkeypatch.setitem(exchange_rates_route.app_settings._EXCHANGE_RATE_CACHE, "payload", payload)
    monkeypatch.setitem(exchange_rates_route.app_settings._EXCHANGE_RATE_CACHE, "expires_at", 0.0)
    monkeypatch.setattr(exchange_rates_route.cache_store, "cache_get", lambda _key: None)
    monkeypatch.setattr(exchange_rates_route.requests, "get", Mock(side_effect=requests.exceptions.Timeout()))

    response = client.get("/api/exchange-rates")

    assert response.status_code == 200
    assert response.get_json()["stale"] is True


def test_exchange_rate_shared_cache_refreshes_daily_and_keeps_stale_fallback(client, monkeypatch):
    currency_codes = [
        "EUR", "CNY", "USD", "JPY", "KRW", "HKD", "GBP", "AUD", "CAD", "SGD",
        "CHF", "THB", "AED", "AFN", "ALL", "AMD", "ANG", "ARS", "BAM", "BDT",
    ]
    payload = {
        "date": "2026-07-12",
        "base": "EUR",
        "rates": {code: 1.0 for code in currency_codes},
        "currencies": [{"code": code, "name": code, "symbol": code} for code in currency_codes],
        "fetched_at": exchange_rates_route.time.time() - exchange_rates_route.app_settings._EXCHANGE_RATE_CACHE_TTL - 1,
    }
    monkeypatch.setitem(exchange_rates_route.app_settings._EXCHANGE_RATE_CACHE, "payload", None)
    monkeypatch.setitem(exchange_rates_route.app_settings._EXCHANGE_RATE_CACHE, "expires_at", 0.0)
    monkeypatch.setattr(exchange_rates_route.cache_store, "cache_get", lambda _key: json.dumps(payload))
    remote_get = Mock(side_effect=requests.exceptions.Timeout())
    monkeypatch.setattr(exchange_rates_route.requests, "get", remote_get)

    response = client.get("/api/exchange-rates")

    assert exchange_rates_route.app_settings._EXCHANGE_RATE_CACHE_TTL == 24 * 3600
    assert response.status_code == 200
    assert response.get_json()["cached"] is True
    assert response.get_json()["stale"] is True
    remote_get.assert_called_once()


def test_favorites_are_localized_and_wired(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    app_script = client.get("/js/app.js").get_data(as_text=True)

    assert zh_locale["welcome"]["favorites"] == "收藏"
    assert en_locale["welcome"]["favorites"] == "Favorites"
    assert zh_locale["welcome"]["recommended"] == "推荐"
    assert en_locale["welcome"]["recommended"] == "Recommended"
    assert zh_locale["welcome"]["recommendations"]["copyLink"] == "复制链接"
    assert en_locale["welcome"]["recommendations"]["copyLink"] == "Copy link"
    assert 'const STORAGE_FAVORITES = "devtools_favorites"' in app_script
    assert "function toggleFavorite(toolId)" in app_script
    assert 'class="menu-favorite' in app_script
    assert "function homeToolCard(" in app_script
    assert "function homeRecommendationCard(" in app_script
    assert "function bindHomeLinkCards(" in app_script


def test_home_discovery_and_mobile_navigation_are_wired(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)

    assert zh_locale["welcome"]["categories"] == "分类"
    assert en_locale["welcome"]["categories"] == "Categories"
    assert zh_locale["welcome"]["desc"] == "45+ 个免费开发工具，无需登录，优先在浏览器本地处理"
    assert en_locale["welcome"]["noLogin"] == "No sign-in"
    assert zh_locale["welcome"]["category"] == {
        "all": "全部",
        "development": "开发调试",
        "encoding": "编码安全",
        "files": "文本文件",
        "data": "数据计算",
        "reference": "开发速查",
        "games": "小游戏",
        "everyday": "日常效率",
    }
    assert en_locale["welcome"]["category"] == {
        "all": "All",
        "development": "Dev & Debug",
        "encoding": "Encoding & Security",
        "files": "Text & Files",
        "data": "Data & Calculations",
        "reference": "Developer Reference",
        "games": "Mini Games",
        "everyday": "Everyday Productivity",
    }
    assert zh_locale["welcome"]["recommendations"]["groups"]["investing"] == "投资理财"
    assert en_locale["welcome"]["recommendations"]["groups"]["crypto"] == "Crypto trading"
    assert zh_locale["welcome"]["recommendations"]["items"]["svscholarX"]["title"] == "硅谷居士 · 推特/X"
    assert en_locale["welcome"]["recommendations"]["items"]["svscholarX"]["title"] == "SV Scholar · X/Twitter"
    assert zh_locale["menu"]["openMenu"] == "打开菜单"
    assert 'id="mobile-menu-toggle"' in index_html
    assert 'id="sidebar-scrim"' in index_html
    assert "function renderHomePanel(" in app_script
    assert "var HOME_CATEGORIES" in app_script
    assert "var HOME_RECOMMENDATIONS" in app_script
    assert 'data-home-tab="recommended"' in app_script
    assert 'var HOME_TAB_IDS = ["favorites", "categories", "recommended"]' in app_script
    assert "function buildPathForHomeTab(" in app_script
    assert 'var homeState = { tab: currentHomeTab, category: "all", query: "" };' in app_script
    assert 'history.pushState({ menuId: "home", homeTab: currentHomeTab }' in app_script
    assert 'href="${buildPathForHomeTab("favorites", currentLang)}"' in app_script
    assert 'activeMenuId === "home"' in app_script
    assert 'buildPathForHomeTab(currentHomeTab, newLang)' in app_script
    assert 'Array.from(el.querySelectorAll(".home-tab"))' in app_script
    assert 'window.matchMedia("(max-width: 760px)")' in app_script
    assert ".home-tool-grid" in app_css
    assert ".home-link-grid" in app_css
    assert ".home-link-card" in app_css
    assert ".home-link-copy-btn" in app_css
    assert ".home-tabs" in app_css
    assert "text-decoration: none;" in app_css
    assert ".home-categories" in app_css
    assert ".sidebar.mobile-open" in app_css
    assert ".home-search:focus-within" in app_css
    assert ".home-search input:focus-visible {\n  outline: none;\n}" in app_css
    assert 'let siteUrl = "https://dev.tools24.uk"' in app_script
    assert 'data-i18n="welcome.toolCount"' in app_script
    assert 'homeState.category = "all";' in app_script
    assert "var categoryOrder = new Map(" in app_script
    assert "tools.sort(function (a, b)" in app_script

    public_ids = set(public_tool_ids())
    assert set(zh_locale["welcome"]["toolHints"]) == public_ids
    assert set(en_locale["welcome"]["toolHints"]) == public_ids

    category_block = re.search(r"var HOME_CATEGORIES = \[(.*?)\n  \];", app_script, re.DOTALL)
    assert category_block
    category_entries = re.findall(r'\{ id: "([^"]+)", tools: \[([^]]*)\] \}', category_block.group(1))
    category_map = {
        category_id: re.findall(r'"([^"]+)"', tools)
        for category_id, tools in category_entries
    }
    assert category_map == {
        "all": [],
        "development": ["device", "json", "format", "regex", "url", "http", "curl", "cron"],
        "encoding": ["encoder", "base64", "uuid", "crypto", "jwt", "qrcode"],
        "files": ["text", "diff", "mindmap", "markdown", "image", "converter", "fileinfo"],
        "data": ["visualization", "function", "timestamp", "unitconvert", "color", "exchange", "tax", "mortgage"],
        "reference": ["terminal", "git", "ai", "android", "flutter", "ios"],
        "games": ["focus", "ball-game", "predator-game", "cycle-game", "war-game", "fish-game", "math-curiosities"],
        "everyday": ["content", "translate", "area-search"],
    }
    categorized_ids = [tool_id for category_id, tools in category_map.items() if category_id != "all" for tool_id in tools]
    assert len(categorized_ids) == len(set(categorized_ids))
    assert set(categorized_ids) == set(public_tool_ids())


def test_sidebar_processing_badges_stay_compact(client):
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)

    assert 'class="menu-label"' in app_script
    assert ".menu-label { flex: 1" in app_css
    assert ".menu-processing::before" in app_css
    assert ".menu-processing {\n  flex: none;" in app_css


def test_image_tool_is_local_and_wired_with_seo_and_locales(client):
    page = client.get("/zh/tool/image")
    script = client.get("/js/image-tool.js")
    script_text = script.get_data(as_text=True)
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert page.status_code == 200
    assert "在线图片处理工具" in page.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/image" in page.get_data(as_text=True)
    assert script.status_code == 200
    assert "MAX_PIXELS = 40000000" in script_text
    assert "canvas.toBlob" in script_text
    assert "URL.createObjectURL" in script_text
    assert "fetch(" not in script_text
    assert "function resetSettings()" in script_text
    assert "exifr@7.1.3" in script_text
    assert "heic-to@1.5.2" in script_text
    assert "jszip@3.10.1" in script_text
    assert "function processBatch()" in script_text
    assert "function timestampName()" in script_text
    assert 'multiple hidden' in script_text
    assert 't("image.batchSizeSummary")' in script_text
    assert zh_locale["image"]["batchReduced"] == "减少 {percent}%"
    assert 'processButton.disabled = true' in script_text
    assert 't("image.downloadingButton")' in script_text
    assert 't("image.zippingButton")' in script_text
    assert "DateTimeOriginal" in script_text
    assert "GPSLatitude" in script_text
    assert zh_locale["menu"]["image"] == "图片处理"
    assert en_locale["menu"]["image"] == "Image Tool"
    assert zh_locale["image"]["metadataRemoved"] == "元数据已移除"
    assert "image-target-kb" in script_text
    assert "function encodeCanvas(" in script_text
    assert "data-max-edge=\"1920\"" in script_text
    assert zh_locale["image"]["targetReached"] == "已达到目标体积"
    assert_tool_is_lazy_loaded(frontend_dir, "image-tool.js")


def test_json_error_location_examples_and_jwt_security_analysis(client):
    json_script = client.get("/js/json-tool.js").get_data(as_text=True)
    jwt_script = client.get("/js/jwt-tool.js").get_data(as_text=True)
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())

    assert "function locateJsonError(" in json_script
    assert "function bindLineNumbers(" in json_script
    assert "jt-line-numbers" in json_script
    assert "var EXAMPLES" in json_script
    assert 'id="jt-fold"' in json_script
    assert 'id="jt-analyze"' in json_script
    assert 'option value="api"' in json_script
    assert 'option value="config"' in json_script
    assert 'option value="nested"' in json_script
    assert "function toggleFoldedView()" in json_script
    assert "function toggleAnalysisView()" in json_script
    assert "function buildNode(value, showCounts)" in json_script
    assert 'showCounts ? \'<span class="jt-count">\'' in json_script
    assert 'class="jt-fold-placeholder">…' in json_script
    assert 'isArray && !showCounts ? ""' in json_script
    assert 'id="jt-output"' not in json_script
    assert 'id="jt-pane-convert"' not in json_script
    assert 'id="json-history"' not in json_script
    assert zh_locale["json"]["errorLocation"] == "第 {line} 行，第 {column} 列"
    assert zh_locale["json"]["fold"] == "折叠"
    assert zh_locale["json"]["analyze"] == "分析"
    assert "function renderTokenAnalysis(" in jwt_script
    assert "warningLongLifetime" in jwt_script
    assert "decodedNotVerified" in jwt_script
    assert "jwt-verification-state" in jwt_script
    assert en_locale["jwt"]["statusNoExpiry"] == "Lifetime unknown: exp is missing"


def test_file_converter_routes_are_local_and_lazy_loaded(client):
    page = client.get("/zh/tool/converter")
    script = client.get("/js/converter-tool.js")
    script_text = script.get_data(as_text=True)
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert page.status_code == 200
    assert "在线文件转换工具" in page.get_data(as_text=True)
    assert script.status_code == 200
    assert 'md: ["html", "txt", "pdf"]' in script_text
    assert 'docx: ["html", "txt"]' in script_text
    assert 'xlsx: ["csv", "html"]' in script_text
    assert 'json: ["csv", "yaml", "xml"]' in script_text
    assert 'yaml: ["json"]' in script_text
    assert 'xml: ["json"]' in script_text
    assert 'csv: ["json", "html", "xlsx"]' in script_text
    assert "function renderSupportedRoutes()" in script_text
    assert sum(len(targets) for targets in ({"txt": ["html", "md", "pdf"], "html": ["txt", "md", "pdf"], "md": ["html", "txt", "pdf"], "csv": ["json", "html", "xlsx"], "xlsx": ["csv", "html"], "docx": ["html", "txt"], "json": ["csv", "yaml", "xml"], "yaml": ["json"], "xml": ["json"]}).values()) == 21
    assert "mammoth.browser.min.js" in script_text
    assert "xlsx.full.min.js" in script_text
    assert "js-yaml@4.1.0" in script_text
    assert "function jsonToCsv(value)" in script_text
    assert "function convertXmlToJson(text)" in script_text
    assert "function jsonToXml(value)" in script_text
    assert 'accept=".txt,.html,.htm,.md,.markdown,.csv,.xlsx,.docx,.json,.yaml,.yml,.xml"' in script_text
    assert "function ensureScript" in script_text
    assert "function preparePdf(html)" in script_text
    assert "function downloadPdf()" in script_text
    assert 'backgroundColor: "#ffffff"' in script_text
    assert '.from(byId("converter-pdf-preview")).save()' in script_text
    assert "fetch(" not in script_text
    assert zh_locale["menu"]["converter"] == "文件转换"
    assert en_locale["menu"]["converter"] == "File Converter"
    assert zh_locale["converter"]["supportedRoutes"] == "当前支持的全部转换格式（21 项）"
    assert en_locale["converter"]["supportedRoutes"] == "All Supported Conversions (21)"
    assert zh_locale["converter"]["invalidJson"] == "JSON 内容无效"
    assert en_locale["converter"]["invalidXml"] == "Invalid XML"
    assert_tool_is_lazy_loaded(frontend_dir, "converter-tool.js")
    app_css = (frontend_dir / "css" / "app.css").read_text()
    assert ".converter-pdf-preview { min-height: 480px" in app_css
    assert ".converter-preview.hidden, .converter-pdf-preview.hidden { display: none; }" in app_css


def test_spa_routes_render_seo_and_reject_invalid_paths(client):
    response = client.get("/en/tool/json")
    fallback = client.get("/fr/tool/unknown")
    missing_tool = client.get("/zh/tool/unknown")
    home_tabs = {
        "/zh/favorites": "https://dev.tools24.uk/zh/",
        "/zh/categories": "https://dev.tools24.uk/zh/",
        "/zh/recommended": "https://dev.tools24.uk/zh/",
        "/en/favorites": "https://dev.tools24.uk/en/",
        "/en/categories": "https://dev.tools24.uk/en/",
        "/en/recommended": "https://dev.tools24.uk/en/",
    }

    html = response.get_data(as_text=True)
    assert response.status_code == 200
    assert '<html lang="en">' in html
    assert response.headers["Content-Language"] == "en"
    assert "https://dev.tools24.uk/en/tool/json" in html
    assert '<meta property="og:locale" content="en_US">' in html
    assert "JSON Format Checker Online" in html
    assert fallback.status_code == 404
    assert missing_tool.status_code == 404
    assert "这个页面走丢了" in fallback.get_data(as_text=True)
    assert "Page not found | Tools24" in missing_tool.get_data(as_text=True)
    assert fallback.headers["X-Robots-Tag"] == "noindex, nofollow"
    assert "s-maxage=300" in fallback.headers["Cache-Control"]
    for path, canonical in home_tabs.items():
        tab_response = client.get(path)
        assert tab_response.status_code == 200
        assert f'<link rel="canonical" href="{canonical}">' in tab_response.get_data(as_text=True)


def test_custom_404_is_bilingual_responsive_and_navigation_ready(client):
    page = client.get("/missing-file").get_data(as_text=True)

    assert '<meta name="robots" content="noindex,nofollow">' in page
    assert 'data-en="This page wandered off"' in page
    assert 'id="requested-path"' in page
    assert 'id="home-link"' in page
    assert 'id="back-button"' in page
    assert 'data-tool="json"' in page
    assert 'prefers-reduced-motion: reduce' in page
    assert 'devtools_theme' in page
    assert 'devtools_lang' in page


def test_canonical_routes_redirect_and_api_is_not_indexed(client):
    root = client.get("/")
    no_slash = client.get("/zh")
    api = client.get("/api/health")

    assert root.status_code == 308
    assert root.headers["Location"].endswith("/zh/")
    assert no_slash.status_code == 308
    assert no_slash.headers["Location"].endswith("/zh/")
    assert api.headers["X-Robots-Tag"] == "noindex, nofollow"


def test_public_cache_headers_and_deferred_analytics(client, monkeypatch):
    index = client.get("/zh/")
    css = client.get("/css/app.css")
    locale = client.get("/locales/zh-CN.json")
    manifest = client.get("/api/tool-manifest")
    index_template = (Path(__file__).resolve().parents[2] / "frontend" / "index.html").read_text()

    assert "s-maxage=3600" in index.headers["Cache-Control"]
    assert css.headers["Cache-Control"] == "no-store"
    assert locale.headers["Cache-Control"] == "no-store"
    assert manifest.headers["Cache-Control"] == "no-store"
    assert "requestIdleCallback(loadAnalytics" in index_template
    assert "isStrictLocalDeviceRoute()" in index_template
    assert 'if (isStrictLocalDeviceRoute()) return;' in index_template
    assert '<script async src="https://www.googletagmanager.com/' not in index_template
    assert "window.va = window.va || function" in index_template
    assert "vercelAnalyticsScript.defer = true" in index_template
    assert "vercelAnalyticsScript.src = '/_vercel/insights/script.js'" in index_template

    node = shutil.which("node")
    if node:
        inline_script = re.search(
            r"<script>\s*(window\.dataLayer.*?window\.addEventListener\('load'.*?)</script>",
            index_template,
            re.DOTALL,
        )
        assert inline_script, "analytics loader script was not found"
        program = r'''
const vm = require("vm");
const source = process.argv[1];
const appended = [];
const context = {
  Date,
  RegExp,
  setTimeout: () => {},
  document: {
    createElement: tag => ({ tag, setAttribute(name, value) { this[name] = value; } }),
    head: { appendChild: node => appended.push(node) }
  },
  location: { pathname: "/zh/tool/device" },
  addEventListener: () => {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context);
context.loadAnalytics();
const strictCount = appended.length;
context.location.pathname = "/zh/categories";
context.loadAnalytics();
process.stdout.write(JSON.stringify({ strictCount, normalCount: appended.length }));
'''
        completed = subprocess.run(
            [node, "-e", program, inline_script.group(1)],
            check=True,
            capture_output=True,
            text=True,
        )
        assert json.loads(completed.stdout) == {"strictCount": 0, "normalCount": 4}

    # 静态资源版本号按 git 提交自动注入，无需手动维护 ?v= 字面量
    rendered = index.get_data(as_text=True)
    assert "<!--SEO_ASSET_VERSION-->" not in rendered
    css_version = re.search(r'/css/app\.css\?v=([^"]+)"', rendered)
    assert css_version, "css asset version was not injected"
    version = css_version.group(1)
    assert version, "asset version must not be empty"
    assert f'/js/app.js?v={version}"' in rendered  # css 与 js 共用同一版本号
    scripted = [tool for tool in manifest.get_json()["tools"] if tool.get("script")]
    assert scripted, "expected lazy-loaded tool scripts in manifest"
    assert all(tool["script"].endswith(f"?v={version}") for tool in scripted)
    assert all(tool["script"].count("?") == 1 for tool in scripted)  # 不出现双 ?v=

    monkeypatch.setenv("VERCEL_GIT_COMMIT_SHA", "1234567890abcdef")
    deployed = client.get("/zh/").get_data(as_text=True)
    deployed_css = client.get("/css/app.css")
    assert '/css/app.css?v=12345678"' in deployed
    assert deployed_css.headers["Cache-Control"] == "public, max-age=31536000, immutable"


def test_local_asset_version_changes_for_uncommitted_edits(tmp_path, monkeypatch):
    frontend = tmp_path / "frontend"
    (frontend / "js").mkdir(parents=True)
    (frontend / "css").mkdir()
    (frontend / "locales").mkdir()
    (frontend / "index.html").write_text("index", encoding="utf-8")
    script = frontend / "js" / "app.js"
    script.write_text("one", encoding="utf-8")

    monkeypatch.delenv("ASSET_VERSION", raising=False)
    monkeypatch.delenv("VERCEL_GIT_COMMIT_SHA", raising=False)
    monkeypatch.setattr(site_route.app_settings, "FRONTEND_DIR", frontend)
    first = site_route.asset_version()
    script.write_text("a different local edit", encoding="utf-8")
    second = site_route.asset_version()

    assert first.startswith("dev-")
    assert second.startswith("dev-")
    assert first != second


def test_tool_registry_routes_and_sitemap_stay_in_sync(client):
    manifest = client.get("/api/tool-manifest").get_json()
    manifest_tools = {tool["id"]: tool for tool in manifest["tools"]}
    assert set(public_tool_ids()) == set(TOOLS)
    assert set(manifest_tools) == set(TOOL_REGISTRY)
    assert manifest_tools["json"]["script"].startswith("/js/json-tool.js")
    assert manifest_tools["translate"]["processing"] == "server"
    assert manifest_tools["device"]["processing"] == "local"
    assert manifest_tools["jwt"]["processing"] == "local"

    sitemap = client.get("/sitemap.xml").get_data(as_text=True)
    assert 'xmlns:xhtml="http://www.w3.org/1999/xhtml"' in sitemap
    assert f"<lastmod>{content_last_modified()}</lastmod>" in sitemap
    assert manifest["lastModified"] == content_last_modified()
    for tool_id in TOOLS:
        assert f"https://dev.tools24.uk/zh/tool/{tool_id}" in sitemap
        assert f"https://dev.tools24.uk/en/tool/{tool_id}" in sitemap
    assert "<changefreq>weekly</changefreq>" in sitemap
    assert "<priority>1.0</priority>" in sitemap


def test_new_tools_have_server_rendered_seo(client):
    for tool_id, expected in (("flutter", "Flutter 常用速查"), ("ios", "iOS 常用速查"), ("jwt", "JWT 在线解析调试工具")):
        response = client.get(f"/zh/tool/{tool_id}")
        page = response.get_data(as_text=True)
        assert response.status_code == 200
        assert expected in page
        assert f"https://dev.tools24.uk/zh/tool/{tool_id}" in page
        assert '"@type": "FAQPage"' in page
        assert '"@type": "BreadcrumbList"' in page


def test_processing_badges_distinguish_local_hybrid_and_server_tools(client):
    local_page = client.get("/zh/tool/jwt").get_data(as_text=True)
    device_page = client.get("/zh/tool/device").get_data(as_text=True)
    hybrid_page = client.get("/zh/tool/exchange").get_data(as_text=True)
    server_page = client.get("/zh/tool/translate").get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())

    assert "浏览器本地处理，数据不上传" in local_page
    assert "浏览器本地处理，数据不上传" in device_page
    assert "部分信息需要请求服务端" in hybrid_page
    assert "服务端处理，数据会发送到服务器" in server_page
    assert "function renderToolPageHeader(" in app_script
    assert 'class="tool-page-header"' in app_script
    assert zh_locale["toolHeader"]["processing"]["local"] == "浏览器本地处理 · 数据不上传"
    assert zh_locale["toolHeader"]["processing"]["hybrid"] == "混合处理 · 部分数据请求服务端"
    assert zh_locale["toolHeader"]["processing"]["server"] == "服务端处理 · 数据会发送到服务器"
    assert 'fetch("/api/tool-manifest?v=" + encodeURIComponent(APP_ASSET_VERSION))' in app_script
    assert 'fetch(`/locales/${lang}.json?v=${encodeURIComponent(APP_ASSET_VERSION)}`)' in app_script
    assert "json-tool.js" not in app_script


def test_non_indexable_server_tool_still_supports_direct_navigation(client):
    response = client.get("/zh/tool/wishes")
    page = response.get_data(as_text=True)
    assert response.status_code == 200
    assert '<meta name="robots" content="noindex,nofollow">' in page
    assert "/zh/tool/wishes" not in client.get("/sitemap.xml").get_data(as_text=True)


def test_converter_regex_mobile_metadata_and_topic_routes(client):
    converter = client.get("/js/converter-tool.js").get_data(as_text=True)
    regex = client.get("/js/regex-tool.js").get_data(as_text=True)
    markdown = client.get("/js/md-tool.js").get_data(as_text=True)
    index_html = client.get("/zh/").get_data(as_text=True)

    assert "renderCompatibilityMatrix" in converter
    assert "data-converter-example" in converter
    assert "converter-cancel" in converter
    assert "MARKED_URL" in converter and "HTML2PDF_URL" in converter
    assert "buildAnalysis" in regex
    assert "riskBacktracking" in regex
    assert "URLSearchParams" in regex
    assert "MARKED_URL" in markdown and "HTML2PDF_URL" in markdown
    assert "marked.min.js" not in index_html
    assert "html2pdf.bundle.min.js" not in index_html

    for path, expected in (
        ("/zh/flutter/widgets", "Flutter Widgets 组件速查"),
        ("/zh/android/compose", "Android Compose 组件速查"),
        ("/zh/ios/swiftui", "SwiftUI 组件速查"),
        ("/zh/converter/markdown-to-pdf", "Markdown 转 PDF 在线工具"),
    ):
        response = client.get(path)
        assert response.status_code == 200
        assert expected in response.get_data(as_text=True)
        assert path in client.get("/sitemap.xml").get_data(as_text=True)

    assert client.get("/zh/flutter/unknown").status_code == 404
    assert 'escapeHtml([r[0], r[1], r[2], r[3], r[5]].join(" ").toLowerCase())' in client.get("/js/android-tool.js").get_data(as_text=True)


def test_search_query_seo_pages_and_local_tools_are_upgraded(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())

    permissions = client.get("/en/android/permissions").get_data(as_text=True)
    assert "Android Permissions Reference - Manifest Permission Lookup" in permissions
    assert '<h1>Android Manifest Permissions Reference</h1>' in permissions
    assert "Can a third-party app use android.permission.STATUS_BAR?" in permissions
    assert '"inLanguage": "en"' in permissions
    assert "Android 权限速查" not in permissions

    for path, expected in (
        ("/en/flutter/widgets", "Flutter Widgets Reference"),
        ("/en/ios/info-plist", "Info.plist Privacy Key Reference"),
        ("/en/converter/csv-to-xlsx", "CSV to XLSX Online Converter"),
    ):
        page = client.get(path).get_data(as_text=True)
        assert expected in page

    android_script = client.get("/js/android-tool.js").get_data(as_text=True)
    assert '["STATUS_BAR"' in android_script
    assert '["EXPAND_STATUS_BAR"' in android_script
    assert 'var fullName = "android.permission." + r[0]' in android_script

    diff_page = client.get("/en/tool/diff").get_data(as_text=True)
    diff_script = client.get("/js/diff-tool.js").get_data(as_text=True)
    assert "Code Compare Tool Online" in diff_page
    assert "How do I compare two code snippets online?" in diff_page
    assert 'href="/en/tool/format"' in diff_page
    assert 'href="/en/tool/json"' in diff_page
    assert "MAX_FILE_BYTES" in diff_script
    assert "diff-ignore-space" in diff_script
    assert "renderSideBySide" in diff_script
    assert "highlightPair" in diff_script
    assert 'id="diff-left-preview"' not in diff_script
    assert '"-preview"' in diff_script
    assert "function renderPanes(rows)" in diff_script
    assert "function bindPreviewScroll()" in diff_script
    assert 'id="diff-result"' not in diff_script
    assert 'id="diff-immersive"' in diff_script
    assert 'document.body.classList.toggle("diff-immersive", immersive)' in diff_script
    assert 'event.key === "Escape" && immersive' in diff_script
    assert en_locale["diff"]["sideBySide"] == "Side by side"
    assert en_locale["diff"]["enterImmersive"] == "Immersive compare"

    app_css = (frontend_dir / "css" / "app.css").read_text()
    assert "body.diff-immersive .content" in app_css
    assert "body.diff-immersive .diff-toolbar-controls { display: none; }" in app_css
    assert "body.diff-immersive .diff-tool.controls-open .diff-toolbar-controls" in app_css

    json_page = client.get("/en/tool/json").get_data(as_text=True)
    assert "JSON Format Checker Online" in json_page
    assert "How can I test whether JSON is valid online?" in json_page

    file_page = client.get("/en/tool/fileinfo").get_data(as_text=True)
    file_script = client.get("/js/file-info-tool.js").get_data(as_text=True)
    assert "MD5 Hash Checker Online" in file_page
    assert "How do I verify a file checksum?" in file_page
    assert "bindHashVerifier" in file_script
    assert "fi-expected-hash" in file_script
    assert en_locale["fileinfo"]["hashMatch"] == "Checksum matches"
    app_css = (frontend_dir / "css" / "app.css").read_text()
    assert ".fi-dropzone .jt-btn { min-height: 44px" in app_css
    app_script = client.get("/js/app.js").get_data(as_text=True)
    assert '"subpageTitles." + toolId + "." + window.__toolSubpage' in app_script


def test_new_platform_notes_are_localized(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en = json.loads((frontend_dir / "locales" / "en.json").read_text())
    android = client.get("/js/android-tool.js").get_data(as_text=True)
    ios = client.get("/js/ios-tool.js").get_data(as_text=True)
    regex = client.get("/js/regex-tool.js").get_data(as_text=True)

    assert zh["android"]["adbCommonOutput"] == "常见输出："
    assert zh["android"]["composeMaterialNote"].startswith("新 Compose 项目")
    assert zh["ios"]["modernSwiftTitle"] == "现代 Swift："
    assert en["regex"]["engineTitle"] == "JavaScript RegExp"
    assert 't("android.versionNote")' in android
    assert 't("ios.reviewGuidanceNote")' in ios
    assert 't("regex.engineNote")' in regex
    assert "PCRE-only recursion" not in regex


def test_regex_and_http_tools_are_wired_with_seo_and_locales(client):
    regex_page = client.get("/zh/tool/regex")
    http_page = client.get("/en/tool/http")
    regex_script = client.get("/js/regex-tool.js")
    http_script = client.get("/js/http-tool.js")

    assert regex_page.status_code == 200
    assert "正则表达式测试工具" in regex_page.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/regex" in regex_page.get_data(as_text=True)
    assert http_page.status_code == 200
    assert "HTTP Status Codes and Headers Reference" in http_page.get_data(as_text=True)
    assert regex_script.status_code == 200
    assert "collectMatches" in regex_script.get_data(as_text=True)
    assert "COMMON_PATTERNS" in regex_script.get_data(as_text=True)
    assert "data-regex-tab" in regex_script.get_data(as_text=True)
    assert http_script.status_code == 200
    assert "Access-Control-Allow-Origin" in http_script.get_data(as_text=True)

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["menu"]["regex"] == "正则测试"
    assert en_locale["menu"]["http"] == "HTTP Reference"
    assert_tool_is_lazy_loaded(frontend_dir, "regex-tool.js")
    assert_tool_is_lazy_loaded(frontend_dir, "http-tool.js")


def test_text_tool_is_wired_with_seo_and_locales(client):
    response = client.get("/zh/tool/text")
    script = client.get("/js/text-tool.js")

    assert response.status_code == 200
    assert "在线文本处理工具" in response.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/text" in response.get_data(as_text=True)
    assert script.status_code == 200
    assert "sqlIn" in script.get_data(as_text=True)

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["menu"]["text"] == "文本处理"
    assert_tool_is_lazy_loaded(frontend_dir, "text-tool.js")


def test_tax_tool_is_wired_with_seo_and_locales(client):
    response_zh = client.get("/zh/tool/tax")
    response_en = client.get("/en/tool/tax")
    script = client.get("/js/tax-tool.js")

    assert response_zh.status_code == 200
    assert "工资税收计算器" in response_zh.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/tax" in response_zh.get_data(as_text=True)
    assert response_en.status_code == 200
    assert "China Tax Calculator" in response_en.get_data(as_text=True)
    assert script.status_code == 200
    script_text = script.get_data(as_text=True)
    assert "MONTHLY_BRACKETS" in script_text
    assert "ANNUAL_BRACKETS" in script_text
    assert "calcBonusSeparate" in script_text
    assert "data-tax-tab" in script_text
    assert "tax-schedule-body" in script_text
    assert "tax-bracket-body" in script_text
    assert "tax-guide-example-body" in script_text
    assert 'data-tax-tab="guide"' in script_text
    assert "renderGuide" in script_text
    assert "fgk.chinatax.gov.cn" in script_text
    assert "P020240202362406243753.pdf" in script_text
    assert "cumulativeTaxable" in script_text
    assert "var separateTotal = roundMoney(result.annualTax + separateBonusTax)" in script_text

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["menu"]["tax"] == "税收计算"
    assert en_locale["menu"]["tax"] == "Tax Calculator"
    assert zh_locale["tax"]["bracketsTab"] == "年度税阶拆分"
    assert zh_locale["tax"]["guideTab"] == "计算说明"
    assert en_locale["tax"]["scheduleTab"] == "Monthly Withholding Process"
    assert en_locale["tax"]["guideTab"] == "How It Works"
    assert_tool_is_lazy_loaded(frontend_dir, "tax-tool.js")


def test_mortgage_tool_is_wired_with_seo_and_locales(client):
    response = client.get("/zh/tool/mortgage")
    script = client.get("/js/mortgage-tool.js")

    assert response.status_code == 200
    assert "房贷计算器" in response.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/mortgage" in response.get_data(as_text=True)
    assert script.status_code == 200
    script_text = script.get_data(as_text=True)
    assert "calcEqualInstallment" in script_text
    assert "calcEqualPrincipal" in script_text
    assert "renderHistory(byId(\"mg-history\"))" in script_text
    assert "updateAll();\n  }" in script_text
    assert "pbc.gov.cn" in script_text
    assert "chinamoney.com.cn/chinese/bklpr/" in script_text
    assert "bklpr3hischrt" not in script_text

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["menu"]["mortgage"] == "房贷计算"
    assert en_locale["menu"]["mortgage"] == "Mortgage"
    assert zh_locale["mortgage"]["pbcLpr"] == "中国人民银行：LPR"
    assert en_locale["tax"]["officialWithholding"] == "STA: Cumulative Withholding Rules"
    assert_tool_is_lazy_loaded(frontend_dir, "mortgage-tool.js")


def test_unit_converter_and_sidebar_use_shared_ui_states(client):
    unit_script = client.get("/js/unitconvert-tool.js").get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())

    assert "at-table uc-table" in unit_script
    assert "data-uc-category" in unit_script
    assert 'var activeCategoryId = "radix"' in unit_script
    assert unit_script.index('id: "radix"') < unit_script.index('id: "length"')
    assert "function parseRadix(raw, radix)" in unit_script
    assert "BigInt((prefix || \"\") + value)" in unit_script
    assert "value.toString(unit.radix).toUpperCase()" in unit_script
    assert zh_locale["unitconvert"]["tabs"]["radix"] == "进制换算"
    assert zh_locale["unitconvert"]["units"]["binary"] == "二进制"
    assert en_locale["unitconvert"]["units"]["hexadecimal"] == "Hexadecimal"
    assert '"immersive"' in app_script
    assert "applySidebarState" in app_script


def test_color_converter_is_registered_localized_and_lazy_loaded(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    app_script = client.get("/js/app.js").get_data(as_text=True)
    color_script = client.get("/js/color-tool.js").get_data(as_text=True)
    page = client.get("/zh/tool/color")

    assert page.status_code == 200
    assert "颜色转换工具" in page.get_data(as_text=True)
    assert TOOL_REGISTRY["color"]["processing"] == "local"
    assert TOOL_REGISTRY["color"]["icon"] == "palette"
    assert zh_locale["menu"]["color"] == "颜色转换"
    assert en_locale["menu"]["color"] == "Color Converter"
    assert zh_locale["color"]["eyedropper"] == "吸取颜色"
    assert en_locale["color"]["formats"]["oklch"] == "UI-friendly color and gradients"
    assert 'typeof ColorTool !== "undefined"' in app_script
    assert '{ id: "data", tools: ["visualization", "function", "timestamp", "unitconvert", "color", "exchange", "tax", "mortgage"] }' in app_script
    assert "function parseColor(raw)" in color_script
    assert '"EyeDropper" in window' in color_script
    assert "oklabToXyz" in color_script
    assert 'class="color-opacity-panel"' in color_script
    assert "data-color-tab" not in color_script
    assert "switchColorTab" not in color_script
    assert "function opacityResults(opacity)" in color_script
    assert 'id: "hexArgb"' in color_script
    assert 'id: "webHexa"' not in color_script
    assert "function toArgbHex(color)" in color_script
    assert 'id: "cssRgba"' in color_script
    assert "/js/android-tool.js" not in color_script
    assert zh_locale["color"]["opacityTitle"] == "透明度与不透明度"
    assert zh_locale["color"]["opacityFormats"]["hexArgb"] == "HEX / ARGB（AARRGGBB）"
    assert en_locale["color"]["opacityTitle"] == "Opacity and transparency"
    assert_tool_is_lazy_loaded(frontend_dir, "color-tool.js")


def test_ai_tool_uses_verified_commands_categories_and_comparison(client):
    page = client.get("/zh/tool/ai")
    script = client.get("/js/ai-tool.js")
    script_text = script.get_data(as_text=True)

    assert page.status_code == 200
    assert "Claude Code 与 Codex CLI 对照" in page.get_data(as_text=True)
    assert script.status_code == 200
    assert "COMPARISON" in script_text
    assert "data-ai-product" in script_text
    assert "data-ai-category" in script_text
    assert 'activeCategories = { claude: "all", codex: "all" }' in script_text
    assert 'categories: ["all", "quick"' in script_text
    assert 'category === "all" || item.category === category' in script_text
    assert "claude mcp list" in script_text
    assert "claude --dangerously-skip-permissions -r" in script_text
    assert "codex review --uncommitted" in script_text
    assert "claude --mcp" not in script_text
    assert "codex test <file>" not in script_text
    assert "codex plan" not in script_text
    assert "--approve" not in script_text

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["ai"]["comparison"] == "功能对照"
    assert zh_locale["ai"]["categories"]["all"] == "全部"
    assert en_locale["ai"]["categories"]["all"] == "All"
    assert en_locale["ai"]["categories"]["review"] == "Code Review"
    assert_tool_is_lazy_loaded(frontend_dir, "ai-tool.js")


def test_visit_counter_is_read_only_then_increments(client):
    assert client.get("/api/visits").get_json() == {"count": 0}
    assert client.get("/api/visits").get_json() == {"count": 0}
    assert client.post("/api/visits/increment").get_json() == {"count": 1}
    assert client.get("/api/visits").get_json() == {"count": 1}


def test_local_telemetry_writes_are_disabled_by_default(client, monkeypatch):
    monkeypatch.delenv("TELEMETRY_WRITES", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)

    visit = client.post("/api/visits/increment").get_json()
    click = client.post("/api/tool-click", json={"tool_id": "json"}).get_json()

    assert visit == {"count": 0, "skipped": True}
    assert click == {"ok": True, "tool_id": "json", "count": None, "skipped": True}
    assert client.get("/api/visits").get_json() == {"count": 0}


def test_anonymous_unique_users_are_deduped_and_rendered_in_admin_chart(client):
    import app_settings

    first_uid = "11111111-1111-4111-8111-111111111111"
    second_uid = "22222222-2222-4222-8222-222222222222"

    first = client.post("/api/visits/increment", json={"anonymous_id": first_uid}).get_json()
    duplicate = client.post("/api/visits/increment", json={"anonymous_id": first_uid}).get_json()
    second = client.post("/api/visits/increment", json={"anonymous_id": second_uid}).get_json()

    assert first["unique_users_today"] == 1
    assert first["is_new_daily_user"] is True
    assert duplicate["unique_users_today"] == 1
    assert duplicate["is_new_daily_user"] is False
    assert second["unique_users_today"] == 2
    assert second["is_new_daily_user"] is True
    assert first_uid not in app_settings._UNIQUE_VISIT_PATH.read_text()

    admin = client.get("/api/tool-stats?view=1&token=test-admin-token")
    page = admin.get_data(as_text=True)

    assert admin.status_code == 200
    assert "每日唯一用户" in page
    assert "匿名 UUID 去重，仅保留最近 30 天" in page
    assert '<div class="num">2</div><div class="label">今日用户</div>' in page
    assert 'class="uv-chart"' in page


def test_translate_requires_api_key(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module.app_settings, "_DEEPSEEK_KEY", "")

    response = client.post("/api/translate", json={"text": "hello"})

    assert response.status_code == 503
    assert response.get_json()["ok"] is False


def test_translate_validates_input(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module.app_settings, "_DEEPSEEK_KEY", "test-key")

    empty = client.post("/api/translate", json={"text": "  "})
    too_long = client.post("/api/translate", json={"text": "x" * 5001})

    assert empty.status_code == 400
    assert too_long.status_code == 400


def test_translate_parses_success_response(client, monkeypatch):
    import app as app_module

    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [{"message": {"content": "```json\n{\"translation\": \"你好\", \"phonetic\": \"nǐ hǎo\", \"pos\": \"感叹词\"}\n```"}}]
    }
    post = Mock(return_value=response)
    monkeypatch.setattr(app_module.app_settings, "_DEEPSEEK_KEY", "test-key")
    monkeypatch.setattr(app_module.translate.requests, "post", post)

    result = client.post("/api/translate", json={"text": "hello"})

    assert result.status_code == 200
    assert result.get_json() == {
        "ok": True,
        "translation": "你好",
        "phonetic": "nǐ hǎo",
        "pos": "感叹词",
        "is_short": True,
        "source_lang": "auto",
        "target_lang": "zh",
    }
    assert post.call_args.kwargs["timeout"] == 15


def test_translate_handles_request_failure(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module.app_settings, "_DEEPSEEK_KEY", "test-key")
    monkeypatch.setattr(
        app_module.translate.requests,
        "post",
        Mock(side_effect=requests.RequestException("unavailable")),
    )

    response = client.post("/api/translate", json={"text": "hello"})

    assert response.status_code == 500
    assert response.get_json()["ok"] is False


def test_translation_helpers_cover_language_and_length():
    import app as app_module

    assert app_module._is_chinese("你好世界") is True
    assert app_module._is_chinese("hello") is False
    assert app_module._is_short("one two three four five") is True
    assert app_module._is_short("one two three four five six") is False
    assert "English translation" in app_module._build_prompt("你好")
    assert "Simplified Chinese" in app_module._build_prompt("hello world")


def test_area_search_api_and_seo(client):
    """Verify area-search tool: SEO, API endpoints, lazy loading, i18n, and CSS."""
    # SEO page renders
    zh_page = client.get("/zh/tool/area-search")
    en_page = client.get("/en/tool/area-search")
    assert zh_page.status_code == 200
    assert en_page.status_code == 200
    assert "地区搜索" in zh_page.get_data(as_text=True)
    assert "Area Search" in en_page.get_data(as_text=True)

    # China API — provinces
    china_provinces = client.get("/api/area-search/china").get_json()
    assert china_provinces["ok"] is True
    assert len(china_provinces["data"]) >= 2
    province_names = {p["name"] for p in china_provinces["data"]}
    assert "北京" in province_names

    # China API — children of province 11 (Beijing)
    bj_children = client.get("/api/area-search/china?parent=11").get_json()
    assert bj_children["ok"] is True
    for c in bj_children["data"]:
        assert c["code"].startswith("11")

    # China API — children of city 1101 (Beijing districts)
    bj_districts = client.get("/api/area-search/china?parent=1101").get_json()
    assert bj_districts["ok"] is True
    district_names = {d["name"] for d in bj_districts["data"]}
    assert len(district_names) >= 1

    # China API — invalid parent
    bad = client.get("/api/area-search/china?parent=999999")
    assert bad.status_code == 400

    # World API — countries
    countries = client.get("/api/area-search/world/countries").get_json()
    assert countries["ok"] is True
    assert len(countries["data"]) >= 2
    country_codes = {c["code"] for c in countries["data"]}
    assert "CHN" in country_codes or "AFG" in country_codes

    # World API — cities
    cities = client.get("/api/area-search/world/cities?country=AFG").get_json()
    assert cities["ok"] is True
    assert len(cities["data"]) >= 1

    # World API — missing country param
    bad_cities = client.get("/api/area-search/world/cities")
    assert bad_cities.status_code == 400

    # World API — unknown country
    unknown = client.get("/api/area-search/world/cities?country=ZZZ")
    assert unknown.status_code == 404

    # Server-side limited search includes ancestor context for ambiguous names
    china_search = client.get("/api/area-search/china/search?q=朝阳&level=3&limit=2").get_json()
    assert china_search["ok"] is True
    assert len(china_search["data"]) <= 2
    assert all(item["parentName"] and item["grandparentName"] for item in china_search["data"])
    assert client.get("/api/area-search/china/search?q=&level=3").status_code == 400
    assert client.get("/api/area-search/china/search?q=北京&level=4").status_code == 400

    world_search = client.get("/api/area-search/world/search?q=Kabul&limit=1").get_json()
    assert world_search["ok"] is True
    assert len(world_search["data"]) <= 1
    assert all(item["countryCode"] and item["countryName"] for item in world_search["data"])
    assert client.get("/api/area-search/world/search?q=").status_code == 400

    # Lazy loading check
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    assert_tool_is_lazy_loaded(frontend_dir, "area-search-tool.js")

    # i18n check
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    assert zh_locale["menu"]["area-search"] == "地区搜索"
    assert en_locale["menu"]["area-search"] == "Area Search"
    assert zh_locale["areaSearch"]["china"] == "中国地区"
    assert en_locale["areaSearch"]["world"] == "World"
    assert zh_locale["areaSearch"]["copyPath"] == "复制路径"

    # CSS check
    app_css = (frontend_dir / "css" / "app.css").read_text()
    assert ".as-tool" in app_css
    assert ".as-dropdown" in app_css
    assert ".as-path" in app_css
    assert ".as-tool { width: min(100%, 960px);" in app_css

    # JS tool script exists and matches conventions
    script = client.get("/js/area-search-tool.js")
    assert script.status_code == 200
    script_text = script.get_data(as_text=True)
    assert "var AreaSearchTool" in script_text
    assert "function init(" in script_text
    assert "area-search/china" in script_text
    assert "area-search/world" in script_text
    assert "/china/all" not in script_text
    assert "/world/all-cities" not in script_text
    assert "_chinaAllCities" not in script_text
    assert "_chinaAllDistricts" not in script_text
    assert "_worldAllCities" not in script_text
    assert "MARKED_URL" not in script_text
    assert "window.marked" not in script_text
    assert "renderIntroText" in script_text
    assert "function inlineMarkdown" in script_text
    assert "escapeHtml(value)" in script_text
    assert 'el.innerHTML = html.join("")' in script_text
    assert 'var text = el.dataset.copy || ""' in script_text
    assert 'cn.join(" ")' in script_text
    assert 'codes.join(" ")' in script_text
    assert 'join(" > ")' not in script_text
    assert "https://www.amap.com/search?query=" in script_text
    assert "https://www.google.com/maps/search/?api=1&query=" in script_text
    assert 'rel="noopener noreferrer"' in script_text
    assert "pathEl.appendChild(cachedEl)" in script_text
    assert "btn.parentNode.appendChild(resultEl)" not in script_text
    assert "function randomChinaDistrict(city)" in script_text
    assert "function randomWorldCity(country)" in script_text
    assert "function randomPickDifferent(options, currentCode)" in script_text
    assert "if (_randomBusy) return" in script_text
    assert "selectOption(prov, 0, true)" in script_text
    assert "selectOption(city, 1, true)" in script_text
    assert "var _introPending = {}" in script_text
    assert "function refreshIntroLoadingUi()" in script_text
    assert "_introPending[selection.key]" in script_text
    assert "signal: _introController.signal" not in script_text
    assert 'showStatus(t("areaSearch.loadFailed"), true)' in script_text

    # Registry check
    import app as app_module
    assert "area-search" in app_module.TOOL_REGISTRY
    assert app_module.TOOL_REGISTRY["area-search"]["processing"] == "hybrid"
    assert app_module.TOOL_REGISTRY["area-search"]["indexable"] is True


def test_area_search_path_validation_and_intro_guards(client, monkeypatch):
    import app as app_module

    assert app_module._resolve_area_path("china", ["11", "1101", "110105"]) == "北京 北京 朝阳"
    afghanistan = next(country for country in app_module._load_world_countries() if country["code"] == "AFG")
    city = afghanistan["cities"][0]
    world_path = app_module._resolve_area_path("world", ["AFG", city["code"]])
    assert world_path
    assert app_module._resolve_area_path("china", ["99"]) is None
    assert app_module._resolve_area_path("world", ["ZZZ"]) is None

    monkeypatch.setattr(app_module.app_settings, "_DEEPSEEK_KEY", "")
    unavailable = client.post("/api/area-search/intro", json={"mode": "china", "codes": ["11"]})
    assert unavailable.status_code == 503
    assert unavailable.get_json()["error"] == "not_configured"

    monkeypatch.setattr(app_module.app_settings, "_DEEPSEEK_KEY", "test-key")
    invalid = client.post("/api/area-search/intro", json={"mode": "china", "codes": ["99"]})
    assert invalid.status_code == 400
    assert invalid.get_json()["error"] == "invalid_region"


def test_area_search_intro_local_cache_and_rate_limit(monkeypatch):
    import app as app_module

    app_module._AREA_INTRO_LOCAL_CACHE.clear()
    app_module._AREA_INTRO_RATE_STORE.clear()
    monkeypatch.setattr(app_module.cache_store, "is_enabled", lambda: False)
    monkeypatch.setattr(app_module.cache_store, "cache_get", lambda _key: None)
    monkeypatch.setattr(app_module.cache_store, "cache_set", lambda *_args: False)

    key = app_module._area_intro_cache_key("china", "北京 北京 朝阳")
    app_module._area_intro_cache_set(key, "安全的纯文本介绍")
    assert app_module._area_intro_cache_get(key) == "安全的纯文本介绍"

    assert all(app_module._check_area_intro_rate_limit("203.0.113.8")[0] for _ in range(10))
    allowed, retry_after = app_module._check_area_intro_rate_limit("203.0.113.8")
    assert allowed is False
    assert 1 <= retry_after <= 600

    app_module._AREA_INTRO_LOCAL_CACHE.clear()
    app_module._AREA_INTRO_RATE_STORE.clear()


def test_area_search_intro_rejects_truncated_model_output(client, monkeypatch):
    import app_settings
    from routes import area_search

    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [{"finish_reason": "length", "message": {"content": "**还有小磨"}}]
    }
    post = Mock(return_value=response)
    cache_set = Mock()
    monkeypatch.setattr(app_settings, "_DEEPSEEK_KEY", "test-key")
    monkeypatch.setattr(area_search.requests, "post", post)
    monkeypatch.setattr(area_search, "_area_intro_cache_get", lambda _key: None)
    monkeypatch.setattr(area_search, "_check_area_intro_rate_limit", lambda _ip: (True, 0))
    monkeypatch.setattr(area_search, "_area_intro_cache_set", cache_set)

    result = client.post("/api/area-search/intro", json={"mode": "china", "codes": ["11"]})

    assert result.status_code == 502
    assert result.get_json()["error"] == "generation_incomplete"
    assert post.call_args.kwargs["json"]["max_tokens"] == 2048
    cache_set.assert_not_called()


def test_focus_training_is_local_timed_and_wired(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())

    page = client.get("/zh/tool/focus")
    script = client.get("/js/focus-tool.js")
    script_text = script.get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)

    assert page.status_code == 200
    assert "舒尔特方格专注力训练" in page.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/focus" in page.get_data(as_text=True)
    assert script.status_code == 200
    assert_tool_is_lazy_loaded(frontend_dir, "focus-tool.js")
    assert TOOL_REGISTRY["focus"]["processing"] == "local"
    assert TOOL_REGISTRY["focus"]["indexable"] is True
    assert zh_locale["menu"]["focus"] == "专注力训练"
    assert en_locale["menu"]["focus"] == "Focus Training"
    assert set(zh_locale["focus"]["levels"]) == {"3", "4", "5", "6"}
    assert len(zh_locale["focus"]["howSteps"]) == 3
    assert "far" not in zh_locale["focus"]["scienceNote"].lower()
    assert 'SIZES = [3, 4, 5, 6]' in script_text
    assert "performance.now()" in script_text
    assert "requestAnimationFrame" in script_text
    assert 'STORAGE_KEY = "devtools_focus_scores"' in script_text
    assert "function shuffledNumbers(size)" in script_text
    assert "function handleNumber(event)" in script_text
    assert "function finishGame()" in script_text
    assert 'id="focus-orbit-end"' not in script_text
    assert 'class="focus-intro"' in script_text
    assert "fetch(" not in script_text
    assert 'activeMenuId === "focus"' in app_script
    assert '{ id: "games", tools: ["focus", "ball-game", "predator-game", "cycle-game", "war-game", "fish-game", "math-curiosities"] }' in app_script
    assert '{ id: "everyday", tools: ["content", "translate", "area-search"] }' in app_script
    assert ".focus-grid" in app_css
    assert "--focus-grid-size" in app_css
    assert "@media (max-width: 760px)" in app_css


def test_shared_tool_visual_contract_and_compact_headers(client):
    app_css = client.get("/css/app.css").get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)
    converter_script = client.get("/js/converter-tool.js").get_data(as_text=True)
    translate_script = client.get("/js/translate-tool.js").get_data(as_text=True)

    assert ".hidden { display: none !important; }" in app_css
    assert ".image-size-row .crypto-input { width: 100%; min-width: 0; }" in app_css
    assert "#content button," in app_css
    assert "min-height: 44px;" in app_css
    assert 'button:focus-visible,' in app_css
    assert '<div class="welcome-icon">💻</div>' not in app_script
    assert '<h2 data-i18n="welcome.deviceInfo">' not in app_script
    assert 't("converter.title")' not in converter_script
    assert 't("translate.title")' not in translate_script


def test_ball_genesis_is_local_randomized_and_wired(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())

    page = client.get("/zh/tool/ball-game")
    english_page = client.get("/en/tool/ball-game")
    script = client.get("/js/ball-game-tool.js")
    script_text = script.get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)

    assert page.status_code == 200
    assert english_page.status_code == 200
    assert "万象小球" in page.get_data(as_text=True)
    assert "Ball Genesis" in english_page.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/ball-game" in page.get_data(as_text=True)
    assert "https://dev.tools24.uk/en/tool/ball-game" in english_page.get_data(as_text=True)
    assert script.status_code == 200
    assert_tool_is_lazy_loaded(frontend_dir, "ball-game-tool.js")
    assert TOOL_REGISTRY["ball-game"]["processing"] == "local"
    assert TOOL_REGISTRY["ball-game"]["global"] == "BallGameTool"
    assert TOOL_REGISTRY["ball-game"]["icon"] == "balls"
    assert TOOL_REGISTRY["ball-game"]["indexable"] is True
    assert zh_locale["menu"]["ball-game"] == "万象小球"
    assert en_locale["menu"]["ball-game"] == "Ball Genesis"
    assert zh_locale["ballGame"]["status"]["limit"] == "已达生态上限，撞墙只反弹"
    assert en_locale["ballGame"]["currentSpeed"] == "Constant speed"
    assert zh_locale["ballGame"]["recommended"] == "推荐"
    assert en_locale["ballGame"]["fullscreen"] == "Expand preview"
    assert zh_locale["ballGame"]["errors"]["range"] == "数量上限必须是 1–10,000 的整数。"
    assert zh_locale["ballGame"]["limitTime"] == "达上限用时"
    assert en_locale["ballGame"]["totalTime"] == "Total time"
    assert zh_locale["ballGame"]["collisionMode"] == "相撞消失"
    assert zh_locale["ballGame"]["ballSize"] == "球的直径"
    assert en_locale["ballGame"]["errors"]["size"] == "Ball diameter must be a number greater than 0."
    assert zh_locale["ballGame"]["populationChart"] == "数量变化曲线"
    assert zh_locale["ballGame"]["guide"]["title"] == "玩法与规则"
    assert "正中心" in zh_locale["ballGame"]["guide"]["item1"]
    assert "population ceiling" in en_locale["ballGame"]["guide"]["item4"]
    assert en_locale["ballGame"]["chartAxes"] == "X: time · Y: ball count"
    assert "headline" not in zh_locale["ballGame"]
    assert "subtitle" not in zh_locale["ballGame"]
    assert "localBadge" not in zh_locale["ballGame"]
    assert "headline" not in en_locale["ballGame"]
    assert "subtitle" not in en_locale["ballGame"]
    assert "localBadge" not in en_locale["ballGame"]
    assert "requestAnimationFrame" in script_text
    assert "ResizeObserver" in script_text
    assert "MutationObserver" in script_text
    assert "function splitAtWall(" in script_text
    assert "function wallCollision(" in script_text
    assert "function nextGenerationColor(" in script_text
    assert "function colorForGeneration(" in script_text
    assert "function symmetricAngles(" in script_text
    assert "function velocityFor(" in script_text
    assert "function canSplitAtWall(" in script_text
    assert "function enterFullscreen(" in script_text
    assert "function exitFullscreen(" in script_text
    assert "function updateLimitRecommendation(" in script_text
    assert "function validatePopulationLimit(" in script_text
    assert "function validateBallSize(" in script_text
    assert "function collidingBallIndexes(" in script_text
    assert "function removeTouchingBalls(" in script_text
    assert "function resetPopulationHistory(" in script_text
    assert "function recordPopulationSample(" in script_text
    assert "function drawPopulationChart(" in script_text
    assert "populationHistory.length > 1200" in script_text
    assert "var DEFAULT_BALL_SIZE = 16;" in script_text
    assert "var collisionCellSize = Math.max(" in script_text
    assert "var x = width / 2;" in script_text
    assert "var y = height / 2;" in script_text
    assert "var angle = randomSource() * Math.PI * 2;" in script_text
    assert "var reachedLimitAtMs = null;" in script_text
    assert "if (started && atLimit && reachedLimitAtMs === null) reachedLimitAtMs = elapsedMs;" in script_text
    assert "nextBalls.push.apply(nextBalls, splitAtWall(ball, normalAngle))" in script_text
    assert "function populationCap(" in script_text
    assert "function clampToAxis(" in script_text
    assert "var MIN_SPEED = 0.1;" in script_text
    assert "var MAX_SPEED = 10;" in script_text
    assert "var speed = BASE_SPEED * config.speed;" in script_text
    assert "ball.x += ball.vx * deltaSeconds;" in script_text
    assert "ball.y += ball.vy * deltaSeconds;" in script_text
    assert "context.arc(ball.x, ball.y, ball.radius" in script_text
    assert "function speedMultiplier(" not in script_text
    assert "function processCollisions()" not in script_text
    assert "function resolveElasticCollision(" not in script_text
    assert "function createEffect(" not in script_text
    assert "function drawEffects(" not in script_text
    assert "context.lineTo" not in script_text
    assert "context.stroke" not in script_text
    assert "shadowBlur" not in script_text
    assert "requestFullscreen" not in script_text
    assert "document.fullscreenElement" not in script_text
    assert 'id="ball-game-count-value">1</output>' in script_text
    assert 'id="ball-game-count" type="range" min="1" max="20" step="1" value="1"' in script_text
    assert 'id="ball-game-size" type="number" step="any" value="16"' in script_text
    assert 'id="ball-game-size" type="number" min=' not in script_text
    assert 'id="ball-game-size" type="number" max=' not in script_text
    assert 'id="ball-game-size-error"' in script_text
    assert 'id="ball-game-speed" type="range" min="0.1" max="10" step="0.1" value="1"' in script_text
    assert 'id="ball-game-limit" type="number" step="1" value="40"' in script_text
    assert 'id="ball-game-limit" type="number" min=' not in script_text
    assert 'id="ball-game-limit-error"' in script_text
    assert 'id="ball-game-collision" type="checkbox" checked' in script_text
    assert 'id="ball-game-total-time">00:00.000</strong>' in script_text
    assert 'id="ball-game-limit-time">00:00.000</strong>' in script_text
    assert 'id="ball-game-fullscreen"' in script_text
    assert 'id="ball-game-exit-fullscreen"' in script_text
    assert 'id="ball-game-population-chart"' in script_text
    assert 'class="ball-game-guide"' in script_text
    assert script_text.index('class="ball-game-guide"') < script_text.index('t("ballGame.configTitle")')
    assert "ball-game-chart-card" in script_text
    assert "ball-game-intro" not in script_text
    assert "ball-game-rules" not in script_text
    assert "fetch(" not in script_text
    assert "localStorage" not in script_text
    assert 'activeMenuId === "ball-game"' in app_script
    assert "BallGameTool.deactivate" in app_script
    assert ".ball-game-canvas-shell" in app_css
    assert "--ball-game-canvas-bg" in app_css
    assert "--ball-game-grid" not in app_css
    assert ".ball-game-stage-card.is-viewport-fullscreen" in app_css
    assert ".ball-game-stage-card.is-fullscreen .ball-game-stats {" in app_css
    assert ".ball-game-stage-card.is-fullscreen .ball-game-canvas-shell" in app_css
    assert ".ball-game-stage-card.is-fullscreen .ball-game-chart-card { display: none; }" in app_css
    assert ".ball-game-population-chart" in app_css
    assert ".ball-game-guide" in app_css
    assert ".ball-game-intro" not in app_css
    assert "inset: 112px 0 0;" in app_css
    assert "body.ball-game-fullscreen-active" in app_css
    assert ".ball-game-config-error" in app_css
    assert ".ball-game-toggle-control" in app_css
    assert ".ball-game-rules" not in app_css
    assert "grid-template-columns: repeat(5, minmax(0, 1fr));" in app_css
    assert "rules" not in zh_locale["ballGame"]
    assert "rules" not in en_locale["ballGame"]
    assert "@media (prefers-reduced-motion: reduce)" in app_css

    node = shutil.which("node")
    if node:
        program = r'''
const fs = require("fs");
const vm = require("vm");
const context = { Math, Number, String, RegExp, Map };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("frontend/js/ball-game-tool.js", "utf8"), context);
const core = context.BallGameTool._test;
const nextColor = core.nextGenerationColor({ h: 350, s: 60, l: 50 }, () => 0.75);
const generationPalette = [{ h: 210, s: 70, l: 50 }];
const generationOneA = core.generationColor(generationPalette, 1, () => 0.75);
const generationOneB = core.generationColor(generationPalette, 1, () => 0.1);
const generationTwo = core.generationColor(generationPalette, 2, () => 0.75);
const angles = core.symmetricAngles(Math.PI, 0.5);
const firstVelocity = core.velocityFor(70, 0.3);
const secondVelocity = core.velocityFor(70, 2.1);
const reflected = { vx: -10, vy: 2 };
const touchingBalls = [
  { x: 0, y: 0, radius: 8, collisionImmuneUntil: 0 },
  { x: 15, y: 0, radius: 8, collisionImmuneUntil: 0 },
  { x: 80, y: 80, radius: 8, collisionImmuneUntil: 0 }
];
const protectedBalls = [
  { x: 0, y: 0, radius: 8, collisionImmuneUntil: 600 },
  { x: 15, y: 0, radius: 8, collisionImmuneUntil: 600 }
];
core.reflectFromWall(reflected, 0);
process.stdout.write(JSON.stringify({
  defaults: core.normalizeConfig(null, null, null, null, 64),
  normalized: core.normalizeConfig(99, 99, "invalid", 99999, 64),
  customSize: core.normalizeConfig(1, 1, "#3b82f6", 40, 64, 2.5).size,
  oneLimit: core.normalizeConfig(1, 1, "#3b82f6", 1, 64).limit,
  raisedLimit: core.normalizeConfig(20, 1, "#3b82f6", 2, 64).limit,
  limitValidation: [
    core.validatePopulationLimit("", 1),
    core.validatePopulationLimit("1.5", 1),
    core.validatePopulationLimit("0", 1),
    core.validatePopulationLimit("10001", 1),
    core.validatePopulationLimit("3", 4),
    core.validatePopulationLimit("1", 1),
    core.validatePopulationLimit("10000", 1)
  ],
  sizeValidation: [
    core.validateBallSize(""),
    core.validateBallSize("0"),
    core.validateBallSize("-1"),
    core.validateBallSize("1.25"),
    core.validateBallSize("1000000")
  ],
  caps: [core.populationCap(10, 10), core.populationCap(4000, 4000)],
  formattedTimes: [core.formatTime(0), core.formatTime(61234.9)],
  formattedAxisTimes: [core.formatAxisTime(0), core.formatAxisTime(9500), core.formatAxisTime(10000), core.formatAxisTime(90000)],
  substepCounts: [core.physicsSubstepCount(0.032, 0.1), core.physicsSubstepCount(0.032, 10)],
  sizedSubsteps: [core.physicsSubstepCount(0.032, 10, 1), core.physicsSubstepCount(0.032, 10, 40)],
  axisPositions: [core.clampToAxis(-10, 8, 300), core.clampToAxis(400, 8, 300), core.clampToAxis(20, 200, 300)],
  collisionIndexes: core.collidingBallIndexes(touchingBalls, 500).sort((a, b) => a - b),
  protectedCollisionIndexes: core.collidingBallIndexes(protectedBalls, 500),
  velocityMagnitudes: [
    Math.hypot(firstVelocity.vx, firstVelocity.vy),
    Math.hypot(secondVelocity.vx, secondVelocity.vy)
  ],
  nextColor,
  generationOneA,
  generationOneB,
  generationTwo,
  angles,
  reflected,
  wallSplitAllowed: core.canSplitAtWall({ wallImmuneUntil: 180 }, 181, 39, 40),
  wallSplitCoolingDown: core.canSplitAtWall({ wallImmuneUntil: 180 }, 179, 39, 40),
  wallSplitAtCap: core.canSplitAtWall({ wallImmuneUntil: 0 }, 181, 40, 40)
}));
'''
        completed = subprocess.run(
            [node, "-e", program],
            cwd=frontend_dir.parent,
            check=True,
            capture_output=True,
            text=True,
        )
        result = json.loads(completed.stdout)
        assert result["defaults"] == {"count": 1, "speed": 1, "color": "#3b82f6", "limit": 64, "size": 16}
        assert result["normalized"] == {"count": 20, "speed": 10, "color": "#3b82f6", "limit": 10000, "size": 16}
        assert result["customSize"] == 2.5
        assert result["oneLimit"] == 1
        assert result["raisedLimit"] == 20
        assert [item["error"] for item in result["limitValidation"][:4]] == ["range"] * 4
        assert result["limitValidation"][4]["error"] == "count"
        assert result["limitValidation"][5] == {"valid": True, "value": 1, "error": None}
        assert result["limitValidation"][6] == {"valid": True, "value": 10000, "error": None}
        assert [item["error"] for item in result["sizeValidation"][:3]] == ["size"] * 3
        assert result["sizeValidation"][3] == {"valid": True, "value": 1.25, "error": None}
        assert result["sizeValidation"][4] == {"valid": True, "value": 1000000, "error": None}
        assert result["caps"] == [40, 160]
        assert result["formattedTimes"] == ["00:00.000", "01:01.234"]
        assert result["formattedAxisTimes"] == ["0.0s", "9.5s", "10s", "1.5m"]
        assert result["substepCounts"] == [1, 6]
        assert result["sizedSubsteps"] == [45, 2]
        assert result["axisPositions"] == [8, 292, 150]
        assert result["collisionIndexes"] == [0, 1]
        assert result["protectedCollisionIndexes"] == []
        assert all(abs(magnitude - 70) < 1e-9 for magnitude in result["velocityMagnitudes"])
        assert 0 <= result["nextColor"]["h"] < 360
        assert result["nextColor"]["h"] != 350
        assert 46 <= result["nextColor"]["s"] <= 88
        assert 40 <= result["nextColor"]["l"] <= 68
        assert result["generationOneA"] == result["generationOneB"]
        assert result["generationTwo"] != result["generationOneA"]
        assert abs(result["angles"][0] - 3.641592653589793) < 1e-9
        assert abs(result["angles"][1] - 2.641592653589793) < 1e-9
        assert result["reflected"] == {"vx": 10, "vy": 2}
        assert result["wallSplitAllowed"] is True
        assert result["wallSplitCoolingDown"] is False
        assert result["wallSplitAtCap"] is False


def test_predator_reproduction_ecosystem_is_local_fullscreen_and_wired(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())

    page = client.get("/zh/tool/predator-game")
    english_page = client.get("/en/tool/predator-game")
    script_response = client.get("/js/predator-game-tool.js")
    script = script_response.get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)

    assert page.status_code == 200
    assert english_page.status_code == 200
    assert script_response.status_code == 200
    assert "捕食与繁衍" in page.get_data(as_text=True)
    assert "Predation &amp; Reproduction" in english_page.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/predator-game" in page.get_data(as_text=True)
    assert "https://dev.tools24.uk/en/tool/predator-game" in english_page.get_data(as_text=True)
    assert_tool_is_lazy_loaded(frontend_dir, "predator-game-tool.js")
    assert TOOL_REGISTRY["predator-game"] == {
        "order": 237,
        "icon": "balls",
        "script": "/js/predator-game-tool.js",
        "global": "PredatorGameTool",
        "processing": "local",
        "indexable": True,
    }
    assert zh_locale["menu"]["predator-game"] == "捕食与繁衍"
    assert en_locale["menu"]["predator-game"] == "Predation & Reproduction"
    assert zh_locale["predatorGame"]["status"]["extinct"] == "生态已经灭绝，可重新生成"
    assert en_locale["predatorGame"]["populationChart"] == "Ecosystem over time"
    assert "18 秒" in zh_locale["predatorGame"]["guide"]["item3"]
    assert "18 seconds" in en_locale["predatorGame"]["guide"]["item3"]
    assert zh_locale["welcome"]["category"]["games"] == "小游戏"
    assert "requestAnimationFrame" in script
    assert "ResizeObserver" in script
    assert "MutationObserver" in script
    assert "function buildSpatialGrid(" in script
    assert "function nearestTarget(" in script
    assert "function feedPrey(" in script
    assert "function feedPredators(" in script
    assert "function splitAnimal(" in script
    assert "function removeStarvedPredators(" in script
    assert "function replenishResources(" in script
    assert "function drawChartLine(" in script
    assert "history.length > 1200" in script
    assert "function enterFullscreen(" in script
    assert "function exitFullscreen(" in script
    assert 'id="predator-game-prey" type="range" min="1" max="200"' in script
    assert 'id="predator-game-predators" type="range" min="1" max="50"' in script
    assert 'id="predator-game-resources"' not in script
    assert 'id="predator-game-speed" type="range" min="0.1" max="10"' in script
    assert 'id="predator-game-limit" type="number" step="1" value="320"' in script
    assert 'id="predator-game-limit" type="number" min=' not in script
    assert 'id="predator-game-fullscreen"' in script
    assert 'id="predator-game-exit-fullscreen"' in script
    assert 'id="predator-game-chart"' in script
    assert 'class="ball-game-guide"' in script
    assert script.index('class="ball-game-guide"') < script.index('t("predatorGame.configTitle")')
    assert "fetch(" not in script
    assert "localStorage" not in script
    assert ".energy" not in script
    assert "resourceRate" not in script
    assert 'activeMenuId === "predator-game"' in app_script
    assert "PredatorGameTool.deactivate" in app_script
    assert '{ id: "games", tools: ["focus", "ball-game", "predator-game", "cycle-game", "war-game", "fish-game", "math-curiosities"] }' in app_script
    assert "--ecosystem-prey" in app_css
    assert "--ecosystem-predator" in app_css
    assert "--ecosystem-resource" in app_css
    assert ".predator-game-legend" in app_css
    assert ".ball-game-stage-card.is-viewport-fullscreen" in app_css
    assert ".ball-game-stage-card.is-fullscreen .ball-game-chart-card { display: none; }" in app_css

    node = shutil.which("node")
    if node:
        program = r'''
const fs = require("fs");
const vm = require("vm");
const context = { Math, Number, String, RegExp, Map, Set };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("frontend/js/predator-game-tool.js", "utf8"), context);
const core = context.PredatorGameTool._test;
const targets = [{ x: 20, y: 20 }, { x: 80, y: 80 }, { x: 110, y: 110 }];
const grid = core.buildSpatialGrid(targets, 64);
const velocity = core.velocityFor(54, Math.PI / 2);
process.stdout.write(JSON.stringify({
  defaults: core.normalizeConfig(null, null, null, null, 320),
  normalized: core.normalizeConfig(999, 999, 99, 99999, 320),
  validation: [
    core.validatePopulationLimit("", 36),
    core.validatePopulationLimit("35", 36),
    core.validatePopulationLimit("36", 36),
    core.validatePopulationLimit("10000", 36)
  ],
  populationCaps: [core.populationCap(10, 10), core.populationCap(4000, 4000)],
  resourceCaps: [core.resourceCapacity(10, 10), core.resourceCapacity(4000, 4000)],
  nearby: core.nearbyIndexes(grid, 20, 20, 20, 64),
  nearest: core.nearestTarget({ x: 18, y: 18 }, targets, grid, 100, 64),
  excludedNearest: core.nearestTarget({ x: 18, y: 18 }, targets, grid, 100, 64, new Set([0])),
  velocityMagnitude: Math.hypot(velocity.vx, velocity.vy),
  formattedTime: core.formatTime(61234.9),
  formattedAxis: core.formatAxisTime(90000),
  substeps: [core.physicsSubstepCount(0.032, 0.1), core.physicsSubstepCount(0.032, 10)]
}));
'''
        completed = subprocess.run(
            [node, "-e", program],
            cwd=frontend_dir.parent,
            check=True,
            capture_output=True,
            text=True,
        )
        result = json.loads(completed.stdout)
        assert result["defaults"] == {
            "preyCount": 24,
            "predatorCount": 3,
            "speed": 1,
            "limit": 320,
        }
        assert result["normalized"] == {
            "preyCount": 200,
            "predatorCount": 50,
            "speed": 10,
            "limit": 10000,
        }
        assert result["validation"][0]["error"] == "range"
        assert result["validation"][1]["error"] == "count"
        assert result["validation"][2] == {"valid": True, "value": 36, "error": None}
        assert result["validation"][3] == {"valid": True, "value": 10000, "error": None}
        assert result["populationCaps"] == [160, 1200]
        assert result["resourceCaps"] == [60, 300]
        assert result["nearby"] == [0]
        assert result["nearest"] == 0
        assert result["excludedNearest"] == 1
        assert abs(result["velocityMagnitude"] - 54) < 1e-9
        assert result["formattedTime"] == "01:01.234"
        assert result["formattedAxis"] == "1.5m"
        assert result["substeps"] == [1, 9]


def test_multi_faction_cycle_is_balanced_constant_local_fullscreen_and_wired(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())

    page = client.get("/zh/tool/cycle-game")
    english_page = client.get("/en/tool/cycle-game")
    script_response = client.get("/js/cycle-game-tool.js")
    script = script_response.get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)

    assert page.status_code == 200
    assert english_page.status_code == 200
    assert script_response.status_code == 200
    assert "多方循环" in page.get_data(as_text=True)
    assert "N-Sided Cycle" in english_page.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/cycle-game" in page.get_data(as_text=True)
    assert "https://dev.tools24.uk/en/tool/cycle-game" in english_page.get_data(as_text=True)
    assert_tool_is_lazy_loaded(frontend_dir, "cycle-game-tool.js")
    assert TOOL_REGISTRY["cycle-game"] == {
        "order": 238,
        "icon": "balls",
        "script": "/js/cycle-game-tool.js",
        "global": "CycleGameTool",
        "processing": "local",
        "indexable": True,
    }
    assert zh_locale["menu"]["cycle-game"] == "多方循环"
    assert en_locale["menu"]["cycle-game"] == "N-Sided Cycle"
    assert "2–20 个阵营" in zh_locale["cycleGame"]["guide"]["item1"]
    assert "clockwise half" in en_locale["cycleGame"]["guide"]["item2"].lower()
    assert zh_locale["cycleGame"]["status"]["unified"] == "{faction}完成生态统一"
    assert "requestAnimationFrame" in script
    assert "ResizeObserver" in script
    assert "MutationObserver" in script
    assert "function winnerSpecies(" in script
    assert "distance === count / 2" in script
    assert "function speciesHue(" in script
    assert "function collisionPairs(" in script
    assert "function resolveConversions(" in script
    assert "function unifiedSpecies(" in script
    assert "function drawChartLine(" in script
    assert "history.length > 1200" in script
    assert "function enterFullscreen(" in script
    assert "function exitFullscreen(" in script
    assert 'id="cycle-game-factions" type="range" min="2" max="20" step="1" value="3"' in script
    assert 'id="cycle-game-count" type="range" min="1" max="300" step="1" value="30"' in script
    assert 'id="cycle-game-speed" type="range" min="0.1" max="10" step="0.1" value="1"' in script
    assert 'id="cycle-game-fullscreen"' in script
    assert 'id="cycle-game-exit-fullscreen"' in script
    assert 'id="cycle-game-chart"' in script
    assert 'class="ball-game-guide"' in script
    assert "fetch(" not in script
    assert "localStorage" not in script
    assert "balls.push(" in script
    assert "balls.splice(" not in script
    assert "balls = balls.filter(" not in script
    assert 'activeMenuId === "cycle-game"' in app_script
    assert "CycleGameTool.deactivate" in app_script
    assert '{ id: "games", tools: ["focus", "ball-game", "predator-game", "cycle-game", "war-game", "fish-game", "math-curiosities"] }' in app_script
    assert ".cycle-game-swatch" in app_css
    assert ".ball-game-status.is-unified" in app_css
    assert ".ball-game-stage-card.is-viewport-fullscreen" in app_css
    assert ".ball-game-stage-card.is-fullscreen .ball-game-chart-card { display: none; }" in app_css

    node = shutil.which("node")
    if node:
        program = r'''
const fs = require("fs");
const vm = require("vm");
const context = { Math, Number, String, RegExp, Map, Set };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("frontend/js/cycle-game-tool.js", "utf8"), context);
const core = context.CycleGameTool._test;
const colliders = [
  { x: 0, y: 0, species: 0, immuneUntil: 0 },
  { x: 10, y: 0, species: 1, immuneUntil: 0 },
  { x: 80, y: 80, species: 2, immuneUntil: 0 }
];
const immune = [
  { x: 0, y: 0, species: 0, immuneUntil: 600 },
  { x: 10, y: 0, species: 1, immuneUntil: 600 }
];
const velocity = core.velocityFor(70, Math.PI / 2);
process.stdout.write(JSON.stringify({
  defaults: core.normalizeConfig(null, null, null),
  normalized: core.normalizeConfig(999, 999, 99),
  winners: [
    core.winnerSpecies(0, 1, 3),
    core.winnerSpecies(1, 2, 3),
    core.winnerSpecies(2, 0, 3),
    core.winnerSpecies(1, 0, 3),
    core.winnerSpecies(0, 2, 4, () => 0.25),
    core.winnerSpecies(0, 2, 4, () => 0.75),
    core.winnerSpecies(0, 2, 5),
    core.winnerSpecies(0, 3, 5),
    core.winnerSpecies(1, 1, 5)
  ],
  counts: core.populationCounts([{ species: 0 }, { species: 0 }, { species: 1 }, { species: 2 }], 4),
  center: core.clusterCenter(0, 4, 1000, 500),
  pairs: core.collisionPairs(colliders, 500),
  immunePairs: core.collisionPairs(immune, 500),
  unified: [
    core.unifiedSpecies([5, 0, 0]),
    core.unifiedSpecies([0, 4, 0]),
    core.unifiedSpecies([1, 1, 0])
  ],
  velocityMagnitude: Math.hypot(velocity.vx, velocity.vy),
  formattedTime: core.formatTime(61234.9),
  formattedAxis: core.formatAxisTime(90000),
  substeps: [core.physicsSubstepCount(0.032, 0.1), core.physicsSubstepCount(0.032, 10)]
}));
'''
        completed = subprocess.run(
            [node, "-e", program],
            cwd=frontend_dir.parent,
            check=True,
            capture_output=True,
            text=True,
        )
        result = json.loads(completed.stdout)
        assert result["defaults"] == {"factions": 3, "count": 30, "speed": 1}
        assert result["normalized"] == {"factions": 20, "count": 300, "speed": 10}
        assert result["winners"] == [0, 1, 2, 0, 0, 2, 0, 3, None]
        assert result["counts"] == [2, 1, 1, 0]
        assert result["center"] == {"x": 500, "y": 115}
        assert result["pairs"] == [[0, 1]]
        assert result["immunePairs"] == []
        assert result["unified"] == [0, 1, None]
        assert abs(result["velocityMagnitude"] - 70) < 1e-9
        assert result["formattedTime"] == "01:01.234"
        assert result["formattedAxis"] == "1.5m"
        assert result["substeps"] == [1, 8]


def test_red_green_war_uses_local_support_and_is_fully_wired(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())

    page = client.get("/zh/tool/war-game")
    english_page = client.get("/en/tool/war-game")
    script_response = client.get("/js/war-game-tool.js")
    script = script_response.get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)

    assert page.status_code == 200
    assert english_page.status_code == 200
    assert script_response.status_code == 200
    assert "红绿大战" in page.get_data(as_text=True)
    assert "Red vs Green" in english_page.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/war-game" in page.get_data(as_text=True)
    assert "https://dev.tools24.uk/en/tool/war-game" in english_page.get_data(as_text=True)
    assert_tool_is_lazy_loaded(frontend_dir, "war-game-tool.js")
    assert TOOL_REGISTRY["war-game"] == {
        "order": 238.5,
        "icon": "balls",
        "script": "/js/war-game-tool.js",
        "global": "WarGameTool",
        "processing": "local",
        "indexable": True,
    }
    assert zh_locale["menu"]["war-game"] == "红绿大战"
    assert en_locale["menu"]["war-game"] == "Red vs Green"
    assert "左半场和右半场" in zh_locale["warGame"]["guide"]["item1"]
    assert "nearby allies" in en_locale["warGame"]["guide"]["item2"].lower()
    assert zh_locale["warGame"]["status"]["winner"] == "{side}统一战场"
    assert "requestAnimationFrame" in script
    assert "ResizeObserver" in script
    assert "MutationObserver" in script
    assert "function nearbySupport(" in script
    assert "function battleWinner(" in script
    assert "function collisionPairs(" in script
    assert "function resolveBattles(" in script
    assert "function winningSpecies(" in script
    assert "function drawChartLine(" in script
    assert "history.length > 1200" in script
    assert "function enterFullscreen(" in script
    assert "function exitFullscreen(" in script
    assert 'id="war-game-count" type="range" min="1" max="500" step="1" value="80"' in script
    assert 'id="war-game-speed" type="range" min="0.1" max="10" step="0.1" value="1"' in script
    assert 'id="war-game-fullscreen"' in script
    assert 'id="war-game-exit-fullscreen"' in script
    assert 'id="war-game-chart"' in script
    assert 'class="ball-game-guide"' in script
    assert "fetch(" not in script
    assert "localStorage" not in script
    assert "balls.push(" in script
    assert "balls.splice(" not in script
    assert "balls = balls.filter(" not in script
    assert 'activeMenuId === "war-game"' in app_script
    assert "WarGameTool.deactivate" in app_script
    assert '{ id: "games", tools: ["focus", "ball-game", "predator-game", "cycle-game", "war-game", "fish-game", "math-curiosities"] }' in app_script
    assert "--ecosystem-predator" in app_css
    assert "--ecosystem-resource" in app_css
    assert ".ball-game-stage-card.is-viewport-fullscreen" in app_css
    assert ".ball-game-stage-card.is-fullscreen .ball-game-chart-card { display: none; }" in app_css

    node = shutil.which("node")
    if node:
        program = r'''
const fs = require("fs");
const vm = require("vm");
const context = { Math, Number, String, RegExp, Map, Set };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("frontend/js/war-game-tool.js", "utf8"), context);
const core = context.WarGameTool._test;
const supportBalls = [
  { x: 0, y: 0, species: 0, immuneUntil: 0 },
  { x: 10, y: 0, species: 0, immuneUntil: 0 },
  { x: 60, y: 0, species: 1, immuneUntil: 0 }
];
const supportGrid = core.buildSpatialGrid(supportBalls, 20);
const colliders = [
  { x: 0, y: 0, species: 0, immuneUntil: 0 },
  { x: 10, y: 0, species: 1, immuneUntil: 0 },
  { x: 80, y: 80, species: 0, immuneUntil: 0 }
];
const immune = [
  { x: 0, y: 0, species: 0, immuneUntil: 600 },
  { x: 10, y: 0, species: 1, immuneUntil: 600 }
];
const velocity = core.velocityFor(70, Math.PI / 2);
process.stdout.write(JSON.stringify({
  defaults: core.normalizeConfig(null, null),
  normalized: core.normalizeConfig(999, 99),
  support: [
    core.nearbySupport(0, 0, 0, supportBalls, supportGrid, 20, 20),
    core.nearbySupport(1, 0, 0, supportBalls, supportGrid, 20, 20)
  ],
  winners: [
    core.battleWinner(3, 1, () => 0.74),
    core.battleWinner(3, 1, () => 0.76),
    core.battleWinner(1, 1, () => 0.49),
    core.battleWinner(1, 1, () => 0.51)
  ],
  counts: core.populationCounts([{ species: 0 }, { species: 0 }, { species: 1 }]),
  pairs: core.collisionPairs(colliders, 500),
  immunePairs: core.collisionPairs(immune, 500),
  unified: [
    core.winningSpecies([5, 0]),
    core.winningSpecies([0, 4]),
    core.winningSpecies([1, 1])
  ],
  velocityMagnitude: Math.hypot(velocity.vx, velocity.vy),
  formattedTime: core.formatTime(61234.9),
  formattedAxis: core.formatAxisTime(90000),
  substeps: [core.physicsSubstepCount(0.032, 0.1), core.physicsSubstepCount(0.032, 10)]
}));
'''
        completed = subprocess.run(
            [node, "-e", program],
            cwd=frontend_dir.parent,
            check=True,
            capture_output=True,
            text=True,
        )
        result = json.loads(completed.stdout)
        assert result["defaults"] == {"count": 80, "speed": 1}
        assert result["normalized"] == {"count": 500, "speed": 10}
        assert result["support"] == [2, 1]
        assert result["winners"] == [0, 1, 0, 1]
        assert result["counts"] == [2, 1]
        assert result["pairs"] == [[0, 1]]
        assert result["immunePairs"] == []
        assert result["unified"] == [0, 1, None]
        assert abs(result["velocityMagnitude"] - 70) < 1e-9
        assert result["formattedTime"] == "01:01.234"
        assert result["formattedAxis"] == "1.5m"
        assert result["substeps"] == [1, 8]


def test_big_fish_ecosystem_replicates_merges_grows_and_is_wired(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())

    page = client.get("/zh/tool/fish-game")
    english_page = client.get("/en/tool/fish-game")
    script_response = client.get("/js/fish-game-tool.js")
    script = script_response.get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)

    assert page.status_code == 200
    assert english_page.status_code == 200
    assert script_response.status_code == 200
    assert "大鱼吃小鱼" in page.get_data(as_text=True)
    assert "Big Fish Eats Small Fish" in english_page.get_data(as_text=True)
    assert "https://dev.tools24.uk/zh/tool/fish-game" in page.get_data(as_text=True)
    assert "https://dev.tools24.uk/en/tool/fish-game" in english_page.get_data(as_text=True)
    assert_tool_is_lazy_loaded(frontend_dir, "fish-game-tool.js")
    assert TOOL_REGISTRY["fish-game"] == {
        "order": 238.75,
        "icon": "balls",
        "script": "/js/fish-game-tool.js",
        "global": "FishGameTool",
        "processing": "local",
        "indexable": True,
    }
    assert zh_locale["menu"]["fish-game"] == "大鱼吃小鱼"
    assert en_locale["menu"]["fish-game"] == "Big Fish Eats Small Fish"
    assert "撞到墙壁便复制" in zh_locale["fishGame"]["guide"]["item1"]
    assert "diameter grows by area" in en_locale["fishGame"]["guide"]["item3"].lower()
    assert zh_locale["fishGame"]["status"]["settled"] == "只剩一条大鱼，生态完成统治"
    assert "requestAnimationFrame" in script
    assert "ResizeObserver" in script
    assert "MutationObserver" in script
    assert "function fishRadius(" in script
    assert "function canReplicateAtWall(" in script
    assert "function splitAtWall(" in script
    assert "function collisionPairs(" in script
    assert "function mergeTwo(" in script
    assert "function resolveMerges(" in script
    assert "function largestMass(" in script
    assert "function drawChartLine(" in script
    assert "history.length > 1200" in script
    assert "function enterFullscreen(" in script
    assert "function exitFullscreen(" in script
    assert 'id="fish-game-count" type="range" min="1" max="20" step="1" value="1"' in script
    assert 'id="fish-game-size" type="range" min="4" max="30" step="1" value="12"' in script
    assert 'id="fish-game-speed" type="range" min="0.1" max="10" step="0.1" value="1"' in script
    assert 'id="fish-game-limit" type="number" step="1" value="80"' in script
    assert 'id="fish-game-limit" type="number" min=' not in script
    assert 'id="fish-game-fullscreen"' in script
    assert 'id="fish-game-exit-fullscreen"' in script
    assert 'id="fish-game-chart"' in script
    assert 'class="ball-game-guide"' in script
    assert "fetch(" not in script
    assert "localStorage" not in script
    assert 'activeMenuId === "fish-game"' in app_script
    assert "FishGameTool.deactivate" in app_script
    assert '{ id: "games", tools: ["focus", "ball-game", "predator-game", "cycle-game", "war-game", "fish-game", "math-curiosities"] }' in app_script
    assert ".fish-game-swatch.is-giant" in app_css
    assert ".ball-game-stage-card.is-viewport-fullscreen" in app_css
    assert ".ball-game-stage-card.is-fullscreen .ball-game-chart-card { display: none; }" in app_css

    node = shutil.which("node")
    if node:
        program = r'''
const fs = require("fs");
const vm = require("vm");
const context = { Math, Number, String, RegExp, Map, Set };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("frontend/js/fish-game-tool.js", "utf8"), context);
const core = context.FishGameTool._test;
const colliders = [
  { x: 0, y: 0, radius: 6, mass: 1, mergeImmuneUntil: 0 },
  { x: 10, y: 0, radius: 6, mass: 1, mergeImmuneUntil: 0 },
  { x: 80, y: 80, radius: 12, mass: 4, mergeImmuneUntil: 0 }
];
const immune = [
  { x: 0, y: 0, radius: 6, mass: 1, mergeImmuneUntil: 600 },
  { x: 10, y: 0, radius: 6, mass: 1, mergeImmuneUntil: 600 }
];
const reflected = { vx: -10, vy: 2 };
const mergedVelocity = core.normalizedVelocity(0, 0, 70, 3, 4);
core.reflectFromWall(reflected, 0);
process.stdout.write(JSON.stringify({
  defaults: core.normalizeConfig(null, null, null, null, null, 90),
  normalized: core.normalizeConfig(99, 99, 99, "invalid", 99999, 90),
  validation: [
    core.validatePopulationLimit("", 1),
    core.validatePopulationLimit("2.5", 1),
    core.validatePopulationLimit("3", 4),
    core.validatePopulationLimit("1", 1),
    core.validatePopulationLimit("10000", 1)
  ],
  caps: [core.populationCap(10, 10), core.populationCap(4000, 4000)],
  radii: [core.fishRadius(1, 6), core.fishRadius(4, 6), core.fishRadius(9, 6)],
  counts: [
    core.smallFishCount(colliders),
    core.largestMass(colliders),
    core.totalMass(colliders)
  ],
  pairs: core.collisionPairs(colliders, 500),
  immunePairs: core.collisionPairs(immune, 500),
  replicate: [
    core.canReplicateAtWall({ mass: 1, wallImmuneUntil: 100 }, 101, 9, 10),
    core.canReplicateAtWall({ mass: 2, wallImmuneUntil: 100 }, 101, 9, 10),
    core.canReplicateAtWall({ mass: 1, wallImmuneUntil: 100 }, 99, 9, 10),
    core.canReplicateAtWall({ mass: 1, wallImmuneUntil: 100 }, 101, 10, 10)
  ],
  mergedVelocityMagnitude: Math.hypot(mergedVelocity.vx, mergedVelocity.vy),
  reflected,
  axis: [core.clampToAxis(-10, 6, 300), core.clampToAxis(400, 6, 300), core.clampToAxis(20, 200, 300)],
  formattedTime: core.formatTime(61234.9),
  formattedAxis: core.formatAxisTime(90000),
  substeps: [core.physicsSubstepCount(0.032, 0.1, 6), core.physicsSubstepCount(0.032, 10, 6)]
}));
'''
        completed = subprocess.run(
            [node, "-e", program],
            cwd=frontend_dir.parent,
            check=True,
            capture_output=True,
            text=True,
        )
        result = json.loads(completed.stdout)
        assert result["defaults"] == {
            "count": 1,
            "size": 12,
            "speed": 1,
            "color": "#38bdf8",
            "limit": 90,
        }
        assert result["normalized"] == {
            "count": 20,
            "size": 30,
            "speed": 10,
            "color": "#38bdf8",
            "limit": 10000,
        }
        assert [item["error"] for item in result["validation"][:2]] == ["range", "range"]
        assert result["validation"][2]["error"] == "count"
        assert result["validation"][3] == {"valid": True, "value": 1, "error": None}
        assert result["validation"][4] == {"valid": True, "value": 10000, "error": None}
        assert result["caps"] == [60, 240]
        assert result["radii"] == [6, 12, 18]
        assert result["counts"] == [2, 4, 6]
        assert result["pairs"] == [[0, 1]]
        assert result["immunePairs"] == []
        assert result["replicate"] == [True, False, False, False]
        assert abs(result["mergedVelocityMagnitude"] - 70) < 1e-9
        assert result["reflected"] == {"vx": 10, "vy": 2}
        assert result["axis"] == [6, 294, 150]
        assert result["formattedTime"] == "01:01.234"
        assert result["formattedAxis"] == "1.5m"
        assert result["substeps"] == [1, 8]


def test_uuid_url_and_cron_tools_are_local_lazy_and_indexable(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en = json.loads((frontend_dir / "locales" / "en.json").read_text())
    app_script = client.get("/js/app.js").get_data(as_text=True)

    for tool_id, filename, global_name in (
        ("uuid", "uuid-tool.js", "UuidTool"),
        ("url", "url-tool.js", "UrlTool"),
        ("cron", "cron-tool.js", "CronTool"),
    ):
        response = client.get(f"/zh/tool/{tool_id}")
        script = client.get(f"/js/{filename}")
        assert response.status_code == 200
        assert f"https://dev.tools24.uk/zh/tool/{tool_id}" in response.get_data(as_text=True)
        assert '"@type": "FAQPage"' in response.get_data(as_text=True)
        assert script.status_code == 200
        assert "fetch(" not in script.get_data(as_text=True)
        assert_tool_is_lazy_loaded(frontend_dir, filename)
        assert TOOL_REGISTRY[tool_id]["processing"] == "local"
        assert TOOL_REGISTRY[tool_id]["indexable"] is True
        assert TOOL_REGISTRY[tool_id]["global"] == global_name
        assert tool_id in zh and tool_id in en
        assert f'activeMenuId === "{tool_id}"' in app_script

    uuid_script = client.get("/js/uuid-tool.js").get_data(as_text=True)
    url_script = client.get("/js/url-tool.js").get_data(as_text=True)
    cron_script = client.get("/js/cron-tool.js").get_data(as_text=True)
    assert "function generateUuidV4()" in uuid_script
    assert "function generateUuidV7(now)" in uuid_script
    assert "function generateUlid(now)" in uuid_script
    assert "function parseUrl(raw)" in url_script
    assert "Array.from(currentUrl.searchParams.entries())" in url_script
    assert "function hasSensitiveValues(url)" in url_script
    assert "function parseCron(expression)" in cron_script
    assert "function nextRuns(expression, timeZone, count, fromDate)" in cron_script
    assert "formatToParts" in cron_script


def test_first_render_navigation_and_accessibility_regressions(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    index_html = (frontend_dir / "index.html").read_text()
    app_script = client.get("/js/app.js").get_data(as_text=True)
    app_css = client.get("/css/app.css").get_data(as_text=True)

    assert 'fetch("/api/tool-stats")' not in app_script
    assert "globalStats" not in app_script
    assert 'Promise.all([manifestReady, localeReady])' in app_script
    assert '<div class="menu-row' in app_script
    assert '<a class="menu-item' in app_script
    assert "ensureAccessibleControlNames" in app_script
    assert 'toast.setAttribute("role", "status")' in app_script
    assert 'document.getElementById("content").inert' in app_script
    assert "sidebar.inert" in app_script
    assert 'aria-controls="settings-panel"' in index_html
    assert 'for="lang-select"' in index_html
    assert 'for="theme-select"' in index_html
    assert 'rel="icon" href="/favicon.svg"' in index_html
    assert "@media (prefers-reduced-motion: reduce)" in app_css
    assert ".tool-actions .local-primary:hover:not(:disabled)" in app_css
    assert "background: var(--primary-button-hover); color: var(--on-color);" in app_css
    assert ".tool-panel > button { margin-top: 12px; }" in app_css
    assert client.get("/favicon.svg").status_code == 200
    favicon = client.get("/favicon.ico")
    assert favicon.status_code == 308
    assert favicon.headers["Location"].endswith("/favicon.svg")


def test_operational_logging_and_delivery_gate_are_wired():
    root = Path(__file__).resolve().parents[2]
    app_script = (root / "backend" / "app.py").read_text()
    translate_route = (root / "backend" / "routes" / "translate.py").read_text()
    area_route = (root / "backend" / "routes" / "area_search.py").read_text()
    exchange_route = (root / "backend" / "routes" / "exchange_rates.py").read_text()
    content_route = (root / "backend" / "routes" / "content.py").read_text()
    wishes_route = (root / "backend" / "routes" / "wishes.py").read_text()
    stats_route = (root / "backend" / "routes" / "stats.py").read_text()
    start_script = (root / "start.sh").read_text()
    project_instructions = (root / "CLAUDE.md").read_text()

    assert "event=app_start" in app_script
    assert "flask_debug=%s" in app_script
    assert "event=http_request" in app_script
    assert "def _log_path(path: str)" in app_script
    assert 'r"/api/\\1/:id"' in app_script
    assert 'response.headers["X-Request-ID"]' in app_script
    assert "REQUEST_LOG" in app_script
    assert 'logging.getLogger("werkzeug").setLevel(logging.WARNING)' in app_script
    assert "event=translate_success" in translate_route
    assert "event=translate_failed" in translate_route
    assert "event=area_intro_success" in area_route
    assert "event=area_intro_rate_limited" in area_route
    assert "event=exchange_rates_success" in exchange_route
    assert "event=content_created" in content_route
    assert "event=content_deleted" in content_route
    assert "event=wish_created" in wishes_route
    assert "event=wish_replied" in wishes_route
    assert "event=wish_deleted" in wishes_route
    assert "event=tool_click" in stats_route
    assert "TELEMETRY_WRITES" in stats_route
    assert "isLocalDevelopmentHost()" in (root / "frontend" / "js" / "app.js").read_text()
    assert 'echo "[log] 本次启动日志"' in start_script
    assert "set -o pipefail" in start_script
    assert "validate_args" in start_script
    assert 'HOST=127.0.0.1 FLASK_DEBUG=1 PYTHONUNBUFFERED=1 PYTHONPATH=backend "$VENV_PYTHON" backend/app.py 2>&1 | tee -a "$LOGFILE"' in start_script
    assert 'FLASK_DEBUG=0 PYTHONPATH=backend nohup "$VENV_PYTHON" backend/app.py' in start_script
    assert "Flask Debug: on（自动重载，仅监听本机）" in start_script
    assert "非法参数:" in start_script
    assert "无需额外参数" in start_script
    assert "debug --test" not in start_script
    assert "logs)" in start_script
    assert "产品交付门禁（强制）" in project_instructions
    assert "./start.sh logs" in project_instructions
    assert "不得声称产品已交付完成" in project_instructions
