// Curl Tool — command builder, common examples (with form fill), curl-to-code converter.
var CurlTool = (function () {
  var tab = "builder";

  function t(key) { return (window.__t && window.__t(key)) || key; }

  // [scenario, method, url, headers, body, note]
  var EXAMPLES = [
    ["GET 请求",           "GET",    "https://api.example.com/users",                                    "",                                                     "",                                                       "最基础的 GET"],
    ["GET + Header",       "GET",    "https://api.example.com/users",                                    "Authorization: Bearer TOKEN",                           "",                                                       "带认证头"],
    ["GET + 查询参数",     "GET",    "https://api.example.com/users?page=1&limit=20&status=active",       "",                                                     "",                                                       "URL 查询参数过滤分页"],
    ["POST JSON",          "POST",   "https://api.example.com/users",                                    "Content-Type: application/json",                        "{\n  \"name\": \"test\",\n  \"email\": \"test@example.com\"\n}",  "JSON 请求体创建用户"],
    ["POST 表单",          "POST",   "https://api.example.com/login",                                    "Content-Type: application/x-www-form-urlencoded",       "username=admin&password=123",                             "表单编码登录"],
    ["综合示例",           "POST",   "https://api.example.com/v2/orders?source=app",                     "Content-Type: application/json\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9...\nAccept: application/json\nX-Request-Id: req-20240101-001", "{\n  \"product_id\": \"PRO-001\",\n  \"quantity\": 2,\n  \"address\": {\n    \"city\": \"Beijing\",\n    \"zip\": \"100000\"\n  },\n  \"note\": \"请发货前确认\"\n}", "Header/Query/Body/鉴权 全覆盖示例"],
    ["PUT 更新",           "PUT",    "https://api.example.com/users/1",                                  "Content-Type: application/json",                        "{\n  \"name\": \"updated\"\n}",                               "更新资源"],
    ["PATCH 部分更新",     "PATCH",  "https://api.example.com/users/1",                                  "Content-Type: application/json",                        "{\n  \"status\": \"active\"\n}",                             "部分更新单个字段"],
    ["DELETE",             "DELETE", "https://api.example.com/users/1",                                  "",                                                     "",                                                       "删除资源"],
    ["上传文件",           "POST",   "https://api.example.com/upload",                                   "",                                                     "",                                                       "multipart 上传 (curl -F)"],
    ["上传+参数",          "POST",   "https://api.example.com/upload",                                   "",                                                     "",                                                       "curl -F \"file=@./photo.png\" -F \"title=头像\""],
    ["下载文件",           "GET",    "https://example.com/file.zip",                                     "",                                                     "",                                                       "curl -O 保存到本地"],
    ["跟随重定向",         "GET",    "https://example.com",                                              "",                                                     "",                                                       "curl -L 自动跟随 301/302"],
    ["仅显示响应头",       "HEAD",   "https://api.example.com",                                          "",                                                     "",                                                       "curl -I HEAD 请求"],
    ["响应头+体",          "GET",    "https://api.example.com",                                          "",                                                     "",                                                       "curl -i 输出头+体"],
    ["详细调试",           "GET",    "https://api.example.com",                                          "",                                                     "",                                                       "curl -v 显示 TLS/请求/响应头"],
    ["超时设置",           "GET",    "https://api.example.com",                                          "",                                                     "",                                                       "curl --connect-timeout 5 --max-time 30"],
    ["Basic Auth",         "GET",    "https://api.example.com/admin",                                    "",                                                     "",                                                       "curl -u admin:pass"],
    ["Bearer Token",       "GET",    "https://api.example.com/me",                                       "Authorization: Bearer eyJ...",                          "",                                                       "JWT / OAuth2"],
    ["发送 Cookie",        "GET",    "https://api.example.com/dashboard",                                "Cookie: session=abc123",                                "",                                                       "curl -b 发送 Cookie"],
    ["保存 Cookie",        "POST",   "https://api.example.com/login",                                    "Content-Type: application/x-www-form-urlencoded",       "user=admin&pass=123",                                     "curl -c cookies.txt 保存"],
    ["HTTP 代理",          "GET",    "https://api.example.com",                                          "",                                                     "",                                                       "curl -x http://127.0.0.1:8080"],
    ["忽略 SSL 证书",      "GET",    "https://self-signed.example.com",                                  "",                                                     "",                                                       "curl -k 跳过验证（不推荐）"],
    ["自定义 User-Agent",  "GET",    "https://api.example.com",                                          "",                                                     "",                                                       "curl -A \"Mozilla/5.0\""],
    ["输出 HTTP 状态码",   "GET",    "https://api.example.com",                                          "",                                                     "",                                                       "curl -w \"%{http_code}\" -o /dev/null -s"],
    ["JSON 美化输出",      "GET",    "https://api.example.com/users",                                    "",                                                     "",                                                       "管道到 python3 -m json.tool"],
    ["并发测试",           "GET",    "https://api.example.com",                                          "",                                                     "",                                                       "for i in {1..10}; do curl & done; wait"],
  ];

  function currentLang() {
    return (window.__locale && window.__locale.menu && window.__locale.menu.home === "首页") ? "zh" : "en";
  }

  function init(parent) {
    parent.innerHTML =
      '<div class="b64-tool">' +
      '  <div class="b64-tabs">' +
      '    <button id="curl-tab-builder" class="b64-tab active">' + t("curl.builder") + '</button>' +
      '    <button id="curl-tab-examples" class="b64-tab">' + t("curl.examples") + '</button>' +
      '    <button id="curl-tab-convert" class="b64-tab">' + t("curl.convert") + '</button>' +
      '  </div>' +
      // ── builder ──
      '  <div id="curl-pane-builder" class="b64-pane">' +
      '    <div class="curl-builder">' +
      '      <div class="curl-form-row">' +
      '        <select id="curl-method" class="settings-select" style="width:auto">' +
      '          <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option><option>OPTIONS</option>' +
      '        </select>' +
      '        <input id="curl-url" class="crypto-input" type="text" placeholder="https://api.example.com/users" style="flex:1;min-width:250px">' +
      '      </div>' +
      '      <div class="curl-form-row">' +
      '        <label class="crypto-inline"><span>' + t("curl.headers") + '</span></label>' +
      '        <textarea id="curl-headers" class="b64-textarea" placeholder="Content-Type: application/json\nAuthorization: Bearer TOKEN" style="min-height:60px;resize:vertical"></textarea>' +
      '      </div>' +
      '      <div class="curl-form-row">' +
      '        <label class="crypto-inline"><span>' + t("curl.body") + '</span></label>' +
      '        <textarea id="curl-body" class="b64-textarea" placeholder=\'{"name":"test"}\' style="min-height:80px;resize:vertical"></textarea>' +
      '      </div>' +
      '      <div class="curl-form-row">' +
      '        <label class="crypto-inline"><span>' + t("curl.options") + '</span>' +
      '          <label style="font-weight:400;margin-left:8px;font-size:0.85rem" title="显示 TLS 握手、请求/响应头等完整调试信息"><input type="checkbox" id="curl-opt-verbose"> -v 详细</label>' +
      '          <label style="font-weight:400;margin-left:8px;font-size:0.85rem" title="输出内容同时包含 HTTP 响应头和响应体"><input type="checkbox" id="curl-opt-include"> -i 含头</label>' +
      '          <label style="font-weight:400;margin-left:8px;font-size:0.85rem" title="自动跟随 301/302 重定向跳转"><input type="checkbox" id="curl-opt-location"> -L 跟随</label>' +
      '          <label style="font-weight:400;margin-left:8px;font-size:0.85rem" title="跳过 HTTPS 证书验证，仅限测试环境"><input type="checkbox" id="curl-opt-insecure"> -k 免证</label>' +
      '        </label>' +
      '      </div>' +
      '      <div class="curl-form-row">' +
      '        <button id="curl-build-btn" class="jt-btn jt-btn-primary">' + t("curl.build") + '</button>' +
      '        <button id="curl-copy-btn" class="jt-btn">' + t("curl.copyCmd") + '</button>' +
      '        <button id="curl-run-btn" class="jt-btn">' + t("curl.tryIt") + '</button>' +
      '      </div>' +
      '      <div class="curl-form-row" style="margin-top:12px">' +
      '        <textarea id="curl-output-cmd" class="b64-textarea" readonly placeholder="' + t("curl.curlPlaceholder") + '" style="font-family:SF Mono,monospace;min-height:80px;resize:vertical"></textarea>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      // ── examples ──
      '  <div id="curl-pane-examples" class="b64-pane hidden">' +
      '    <div class="at-search-wrap" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '      <input id="curl-search-examples" class="search-input" type="text" placeholder="' + t("curl.searchExamples") + '" style="max-width:260px">' +
      '      <span style="font-size:0.82rem;color:var(--text-secondary)">' + t("curl.replaceDomain") + '</span>' +
      '      <input id="curl-domain-input" class="crypto-input" type="text" placeholder="https://api.example.com" style="width:240px">' +
      '      <span id="curl-domain-msg" style="font-size:0.78rem;color:var(--text-muted)"></span>' +
      '    </div>' +
      '    <div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.scenario") + '</th><th>Method</th><th>URL</th><th>' + t("android.note") + '</th></tr></thead><tbody id="curl-examples-body"></tbody></table></div>' +
      '  </div>' +
      // ── convert ──
      '  <div id="curl-pane-convert" class="b64-pane hidden">' +
      '    <div class="curl-convert-wrap">' +
      '      <div class="curl-form-row">' +
      '        <textarea id="curl-convert-input" class="b64-textarea" placeholder="curl -X POST https://api.example.com -H ‘Content-Type: application/json’ -d ‘{“key”:“value”}’" style="height:80px;min-height:80px"></textarea>' +
      '      </div>' +
      '      <div class="curl-form-row">' +
      '        <select id="curl-convert-lang" class="settings-select" style="width:auto">' +
      '          <option value="python">Python (requests)</option>' +
      '          <option value="js">JavaScript (fetch)</option>' +
      '          <option value="go">Go (net/http)</option>' +
      '          <option value="java">Java (OkHttp)</option>' +
      '          <option value="kotlin">Kotlin (OkHttp)</option>' +
      '        </select>' +
      '        <button id="curl-convert-btn" class="jt-btn jt-btn-primary">' + t("curl.convert") + '</button>' +
      '        <button id="curl-convert-copy" class="jt-btn">' + t("curl.copyCmd") + '</button>' +
      '      </div>' +
      '      <div class="curl-form-row" style="margin-top:12px">' +
      '        <textarea id="curl-convert-output" class="b64-textarea" readonly placeholder="' + t("curl.convertPlaceholder") + '" style="height:200px;min-height:200px;font-family:SF Mono,monospace"></textarea>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    switchTab("builder");
    bindEvents();
    renderExamples();
  }

  function switchTab(mode) {
    tab = mode;
    document.querySelectorAll("#curl-tab-builder, #curl-tab-examples, #curl-tab-convert").forEach(function (btn) {
      btn.className = "b64-tab" + (btn.id === "curl-tab-" + mode ? " active" : "");
    });
    document.getElementById("curl-pane-builder").classList.toggle("hidden", mode !== "builder");
    document.getElementById("curl-pane-examples").classList.toggle("hidden", mode !== "examples");
    document.getElementById("curl-pane-convert").classList.toggle("hidden", mode !== "convert");
  }

  function bindEvents() {
    document.getElementById("curl-tab-builder").addEventListener("click", function () { switchTab("builder"); });
    document.getElementById("curl-tab-examples").addEventListener("click", function () { switchTab("examples"); });
    document.getElementById("curl-tab-convert").addEventListener("click", function () { switchTab("convert"); });
    document.getElementById("curl-build-btn").addEventListener("click", buildCurl);
    document.getElementById("curl-copy-btn").addEventListener("click", copyCmd);
    document.getElementById("curl-run-btn").addEventListener("click", tryCurl);
    document.getElementById("curl-convert-btn").addEventListener("click", convertCurl);
    document.getElementById("curl-convert-copy").addEventListener("click", function () {
      var v = document.getElementById("curl-convert-output").value;
      if (v) { navigator.clipboard.writeText(v); showCopyToast(); }
    });
    bindSearch("curl-search-examples", "#curl-examples-body tr", function (tr, q) {
      tr.style.display = q && !tr.textContent.toLowerCase().includes(q) ? "none" : "";
    });
    // auto-build on input change
    ["curl-method", "curl-url", "curl-headers", "curl-body"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", buildCurl);
    });
    document.querySelectorAll("#curl-opt-verbose, #curl-opt-include, #curl-opt-location, #curl-opt-insecure").forEach(function (cb) {
      cb.addEventListener("change", buildCurl);
    });
  }

  // ═══ Builder ═══

  function fillForm(method, url, headers, body) {
    document.getElementById("curl-method").value = method || "GET";
    document.getElementById("curl-url").value = url || "";
    document.getElementById("curl-headers").value = headers || "";
    document.getElementById("curl-body").value = body || "";
    buildCurl();
  }

  function buildCurl() {
    var method = document.getElementById("curl-method").value;
    var url = document.getElementById("curl-url").value.trim();
    if (!url) { document.getElementById("curl-output-cmd").value = ""; return; }

    var parts = ["curl"];
    if (method !== "GET") parts.push("-X " + method);

    var headers = document.getElementById("curl-headers").value.trim();
    if (headers) {
      headers.split("\n").forEach(function (line) {
        line = line.trim();
        if (line) parts.push("-H '" + line + "'");
      });
    }

    var body = document.getElementById("curl-body").value.trim();
    if (body && method !== "GET" && method !== "HEAD") {
      parts.push("-d '" + body.replace(/'/g, "'\\''") + "'");
    }

    if (document.getElementById("curl-opt-verbose").checked) parts.push("-v");
    if (document.getElementById("curl-opt-include").checked) parts.push("-i");
    if (document.getElementById("curl-opt-location").checked) parts.push("-L");
    if (document.getElementById("curl-opt-insecure").checked) parts.push("-k");

    parts.push("'" + url + "'");
    document.getElementById("curl-output-cmd").value = parts.join(" \\\n  ");
  }

  function copyCmd() {
    var v = document.getElementById("curl-output-cmd").value;
    if (v) { navigator.clipboard.writeText(v.replace(/ \\\n  /g, " ")); showCopyToast(); }
  }

  function tryCurl() {
    var cmd = document.getElementById("curl-output-cmd").value.replace(/ \\\n  /g, " ");
    if (!cmd) return;
    navigator.clipboard.writeText(cmd);
    showCopyToast();
  }

  // ═══ Examples ═══

  var examplesBaseDomain = "https://api.example.com"; // detected from first example

  function detectBaseDomain() {
    // find the most common scheme+host across examples
    var hosts = {};
    EXAMPLES.forEach(function (r) {
      var m = r[2].match(/^(https?:\/\/[^\/]+)/);
      if (m) hosts[m[1]] = (hosts[m[1]] || 0) + 1;
    });
    var best = "", bestCount = 0;
    for (var h in hosts) { if (hosts[h] > bestCount) { best = h; bestCount = hosts[h]; } }
    return best || "https://api.example.com";
  }

  function replaceDomain(newDomain) {
    if (!newDomain) newDomain = examplesBaseDomain;
    // auto-detect scheme: if no http(s):// prefix, add https://
    if (!/^https?:\/\//i.test(newDomain)) newDomain = "https://" + newDomain;
    // strip trailing slash
    newDomain = newDomain.replace(/\/+$/, "");
    examplesBaseDomain = newDomain;

    var userHasPath = newDomain.indexOf("/", 8) > 0;

    document.querySelectorAll("#curl-examples-body tr").forEach(function (tr) {
      var idx = parseInt(tr.dataset.idx);
      var r = EXAMPLES[idx];
      var origUrl = r[2];
      var origMatch = origUrl.match(/^(https?:\/\/[^\/]+)(\/.*)?$/);
      if (!origMatch) return;
      var origPath = origMatch[2] || "";
      var origQuery = origPath.indexOf("?") > 0 ? origPath.substring(origPath.indexOf("?")) : "";
      var newUrl;
      if (userHasPath) {
        // user provided domain+path → preserve original query string
        newUrl = newDomain.replace(/\/+$/, "") + origQuery;
      } else {
        newUrl = newDomain.replace(/\/+$/, "") + origPath;
      }
      var urlCell = tr.querySelector("td:nth-child(3) code");
      if (urlCell) urlCell.textContent = newUrl;
      tr.dataset.replacedUrl = newUrl;
    });

    var msg = document.getElementById("curl-domain-msg");
    var count = document.querySelectorAll("#curl-examples-body tr").length;
    if (msg) msg.textContent = "✓ " + count + " 条已切换";
    setTimeout(function () { if (msg) msg.textContent = ""; }, 2000);
  }

  function renderExamples() {
    var body = document.getElementById("curl-examples-body");
    if (!body) return;
    examplesBaseDomain = detectBaseDomain();
    document.getElementById("curl-domain-input").placeholder = examplesBaseDomain;

    var h = "";
    EXAMPLES.forEach(function (r, idx) {
      h += '<tr data-idx="' + idx + '" style="cursor:pointer"><td>' + escapeHtml(r[0]) + '</td><td><code>' + r[1] + '</code></td><td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><code>' + escapeHtml(r[2]) + '</code></td><td>' + escapeHtml(r[5]) + '</td></tr>';
    });
    body.innerHTML = h;
    body.querySelectorAll("tr").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var idx = parseInt(this.dataset.idx);
        var r = EXAMPLES[idx];
        var url = this.dataset.replacedUrl || r[2];
        fillForm(r[1], url, r[3], r[4]);
        switchTab("builder");
      });
    });

    // domain replacement input
    var domainInput = document.getElementById("curl-domain-input");
    if (domainInput) {
      domainInput.addEventListener("input", function () {
        var val = this.value.trim();
        if (val) replaceDomain(val);
      });
    }
  }

  // ═══ Curl → Code ═══

  function parseCurl(cmd) {
    var parsed = { method: "GET", url: "", headers: {}, body: "" };
    var flat = cmd.replace(/\\\n/g, " ").replace(/\s+/g, " ").trim();

    var urlMatch = flat.match(/'([^']+)'/g);
    if (urlMatch) {
      parsed.url = urlMatch[urlMatch.length - 1].replace(/'/g, "");
      flat = flat.replace(/'[^']+'/g, "");
    } else {
      var parts = flat.split(" ");
      parsed.url = parts[parts.length - 1];
      flat = parts.slice(0, -1).join(" ");
    }

    var m = flat.match(/-X\s+(\w+)/i);
    if (m) parsed.method = m[1].toUpperCase();

    var hRe = /-H\s+'([^']+)'/g, hm;
    while ((hm = hRe.exec(cmd.replace(/\\\n/g, " "))) !== null) {
      var colon = hm[1].indexOf(": ");
      if (colon > 0) parsed.headers[hm[1].substring(0, colon)] = hm[1].substring(colon + 2);
    }

    var bm = cmd.match(/-d\s+'([^']+)'/);
    if (bm) parsed.body = bm[1];

    return parsed;
  }

  function convertCurl() {
    var input = document.getElementById("curl-convert-input").value.trim();
    var output = document.getElementById("curl-convert-output");
    if (!input) { output.value = ""; return; }

    try {
      var p = parseCurl(input);
      var lang = document.getElementById("curl-convert-lang").value;
      var result = "";
      var headersArr = Object.keys(p.headers);

      if (lang === "python") {
        result = "import requests\n\nurl = " + quote(p.url) + "\n";
        if (headersArr.length) {
          result += "headers = {\n";
          headersArr.forEach(function (k) { result += "    " + quote(k) + ": " + quote(p.headers[k]) + ",\n"; });
          result += "}\n";
        }
        if (p.body) result += "data = " + quote(p.body) + "\n";
        result += "\nresponse = requests." + p.method.toLowerCase() + "(url";
        if (headersArr.length) result += ", headers=headers";
        if (p.body) result += ", data=data";
        result += ")\nprint(response.json())";
      } else if (lang === "js") {
        result = "const url = " + quote(p.url) + ";\n\nconst options = {\n  method: " + quote(p.method) + ",\n";
        if (headersArr.length) {
          result += "  headers: {\n";
          headersArr.forEach(function (k) { result += "    " + quote(k) + ": " + quote(p.headers[k]) + ",\n"; });
          result += "  },\n";
        }
        if (p.body) result += "  body: " + quote(p.body) + ",\n";
        result += "};\n\nfetch(url, options)\n  .then(res => res.json())\n  .then(data => console.log(data));";
      } else if (lang === "go") {
        result = 'package main\n\nimport (\n\t"bytes"\n\t"io"\n\t"net/http"\n)\n\nfunc main() {\n';
        if (p.body) result += '\tbody := bytes.NewBufferString(' + quote(p.body) + ')\n';
        result += '\treq, _ := http.NewRequest(' + quote(p.method) + ', ' + quote(p.url) + ', ';
        result += p.body ? 'body)' : 'nil)';
        result += '\n';
        headersArr.forEach(function (k) { result += '\treq.Header.Set(' + quote(k) + ', ' + quote(p.headers[k]) + ')\n'; });
        result += '\tresp, _ := http.DefaultClient.Do(req)\n\tdefer resp.Body.Close()\n\t_, _ = io.ReadAll(resp.Body)\n}';
      } else if (lang === "java") {
        result = 'import okhttp3.*;\n\nOkHttpClient client = new OkHttpClient();\n\n';
        if (p.body) result += 'RequestBody body = RequestBody.create(MediaType.parse("application/json"), ' + quote(p.body) + ');\n\n';
        result += 'Request request = new Request.Builder()\n    .url(' + quote(p.url) + ')\n    .' + p.method.toLowerCase() + '(' + (p.body ? 'body' : '') + ')\n';
        headersArr.forEach(function (k) { result += '    .addHeader(' + quote(k) + ', ' + quote(p.headers[k]) + ')\n'; });
        result += '    .build();\n\nResponse response = client.newCall(request).execute();\nString body = response.body().string();';
      } else if (lang === "kotlin") {
        result = 'import okhttp3.*\n\nval client = OkHttpClient()\n\n';
        if (p.body) result += 'val body = RequestBody.create(MediaType.parse("application/json"), ' + quote(p.body) + ')\n\n';
        result += 'val request = Request.Builder()\n    .url(' + quote(p.url) + ')\n    .' + p.method.toLowerCase() + '(' + (p.body ? 'body' : '') + ')\n';
        headersArr.forEach(function (k) { result += '    .addHeader(' + quote(k) + ', ' + quote(p.headers[k]) + ')\n'; });
        result += '    .build()\n\nval response = client.newCall(request).execute()\nval body = response.body?.string()';
      }

      output.value = result;
    } catch (e) {
      output.value = "// Error: " + (e.message || e);
    }
  }

  // ── helpers ──

  function quote(s) {
    s = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return JSON.stringify(s);
  }

  function escapeHtml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function bindSearch(inputId, rowSelector, filterFn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("input", function () {
      var q = this.value.toLowerCase();
      document.querySelectorAll(rowSelector).forEach(function (tr) { filterFn(tr, q); });
    });
  }

  return { init: init };
})();
