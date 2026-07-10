// HTTP Reference Tool — searchable status-code and header reference.
var HttpTool = (function () {
  var HISTORY_KEY = "http_reference_history";
  var MAX_HISTORY = 12;

  var STATUS_CODES = [
    [100, "Continue", "继续发送请求体", "Continue sending the request body"],
    [101, "Switching Protocols", "正在切换协议，例如 WebSocket", "Switching protocols, such as WebSocket"],
    [200, "OK", "请求成功", "Request succeeded"],
    [201, "Created", "资源创建成功", "Resource created successfully"],
    [202, "Accepted", "请求已接受，尚未处理完成", "Accepted but not yet completed"],
    [204, "No Content", "成功但没有响应正文", "Succeeded with no response body"],
    [206, "Partial Content", "返回范围请求的部分内容", "Partial response for a range request"],
    [301, "Moved Permanently", "资源永久重定向", "Permanent redirect"],
    [302, "Found", "临时重定向，历史客户端可能改用 GET", "Temporary redirect; legacy clients may switch to GET"],
    [303, "See Other", "使用 GET 访问另一个资源", "Use GET to retrieve another resource"],
    [304, "Not Modified", "缓存仍有效，无需返回正文", "Cached response is still valid"],
    [307, "Temporary Redirect", "临时重定向并保留方法和请求体", "Temporary redirect preserving method and body"],
    [308, "Permanent Redirect", "永久重定向并保留方法和请求体", "Permanent redirect preserving method and body"],
    [400, "Bad Request", "请求语法或参数错误", "Invalid request syntax or parameters"],
    [401, "Unauthorized", "缺少或无效的身份认证", "Authentication is missing or invalid"],
    [403, "Forbidden", "身份已知但无访问权限", "Authenticated but not permitted"],
    [404, "Not Found", "资源不存在", "Resource was not found"],
    [405, "Method Not Allowed", "请求方法不被资源支持", "Method is not supported by the resource"],
    [406, "Not Acceptable", "无法生成客户端可接受的响应格式", "Cannot produce an acceptable representation"],
    [408, "Request Timeout", "服务器等待请求超时", "Server timed out waiting for the request"],
    [409, "Conflict", "请求与资源当前状态冲突", "Request conflicts with current resource state"],
    [410, "Gone", "资源已永久删除", "Resource has been permanently removed"],
    [411, "Length Required", "需要 Content-Length", "Content-Length is required"],
    [412, "Precondition Failed", "条件请求校验失败", "A request precondition failed"],
    [413, "Content Too Large", "请求体过大", "Request body is too large"],
    [415, "Unsupported Media Type", "不支持请求的媒体类型", "Request media type is unsupported"],
    [416, "Range Not Satisfiable", "请求的字节范围无效", "Requested byte range cannot be satisfied"],
    [418, "I'm a teapot", "彩蛋状态码：服务器拒绝煮咖啡", "Joke status: the server refuses to brew coffee"],
    [422, "Unprocessable Content", "语法正确但业务校验失败", "Syntax is valid but semantic validation failed"],
    [425, "Too Early", "请求可能遭受重放攻击", "Request may be vulnerable to replay"],
    [426, "Upgrade Required", "客户端需要升级协议", "Client must upgrade the protocol"],
    [428, "Precondition Required", "要求使用条件请求避免覆盖", "A conditional request is required"],
    [429, "Too Many Requests", "请求过于频繁，通常配合 Retry-After", "Rate limit exceeded; often includes Retry-After"],
    [431, "Request Header Fields Too Large", "请求头字段过大", "Request header fields are too large"],
    [451, "Unavailable For Legal Reasons", "因法律原因不可用", "Unavailable for legal reasons"],
    [500, "Internal Server Error", "服务器内部异常", "Unexpected server error"],
    [501, "Not Implemented", "服务器未实现该功能", "Functionality is not implemented"],
    [502, "Bad Gateway", "网关收到无效的上游响应", "Gateway received an invalid upstream response"],
    [503, "Service Unavailable", "服务暂时不可用", "Service is temporarily unavailable"],
    [504, "Gateway Timeout", "网关等待上游响应超时", "Gateway timed out waiting for upstream"],
  ];

  var HEADERS = [
    ["request", "Accept", "application/json", "声明客户端可接受的响应类型", "Response media types accepted by the client"],
    ["request", "Accept-Encoding", "gzip, br", "声明支持的内容压缩算法", "Supported content encodings"],
    ["request", "Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8", "声明偏好的自然语言", "Preferred natural languages"],
    ["request", "Authorization", "Bearer <token>", "携带认证凭据", "Carries authentication credentials"],
    ["request", "Content-Type", "application/json; charset=utf-8", "描述请求体的媒体类型", "Media type of the request body"],
    ["request", "Cookie", "session_id=abc123", "向服务器发送 Cookie", "Sends cookies to the server"],
    ["request", "If-None-Match", "\"etag-value\"", "ETag 条件请求，未变化时返回 304", "ETag condition; returns 304 when unchanged"],
    ["request", "If-Modified-Since", "Wed, 21 Oct 2015 07:28:00 GMT", "按修改时间进行缓存校验", "Cache validation by modification date"],
    ["request", "Origin", "https://app.example.com", "CORS 请求的来源", "Origin of a CORS request"],
    ["request", "Range", "bytes=0-1023", "请求资源的指定字节范围", "Requests a byte range"],
    ["request", "Referer", "https://example.com/page", "当前请求的来源页面", "Page that initiated the request"],
    ["request", "User-Agent", "Mozilla/5.0 ...", "客户端软件标识", "Client software identifier"],
    ["response", "Content-Type", "application/json; charset=utf-8", "描述响应正文的媒体类型", "Media type of the response body"],
    ["response", "Content-Length", "1024", "响应正文的字节长度", "Response body length in bytes"],
    ["response", "Content-Disposition", "attachment; filename=report.pdf", "控制内联显示或文件下载", "Controls inline display or download"],
    ["response", "ETag", "\"686897696a7c876b7e\"", "资源版本标识，用于缓存校验", "Resource version identifier for validation"],
    ["response", "Last-Modified", "Wed, 21 Oct 2015 07:28:00 GMT", "资源最后修改时间", "Resource's last modification date"],
    ["response", "Location", "https://example.com/new", "重定向地址或新资源地址", "Redirect or newly created resource URL"],
    ["response", "Retry-After", "120", "建议客户端等待后重试的秒数或日期", "Delay or date before retrying"],
    ["response", "Set-Cookie", "session_id=abc; HttpOnly; Secure; SameSite=Lax", "让浏览器保存 Cookie", "Stores a cookie in the browser"],
    ["response", "Vary", "Accept-Encoding, Origin", "声明缓存键还依赖哪些请求头", "Request headers that affect the cache key"],
    ["cache", "Cache-Control", "public, max-age=3600", "控制浏览器与共享缓存行为", "Controls browser and shared caching"],
    ["cache", "Cache-Control", "no-store", "禁止存储任何响应副本", "Prevents storing any response copy"],
    ["cache", "Cache-Control", "no-cache", "允许存储，但每次使用前必须验证", "Allows storage but requires revalidation"],
    ["cache", "Expires", "Wed, 21 Oct 2026 07:28:00 GMT", "旧式绝对过期时间", "Legacy absolute expiration date"],
    ["cors", "Access-Control-Allow-Origin", "https://app.example.com", "允许访问资源的来源", "Origin allowed to access the resource"],
    ["cors", "Access-Control-Allow-Methods", "GET, POST, OPTIONS", "预检响应允许的方法", "Methods allowed by preflight"],
    ["cors", "Access-Control-Allow-Headers", "Content-Type, Authorization", "预检响应允许的请求头", "Request headers allowed by preflight"],
    ["cors", "Access-Control-Allow-Credentials", "true", "允许跨域请求携带凭据", "Allows credentials in cross-origin requests"],
    ["cors", "Access-Control-Max-Age", "86400", "预检结果可以缓存的秒数", "Seconds a preflight result may be cached"],
    ["security", "Content-Security-Policy", "default-src 'self'", "限制页面可加载的资源来源", "Restricts sources the page may load"],
    ["security", "Strict-Transport-Security", "max-age=31536000; includeSubDomains", "强制后续使用 HTTPS", "Forces future HTTPS connections"],
    ["security", "X-Content-Type-Options", "nosniff", "禁止浏览器猜测 MIME 类型", "Prevents MIME type sniffing"],
    ["security", "X-Frame-Options", "DENY", "限制页面被嵌入 frame", "Restricts framing of the page"],
    ["security", "Referrer-Policy", "strict-origin-when-cross-origin", "控制 Referer 信息的发送范围", "Controls how much referrer data is sent"],
    ["security", "Permissions-Policy", "camera=(), microphone=()", "限制浏览器功能权限", "Restricts browser feature permissions"],
  ];

  function t(key) { return (window.__t && window.__t(key)) || key; }
  function isEnglish() { return document.documentElement.lang.toLowerCase().indexOf("en") === 0; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, function (char) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]; }); }
  function statusGroup(code) { return String(Math.floor(code / 100)) + "xx"; }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (error) { return []; }
  }

  function remember(value) {
    var history = loadHistory().filter(function (item) { return item !== value; });
    history.unshift(value);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    renderHistory();
  }

  function copyValue(value) {
    navigator.clipboard.writeText(value).then(function () {
      remember(value);
      showCopyToast("✓ " + t("http.copied"));
    });
  }

  function renderStatuses() {
    var query = document.getElementById("http-status-search").value.trim().toLowerCase();
    var group = document.getElementById("http-status-filter").value;
    var rows = STATUS_CODES.filter(function (item) {
      var search = item.join(" ").toLowerCase();
      return (!query || search.indexOf(query) !== -1) && (!group || statusGroup(item[0]) === group);
    }).map(function (item) {
      var value = item[0] + " " + item[1];
      return '<tr data-search="' + escapeHtml(item.join(" ").toLowerCase()) + '"><td data-copy="' + escapeHtml(value) + '"><code>' + item[0] + '</code></td><td>' + escapeHtml(item[1]) + '</td><td class="at-muted">' + t("http.group." + statusGroup(item[0])) + '</td><td>' + escapeHtml(isEnglish() ? item[3] : item[2]) + '</td></tr>';
    }).join("");
    document.getElementById("http-status-body").innerHTML = rows || '<tr><td colspan="4" class="at-muted">' + t("http.noResults") + "</td></tr>";
  }

  function renderHeaders() {
    var query = document.getElementById("http-header-search").value.trim().toLowerCase();
    var type = document.getElementById("http-header-filter").value;
    var rows = HEADERS.filter(function (item) {
      var search = item.join(" ").toLowerCase();
      return (!query || search.indexOf(query) !== -1) && (!type || item[0] === type);
    }).map(function (item) {
      var snippet = item[1] + ": " + item[2];
      return '<tr><td><code>' + escapeHtml(item[1]) + '</code><br><span class="at-muted">' + t("http.type." + item[0]) + '</span></td><td data-copy="' + escapeHtml(snippet) + '"><code>' + escapeHtml(item[2]) + '</code></td><td>' + escapeHtml(isEnglish() ? item[4] : item[3]) + '</td></tr>';
    }).join("");
    document.getElementById("http-header-body").innerHTML = rows || '<tr><td colspan="3" class="at-muted">' + t("http.noResults") + "</td></tr>";
  }

  function renderHistory() {
    var container = document.getElementById("http-history");
    if (!container) return;
    var history = loadHistory();
    if (!history.length) { container.innerHTML = ""; return; }
    var html = '<span class="history-label">' + t("history.label") + "</span>";
    history.forEach(function (item, index) {
      html += '<button class="history-chip" data-index="' + index + '" title="' + escapeHtml(item) + '">' + escapeHtml(item) + "</button>";
    });
    container.innerHTML = html;
    container.querySelectorAll(".history-chip").forEach(function (button) {
      button.addEventListener("click", function () { copyValue(history[parseInt(this.dataset.index, 10)]); });
    });
  }

  function switchTab(tab) {
    document.querySelectorAll(".b64-tab[data-http-tab]").forEach(function (button) {
      button.className = "b64-tab" + (button.dataset.httpTab === tab ? " active" : "");
    });
    document.querySelectorAll(".android-section[id^='http-tab-']").forEach(function (section) {
      section.classList.toggle("hidden", section.id !== "http-tab-" + tab);
    });
  }

  function init(parent) {
    parent.innerHTML =
      '<div class="b64-tool">' +
      '<div class="b64-tabs"><button class="b64-tab active" data-http-tab="statuses">' + t("http.statusCodes") + '</button><button class="b64-tab" data-http-tab="headers">' + t("http.headers") + '</button></div>' +
      '<div id="http-tab-statuses" class="android-section"><div class="at-search-wrap"><input id="http-status-search" class="search-input" type="text" placeholder="' + t("http.statusSearch") + '"> <select id="http-status-filter" class="crypto-input" style="width:190px"><option value="">' + t("http.allCategories") + '</option><option value="1xx">1xx · ' + t("http.info") + '</option><option value="2xx">2xx · ' + t("http.success") + '</option><option value="3xx">3xx · ' + t("http.redirect") + '</option><option value="4xx">4xx · ' + t("http.clientError") + '</option><option value="5xx">5xx · ' + t("http.serverError") + '</option></select></div><div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("http.code") + '</th><th>' + t("http.statusName") + '</th><th>' + t("http.category") + '</th><th>' + t("http.description") + '</th></tr></thead><tbody id="http-status-body"></tbody></table></div></div>' +
      '<div id="http-tab-headers" class="android-section hidden"><div class="at-search-wrap"><input id="http-header-search" class="search-input" type="text" placeholder="' + t("http.headerSearch") + '"> <select id="http-header-filter" class="crypto-input" style="width:190px"><option value="">' + t("http.allHeaders") + '</option><option value="request">' + t("http.type.request") + '</option><option value="response">' + t("http.type.response") + '</option><option value="cache">' + t("http.type.cache") + '</option><option value="cors">CORS</option><option value="security">' + t("http.type.security") + '</option></select></div><div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("http.headerName") + '</th><th>' + t("http.example") + '</th><th>' + t("http.description") + '</th></tr></thead><tbody id="http-header-body"></tbody></table></div></div>' +
      '<div id="http-history" class="history-bar"></div></div>';

    document.querySelectorAll(".b64-tab[data-http-tab]").forEach(function (button) { button.addEventListener("click", function () { switchTab(this.dataset.httpTab); }); });
    document.getElementById("http-status-search").addEventListener("input", renderStatuses);
    document.getElementById("http-status-filter").addEventListener("change", renderStatuses);
    document.getElementById("http-header-search").addEventListener("input", renderHeaders);
    document.getElementById("http-header-filter").addEventListener("change", renderHeaders);
    parent.addEventListener("click", function (event) {
      var target = event.target.closest("[data-copy]");
      if (target) copyValue(target.dataset.copy);
    });
    renderStatuses();
    renderHeaders();
    renderHistory();
  }

  return { init: init };
})();
