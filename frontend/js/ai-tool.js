// AI Tool — Claude Code + Codex CLI reference
var AiTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  // ═══ Claude Code commands ═══
  // Each: [command/flag, description (zh), example, description (en), note]

  var CLAUDE_CMDS = [
    // ── 官网 ──
    ["🌐 官网", "Anthropic 官方文档", "https://docs.anthropic.com/en/docs/claude-code/overview", "Claude Code 官方使用指南", "Anthropic official docs", "Claude Code official user guide"],
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

    // ── 交互会话斜杠命令 ──
    ["/clear",                "清空会话历史", "/clear", "Clear conversation history", "重置上下文窗口，释放 token，话题切换时使用"],
    ["/compact",              "压缩/摘要会话", "/compact", "Compact / summarize conversation", "自动摘要历史消息，保留关键上下文，大幅降低 token 消耗"],
    ["/rename",               "重命名会话", "/rename 'fix login bug'", "Rename current conversation", "给会话起个有意义的名字，方便后续 resume 时查找"],
    ["/model",                "切换模型", "/model opus", "Switch model mid-session", "opus / sonnet / haiku，无需重启会话"],
    ["/cost",                 "查看用量与费用", "/cost", "Show token usage and cost", "显示当前会话的 token 消耗和预估费用"],
    ["/init",                 "初始化项目 CLAUDE.md", "/init", "Generate CLAUDE.md for project", "分析项目结构后生成项目配置文件"],
    ["/add-dir",              "添加目录到工作区", "/add-dir ~/other-project", "Add directory to workspace", "将外部目录加入当前工作区，跨项目协作"],
    ["/memory",               "管理记忆", "/memory", "Open memory manager", "查看和编辑持久化记忆条目"],
    ["/export",               "导出会话", "/export", "Export conversation to file", "导出完整会话记录，支持多种格式"],
    ["/review",               "代码审查 PR", "/review", "Review a GitHub pull request", "在 PR 页面触发完整代码审查流程"],
    ["/upgrade",              "升级 Claude Code", "/upgrade", "Upgrade Claude Code CLI", "检测并安装最新版本"],
    ["/workflows",            "管理工作流", "/workflows", "Manage workflows & agents", "查看运行中的后台代理和工作流"],
    ["/statusline",           "配置状态栏", "/statusline", "Configure status line", "自定义终端状态栏显示内容和样式"],
    ["/todos",                "任务列表", "/todos", "Manage task list", "查看和管理当前会话的任务清单"],
    ["/config",               "配置设置", "/config", "Configure theme, model, etc.", "交互式修改主题、默认模型、权限等配置"],
    ["/doctor",               "环境诊断", "/doctor", "Diagnose environment", "检查 Node、git、网络、API 认证等状态"],
    ["/pr-comments",          "PR 评论", "/pr-comments", "Send review as PR comments", "将代码审查结果以行级评论发到 GitHub PR"],
    ["/terminal-setup",       "终端设置", "/terminal-setup", "Configure terminal integration", "设置终端快捷键、自动补全等"],
  ];

  var CODEX_CMDS = [
    // ── 官网 ──
    ["🌐 官网", "OpenAI Codex 官方", "https://chatgpt.com/zh-Hans-CN/codex/", "Codex 产品主页", "OpenAI Codex official", "Codex product page"],
    ["📦 GitHub", "Codex 开源仓库", "https://github.com/openai/codex", "Issues / Releases / Discussions", "Codex open-source repo", "Issues / Releases / Discussions"],
    // ── CLI 命令 ──
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

    // ── 交互会话斜杠命令 ──
    ["/model",                "切换模型", "/model", "Switch model mid-session", "列出可用模型并切换，无需重启会话"],
    ["/init",                 "初始化项目 AGENTS.md", "/init", "Generate AGENTS.md for project", "分析项目结构生成配置，等价 Claude Code /init"],
    ["/compact",              "压缩上下文", "/compact", "Compact conversation context", "自动摘要历史消息，降低 token 消耗"],
    ["/clear",                "清空上下文", "/clear", "Clear conversation context", "重置上下文窗口，话题切换时使用"],
    ["/rename",               "重命名会话", "/rename 'API refactor'", "Rename current session", "给会话起名，方便后续 resume 查找"],
    ["/new",                  "新建会话", "/new", "Start a new session", "保留当前会话，另开一个新的"],
    ["/resume",               "恢复会话", "/resume", "Resume a previous session", "显示历史会话列表供选择恢复"],
    ["/review",               "代码审查", "/review", "Review code changes", "审查当前 diff，给出行级优化建议"],
    ["/diff",                 "查看变更", "/diff", "Show current diff", "显示本次会话所有文件变更摘要"],
    ["/usage",                "查看用量", "/usage", "Show token usage and cost", "显示当前会话 token 消耗和预估费用"],
    ["/status",               "会话状态", "/status", "Show session status", "查看当前会话模型、token 用量、运行时长"],
    ["/plan",                 "规划模式", "/plan 'build REST API'", "Enter plan-only mode", "先设计方案不写代码，确认后再执行"],
    ["/goal",                 "设定目标", "/goal 'refactor auth module'", "Set session goal", "为会话设定高层次目标，引导 agent 工作方向"],
    ["/agent",                "生成子代理", "/agent 'write tests'", "Spawn a sub-agent", "派生子代理处理独立任务，并行工作"],
    ["/stop",                 "停止代理", "/stop", "Stop running agent", "终止当前正在执行的代理任务"],
    ["/permissions",          "权限管理", "/permissions", "Manage tool permissions", "查看和修改工具权限（allow/deny/ask）"],
    ["/skills",               "管理技能", "/skills", "Manage skills", "查看已安装的技能列表，启用/禁用"],
    ["/memories",             "管理记忆", "/memories", "Manage memories", "查看和编辑 Codex 持久化记忆"],
    ["/mcp",                  "MCP 服务器", "/mcp", "Manage MCP servers", "添加、移除、查看 MCP 服务器配置"],
    ["/sandbox-add-read-dir", "添加沙箱读取目录", "/sandbox-add-read-dir ~/lib", "Add read dir to sandbox", "将外部目录加入沙箱只读路径"],
    ["/theme",                "切换主题", "/theme", "Change UI theme", "切换 TUI 配色方案"],
    ["/statusline",           "配置状态栏", "/statusline", "Configure status line", "自定义终端状态栏显示内容"],
    ["/quit",                 "退出会话", "/quit", "Quit Codex session", "等价 /exit，退出当前交互会话"],
  ];

  var CLI_TABS = [
    { id: "claude", i18n: "ai.claudeCode", data: CLAUDE_CMDS, cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
    { id: "codex",  i18n: "ai.codex",      data: CODEX_CMDS,  cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
  ];

  // ═══ Build ═══

  function buildCliSection(tab) {
    var h = '';
    h += '<div class="at-search-wrap"><input id="aisearch-' + tab.id + '" class="search-input" type="text" placeholder="' + t("ai.searchPlaceholder") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr>';
    tab.cols.forEach(function (c) { h += '<th>' + t(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    tab.data.forEach(function (r) {
      var searchData = r.join(" ").toLowerCase();
      var example = r[2];
      h += '<tr data-search="' + searchData + '">';
      h += '<td><code>' + r[0] + '</code></td>';
      h += '<td>' + r[1] + '<br><span class="at-muted">' + r[3] + '</span></td>';
      // example column: URL → clickable link, else → copy on click
      if (/^https?:\/\//.test(example)) {
        h += '<td><a href="' + escapeHtml(example) + '" target="_blank" rel="noopener" class="at-url">' + escapeHtml(example) + '</a></td>';
      } else {
        h += '<td data-copy="' + escapeHtml(example) + '"><code>' + escapeHtml(example) + '</code></td>';
      }
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
    CLI_TABS.forEach(function (tab, i) {
      h += '<button class="b64-tab' + (i === 0 ? ' active' : '') + '" data-aitab="' + tab.id + '">' + t(tab.i18n) + '</button>';
    });
    h += '</div>';
    CLI_TABS.forEach(function (tab, i) {
      h += '<div id="aitab-' + tab.id + '" class="android-section' + (i !== 0 ? ' hidden' : '') + '">' + buildCliSection(tab) + '</div>';
    });
    h += '</div>';

    parent.innerHTML = h;

    // tab switch
    document.querySelectorAll(".b64-tab[data-aitab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchAiTab(this.dataset.aitab); });
    });

    // click row to copy example (delegation, skip <a> clicks)
    parent.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var el = e.target.closest("[data-copy]");
      if (!el) return;
      navigator.clipboard.writeText(el.dataset.copy).then(function () {
        showCopyToast("✓ " + t("ai.copied"));
      });
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
