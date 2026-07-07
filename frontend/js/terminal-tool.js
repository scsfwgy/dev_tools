// Terminal Tool — common shell commands quick reference for ops and terminal users.
var TerminalTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  // ═══ Command data ═══
  // Each: [command, description, example, note]

  var FILE_CMDS = [
    ["ls",     "列出目录内容", "ls -la /var/log", "List directory contents", "-l 长格式，-a 含隐藏文件，-h 人类可读大小"],
    ["cd",     "切换工作目录", "cd /etc && cd -", "Change directory", "cd - 返回上次目录，cd ~ 回 home"],
    ["cp",     "复制文件或目录", "cp -r src/ dst/", "Copy files/directories", "-r 递归复制目录，-p 保留权限时间戳"],
    ["mv",     "移动 / 重命名", "mv old.txt new.txt", "Move or rename", "同分区移动仅改 inode，跨分区实际是 cp+rm"],
    ["rm",     "删除文件或目录", "rm -rf ./tmp", "Remove files/directories", "⚠ -rf 不确认递归删除，慎用"],
    ["mkdir",  "创建目录", "mkdir -p a/b/c", "Create directory", "-p 递归创建父目录，已存在不报错"],
    ["find",   "搜索文件", "find . -name '*.log' -mtime -7", "Find files by name/date/size", "-exec 可对结果执行命令"],
    ["tree",   "树形显示目录结构", "tree -L 2 /etc", "Show directory tree", "-L 限制深度，-d 仅目录"],
    ["stat",   "查看文件详细信息", "stat /etc/hosts", "Show file metadata", "含 inode、权限、时间戳、大小"],
    ["touch",  "创建空文件 / 更新时间戳", "touch -t 202607070000 file", "Create file or update timestamp", "常用于触发 make / 容器重启检测"],
    ["ln",     "创建链接", "ln -s /usr/bin/python3 /usr/bin/python", "Create hard/symbolic link", "-s 软链接（符号链接），无 -s 硬链接"],
    ["du",     "查看目录 / 文件占用", "du -sh /var/log", "Disk usage", "-s 汇总，-h 人类可读，--max-depth=N 限制深度"],
  ];

  var TEXT_CMDS = [
    ["grep",   "文本搜索", "grep -rn 'error' /var/log/", "Search text with regex", "-r 递归，-n 显示行号，-i 忽略大小写，-v 反向匹配"],
    ["sed",    "流式文本编辑", "sed -i 's/foo/bar/g' file.txt", "Stream editor", "-i 原地替换，'s/old/new/g' 全局替换"],
    ["awk",    "文本处理语言", "awk '{print $1, $NF}' file.txt", "Column-based text processing", "$1 第1列，$NF 最后1列，-F: 指定分隔符"],
    ["cat",    "查看 / 拼接文件", "cat file1 file2 > merged", "Concatenate files", "-n 显示行号，tac 反向输出"],
    ["head",   "查看文件头部", "head -n 20 log.txt", "Show first lines", "默认 10 行，-n 指定行数"],
    ["tail",   "查看文件尾部", "tail -f /var/log/syslog", "Show last lines / follow", "-f 跟踪追加，-n 指定行数"],
    ["wc",     "统计行数字数", "wc -l *.js", "Word/line/char count", "-l 行数，-w 单词数，-c 字节数"],
    ["sort",   "排序文本行", "sort -n -k2 file.txt", "Sort lines", "-n 数字排序，-r 倒序，-u 去重，-k 按第N列"],
    ["uniq",   "去重相邻行", "sort file | uniq -c", "Deduplicate adjacent lines", "-c 计数，-d 仅重复行，常配合 sort"],
    ["cut",    "按分隔符截取", "cut -d',' -f1,3 data.csv", "Cut by delimiter", "-d 分隔符，-f 字段编号"],
    ["tr",     "字符替换 / 删除", "echo 'HELLO' | tr 'A-Z' 'a-z'", "Translate characters", "-d 删除指定字符，-s 压缩重复"],
    ["diff",   "比较文件差异", "diff -u old.txt new.txt", "Compare files line by line", "-u unified 格式，-r 递归比较目录"],
  ];

  var PROC_CMDS = [
    ["ps",     "查看进程快照", "ps aux | grep nginx", "Process snapshot", "a=所有用户，u=用户格式，x=含无终端的"],
    ["top",    "实时进程监控", "top -p 1234", "Real-time process monitor", "htop 更友好的替代品，按 q 退出"],
    ["kill",   "发送信号给进程", "kill -9 1234", "Send signal to process", "-9 SIGKILL 强制杀，-15 SIGTERM 优雅终止"],
    ["jobs",   "查看后台任务", "jobs -l", "List background jobs", "仅当前 shell 会话有效"],
    ["bg/fg",  "后台 / 前台切换", "fg %1", "Move job to background/foreground", "bg %1 继续后台运行，fg %1 拉回前台"],
    ["nohup",  "不受挂断影响的运行", "nohup ./script.sh &", "Run immune to hangups", "输出默认写入 nohup.out"],
    ["screen", "会话保持", "screen -S mysession", "Persistent terminal session", "Ctrl+A D 分离，screen -r 恢复"],
    ["tmux",   "终端复用器", "tmux new -s dev", "Terminal multiplexer", "Ctrl+B D 分离，tmux attach -t dev 恢复"],
    ["pgrep",  "按名称查 PID", "pgrep -f 'python app.py'", "Find process by name", "-f 匹配完整命令行，-l 同时显示名称"],
    ["lsof",   "列出打开的文件", "lsof -i :8080", "List open files", "-i 网络连接，-p PID 指定进程"],
  ];

  var NET_CMDS = [
    ["ssh",    "远程登录服务器", "ssh user@192.168.1.100", "Secure Shell remote login", "-p 指定端口；-i 指定私钥；-L 本地端口转发"],
    ["ssh-keygen","生成 SSH 密钥对", "ssh-keygen -t ed25519 -C 'your@email'", "Generate SSH key pair", "免密登录第1步；ed25519 更安全更快，兼容用 rsa"],
    ["ssh-copy-id","复制公钥到远程机器", "ssh-copy-id user@192.168.1.100", "Install public key on remote server", "免密登录第2步；之后 ssh 无需密码；本质是把 ~/.ssh/id_*.pub 追加到远程 ~/.ssh/authorized_keys"],
    ["curl",   "HTTP / 网络请求", "curl -X POST -d '{}' http://api", "Transfer data from/to server", "-s 静默，-o 输出到文件，-H 添加头"],
    ["wget",   "下载文件", "wget -c https://example.com/file.zip", "Non-interactive download", "-c 断点续传，-r 递归下载"],
    ["ping",   "测试网络连通性", "ping -c 4 8.8.8.8", "Test network connectivity", "-c 次数，-i 间隔秒数"],
    ["netstat","查看网络状态", "netstat -tlnp", "Network statistics", "-t TCP，-l 监听，-n 数字地址，-p 进程"],
    ["ss",     "Socket 统计（现代替代）", "ss -tlnp", "Socket statistics", "比 netstat 快，选项兼容"],
    ["nc",     "网络调试瑞士军刀", "nc -lvp 8888", "Netcat — TCP/UDP read/write", "-l 监听，-v 详细，-p 端口"],
    ["scp",    "远程拷贝文件", "scp file.txt user@host:/path/", "Secure copy over SSH", "-r 递归目录，-P 指定端口"],
    ["rsync",  "高效同步文件", "rsync -avz src/ dst/", "Remote sync", "-a 归档模式，-z 压缩，--delete 删除多余"],
    ["ifconfig","查看 / 配置网卡", "ifconfig eth0", "Configure network interface", "被 ip 命令逐步替代"],
    ["dig",    "DNS 查询", "dig +short A example.com", "DNS lookup utility", "比 nslookup 更详细，+short 精简输出"],
    ["nslookup","DNS 查询", "nslookup example.com 8.8.8.8", "Query DNS records", "简单 DNS 查询，最后参数指定 DNS 服务器"],
  ];

  var SYS_CMDS = [
    ["uname",  "系统内核信息", "uname -a", "System info", "-a 全部信息，-r 内核版本，-m 架构"],
    ["df",     "磁盘空间概览", "df -h", "Disk free space", "-h 人类可读，-i inode 使用情况"],
    ["free",   "内存使用情况", "free -h", "Memory usage", "-h 人类可读，-s N 每 N 秒刷新"],
    ["uptime", "系统运行时间", "uptime", "System uptime / load avg", "显示运行时间 + 1/5/15min 平均负载"],
    ["who",    "查看登录用户", "who -a", "Logged-in users", "w 命令显示更详细活动信息"],
    ["dmesg",  "内核日志", "dmesg | tail -20", "Kernel ring buffer", "系统启动和硬件相关日志"],
    ["lsblk",  "列出块设备", "lsblk -f", "List block devices", "-f 显示文件系统信息"],
    ["history","查看命令历史", "history | grep curl", "Command history", "!! 重复上条，!$ 上条最后参数"],
    ["env",    "显示环境变量", "env | grep PATH", "Environment variables", "printenv 同功能，export 设置变量"],
    ["which",  "查找命令路径", "which python3", "Locate a command", "type 命令在 shell 内更准确"],
  ];

  var PERM_CMDS = [
    ["chmod",  "修改文件权限", "chmod 755 script.sh", "Change file mode bits", "r=4 w=2 x=1；u/g/o 用户/组/其他"],
    ["chown",  "修改文件属主", "chown user:group file.txt", "Change file owner", "-R 递归修改目录下所有文件"],
    ["sudo",   "以 root 身份执行", "sudo systemctl restart nginx", "Execute as superuser", "-i 以 root 登录 shell，-u 指定用户"],
    ["su",     "切换用户", "su - username", "Switch user", "- 参数同时切换环境变量到目标用户"],
    ["umask",  "设置默认权限掩码", "umask 022", "Default permission mask", "022=新文件644 新目录755"],
    ["passwd", "修改用户密码", "passwd username", "Change user password", "root 可改他人，普通用户仅自己"],
    ["chgrp",  "修改文件属组", "chgrp dev team-file", "Change group ownership", "chown :group 等价写法"],
  ];

  var ARCH_CMDS = [
    ["tar",    "归档 / 解归档", "tar -czvf a.tar.gz dir/", "Tape archive", "-c 创建 -x 解压 -z gzip -v 详细 -f 文件"],
    ["gzip",   "GZIP 压缩", "gzip -k file.txt", "Compress with gzip", "-k 保留原文件，-d 解压（同 gunzip）"],
    ["gunzip", "GZIP 解压", "gunzip file.txt.gz", "Decompress gzip", "等价于 gzip -d"],
    ["zip",    "ZIP 压缩", "zip -r archive.zip dir/", "Create ZIP archive", "-r 递归，-e 加密，-P 密码"],
    ["unzip",  "ZIP 解压", "unzip archive.zip -d /tmp", "Extract ZIP archive", "-d 指定目标目录，-l 仅列出内容"],
    ["7z",     "7-Zip 高压缩比", "7z a -mx=9 a.7z dir/", "7-Zip archiver", "a=添加 x=解压 -mx=9 最高压缩"],
    ["zstd",   "Zstandard 压缩", "zstd -d file.zst", "Zstandard compression", "比 gzip 更快、压缩比更高"],
  ];

  var SHELL_CMDS = [
    ["|",     "管道 — 连接命令", "cat log.txt | grep ERROR | wc -l", "Pipe stdout → stdin", "Shell 核心哲学：小命令组合成复杂逻辑"],
    [">",     "重定向输出(覆盖)", "echo 'data' > file.txt", "Redirect stdout (overwrite)", ">> 追加写入；2> 重定向 stderr；&> 全部重定向"],
    ["&",     "后台运行", "./long-task.sh &", "Run in background", "nohup 配合使用以免疫终端退出"],
    ["&&",    "逻辑与 — 前成功才执行", "make && make install", "AND — run next only if success", "|| 逻辑或 — 前失败才执行"],
    ["alias", "创建命令别名", "alias ll='ls -lah'", "Create command alias", "持久化写入 ~/.bashrc 或 ~/.zshrc"],
    ["tee",   "同时输出到文件和屏幕", "./script 2>&1 | tee log.txt", "Write to stdout and file", "调试利器，-a 追加模式"],
    ["~/.ssh/config","SSH 主机别名配置", "echo -e 'Host dev\n  HostName 10.0.0.5\n  User ubuntu\n  IdentityFile ~/.ssh/id_ed25519' >> ~/.ssh/config", "SSH client config for aliases", "配置后可直接 ssh dev 登录，免去每次输入 IP/用户名/密钥路径"],
    ["xargs", "将 stdin 转为参数", "find . -name '*.tmp' | xargs rm", "Build commands from stdin", "-P N 并行执行，-I {} 占位符替换"],
  ];

  var TABS = [
    { id: "file",    i18n: "terminal.fileOps",    data: FILE_CMDS,  cols: ["terminal.cmd", "terminal.desc", "terminal.example", "terminal.note"] },
    { id: "text",    i18n: "terminal.textProc",   data: TEXT_CMDS,  cols: ["terminal.cmd", "terminal.desc", "terminal.example", "terminal.note"] },
    { id: "proc",    i18n: "terminal.process",    data: PROC_CMDS,  cols: ["terminal.cmd", "terminal.desc", "terminal.example", "terminal.note"] },
    { id: "net",     i18n: "terminal.network",    data: NET_CMDS,   cols: ["terminal.cmd", "terminal.desc", "terminal.example", "terminal.note"] },
    { id: "sys",     i18n: "terminal.system",     data: SYS_CMDS,   cols: ["terminal.cmd", "terminal.desc", "terminal.example", "terminal.note"] },
    { id: "perm",    i18n: "terminal.perm",       data: PERM_CMDS,  cols: ["terminal.cmd", "terminal.desc", "terminal.example", "terminal.note"] },
    { id: "arch",    i18n: "terminal.archive",    data: ARCH_CMDS,  cols: ["terminal.cmd", "terminal.desc", "terminal.example", "terminal.note"] },
    { id: "shell",   i18n: "terminal.shellTips",  data: SHELL_CMDS, cols: ["terminal.cmd", "terminal.desc", "terminal.example", "terminal.note"] },
  ];

  // ═══ Build ═══

  function buildSection(tab) {
    var h = '';
    h += '<div class="at-search-wrap"><input id="tsearch-' + tab.id + '" class="search-input" type="text" placeholder="' + t("terminal.searchPlaceholder") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr>';
    tab.cols.forEach(function (c) { h += '<th>' + t(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    tab.data.forEach(function (r) {
      var searchData = r.join(" ").toLowerCase();
      h += '<tr data-search="' + searchData + '">';
      h += '<td><code>' + r[0] + '</code></td>';  // command
      h += '<td>' + r[1] + '<br><span class="at-muted">' + r[3] + '</span></td>';  // desc zh + en
      h += '<td><code>' + escapeHtml(r[2]) + '</code></td>';  // example
      h += '<td class="at-muted">' + r[4] + '</td>';  // note
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
      h += '<button class="b64-tab' + (i === 0 ? ' active' : '') + '" data-ttab="' + tab.id + '">' + t(tab.i18n) + '</button>';
    });
    h += '</div>';
    TABS.forEach(function (tab, i) {
      h += '<div id="ttab-' + tab.id + '" class="android-section' + (i === 0 ? '' : ' hidden') + '">' + buildSection(tab) + '</div>';
    });
    h += '</div>';

    parent.innerHTML = h;

    // tab switch
    document.querySelectorAll(".b64-tab[data-ttab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchTTab(this.dataset.ttab); });
    });

    // search binding per tab
    TABS.forEach(function (tab) {
      var input = document.getElementById("tsearch-" + tab.id);
      if (!input) return;
      input.addEventListener("input", function () {
        var q = this.value.toLowerCase();
        document.querySelectorAll("#ttab-" + tab.id + " tbody tr").forEach(function (tr) {
          tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
        });
      });
    });
  }

  function switchTTab(name) {
    document.querySelectorAll(".b64-tab[data-ttab]").forEach(function (b) {
      b.className = "b64-tab" + (b.dataset.ttab === name ? " active" : "");
    });
    document.querySelectorAll("#ttab-" + name + ", .android-section[id^='ttab-']").forEach(function (s) {
      s.classList.toggle("hidden", s.id !== "ttab-" + name);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  return { init: init };
})();
