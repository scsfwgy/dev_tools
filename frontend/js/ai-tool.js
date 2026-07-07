// AI Tool — CLI commands reference for AI coding assistants (Claude Code, Codex, Copilot CLI, etc.)
var AiTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  // ═══ Per-tool command data ═══
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

  var COPILOT_CMDS = [
    ["gh copilot suggest \"...\"",  "AI 命令建议", "gh copilot suggest 'find large files over 1GB'", "Get AI shell command suggestion", "需安装 GitHub CLI + gh auth login 认证"],
    ["gh copilot explain \"...\"",  "解释命令含义", "gh copilot explain 'tar -czvf archive.tar.gz dir/'", "Explain a shell command", "对陌生/复杂命令快速理解每个参数"],
    ["gh copilot alias",            "命令别名建议", "gh copilot alias 'git reset --soft HEAD~1'", "Suggest shorter alias", "为长命令生成可记的短别名"],
    ["gh copilot debug",            "调试命令错误", "gh copilot debug 'permission denied'", "Debug command errors", "粘贴报错信息，Copilot 分析原因并给出修复建议"],
  ];

  var CURSOR_CMDS = [
    ["cursor <path>",         "用 Cursor 打开项目", "cursor .", "Open project in Cursor IDE", "等价于 VS Code 的 code . 命令"],
    ["cursor --wait <file>",  "等待关闭后继续", "cursor --wait README.md", "Wait for file close then exit", "适合做 git editor：git config --global core.editor 'cursor --wait'"],
    ["cursor --install-extension <id>", "安装扩展", "cursor --install-extension ms-python.python", "Install VS Code extension", "Cursor 兼容所有 VS Code 扩展"],
    ["cursor --disable-extensions", "无扩展启动", "cursor --disable-extensions .", "Start without extensions", "排查扩展冲突问题时使用"],
  ];

  var AIDER_CMDS = [
    ["aider",                 "启动会话", "aider --model claude-sonnet-5", "Start AI coding session with LLM", "支持 Claude/GPT/DeepSeek 等多种模型"],
    ["aider --architect",     "架构师模式", "aider --architect --model opus", "Architect + Editor dual model", "Opus 设计架构 → Sonnet 写代码，分工协作"],
    ["aider --edit-format diff", "生成标准 patch", "aider --edit-format diff", "Use unified diff format for edits", "更可控的编辑方式，适合 code review 流程"],
    ["aider --map-tokens <n>","控制上下文大小", "aider --map-tokens 8000", "Limit repo map token size", "大项目调小此值避免超 token 限制"],
    ["aider --watch",         "文件变更自动触发", "aider --watch", "Auto-act on file changes", "配合 lint/test watch 模式，文件变更即触发 AI 优化"],
    ["aider --voice",         "语音输入模式", "aider --voice", "Voice input mode", "说话代替打字，需要系统麦克风权限"],
    ["/add <file>",           "添加文件到上下文", "/add src/models.py", "Add file to chat context", "把非 git-tracked 文件加入 AI 上下文"],
    ["/clear",                "清空对话历史", "/clear", "Clear chat history", "释放 token 预算，适合话题切换"],
    ["/run <cmd>",            "执行命令并反馈", "/run pytest", "Run shell command, feed output to AI", "测试失败 → AI 看到输出 → 自动修复"],
  ];

  var WINDSURF_CMDS = [
    ["windsurf",              "启动 Windsurf IDE", "windsurf .", "Launch Windsurf IDE", "基于 VS Code 的 AI IDE，内置 Cascade AI"],
    ["Cascade (Cmd+L)",       "AI 对话面板", "Cmd+L 输入 'optimize this function'", "Open AI chat panel", "选中代码后提问，AI 理解上下文"],
    ["Cascade (Cmd+I)",       "行内代码生成", "Cmd+I 写注释 → AI 生成实现", "Inline code generation", "写需求注释，AI 直接替换为代码实现"],
    ["Cascade /fix",          "自动修复错误", "Cascade /fix → 自动修 lint/type 错误", "Auto-fix diagnostics", "一键修复当前文件所有诊断问题"],
  ];

  var TABS = [
    { id: "claude",  i18n: "ai.claudeCode",    data: CLAUDE_CMDS,   cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
    { id: "codex",   i18n: "ai.codex",         data: CODEX_CMDS,    cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
    { id: "copilot", i18n: "ai.copilotCli",    data: COPILOT_CMDS,  cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
    { id: "cursor",  i18n: "ai.cursor",        data: CURSOR_CMDS,   cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
    { id: "aider",   i18n: "ai.aider",         data: AIDER_CMDS,    cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
    { id: "windsurf",i18n: "ai.windsurf",      data: WINDSURF_CMDS, cols: ["ai.cmd", "ai.desc", "ai.example", "ai.note"] },
  ];

  // ═══ Build ═══

  function buildSection(tab) {
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
    TABS.forEach(function (tab, i) {
      h += '<button class="b64-tab' + (i === 0 ? ' active' : '') + '" data-aitab="' + tab.id + '">' + t(tab.i18n) + '</button>';
    });
    h += '</div>';
    TABS.forEach(function (tab, i) {
      h += '<div id="aitab-' + tab.id + '" class="android-section' + (i === 0 ? '' : ' hidden') + '">' + buildSection(tab) + '</div>';
    });
    h += '</div>';

    parent.innerHTML = h;

    // tab switch
    document.querySelectorAll(".b64-tab[data-aitab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchAiTab(this.dataset.aitab); });
    });

    // search binding per tab
    TABS.forEach(function (tab) {
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
    document.querySelectorAll("#aitab-" + name + ", .android-section[id^='aitab-']").forEach(function (s) {
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
