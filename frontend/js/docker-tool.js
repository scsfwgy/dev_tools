// Docker Tool — common Docker / Compose / Dockerfile commands reference with search and copy.
var DockerTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  // Each: [command, description (zh), example, note, description (en)]

  var IMAGE_CMDS = [
    ["docker build",      "构建镜像", "docker build -t myapp:1.0 .", "构建当前目录 Dockerfile 生成镜像", "Build an image from a Dockerfile"],
    ["docker pull",       "拉取镜像", "docker pull nginx:latest", "从镜像仓库下载到本地", "Pull an image from a registry"],
    ["docker images",     "列出镜像", "docker images", "查看本地所有镜像", "List local images"],
    ["docker rmi",        "删除镜像", "docker rmi myapp:1.0", "删除本地镜像，-f 强制删除", "Remove one or more images"],
    ["docker tag",        "打标签", "docker tag myapp:1.0 registry.example.com/myapp:1.0", "复制镜像引用并重命名", "Tag an image"],
    ["docker push",       "推送镜像", "docker push registry.example.com/myapp:1.0", "上传镜像到远程仓库", "Push an image to a registry"],
    ["docker history",    "查看镜像历史", "docker history myapp:1.0", "查看镜像构建层级记录", "Show image build history"],
    ["docker inspect",    "查看镜像详情", "docker inspect myapp:1.0", "以 JSON 输出镜像配置", "Show image details as JSON"],
    ["docker save",       "导出镜像", "docker save -o myapp.tar myapp:1.0", "打包镜像为 tar 文件", "Export image to a tar file"],
    ["docker load",       "导入镜像", "docker load -i myapp.tar", "从 tar 文件导入镜像", "Import image from a tar file"],
  ];

  var CONTAINER_CMDS = [
    ["docker run",        "运行容器", "docker run -d --name web -p 8080:80 nginx", "-d 后台运行，-p 端口映射", "Run a container in background"],
    ["docker ps",         "列出运行容器", "docker ps", "只看运行中容器", "List running containers"],
    ["docker ps -a",      "列出所有容器", "docker ps -a", "含已退出容器，-q 只显示 ID", "List all containers"],
    ["docker start/stop", "启停容器", "docker start web && docker stop web", "启动 / 停止已存在的容器", "Start or stop a container"],
    ["docker restart",    "重启容器", "docker restart web", "重启指定容器", "Restart a container"],
    ["docker rm",         "删除容器", "docker rm -f web", "-f 强制删除运行中的容器", "Remove one or more containers"],
    ["docker exec",       "进入容器", "docker exec -it web sh", "在运行中容器内执行命令", "Run a command in a running container"],
    ["docker logs",       "查看日志", "docker logs -f --tail 100 web", "-f 跟随输出，--tail 控制条数", "View container logs"],
    ["docker cp",         "拷贝文件", "docker cp web:/etc/nginx/nginx.conf ./", "容器与宿主机之间复制文件", "Copy files between container and host"],
    ["docker rename",     "重命名容器", "docker rename web myapp", "重命名指定容器", "Rename a container"],
    ["docker stats",      "查看资源占用", "docker stats", "实时查看 CPU / 内存 / 网络", "Live resource usage per container"],
  ];

  var RUN_CMDS = [
    ["docker run -it",    "交互式运行", "docker run -it ubuntu bash", "-it 打开交互式终端", "Run with an interactive TTY"],
    ["docker run -d",     "后台运行", "docker run -d --name web nginx", "容器在后台运行", "Run a container detached"],
    ["docker run -p",     "端口映射", "docker run -p 8080:80 nginx", "宿主机 8080 → 容器 80", "Map host:container port"],
    ["docker run -v",     "挂载数据卷", "docker run -v /data:/var/lib/mysql mysql", "宿主机目录挂载到容器", "Mount a host directory"],
    ["docker run --rm",   "临时容器", "docker run --rm -it alpine sh", "退出后自动删除容器", "Remove container automatically on exit"],
    ["docker run --name", "指定容器名", "docker run --name web -d nginx", "为容器指定名称", "Name the container"],
    ["docker run -e",     "设置环境变量", "docker run -e NODE_ENV=production -d node-app", "-e 或 --env 传递环境变量", "Set environment variables"],
    ["docker run --network", "指定网络", "docker run --network my-net -d nginx", "容器加入指定网络", "Attach the container to a network"],
    ["docker attach",     "附着终端", "docker attach web", "附着到容器主进程（Ctrl+P Q 退出）", "Attach to the container main process"],
    ["docker port",       "查看端口映射", "docker port web", "查看容器端口映射关系", "Show container port mappings"],
  ];

  var NETWORK_CMDS = [
    ["docker network ls", "列出网络", "docker network ls", "默认有 bridge / host / none", "List networks"],
    ["docker network create", "创建网络", "docker network create my-net", "创建自定义桥接网络", "Create a network"],
    ["docker network connect", "连接网络", "docker network connect my-net web", "将容器加入网络", "Connect a container to a network"],
    ["docker network disconnect", "断开网络", "docker network disconnect my-net web", "将容器移出网络", "Disconnect a container from a network"],
    ["docker network inspect", "查看网络", "docker network inspect my-net", "查看网络下所有容器", "Inspect a network"],
  ];

  var VOLUME_CMDS = [
    ["docker volume ls",  "列出数据卷", "docker volume ls", "查看所有数据卷", "List volumes"],
    ["docker volume create", "创建数据卷", "docker volume create pg-data", "创建命名数据卷", "Create a named volume"],
    ["docker volume inspect", "查看数据卷", "docker volume inspect pg-data", "查看挂载点等信息", "Inspect a volume"],
    ["docker volume rm",  "删除数据卷", "docker volume rm pg-data", "删除未使用的数据卷", "Remove a volume"],
    ["docker volume prune", "清理无用卷", "docker volume prune", "⚠ 删除所有未使用卷，可能丢失数据", "Remove all unused volumes"],
  ];

  var COMPOSE_CMDS = [
    ["docker compose up", "启动服务", "docker compose up -d", "后台启动 Compose 全部服务", "Start services in background"],
    ["docker compose down", "停止服务", "docker compose down", "停止并移除容器/网络，-v 同时删卷", "Stop and remove services"],
    ["docker compose build", "构建镜像", "docker compose build", "构建 Compose 中定义的镜像", "Build all images"],
    ["docker compose ps", "查看服务", "docker compose ps", "查看 Compose 服务状态", "List compose services"],
    ["docker compose logs", "查看日志", "docker compose logs -f web", "跟随输出指定服务日志", "Tail a service's logs"],
    ["docker compose exec", "执行命令", "docker compose exec web sh", "在运行中的服务内执行命令", "Exec into a running service"],
    ["docker compose restart", "重启服务", "docker compose restart web", "重启单个服务", "Restart services"],
    ["docker compose config", "校验配置", "docker compose config", "校验并输出最终配置", "Validate and render final config"],
  ];

  var DOCKERFILE_CMDS = [
    ["FROM",              "基础镜像", "FROM node:20-alpine", "每个 Dockerfile 第一条指令", "Base image"],
    ["RUN",               "执行命令", "RUN npm install && npm run build", "构建时执行，可用 && 串联", "Run commands at build time"],
    ["COPY",              "拷贝文件", "COPY . /app", "将构建上下文文件拷入镜像", "Copy files into the image"],
    ["ADD",               "拷贝 + 解压", "ADD app.tar.gz /app/", "支持 URL，tar 自动解压", "Copy with URL and auto-extract"],
    ["WORKDIR",           "工作目录", "WORKDIR /app", "后续指令的默认执行目录", "Set the working directory"],
    ["CMD",               "默认命令", "CMD [\"npm\", \"start\"]", "容器启动时执行的命令", "Default startup command"],
    ["ENTRYPOINT",        "入口命令", "ENTRYPOINT [\"node\", \"server.js\"]", "与 CMD 参数组合使用", "Container entrypoint"],
    ["ENV",               "环境变量", "ENV NODE_ENV=production", "设置环境变量", "Set environment variables"],
    ["EXPOSE",            "暴露端口", "EXPOSE 8080", "声明监听端口（仅文档作用）", "Declare listening port"],
    ["ARG",               "构建参数", "ARG APP_VERSION=1.0", "构建时传入，可用 --build-arg 覆盖", "Build-time argument"],
    ["USER",              "运行用户", "USER node", "切换运行用户，降低权限更安全", "Run as a specific user"],
    ["VOLUME",            "声明挂载点", "VOLUME /data", "声明匿名数据卷挂载点", "Declare a mount point"],
    ["HEALTHCHECK",       "健康检查", "HEALTHCHECK CMD curl -f http://localhost/ || exit 1", "定期检测容器健康状态", "Check container health"],
  ];

  var SYSTEM_CMDS = [
    ["docker system df",  "查看磁盘占用", "docker system df", "查看镜像/容器/卷占用空间", "Show disk usage"],
    ["docker system prune", "清理未用资源", "docker system prune -a", "删除停止容器、悬空镜像等；-a 全清", "Remove unused resources"],
    ["docker system prune -f", "免确认清理", "docker system prune -a -f", "跳过确认提示", "Prune without prompt"],
    ["docker info",       "查看系统信息", "docker info", "Docker 版本、存储驱动、镜像数量", "Show system-wide info"],
    ["docker version",    "查看版本", "docker version", "客户端与服务端版本", "Show client and server versions"],
    ["docker login",      "登录仓库", "docker login registry.example.com", "登录镜像仓库", "Log in to a registry"],
  ];

  // 常用地址：Each group item: [name, url, description (zh), description (en)]
  var LINKS = [
    {
      i18n: "docker.linksOfficial",
      items: [
        ["Docker 官网", "https://www.docker.com", "Docker 官方主页", "Official Docker home page"],
        ["Docker 文档", "https://docs.docker.com", "官方文档中心", "Official documentation hub"],
        ["Docker Hub", "https://hub.docker.com", "官方镜像仓库", "Official image registry"],
        ["Dockerfile 参考", "https://docs.docker.com/reference/dockerfile/", "Dockerfile 指令官方参考", "Official Dockerfile reference"],
        ["Docker Compose 文档", "https://docs.docker.com/compose/", "Compose 官方文档", "Official Compose documentation"],
      ],
    },
    {
      i18n: "docker.linksMirror",
      items: [
        ["DockerHub 镜像加速器集合", "https://github.com/dongyubin/DockerHub", "常用公共镜像加速地址汇总 (GitHub)", "Curated list of public registry mirrors"],
        ["腾讯云 Docker 镜像加速教程", "https://cloud.tencent.com/developer/article/2485043", "腾讯云开发者：Docker 镜像加速配置参考", "Tencent Cloud guide to registry acceleration"],
        ["1ms.run 镜像加速", "https://1ms.run", "1ms.run 公共镜像加速服务", "1ms.run public mirror acceleration service"],
      ],
    },
    {
      i18n: "docker.linksPractice",
      items: [
        ["Play with Docker", "https://labs.play-with-docker.com", "免费在线 Docker 练习环境", "Free online Docker lab"],
      ],
    },
  ];

  // "全部" tab = merge of all categories
  var ALL_CMDS = [].concat(IMAGE_CMDS, CONTAINER_CMDS, RUN_CMDS, NETWORK_CMDS, VOLUME_CMDS, COMPOSE_CMDS, DOCKERFILE_CMDS, SYSTEM_CMDS);

  var TABS = [
    { id: "all",    i18n: "docker.all",    data: ALL_CMDS },
    { id: "image",  i18n: "docker.image",  data: IMAGE_CMDS },
    { id: "container", i18n: "docker.container", data: CONTAINER_CMDS },
    { id: "run",    i18n: "docker.run",    data: RUN_CMDS },
    { id: "network", i18n: "docker.network", data: NETWORK_CMDS },
    { id: "volume", i18n: "docker.volume", data: VOLUME_CMDS },
    { id: "compose", i18n: "docker.compose", data: COMPOSE_CMDS },
    { id: "dockerfile", i18n: "docker.dockerfile", data: DOCKERFILE_CMDS },
    { id: "system", i18n: "docker.system", data: SYSTEM_CMDS },
    { id: "links",  i18n: "docker.links",  data: LINKS, links: true },
  ];

  // ═══ Build ═══

  function buildLinks(groups) {
    var h = '';
    groups.forEach(function (g) {
      h += '<h3 class="at-group-title">' + t(g.i18n) + '</h3>';
      h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("docker.linkName") + '</th><th>' + t("docker.linkDesc") + '</th><th>' + t("docker.linkUrl") + '</th></tr></thead><tbody>';
      g.items.forEach(function (it) {
        h += '<tr><td><strong>' + it[0] + '</strong></td>';
        h += '<td>' + it[2] + '<br><span class="at-muted">' + it[3] + '</span></td>';
        h += '<td><a href="' + it[1] + '" target="_blank" rel="noopener noreferrer">' + it[1] + '</a></td></tr>';
      });
      h += '</tbody></table></div>';
    });
    return h;
  }

  function buildTable(data, searchId, tabId) {
    var h = '<div class="at-search-wrap"><input id="' + searchId + '" class="search-input" type="text" placeholder="' + t("docker.searchPlaceholder") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("docker.command") + '</th><th>' + t("docker.description") + '</th><th>' + t("docker.example") + '</th><th>' + t("docker.note") + '</th></tr></thead><tbody id="dbody-' + tabId + '">';
    data.forEach(function (r, idx) {
      var searchData = r.join(" ").toLowerCase();
      h += '<tr data-idx="' + idx + '" data-search="' + searchData + '">';
      h += '<td><code>' + r[0] + '</code></td>';
      h += '<td>' + r[1] + '<br><span class="at-muted">' + r[4] + '</span></td>';
      h += '<td data-copy="' + escapeHtml(r[2]) + '"><code>' + escapeHtml(r[2]) + '</code></td>';
      h += '<td class="at-muted">' + r[3] + '</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Init ═══

  var activeTabId = "all";

  function init(parent) {
    var h = '<div class="b64-tool">';
    h += '<div class="b64-tabs">';
    TABS.forEach(function (tab, i) {
      h += '<button class="b64-tab' + (i === 0 ? ' active' : '') + '" data-dtab="' + tab.id + '">' + t(tab.i18n) + '</button>';
    });
    h += '</div>';

    TABS.forEach(function (tab, i) {
      var body = tab.links ? buildLinks(tab.data) : buildTable(tab.data, "dsearch-" + tab.id, tab.id);
      h += '<div id="dtab-' + tab.id + '" class="android-section' + (i === 0 ? '' : ' hidden') + '">' + body + '</div>';
    });

    h += '</div>';
    parent.innerHTML = h;

    document.querySelectorAll(".b64-tab[data-dtab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchDTab(this.dataset.dtab);
      });
    });

    parent.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var el = e.target.closest("[data-copy]");
      if (!el) return;
      navigator.clipboard.writeText(el.dataset.copy).then(function () {
        showCopyToast("✓ " + t("docker.copied"));
      });
    });

    TABS.forEach(function (tab) {
      var input = document.getElementById("dsearch-" + tab.id);
      if (!input) return;
      input.addEventListener("input", function () {
        var q = this.value.toLowerCase();
        document.querySelectorAll("#dbody-" + tab.id + " tr").forEach(function (tr) {
          tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
        });
      });
    });
  }

  function switchDTab(name) {
    activeTabId = name;
    document.querySelectorAll(".b64-tab[data-dtab]").forEach(function (b) {
      b.className = "b64-tab" + (b.dataset.dtab === name ? " active" : "");
    });
    document.querySelectorAll("[id^='dtab-']").forEach(function (s) {
      s.classList.toggle("hidden", s.id !== "dtab-" + name);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  return { init: init };
})();
