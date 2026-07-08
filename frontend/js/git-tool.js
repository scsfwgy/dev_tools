// Git Tool — common commands reference with Curl-style live domain/branch replacement.
var GitTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  // Each: [command, description (zh), example, note, description (en)]

  var BASIC_CMDS = [
    ["git init",          "初始化仓库", "git init", "在当前目录创建 .git", "Initialize a new repo"],
    ["git clone",         "克隆仓库", "git clone https://github.com/user/repo.git", "支持 https/ssh/git 协议", "Clone a remote repository"],
    ["git clone -b",      "克隆指定分支", "git clone -b main https://github.com/user/repo.git", "克隆后自动切换到指定分支", "Clone a specific branch"],
    ["git add",           "暂存文件", "git add .", "暂存所有变更（新增+修改+删除）", "Stage all changes"],
    ["git add -p",        "交互式暂存", "git add -p file.ts", "逐块选择要暂存的代码片段", "Stage hunks interactively"],
    ["git commit -m",     "提交并写信息", "git commit -m 'feat: add login'", "-m 后跟提交信息", "Commit with message"],
    ["git commit -a",     "跳过 add 直接提交", "git commit -am 'fix: typo'", "暂存所有已跟踪文件并提交", "Stage tracked & commit"],
    ["git commit --amend","修改上次提交", "git commit --amend -m 'new msg'", "重写最近一次提交的信息或内容", "Amend last commit"],
    ["git status",        "查看工作区状态", "git status -s", "-s 简洁模式", "Show working tree status"],
    ["git push",          "推送提交", "git push origin main", "推送本地提交到远程", "Push to remote"],
    ["git push -u",       "推送并设 upstream", "git push -u origin main", "首次推送后用 git push 即可", "Push & set upstream"],
    ["git pull",          "拉取 + 合并", "git pull origin main", "等价 fetch + merge", "Pull & merge"],
    ["git pull --rebase", "拉取 + 变基", "git pull --rebase origin main", "避免多余 merge commit", "Pull & rebase"],
    ["git fetch",         "拉取不合并", "git fetch origin", "只下载远程更新，不修改工作区", "Fetch without merging"],
  ];

  var BRANCH_CMDS = [
    ["git branch",        "列出本地分支", "git branch", "当前分支前有 * 标记", "List local branches"],
    ["git branch -a",     "列出所有分支", "git branch -a", "含远程跟踪分支", "List all branches"],
    ["git branch -r",     "列出远程分支", "git branch -r", "仅显示 origin/xxx 远程分支", "List remote branches"],
    ["git branch -d",     "删除本地分支", "git branch -d feat/old", "安全删除（已合并），-D 强制删除", "Delete merged branch"],
    ["git checkout",      "切换分支", "git checkout main", "传统切换方式", "Switch branch (legacy)"],
    ["git checkout -b",   "创建并切换分支", "git checkout -b feat/new", "基于当前分支创建新分支", "Create & switch branch"],
    ["git switch",        "切换分支（新）", "git switch main", "Git 2.23+ 推荐，语义更清晰", "Switch branch (modern)"],
    ["git switch -c",     "创建并切换（新）", "git switch -c feat/new", "Git 2.23+ 推荐", "Create & switch (modern)"],
    ["git merge",         "合并分支", "git merge feat/login", "将 feat/login 合并到当前分支", "Merge branch into current"],
    ["git merge --no-ff", "强制生成提交", "git merge --no-ff feat/login", "保留分支历史痕迹", "Merge with merge commit"],
    ["git rebase",        "变基", "git rebase main", "将当前分支的提交接到 main 之后", "Rebase onto another branch"],
    ["git rebase -i",     "交互式变基", "git rebase -i HEAD~3", "合并/丢弃/重排最近 3 个提交", "Interactive rebase last N commits"],
    ["git branch -m",     "重命名分支", "git branch -m old-name new-name", "本地重命名，远程需 delete+push", "Rename branch"],
    ["git cherry-pick",   "摘取提交", "git cherry-pick abc123f", "将指定提交应用到当前分支", "Apply a specific commit"],
  ];

  var UNDO_CMDS = [
    ["git reset",         "撤销暂存", "git reset HEAD file.txt", "取消 git add，保留修改", "Unstage a file"],
    ["git reset --soft",  "软回退", "git reset --soft HEAD~1", "撤销提交，变更保留在暂存区", "Undo commit, keep staged"],
    ["git reset --mixed", "混合回退", "git reset HEAD~1", "撤销提交+暂存，变更保留在工作区", "Undo commit & unstage"],
    ["git reset --hard",  "硬回退", "git reset --hard HEAD~1", "⚠ 丢弃所有变更和工作区修改", "Discard all changes"],
    ["git revert",        "反向提交", "git revert abc123f", "安全撤销：生成新提交来抵消旧提交", "Safe undo: new commit reversing old"],
    ["git restore",       "丢弃工作区修改", "git restore file.txt", "回到上次暂存/提交的状态", "Discard working tree changes"],
    ["git restore -S",    "取消暂存", "git restore --staged file.txt", "新替代 git reset HEAD", "Unstage (modern)"],
    ["git clean -fd",     "删除未跟踪文件", "git clean -fd", "⚠ 删除所有 .gitignore 外的未跟踪文件目录", "Remove untracked files & dirs"],
    ["git checkout --",   "丢弃修改（旧）", "git checkout -- file.txt", "传统写法，同 git restore", "Discard changes (legacy)"],
  ];

  var REMOTE_CMDS = [
    ["git remote -v",     "查看远程地址", "git remote -v", "显示 fetch 和 push 地址", "Show remote URLs"],
    ["git remote add",    "添加远程仓库", "git remote add upstream https://github.com/user/repo.git", "添加上游仓库地址", "Add a remote"],
    ["git remote set-url","修改远程地址", "git remote set-url origin git@github.com:user/repo.git", "从 https 切到 ssh", "Change remote URL"],
    ["git remote remove", "删除远程", "git remote remove upstream", "移除指定远程仓库", "Remove a remote"],
    ["git remote rename", "重命名远程", "git remote rename origin upstream", "重命名远程仓库别名", "Rename a remote"],
    ["git clone",         "克隆仓库", "git clone https://github.com/user/repo.git", "支持 https/ssh/git 协议", "Clone a remote repository"],
    ["git clone --depth", "浅克隆", "git clone --depth 1 https://github.com/user/repo.git", "只克隆最近一次提交，速度快", "Shallow clone (latest commit only)"],
  ];

  var STASH_LOG_CMDS = [
    ["git stash",         "暂存当前修改", "git stash", "将未提交的修改暂存起来", "Stash working changes"],
    ["git stash -u",      "暂存含未跟踪", "git stash -u", "同时暂存未跟踪文件", "Stash including untracked"],
    ["git stash pop",     "恢复暂存", "git stash pop", "恢复最近一次 stash 并删除记录", "Apply & drop latest stash"],
    ["git stash list",    "查看暂存列表", "git stash list", "列出所有 stash 记录", "List all stashes"],
    ["git stash drop",    "删除暂存", "git stash drop stash@{0}", "删除指定 stash", "Drop a stash entry"],
    ["git log",           "查看提交历史", "git log --oneline -10", "--oneline 一行显示", "Show commit history"],
    ["git log --graph",   "图形化日志", "git log --oneline --graph --all", "可视化分支和合并历史", "Graphical commit history"],
    ["git diff",          "查看未暂存变更", "git diff", "比较工作区与暂存区", "Show unstaged changes"],
    ["git diff --staged", "查看已暂存变更", "git diff --staged", "比较暂存区与上次提交", "Show staged changes"],
    ["git show",          "查看提交详情", "git show abc123f", "展示某次提交的完整内容和 diff", "Show commit details"],
    ["git blame",         "查看每行作者", "git blame file.ts", "逐行显示最后修改者和提交", "Show line-by-line authorship"],
  ];

  var TAG_SUB_CMDS = [
    ["git tag",           "列出所有标签", "git tag", "显示已有标签列表", "List all tags"],
    ["git tag -a",        "创建附注标签", "git tag -a v1.0.0 -m 'release'", "轻量标签不加 -a", "Create annotated tag"],
    ["git tag -d",        "删除标签", "git tag -d v1.0.0", "本地删除，远程需 push --delete", "Delete a tag"],
    ["git push --tags",   "推送所有标签", "git push --tags", "推送本地所有标签到远程", "Push all tags"],
    ["git submodule add", "添加子模块", "git submodule add https://github.com/lib/foo.git libs/foo", "将外部仓库作为子目录引入", "Add submodule"],
    ["git submodule update --init --recursive", "初始化子模块", "git submodule update --init --recursive", "克隆后拉取所有子模块内容", "Init & update submodules"],
    [".gitignore",        "忽略文件", "echo 'node_modules/' >> .gitignore", "匹配规则：* 通配，/ 目录，! 例外", "Ignore files"],
  ];

  var CONFIG_CMDS = [
    ["git config --global user.name",  "设置全局用户名", "git config --global user.name 'Your Name'", "所有项目生效，写入 ~/.gitconfig", "Set global user name"],
    ["git config --global user.email", "设置全局邮箱", "git config --global user.email 'you@example.com'", "提交记录显示的邮箱", "Set global user email"],
    ["git config --global init.defaultBranch", "设置默认分支名", "git config --global init.defaultBranch main", "新仓库 init 后默认分支", "Set default branch name"],
    ["git config --global core.editor","设置默认编辑器", "git config --global core.editor 'code --wait'", "commit/rebase 用的编辑器", "Set default editor"],
    ["git config --global pull.rebase", "pull 默认变基", "git config --global pull.rebase true", "避免 pull 产生 merge commit", "Pull with rebase by default"],
    ["git config --global credential.helper", "缓存凭证", "git config --global credential.helper store", "store=明文存，cache=内存缓存", "Cache credentials"],
    ["git config user.name",           "设置当前项目用户", "git config user.name 'Project Name'", "不加 --global 仅对当前仓库生效", "Set local (repo-only) name"],
    ["git config --list",              "查看所有配置", "git config --list", "--global 仅看全局，--local 仅看当前项目", "Show all config"],
    ["git config --get",               "查看单个配置", "git config --get user.name", "读取某一项的值", "Get a single config value"],
    ["git config --unset",             "删除配置项", "git config --unset user.email", "移除指定配置", "Remove a config entry"],
    ["git config --global alias.",     "设置命令别名", "git config --global alias.co checkout", "之后 git co = git checkout", "Create command alias"],
    ["git config --global core.autocrlf", "换行符处理", "git config --global core.autocrlf input", "input=提交转 LF，检出保留；Windows 用 true", "Line ending handling"],
  ];

  var ADV_CMDS = [
    ["git reflog",        "引用日志", "git reflog", "找回误删的提交（默认保留 90 天）", "Recover lost commits"],
    ["git bisect",        "二分查找 bug", "git bisect start && git bisect bad && git bisect good v1.0", "自动二分定位引入 bug 的提交", "Binary search for bugs"],
    ["git archive",       "导出归档", "git archive -o source.zip HEAD", "不包含 .git 目录的代码归档", "Export without .git"],
    ["git rebase --onto", "变基到指定位置", "git rebase --onto main feat/A feat/B", "把 feat/B 独有提交移到 main 上", "Rebase onto specific base"],
    ["git worktree add",  "添加工作树", "git worktree add ../hotfix hotfix", "同时检出多个分支到不同目录", "Check out multiple branches"],
    ["git gc",            "垃圾回收", "git gc --aggressive", "清理优化仓库，回收空间", "Garbage collect & optimize"],
  ];

  // "全部" tab = merge of all categories
  var ALL_CMDS = [].concat(BASIC_CMDS, BRANCH_CMDS, UNDO_CMDS, REMOTE_CMDS, STASH_LOG_CMDS, TAG_SUB_CMDS, CONFIG_CMDS, ADV_CMDS);

  var TABS = [
    { id: "all",    i18n: "git.all",      data: ALL_CMDS },
    { id: "basic",  i18n: "git.basic",   data: BASIC_CMDS },
    { id: "branch", i18n: "git.branch",  data: BRANCH_CMDS },
    { id: "undo",   i18n: "git.undo",    data: UNDO_CMDS },
    { id: "remote", i18n: "git.remote",  data: REMOTE_CMDS },
    { id: "stash",  i18n: "git.stashLog",data: STASH_LOG_CMDS },
    { id: "tag",    i18n: "git.tagSub",  data: TAG_SUB_CMDS },
    { id: "config", i18n: "git.config",  data: CONFIG_CMDS },
    { id: "adv",    i18n: "git.adv",     data: ADV_CMDS },
  ];

  // ═══ Build ═══

  function buildTable(data, searchId, tabId) {
    var h = '<div class="at-search-wrap"><input id="' + searchId + '" class="search-input" type="text" placeholder="' + t("git.searchPlaceholder") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("git.command") + '</th><th>' + t("git.description") + '</th><th>' + t("git.example") + '</th><th>' + t("git.note") + '</th></tr></thead><tbody id="gtbody-' + tabId + '">';
    data.forEach(function (r, idx) {
      var searchData = r.join(" ").toLowerCase();
      h += '<tr data-idx="' + idx + '" data-search="' + searchData + '">';
      h += '<td><code>' + r[0] + '</code></td>';
      h += '<td>' + r[1] + '<br><span class="at-muted">' + r[4] + '</span></td>';
      h += '<td><code class="gt-example">' + escapeHtml(r[2]) + '</code></td>';
      h += '<td class="at-muted">' + r[3] + '</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Curl-style live replacement ═══

  // match a full URL token (scheme://...  or git@host:path) up to whitespace — replaced wholesale
  var REMOTE_RE = /(https?:\/\/\S+|git@[^:\s]+:[^\s]+)/g;

  function applyRemote(origExample, newDomain) {
    // normalize: ensure scheme, strip trailing slash
    if (!/^(https?:\/\/|git@)/i.test(newDomain)) newDomain = "https://" + newDomain;
    newDomain = newDomain.replace(/\/+$/, "");
    // replace the whole URL token with newDomain (path discarded)
    return origExample.replace(REMOTE_RE, newDomain);
  }

  function applyBranch(origExample, newName) {
    var branchRe = /\b(feat(ure)?\/\S+|bugfix\/\S+|hotfix\/\S+|release\/\S+|develop|staging|master)\b/g;
    return origExample
      .replace(/\bold-name\b/g, newName)
      .replace(/\bnew-name\b/g, newName)
      .replace(branchRe, newName);
  }

  // apply BOTH replacements to original example text (no cumulative state issues)
  function applyAllReplacements(tabId, remoteVal, branchVal) {
    var data = TABS.find(function (t) { return t.id === tabId; }).data;
    var count = 0;
    document.querySelectorAll("#gtbody-" + tabId + " tr").forEach(function (tr) {
      var idx = parseInt(tr.dataset.idx);
      var orig = data[idx][2];
      var result = orig;
      if (remoteVal) result = applyRemote(result, remoteVal);
      if (branchVal) result = applyBranch(result, branchVal);
      if (result !== orig) count++;
      var cell = tr.querySelector(".gt-example");
      if (cell) cell.textContent = result;
    });
    return count;
  }

  function restoreExamples(tabId) {
    var data = TABS.find(function (t) { return t.id === tabId; }).data;
    document.querySelectorAll("#gtbody-" + tabId + " tr").forEach(function (tr) {
      var idx = parseInt(tr.dataset.idx);
      var cell = tr.querySelector(".gt-example");
      if (cell) cell.textContent = data[idx][2];
    });
  }

  // ═══ Init ═══

  var activeTabId = "all";

  function init(parent) {
    var h = '<div class="b64-tool">';
    h += '<div class="b64-tabs">';
    TABS.forEach(function (tab, i) {
      h += '<button class="b64-tab' + (i === 0 ? ' active' : '') + '" data-gtab="' + tab.id + '">' + t(tab.i18n) + '</button>';
    });
    h += '</div>';

    // global replacement bar (shared across all tabs)
    h += '<div class="git-replace-bar">';
    h += '<div class="git-replace-field">';
    h += '<span class="git-replace-label">' + t("git.replaceRemote") + '</span>';
    h += '<input id="gremote-input" class="crypto-input" type="text" placeholder="https://gitlab.com/your-group" style="width:240px">';
    h += '</div>';
    h += '<div class="git-replace-field">';
    h += '<span class="git-replace-label">' + t("git.replaceBranch") + '</span>';
    h += '<input id="gbranch-input" class="crypto-input" type="text" placeholder="feature/xxx" style="width:200px">';
    h += '</div>';
    h += '<span id="greplace-msg" class="git-replace-msg"></span>';
    h += '<button id="greplace-reset" class="jt-btn" style="margin-left:auto">' + t("git.resetBtn") + '</button>';
    h += '</div>';

    // command sections
    TABS.forEach(function (tab, i) {
      h += '<div id="gtab-' + tab.id + '" class="android-section' + (i === 0 ? '' : ' hidden') + '">' + buildTable(tab.data, "gsearch-" + tab.id, tab.id) + '</div>';
    });

    h += '</div>';
    parent.innerHTML = h;

    // tab switching
    document.querySelectorAll(".b64-tab[data-gtab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchGTab(this.dataset.gtab);
        applyReplacements();  // re-apply current replacement values to newly shown tab
      });
    });

    // search binding per tab
    TABS.forEach(function (tab) {
      var input = document.getElementById("gsearch-" + tab.id);
      if (!input) return;
      input.addEventListener("input", function () {
        var q = this.value.toLowerCase();
        document.querySelectorAll("#gtbody-" + tab.id + " tr").forEach(function (tr) {
          tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
        });
      });
    });

    // ── replacement inputs (global, re-applied on tab switch) ──
    var remoteInput = document.getElementById("gremote-input");
    var branchInput = document.getElementById("gbranch-input");

    function applyReplacements() {
      var remoteVal = remoteInput.value.trim();
      var branchVal = branchInput.value.trim();
      var count = applyAllReplacements(activeTabId, remoteVal, branchVal);
      var msg = document.getElementById("greplace-msg");
      if (msg) {
        if (remoteVal || branchVal) {
          msg.textContent = "✓ 当前标签 " + count + " 条已替换";
          clearTimeout(msg._timer);
          msg._timer = setTimeout(function () { msg.textContent = ""; }, 2500);
        } else {
          msg.textContent = "";
        }
      }
    }

    remoteInput.addEventListener("input", applyReplacements);
    branchInput.addEventListener("input", applyReplacements);

    document.getElementById("greplace-reset").addEventListener("click", function () {
      remoteInput.value = "";
      branchInput.value = "";
      TABS.forEach(function (tab) { restoreExamples(tab.id); });
      var msg = document.getElementById("greplace-msg");
      if (msg) msg.textContent = "";
    });
  }

  function switchGTab(name) {
    activeTabId = name;
    document.querySelectorAll(".b64-tab[data-gtab]").forEach(function (b) {
      b.className = "b64-tab" + (b.dataset.gtab === name ? " active" : "");
    });
    document.querySelectorAll("[id^='gtab-']").forEach(function (s) {
      s.classList.toggle("hidden", s.id !== "gtab-" + name);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  return { init: init };
})();
