// AI Tool — CC Switch guide, downloads, Claude Code + Codex CLI reference
var AiTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  // ═══ Tab 1: CC Switch 使用指南 ═══

  function buildCcSwitchSection() {
    var h = '';
    h += '<div class="ccswitch-guide">';

    // ── 简介 ──
    h += '<div class="ccswitch-hero">';
    h += '<h3>🔄 CC Switch — 统一管理你的 AI 编程工具工作流</h3>';
    h += '<p>' + t("ai.ccintro") + '</p>';
    h += '<div class="ccswitch-meta">';
    h += '<a href="https://ccswitch.io" target="_blank" rel="noopener">🌐 官网</a> · ';
    h += '<a href="https://github.com/farion1231/cc-switch" target="_blank" rel="noopener">⭐ GitHub</a> · ';
    h += '<span>📥 ' + t("ai.ccPlatforms") + '</span>';
    h += '</div></div>';

    // ── 它能做什么 ──
    h += '<h4>' + t("ai.ccWhat") + '</h4>';
    h += '<ul>';
    h += '<li><strong>' + t("ai.ccWhat1Title") + '</strong>：' + t("ai.ccWhat1Desc") + '</li>';
    h += '<li><strong>' + t("ai.ccWhat2Title") + '</strong>：' + t("ai.ccWhat2Desc") + '</li>';
    h += '<li><strong>' + t("ai.ccWhat3Title") + '</strong>：' + t("ai.ccWhat3Desc") + '</li>';
    h += '<li><strong>' + t("ai.ccWhat4Title") + '</strong>：' + t("ai.ccWhat4Desc") + '</li>';
    h += '<li><strong>' + t("ai.ccWhat5Title") + '</strong>：' + t("ai.ccWhat5Desc") + '</li>';
    h += '</ul>';

    // ── 安装 ──
    h += '<h4>📥 ' + t("ai.ccInstall") + '</h4>';
    h += '<ol><li>' + t("ai.ccInstallStep1") + ' <a href="https://github.com/farion1231/cc-switch/releases" target="_blank" rel="noopener">GitHub Releases</a></li>';
    h += '<li>' + t("ai.ccInstallStep2") + '</li>';
    h += '<li>' + t("ai.ccInstallStep3") + '</li></ol>';

    // ── 结合 Claude Code ──
    h += '<h4>🤖 ' + t("ai.ccWithClaude") + '</h4>';
    h += '<ol>';
    h += '<li>' + t("ai.ccClaudeStep1") + '</li>';
    h += '<li>' + t("ai.ccClaudeStep2") + '</li>';
    h += '<li>' + t("ai.ccClaudeStep3") + '</li>';
    h += '<li>' + t("ai.ccClaudeStep4") + '</li>';
    h += '<li>' + t("ai.ccClaudeStep5") + '</li>';
    h += '</ol>';
    h += '<p class="at-muted">💡 ' + t("ai.ccClaudeTip") + '</p>';

    // ── 结合 Codex ──
    h += '<h4>⚡ ' + t("ai.ccWithCodex") + '</h4>';
    h += '<ol>';
    h += '<li>' + t("ai.ccCodexStep1") + '</li>';
    h += '<li>' + t("ai.ccCodexStep2") + '</li>';
    h += '<li>' + t("ai.ccCodexStep3") + '</li>';
    h += '<li>' + t("ai.ccCodexStep4") + '</li>';
    h += '</ol>';
    h += '<p class="at-muted">💡 ' + t("ai.ccCodexTip") + '</p>';

    h += '</div>';
    return h;
  }

  // ═══ Tab 2: 常用下载 ═══
  // Each: [tool name, description (zh), official url, mirror/note (zh), description (en), mirror/note (en)]

  var DOWNLOADS = [
    ["Claude Code",   "Anthropic 官方 CLI 编程助手",    "https://docs.anthropic.com/en/docs/claude-code/overview", "npm i -g @anthropic-ai/claude-code", "Anthropic official CLI coding assistant", "npm i -g @anthropic-ai/claude-code"],
    ["CC Switch",     "Claude Code 国内镜像切换工具",    "https://ccswitch.io",                                     "https://ccswitch.io",                "Claude Code mirror switcher for China",          "https://ccswitch.io"],
    ["Codex",         "OpenAI 终端编程助手",             "https://github.com/openai/codex",                         "npm i -g @openai/codex",             "OpenAI terminal coding assistant",              "npm i -g @openai/codex"],
    ["Cursor",        "AI-first 代码编辑器",             "https://cursor.com",                                      "https://cursor.com/downloads",       "AI-first code editor",                          "https://cursor.com/downloads"],
    ["Windsurf",      "Codeium 推出的 AI IDE",           "https://codeium.com/windsurf",                            "https://codeium.com/windsurf/download", "Codeium AI-powered IDE",                     "https://codeium.com/windsurf/download"],
    ["GitHub Copilot","VS Code / JetBrains AI 补全插件", "https://github.com/features/copilot",                     "VS Code 扩展商店搜索 Copilot",        "VS Code / JetBrains AI completion extension",    "Search Copilot in VS Code marketplace"],
    ["aider",         "终端 AI 结对编程工具",            "https://aider.chat",                                      "pip install aider-chat",              "Terminal AI pair programming tool",             "pip install aider-chat"],
    ["Cline",         "VS Code AI 编程助手插件",         "https://github.com/cline/cline",                          "VS Code 扩展商店搜索 Cline",          "VS Code AI coding assistant extension",          "Search Cline in VS Code marketplace"],
    ["Continue",      "开源 VS Code / JetBrains AI 插件","https://continue.dev",                                     "VS Code 扩展商店搜索 Continue",       "Open-source VS Code / JetBrains AI extension",   "Search Continue in VS Code marketplace"],
  ];

  // ═══ Claude Code commands ═══
  // Each: [command/flag, description (zh), example, description (en), note]

  var CLAUDE_CMDS = [
    // ── 核心高频（放首位）──
    ["claude",                "启动交互会话", "claude", "Start interactive session", "在项目根目录运行，自动读取 CLAUDE.md 获取上下文"],
    ["--dangerously-skip-permissions", "跳过所有权限提示", "claude --dangerously-skip-permissions", "Skip ALL permission prompts", "⚠️ 跳过所有确认弹窗，脚本/CI 必需；仅在信任项目使用"],
    ["--dangerously-skip-permissions -r", "跳过权限 + 恢复会话", "claude --dangerously-skip-permissions -r", "Skip perms AND resume last session", "⚠️ 高频组合：免确认继续上次未完成的工作"],
    // ── 基础命令 ──
    ["claude -p \"...\"",     "一次性提问", "claude -p '解释 src/auth.py 的登录流程'", "One-shot prompt (non-interactive)", "--output-format json 可输出结构化结果，适合脚本/CI 调用"],
    ["claude --model <name>", "指定模型", "claude --model opus -p 'review this'", "Switch model", "opus=最强推理, sonnet=均衡, haiku=快速廉价"],
    ["claude --resume",       "恢复上次会话", "claude --resume", "Resume last session", "会话自动保存，适用于中断后继续"],
    ["claude commit",         "自动生成提交", "claude commit", "Auto-generate commit message", "分析 git diff → conventional commit；--no-commit 仅预览不提交"],
    // ── 配置与诊断 ──
    ["claude --mcp",          "管理 MCP 服务器", "claude --mcp add my-server --command 'node server.js'", "Manage MCP servers", "支持 stdio / sse / http 传输；list/remove 子命令查看和删除"],
    ["claude config",         "查看/编辑配置", "claude config set theme dark", "View or update settings", "配置文件 ~/.claude/settings.json；可设 keybindings / hooks"],
    ["claude doctor",         "环境诊断", "claude doctor", "Diagnose environment", "检查 Node、git、网络、API 认证等环境状态"],
    ["claude update",         "更新到最新版", "claude update", "Update CLI", "自动检测和安装最新版本"],
    // ── 其他常用标志 ──
    ["--verbose / --debug",   "详细/调试输出", "claude --debug -p 'what is going on'", "Verbose debug logging", "排查问题时开启，输出完整 API 交互日志"],
    ["--output-format json",  "JSON 结构化输出", "claude -p 'list files' --output-format json", "Structured JSON output", "默认 text；json 适合程序解析"],
    ["--allowedTools",        "限制可用工具", "claude --allowedTools 'Bash,Read'", "Restrict tool access", "安全场景：只允许只读工具"],
  ];

  var CODEX_CMDS = [
    ["codex",                 "启动交互会话", "codex", "Start Codex session", "OpenAI 的终端编程助手；需 OPENAI_API_KEY 环境变量"],
    ["codex exec \"...\"",    "执行指定任务", "codex exec 'add rate limiting to the API'", "Execute a task", "自动规划并执行多步骤，直接修改代码"],
    // ── 权限与安全 ──
    ["--dangerously-bypass-approvals-and-sandbox", "跳过所有审批 + 沙箱（= --yolo）", "codex --yolo exec 'deploy to prod'", "Skip ALL approvals AND sandbox", "⚠️ 等价 claude --dangerously-skip-permissions；CI/脚本用，极其危险"],
    ["--dangerously-bypass-hook-trust", "跳过 hook 信任确认", "codex --dangerously-bypass-hook-trust exec 'run hooks'", "Skip hook trust prompts", "自动化场景：已审查过 hook 来源时跳过确认"],
    // ── 沙箱与模式 ──
    ["--sandbox / -s",        "沙箱策略", "codex --sandbox workspace exec '...'", "Sandbox policy selection", "workspace=限制工作区；danger-full-access=无限制"],
    ["--approve",             "自动审批操作", "codex --approve exec 'run tests'", "Auto-approve actions", "信任场景下跳过审批提示"],
    // ── 模型与配置 ──
    ["--model / -m <name>",   "指定模型", "codex -m gpt-5 exec 'design API'", "Switch model", "默认 gpt-5；也支持 o4-mini 等"],
    ["--profile / -p <name>", "配置档案", "codex -p production exec '...'", "Config profile", "$CODEX_HOME/<name>.config.toml 叠加配置"],
    ["--oss",                 "开源本地模型", "codex --oss --local-provider ollama", "Use open-source provider", "支持 ollama / lmstudio；无需 API key"],
    // ── 会话管理 ──
    ["codex resume",          "恢复上次会话", "codex resume --last", "Resume previous session", "等价 claude --resume；--last 恢复最近一次"],
    ["codex resume <id>",     "恢复指定会话", "codex resume abc123 '继续写测试'", "Resume session by ID", "从 codex ps 获取 session ID 后恢复"],
    // ── 代码辅助 ──
    ["codex review <file>",   "代码审查", "codex review src/auth.py", "Review code for bugs and style", "类似 PR review，逐行给优化建议"],
    ["codex test <file>",     "自动生成测试", "codex test src/auth.py", "Auto-generate test cases", "分析代码逻辑后生成测试文件"],
    ["codex plan",            "任务规划（仅设计）", "codex plan 'build a REST API'", "Plan mode—no code changes", "先出设计方案，用户确认后 exec 再实现"],
  ];

  var CLI_TABS = [
    { id: "claude",  i18n: "ai.claudeCode", data: CLAUDE_CMDS, cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
    { id: "codex",   i18n: "ai.codex",      data: CODEX_CMDS,  cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
  ];

  // ═══ Build ═══

  function buildDownloadSection() {
    var h = '';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr>';
    h += '<th>' + t("ai.dlTool") + '</th>';
    h += '<th>' + t("ai.dlDesc") + '</th>';
    h += '<th>' + t("ai.dlOfficial") + '</th>';
    h += '<th>' + t("ai.dlMirror") + '</th>';
    h += '</tr></thead><tbody>';
    DOWNLOADS.forEach(function (r) {
      h += '<tr>';
      h += '<td><strong>' + escapeHtml(r[0]) + '</strong></td>';
      h += '<td>' + escapeHtml(r[1]) + '<br><span class="at-muted">' + escapeHtml(r[4]) + '</span></td>';
      h += '<td><a href="' + escapeHtml(r[2]) + '" target="_blank" rel="noopener">' + escapeHtml(r[2]) + '</a></td>';
      h += '<td class="at-mono">' + escapeHtml(r[3]) + '<br><span class="at-muted">' + escapeHtml(r[5]) + '</span></td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildCliSection(tab) {
    var h = '';
    h += '<div class="at-search-wrap"><input id="aisearch-' + tab.id + '" class="search-input" type="text" placeholder="' + t("ai.searchPlaceholder") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr>';
    tab.cols.forEach(function (c) { h += '<th>' + t(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    tab.data.forEach(function (r) {
      var searchData = r.join(" ").toLowerCase();
      h += '<tr data-search="' + searchData + '">';
      h += '<td><code>' + r[0] + '</code></td>';
      h += '<td>' + r[1] + '<br><span class="at-muted">' + r[3] + '</span></td>';
      h += '<td><code>' + escapeHtml(r[2]) + '</code></td>';
      h += '<td class="at-muted">' + r[4] + '</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Init ═══

  function init(parent) {
    var h = '<div class="b64-tool">';
    h += '<div class="b64-tabs">';
    // CC Switch 指南 tab first
    h += '<button class="b64-tab active" data-aitab="ccswitch">' + t("ai.ccSwitch") + '</button>';
    // 常用下载 tab second
    h += '<button class="b64-tab" data-aitab="downloads">' + t("ai.downloads") + '</button>';
    CLI_TABS.forEach(function (tab) {
      h += '<button class="b64-tab" data-aitab="' + tab.id + '">' + t(tab.i18n) + '</button>';
    });
    h += '</div>';
    // CC Switch section (shown by default)
    h += '<div id="aitab-ccswitch" class="android-section">' + buildCcSwitchSection() + '</div>';
    // download section (hidden by default)
    h += '<div id="aitab-downloads" class="android-section hidden">' + buildDownloadSection() + '</div>';
    // cli sections (hidden by default)
    CLI_TABS.forEach(function (tab) {
      h += '<div id="aitab-' + tab.id + '" class="android-section hidden">' + buildCliSection(tab) + '</div>';
    });
    h += '</div>';

    parent.innerHTML = h;

    // tab switch
    document.querySelectorAll(".b64-tab[data-aitab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchAiTab(this.dataset.aitab); });
    });

    // search binding per CLI tab
    CLI_TABS.forEach(function (tab) {
      var input = document.getElementById("aisearch-" + tab.id);
      if (!input) return;
      input.addEventListener("input", function () {
        var q = this.value.toLowerCase();
        document.querySelectorAll("#aitab-" + tab.id + " tbody tr").forEach(function (tr) {
          tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
        });
      });
    });
  }

  function switchAiTab(name) {
    document.querySelectorAll(".b64-tab[data-aitab]").forEach(function (b) {
      b.className = "b64-tab" + (b.dataset.aitab === name ? " active" : "");
    });
    document.querySelectorAll("[id^='aitab-']").forEach(function (s) {
      s.classList.toggle("hidden", s.id !== "aitab-" + name);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  return { init: init };
})();
