// AI Tool — verified Claude Code and Codex CLI reference.
var AiTool = (function () {
  var activeProduct = "claude";
  var activeCategories = { claude: "quick", codex: "quick" };

  function t(key) { return (window.__t && window.__t(key)) || key; }
  function currentLang() { return document.documentElement.lang.toLowerCase().indexOf("en") === 0 ? "en" : "zh"; }
  function text(item, field) { return item[field + (currentLang() === "en" ? "En" : "Zh")]; }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  var PRODUCTS = {
    claude: {
      labelKey: "ai.claudeCode",
      version: "Claude Code 2.1.128",
      verified: "2026-07-10",
      links: [
        ["CLI Reference", "https://code.claude.com/docs/en/cli-reference"],
        ["Commands", "https://code.claude.com/docs/en/commands"],
      ],
      categories: ["quick", "session", "automation", "safety", "extensions", "interactive"],
      commands: [
        { category:"quick", command:"claude", example:"claude", descZh:"启动交互会话", descEn:"Start an interactive session", noteZh:"在项目目录运行，读取项目上下文和 CLAUDE.md。", noteEn:"Run inside a project to load project context and CLAUDE.md." },
        { category:"quick", command:"claude \"<prompt>\"", example:"claude \"解释这个项目的认证流程\"", exampleEn:"claude \"Explain this project's authentication flow\"", descZh:"带初始任务启动交互会话", descEn:"Start interactively with an initial task", noteZh:"适合直接进入明确任务。", noteEn:"Useful when the first task is already known." },
        { category:"quick", command:"claude -p \"<prompt>\"", example:"claude -p \"列出未使用的依赖\"", exampleEn:"claude -p \"List unused dependencies\"", descZh:"非交互执行一次任务", descEn:"Run one non-interactive task", noteZh:"完成后退出，适合管道和自动化。", noteEn:"Exits after completion; useful in pipelines and automation." },
        { category:"quick", command:"claude --model <model>", example:"claude --model sonnet", descZh:"为当前会话选择模型", descEn:"Select a model for this session", noteZh:"使用官方模型别名或完整模型 ID，不在页面硬编码默认模型。", noteEn:"Use an official alias or full model ID; this page does not assume a default." },
        { category:"quick", command:"claude doctor", example:"claude doctor", descZh:"诊断安装与配置", descEn:"Diagnose installation and configuration", noteZh:"只读检查安装、PATH、认证和配置健康状况。", noteEn:"Read-only checks for installation, PATH, authentication, and configuration." },

        { category:"session", command:"claude -c", example:"claude -c", descZh:"继续当前目录最近会话", descEn:"Continue the latest session for this directory", noteZh:"等价 --continue。", noteEn:"Alias for --continue." },
        { category:"session", command:"claude -r [name|id]", example:"claude -r auth-refactor \"继续补测试\"", exampleEn:"claude -r auth-refactor \"Continue adding tests\"", descZh:"恢复指定会话或打开选择器", descEn:"Resume a named/session ID or open the picker", noteZh:"不带参数时打开会话选择器。", noteEn:"Without a value, opens the session picker." },
        { category:"session", command:"--name / -n", example:"claude -n feature-auth", descZh:"设置会话名称", descEn:"Name the session", noteZh:"名称会显示在恢复选择器和终端标题中。", noteEn:"The name appears in the resume picker and terminal title." },
        { category:"session", command:"--fork-session", example:"claude -r auth-refactor --fork-session", descZh:"恢复时创建新的会话分支", descEn:"Fork into a new session while resuming", noteZh:"保留原会话 ID，适合尝试另一条路线。", noteEn:"Preserves the original session while trying another direction." },
        { category:"session", command:"--worktree / -w", example:"claude -w feature-auth", descZh:"在隔离 Git worktree 中启动", descEn:"Start in an isolated Git worktree", noteZh:"适合并行功能开发，避免污染当前工作区。", noteEn:"Useful for parallel work without changing the current worktree." },

        { category:"automation", command:"--output-format", example:"claude -p \"检查项目\" --output-format json", exampleEn:"claude -p \"Inspect the project\" --output-format json", descZh:"选择 text、json 或 stream-json 输出", descEn:"Choose text, JSON, or streaming JSON output", noteZh:"仅用于 print 模式。", noteEn:"Available in print mode." },
        { category:"automation", command:"--json-schema", example:"claude -p --json-schema '{\"type\":\"object\"}' \"分析项目\"", exampleEn:"claude -p --json-schema '{\"type\":\"object\"}' \"Analyze the project\"", descZh:"约束最终结构化输出", descEn:"Validate the final structured output", noteZh:"适合脚本稳定消费结果。", noteEn:"Useful when scripts require a stable result shape." },
        { category:"automation", command:"--max-budget-usd", example:"claude -p --max-budget-usd 2 \"修复测试\"", exampleEn:"claude -p --max-budget-usd 2 \"Fix the tests\"", descZh:"限制非交互任务预算", descEn:"Set a budget limit for non-interactive work", noteZh:"达到限制后停止。", noteEn:"Stops when the limit is reached." },
        { category:"automation", command:"--max-turns", example:"claude -p --max-turns 3 \"分析失败原因\"", exampleEn:"claude -p --max-turns 3 \"Analyze the failure\"", descZh:"限制代理执行轮数", descEn:"Limit agentic turns", noteZh:"适合控制自动化任务边界。", noteEn:"Keeps automated tasks bounded." },
        { category:"automation", command:"--bare", example:"claude --bare -p \"总结 README\"", exampleEn:"claude --bare -p \"Summarize the README\"", descZh:"最小化启动模式", descEn:"Start in minimal mode", noteZh:"跳过多数自定义加载，适合快速脚本调用。", noteEn:"Skips most customizations for faster scripted startup." },

        { category:"safety", command:"--permission-mode", example:"claude --permission-mode plan", descZh:"选择权限模式", descEn:"Select a permission mode", noteZh:"可使用 plan、default、acceptEdits、auto 等模式。", noteEn:"Supports modes such as plan, default, acceptEdits, and auto." },
        { category:"safety", command:"--allowedTools", example:"claude --allowedTools \"Bash(git diff *)\" Read", descZh:"预先允许匹配的工具调用", descEn:"Pre-allow matching tool calls", noteZh:"使用权限规则语法精确限制范围。", noteEn:"Use permission-rule syntax to keep access narrow." },
        { category:"safety", command:"--disallowedTools", example:"claude --disallowedTools \"Bash(rm *)\" Edit", descZh:"拒绝指定工具或调用模式", descEn:"Deny tools or matching calls", noteZh:"适合只读审查任务。", noteEn:"Useful for read-only review tasks." },
        { category:"safety", command:"--safe-mode", example:"claude --safe-mode", descZh:"禁用自定义项进行故障排查", descEn:"Disable customizations for troubleshooting", noteZh:"保留认证、模型和内置工具，禁用技能、插件、MCP 等自定义。", noteEn:"Keeps auth and built-ins while disabling skills, plugins, MCP, and other customizations." },
        { category:"safety", command:"claude --dangerously-skip-permissions -r", example:"claude --dangerously-skip-permissions -r", descZh:"跳过权限提示并打开会话恢复选择器", descEn:"Skip permission prompts and open the session picker", noteZh:"-r 不带名称或 ID 时打开选择器；仅限外部已隔离且完全信任的环境。", noteEn:"Without a name or ID, -r opens the picker; use only in an externally isolated, fully trusted environment.", dangerous:true },
        { category:"safety", command:"--dangerously-skip-permissions", example:"claude --dangerously-skip-permissions", descZh:"跳过权限提示", descEn:"Skip permission prompts", noteZh:"仅应在外部已隔离且完全信任的环境使用。", noteEn:"Use only inside an externally isolated, fully trusted environment.", dangerous:true },

        { category:"extensions", command:"claude mcp list", example:"claude mcp list", descZh:"列出 MCP 服务器", descEn:"List configured MCP servers", noteZh:"使用 claude mcp add/get/remove 管理。", noteEn:"Manage servers with claude mcp add/get/remove." },
        { category:"extensions", command:"claude mcp add", example:"claude mcp add my-server -- npx my-mcp-server", descZh:"添加 MCP 服务器", descEn:"Add an MCP server", noteZh:"支持 stdio 和 HTTP 等传输。", noteEn:"Supports transports including stdio and HTTP." },
        { category:"extensions", command:"claude plugin list", example:"claude plugin list", descZh:"列出已安装插件", descEn:"List installed plugins", noteZh:"还支持 install、enable、disable、update、remove。", noteEn:"Also supports install, enable, disable, update, and remove." },
        { category:"extensions", command:"--plugin-dir", example:"claude --plugin-dir ./my-plugin", descZh:"为当前会话加载本地插件", descEn:"Load a local plugin for this session", noteZh:"可重复传入多个目录或 zip。", noteEn:"Repeat for multiple directories or zip archives." },
        { category:"extensions", command:"--add-dir", example:"claude --add-dir ../shared-lib", descZh:"增加可访问目录", descEn:"Add another accessible directory", noteZh:"仅授予目录访问，不等于加载该目录全部配置。", noteEn:"Grants directory access without loading every configuration from it." },

        { category:"interactive", command:"/compact [instructions]", example:"/compact 保留认证和测试上下文", exampleEn:"/compact preserve auth and test context", descZh:"压缩当前会话上下文", descEn:"Compact the current conversation", noteZh:"继续同一会话并释放上下文空间。", noteEn:"Keeps the same session while freeing context space." },
        { category:"interactive", command:"/clear [name]", example:"/clear auth-before-refactor", descZh:"开始空上下文的新对话", descEn:"Start a new conversation with empty context", noteZh:"上一会话仍可通过 /resume 恢复。", noteEn:"The previous conversation remains available through /resume." },
        { category:"interactive", command:"/model [model]", example:"/model sonnet", descZh:"切换模型", descEn:"Switch model", noteZh:"无参数时打开选择器。", noteEn:"Without a value, opens the model picker." },
        { category:"interactive", command:"/permissions", example:"/permissions", descZh:"管理允许、询问和拒绝规则", descEn:"Manage allow, ask, and deny rules", noteZh:"交互查看不同作用域的权限。", noteEn:"Interactively manages permission rules by scope." },
        { category:"interactive", command:"/diff", example:"/diff", descZh:"查看当前及逐轮代码差异", descEn:"Open the interactive diff viewer", noteZh:"用于检查未提交变更和每轮编辑。", noteEn:"Inspect uncommitted changes and per-turn edits." },
        { category:"interactive", command:"/init", example:"/init", descZh:"生成项目 CLAUDE.md", descEn:"Initialize a project CLAUDE.md", noteZh:"分析项目并创建持久化项目指引。", noteEn:"Analyzes the project and creates durable project guidance." },
        { category:"interactive", command:"/mcp", example:"/mcp", descZh:"管理 MCP 连接和认证", descEn:"Manage MCP connections and authentication", noteZh:"可查看、启用、禁用和重连服务器。", noteEn:"View, enable, disable, and reconnect servers." },
        { category:"interactive", command:"/plugin", example:"/plugin list", descZh:"管理插件", descEn:"Manage plugins", noteZh:"无参数时打开插件菜单。", noteEn:"Without a subcommand, opens the plugin menu." },
        { category:"interactive", command:"/doctor", example:"/doctor", descZh:"运行安装与配置检查", descEn:"Run installation and configuration diagnostics", noteZh:"先报告问题，再在修改前请求确认。", noteEn:"Reports findings first and asks before making changes." },
      ],
    },
    codex: {
      labelKey: "ai.codex",
      version: "codex-cli 0.144.0-alpha.4",
      verified: "2026-07-10",
      links: [
        ["CLI Repository", "https://github.com/openai/codex"],
        ["Codex Docs", "https://developers.openai.com/codex/cli"],
      ],
      categories: ["quick", "session", "automation", "safety", "extensions", "review"],
      commands: [
        { category:"quick", command:"codex [prompt]", example:"codex \"解释这个项目的认证流程\"", exampleEn:"codex \"Explain this project's authentication flow\"", descZh:"启动交互会话", descEn:"Start an interactive session", noteZh:"无提示词时直接进入交互界面。", noteEn:"Omit the prompt to open the interactive interface directly." },
        { category:"quick", command:"codex exec [prompt]", example:"codex exec \"修复失败的测试\"", exampleEn:"codex exec \"Fix the failing tests\"", descZh:"非交互执行任务", descEn:"Run a task non-interactively", noteZh:"适合脚本、CI 和明确的一次性任务。", noteEn:"Useful for scripts, CI, and bounded one-shot tasks." },
        { category:"quick", command:"codex -C <dir>", example:"codex -C ../service \"检查 API\"", exampleEn:"codex -C ../service \"Inspect the API\"", descZh:"指定工作目录", descEn:"Set the working directory", noteZh:"无需先 cd。", noteEn:"Avoids changing directories before launch." },
        { category:"quick", command:"codex -m <model>", example:"codex -m <model> \"审查当前改动\"", exampleEn:"codex -m <model> \"Review current changes\"", descZh:"为当前会话选择模型", descEn:"Select a model for this session", noteZh:"模型可用性取决于当前账户和配置。", noteEn:"Model availability depends on account and configuration." },
        { category:"quick", command:"codex doctor", example:"codex doctor", descZh:"诊断安装、配置和认证", descEn:"Diagnose installation, config, and auth", noteZh:"优先用于排查本地运行问题。", noteEn:"Use first when troubleshooting a local installation." },

        { category:"session", command:"codex resume", example:"codex resume", descZh:"打开会话恢复选择器", descEn:"Open the session resume picker", noteZh:"默认按当前目录筛选会话。", noteEn:"Sessions are filtered by the current directory by default." },
        { category:"session", command:"codex resume --last", example:"codex resume --last \"继续补测试\"", exampleEn:"codex resume --last \"Continue adding tests\"", descZh:"恢复最近会话", descEn:"Resume the most recent session", noteZh:"不显示选择器。", noteEn:"Skips the picker." },
        { category:"session", command:"codex resume <id|name>", example:"codex resume auth-refactor", descZh:"恢复指定 ID 或名称的会话", descEn:"Resume a session by ID or name", noteZh:"UUID 优先按会话 ID 解析。", noteEn:"UUID values are resolved as session IDs first." },
        { category:"session", command:"codex fork --last", example:"codex fork --last", descZh:"从最近会话派生新会话", descEn:"Fork the most recent session", noteZh:"适合保留原路线并尝试另一种实现。", noteEn:"Preserves the original path while trying another implementation." },
        { category:"session", command:"codex archive <id|name>", example:"codex archive auth-refactor", descZh:"归档已保存会话", descEn:"Archive a saved session", noteZh:"还提供 unarchive 和 delete。", noteEn:"Related commands include unarchive and delete." },

        { category:"automation", command:"codex exec --json", example:"codex exec --json \"检查依赖\"", descZh:"以 JSONL 输出事件", descEn:"Emit events as JSONL", noteZh:"适合程序逐事件消费。", noteEn:"Useful for programmatic event processing." },
        { category:"automation", command:"--output-schema <file>", example:"codex exec --output-schema result.schema.json \"分析项目\"", descZh:"指定最终输出 JSON Schema", descEn:"Set a JSON Schema for the final response", noteZh:"用于稳定结构化结果。", noteEn:"Provides a stable structured result." },
        { category:"automation", command:"-o, --output-last-message", example:"codex exec -o result.txt \"总结改动\"", descZh:"把最终消息写入文件", descEn:"Write the final message to a file", noteZh:"标准输出仍可用于事件或日志。", noteEn:"Standard output remains available for events or logs." },
        { category:"automation", command:"--ephemeral", example:"codex exec --ephemeral \"检查 README\"", descZh:"不持久化会话文件", descEn:"Run without persisting session files", noteZh:"适合临时自动化任务。", noteEn:"Useful for disposable automated tasks." },
        { category:"automation", command:"--skip-git-repo-check", example:"codex exec --skip-git-repo-check \"分析这个目录\"", descZh:"允许在非 Git 目录执行", descEn:"Allow execution outside a Git repository", noteZh:"仅在明确不需要 Git 上下文时使用。", noteEn:"Use only when Git context is intentionally unnecessary." },

        { category:"safety", command:"-s, --sandbox", example:"codex -s read-only \"审查代码\"", descZh:"选择命令沙箱策略", descEn:"Select the command sandbox policy", noteZh:"支持 read-only、workspace-write、danger-full-access。", noteEn:"Supports read-only, workspace-write, and danger-full-access." },
        { category:"safety", command:"-a, --ask-for-approval", example:"codex -a on-request \"修复测试\"", descZh:"选择审批策略", descEn:"Select the approval policy", noteZh:"支持 untrusted、on-request、never。", noteEn:"Supports untrusted, on-request, and never." },
        { category:"safety", command:"--add-dir", example:"codex --add-dir ../shared-lib", descZh:"增加可写目录", descEn:"Add another writable directory", noteZh:"与主工作区一起纳入沙箱范围。", noteEn:"Adds another directory to the sandbox alongside the workspace." },
        { category:"safety", command:"--strict-config", example:"codex --strict-config", descZh:"遇到未知配置项时直接报错", descEn:"Fail on unrecognized configuration", noteZh:"适合 CI 检测过期或拼错配置。", noteEn:"Useful in CI to catch stale or misspelled config." },
        { category:"safety", command:"--dangerously-bypass-approvals-and-sandbox", example:"codex --dangerously-bypass-approvals-and-sandbox", descZh:"跳过审批并关闭沙箱", descEn:"Skip approvals and disable sandboxing", noteZh:"仅应在外部已隔离的环境使用。", noteEn:"Use only in an externally isolated environment.", dangerous:true },

        { category:"extensions", command:"codex mcp list", example:"codex mcp list", descZh:"列出 MCP 服务器", descEn:"List configured MCP servers", noteZh:"还支持 get、add、remove、login、logout。", noteEn:"Also supports get, add, remove, login, and logout." },
        { category:"extensions", command:"codex plugin list", example:"codex plugin list", descZh:"列出插件市场中的插件", descEn:"List plugins from configured marketplaces", noteZh:"还支持 add、remove 和 marketplace 管理。", noteEn:"Also supports add, remove, and marketplace management." },
        { category:"extensions", command:"codex completion <shell>", example:"codex completion zsh", descZh:"生成 Shell 自动补全", descEn:"Generate shell completion", noteZh:"输出可写入对应 Shell 的补全目录。", noteEn:"Write the output into the completion location for your shell." },
        { category:"extensions", command:"codex app", example:"codex app", descZh:"启动 Codex 桌面应用", descEn:"Launch the Codex desktop app", noteZh:"缺少应用时会打开安装流程。", noteEn:"Opens the installer when the app is unavailable." },
        { category:"extensions", command:"codex update", example:"codex update", descZh:"更新 Codex CLI", descEn:"Update Codex CLI", noteZh:"安装当前渠道的最新版本。", noteEn:"Installs the latest version from the current channel." },

        { category:"review", command:"codex review --uncommitted", example:"codex review --uncommitted", descZh:"审查暂存、未暂存和未跟踪改动", descEn:"Review staged, unstaged, and untracked changes", noteZh:"用于提交前审查当前工作区。", noteEn:"Useful for a pre-commit review of the working tree." },
        { category:"review", command:"codex review --base <branch>", example:"codex review --base main", descZh:"审查相对基准分支的改动", descEn:"Review changes against a base branch", noteZh:"适合 PR 或功能分支检查。", noteEn:"Useful for pull requests and feature branches." },
        { category:"review", command:"codex review --commit <sha>", example:"codex review --commit HEAD", descZh:"审查指定提交引入的改动", descEn:"Review changes introduced by a commit", noteZh:"可追加自定义审查提示词。", noteEn:"A custom review prompt can also be supplied." },
        { category:"review", command:"codex exec review", example:"codex exec review --uncommitted", descZh:"在非交互执行流程中运行代码审查", descEn:"Run review through the non-interactive exec flow", noteZh:"适合脚本和 CI。", noteEn:"Useful for scripts and CI." },
        { category:"review", command:"codex apply", example:"codex apply", descZh:"应用代理最近生成的补丁", descEn:"Apply the latest agent-produced diff", noteZh:"以 git apply 方式写入当前工作树。", noteEn:"Applies the latest diff to the current working tree using git apply." },
      ],
    },
  };

  var COMPARISON = [
    { key:"start", claudeZh:"claude", claudeEn:"claude", codexZh:"codex [prompt]", codexEn:"codex [prompt]" },
    { key:"oneShot", claudeZh:"claude -p \"<prompt>\"", claudeEn:"claude -p \"<prompt>\"", codexZh:"codex exec \"<prompt>\"", codexEn:"codex exec \"<prompt>\"" },
    { key:"resume", claudeZh:"claude -c / claude -r", claudeEn:"claude -c / claude -r", codexZh:"codex resume / codex resume --last", codexEn:"codex resume / codex resume --last" },
    { key:"model", claudeZh:"claude --model <model>", claudeEn:"claude --model <model>", codexZh:"codex -m <model>", codexEn:"codex -m <model>" },
    { key:"workdir", claudeZh:"claude --add-dir <dir>", claudeEn:"claude --add-dir <dir>", codexZh:"codex -C <dir> / --add-dir <dir>", codexEn:"codex -C <dir> / --add-dir <dir>" },
    { key:"plan", claudeZh:"claude --permission-mode plan", claudeEn:"claude --permission-mode plan", codexZh:"在提示词中要求先规划，或使用支持的交互模式", codexEn:"Ask for a plan in the prompt, or use a supported interactive mode" },
    { key:"approval", claudeZh:"claude --permission-mode <mode>", claudeEn:"claude --permission-mode <mode>", codexZh:"codex -a <policy>", codexEn:"codex -a <policy>" },
    { key:"sandbox", claudeZh:"通过权限模式和工具规则控制", claudeEn:"Controlled through permission modes and tool rules", codexZh:"codex -s <sandbox>", codexEn:"codex -s <sandbox>" },
    { key:"structured", claudeZh:"--output-format json / --json-schema", claudeEn:"--output-format json / --json-schema", codexZh:"codex exec --json / --output-schema", codexEn:"codex exec --json / --output-schema" },
    { key:"review", claudeZh:"/code-review 或直接要求审查", claudeEn:"/code-review or ask for a review directly", codexZh:"codex review --uncommitted|--base|--commit", codexEn:"codex review --uncommitted|--base|--commit" },
    { key:"mcp", claudeZh:"claude mcp ... / /mcp", claudeEn:"claude mcp ... / /mcp", codexZh:"codex mcp ...", codexEn:"codex mcp ..." },
    { key:"plugins", claudeZh:"claude plugin ... / /plugin", claudeEn:"claude plugin ... / /plugin", codexZh:"codex plugin ...", codexEn:"codex plugin ..." },
  ];

  function buildLinks(product) {
    var html = '<div class="at-doc-refs"><span>' + t("ai.verified") + ': ' + escapeHtml(product.version) + ' · ' + product.verified + '</span>';
    product.links.forEach(function (link) {
      html += '<a href="' + escapeHtml(link[1]) + '" target="_blank" rel="noopener">' + escapeHtml(link[0]) + '</a>';
    });
    return html + '</div>';
  }

  function buildCategoryTabs(productId) {
    return '<div class="b64-tabs ai-category-tabs">' + PRODUCTS[productId].categories.map(function (category) {
      return '<button class="b64-tab' + (activeCategories[productId] === category ? ' active' : '') + '" data-ai-category="' + category + '">' + t("ai.categories." + category) + '</button>';
    }).join('') + '</div>';
  }

  function buildCommandTable(productId) {
    var product = PRODUCTS[productId];
    var category = activeCategories[productId];
    var rows = product.commands.filter(function (item) { return item.category === category; }).map(function (item) {
      var rowClass = item.dangerous ? ' class="ai-danger-row"' : '';
      var example = currentLang() === "en" && item.exampleEn ? item.exampleEn : item.example;
      return '<tr' + rowClass + ' data-search="' + escapeHtml([item.command, item.example, item.exampleEn || "", item.descZh, item.descEn, item.noteZh, item.noteEn].join(' ').toLowerCase()) + '">' +
        '<td><code>' + escapeHtml(item.command) + '</code>' + (item.dangerous ? '<br><span class="at-muted">⚠ ' + t("ai.dangerous") + '</span>' : '') + '</td>' +
        '<td>' + escapeHtml(text(item, "desc")) + '</td>' +
        '<td data-copy="' + escapeHtml(example) + '"><code>' + escapeHtml(example) + '</code></td>' +
        '<td class="at-muted">' + escapeHtml(text(item, "note")) + '</td></tr>';
    }).join('');
    return '<div class="at-search-wrap"><input id="ai-search" class="search-input" type="text" placeholder="' + t("ai.searchPlaceholder") + '"></div>' +
      '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ai.cmd") + '</th><th>' + t("ai.desc") + '</th><th>' + t("ai.example") + '</th><th>' + t("ai.note") + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function buildProduct(productId) {
    return buildLinks(PRODUCTS[productId]) + buildCategoryTabs(productId) + '<div id="ai-command-table">' + buildCommandTable(productId) + '</div>';
  }

  function buildComparison() {
    var rows = COMPARISON.map(function (row) {
      var claudeValue = text(row, "claude");
      var codexValue = text(row, "codex");
      return '<tr><td>' + t("ai.compare." + row.key) + '</td><td data-copy="' + escapeHtml(claudeValue) + '"><code>' + escapeHtml(claudeValue) + '</code></td><td data-copy="' + escapeHtml(codexValue) + '"><code>' + escapeHtml(codexValue) + '</code></td></tr>';
    }).join('');
    return '<div class="at-doc-refs">' + t("ai.compareHint") + '</div><div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ai.scenario") + '</th><th>Claude Code</th><th>Codex</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderBody() {
    var body = document.getElementById("ai-body");
    body.innerHTML = activeProduct === "compare" ? buildComparison() : buildProduct(activeProduct);
    if (activeProduct !== "compare") {
      body.querySelectorAll(".b64-tab[data-ai-category]").forEach(function (button) {
        button.addEventListener("click", function () {
          activeCategories[activeProduct] = this.dataset.aiCategory;
          renderBody();
        });
      });
      var search = document.getElementById("ai-search");
      if (search) search.addEventListener("input", function () {
        var query = this.value.trim().toLowerCase();
        document.querySelectorAll("#ai-command-table tbody tr").forEach(function (row) {
          row.style.display = query && row.dataset.search.indexOf(query) === -1 ? "none" : "";
        });
      });
    }
  }

  function init(parent) {
    parent.innerHTML = '<div class="b64-tool"><div class="b64-tabs">' +
      '<button class="b64-tab active" data-ai-product="claude">' + t("ai.claudeCode") + '</button>' +
      '<button class="b64-tab" data-ai-product="codex">' + t("ai.codex") + '</button>' +
      '<button class="b64-tab" data-ai-product="compare">' + t("ai.comparison") + '</button></div><div id="ai-body" class="android-section"></div></div>';
    parent.querySelectorAll(".b64-tab[data-ai-product]").forEach(function (button) {
      button.addEventListener("click", function () {
        activeProduct = this.dataset.aiProduct;
        parent.querySelectorAll(".b64-tab[data-ai-product]").forEach(function (item) {
          item.className = "b64-tab" + (item.dataset.aiProduct === activeProduct ? " active" : "");
        });
        renderBody();
      });
    });
    parent.addEventListener("click", function (event) {
      if (event.target.closest("a")) return;
      var copyTarget = event.target.closest("[data-copy]");
      if (!copyTarget) return;
      navigator.clipboard.writeText(copyTarget.dataset.copy).then(function () { showCopyToast("✓ " + t("ai.copied")); });
    });
    renderBody();
  }

  return { init: init };
})();
