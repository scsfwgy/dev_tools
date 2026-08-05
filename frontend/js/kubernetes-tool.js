// Kubernetes Tool — common kubectl commands reference with search and copy.
var KubernetesTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  // Each: [command, description (zh), example, note, description (en)]

  var BASIC_CMDS = [
    ["kubectl version",   "查看版本", "kubectl version --client", "查看客户端与服务端版本", "Show client and server versions"],
    ["kubectl cluster-info", "集群信息", "kubectl cluster-info", "查看集群服务地址", "Show cluster info"],
    ["kubectl get",       "获取资源", "kubectl get pods", "常用资源：pods / deployments / svc / nodes", "List resources"],
    ["kubectl get -o wide", "详细输出", "kubectl get pods -o wide", "显示节点、Pod IP 等更多信息", "Verbose list with node/IP"],
    ["kubectl describe",  "查看详情", "kubectl describe pod my-pod", "查看资源详情与事件", "Show detailed info and events"],
    ["kubectl apply",     "创建 / 更新", "kubectl apply -f deploy.yaml", "声明式应用 YAML 配置", "Apply declarative config"],
    ["kubectl delete",    "删除资源", "kubectl delete pod my-pod", "按名称或 -f 文件删除", "Delete resources"],
    ["kubectl edit",      "编辑资源", "kubectl edit deploy nginx", "在线编辑并立即应用", "Edit a resource live"],
    ["kubectl explain",   "查看字段说明", "kubectl explain pod.spec", "查看资源字段含义与结构", "Explain resource fields"],
  ];

  var POD_CMDS = [
    ["kubectl run",       "创建 Pod", "kubectl run nginx --image=nginx", "快速创建单 Pod", "Create a pod"],
    ["kubectl get pod",   "列出 Pod", "kubectl get pods -n kube-system", "-n 指定命名空间", "List pods in a namespace"],
    ["kubectl logs",      "查看日志", "kubectl logs -f my-pod", "-f 跟随输出，--tail 控制条数", "Tail pod logs"],
    ["kubectl logs -c",   "指定容器日志", "kubectl logs -f my-pod -c sidecar", "-c 指定容器名", "Logs for a specific container"],
    ["kubectl exec",      "执行命令", "kubectl exec -it my-pod -- sh", "-- 后跟容器内命令", "Run a command inside a pod"],
    ["kubectl port-forward", "端口转发", "kubectl port-forward my-pod 8080:80", "本地端口访问集群内服务", "Forward a local port to a pod"],
    ["kubectl delete pod", "删除 Pod", "kubectl delete pod --all", "--all 删除当前命名空间全部 Pod", "Delete pods"],
    ["kubectl cp",        "拷贝文件", "kubectl cp my-pod:/app/log.txt ./", "Pod 与本地之间互拷文件", "Copy files to or from a pod"],
    ["kubectl get pod -w", "观察变化", "kubectl get pods -w", "-w 实时监控 Pod 状态", "Watch pod changes"],
  ];

  var WORKLOAD_CMDS = [
    ["kubectl create deployment", "创建 Deployment", "kubectl create deployment web --image=nginx", "创建 Deployment 并调度副本", "Create a deployment"],
    ["kubectl scale",     "扩缩容", "kubectl scale deploy web --replicas=5", "调整副本数量", "Scale replicas"],
    ["kubectl set image", "更新镜像", "kubectl set image deploy/web web=nginx:1.21", "触发滚动更新", "Update a container image"],
    ["kubectl rollout status", "查看发布状态", "kubectl rollout status deploy/web", "等待滚动发布完成", "Watch rollout status"],
    ["kubectl rollout history", "发布历史", "kubectl rollout history deploy/web", "查看历史发布版本", "Show rollout history"],
    ["kubectl rollout undo", "回滚发布", "kubectl rollout undo deploy/web --to-revision=2", "回滚到指定版本", "Roll back a deployment"],
    ["kubectl rollout restart", "重启工作负载", "kubectl rollout restart deploy/web", "滚动重启全部 Pod", "Restart all pods"],
    ["kubectl get deploy", "查看 Deployment", "kubectl get deploy -A", "-A 查看所有命名空间", "List deployments"],
    ["kubectl autoscale", "自动伸缩", "kubectl autoscale deploy web --min=2 --max=10 --cpu-percent=80", "创建 HPA 按 CPU 自动伸缩", "Autoscale by CPU usage"],
  ];

  var SERVICE_CMDS = [
    ["kubectl expose",    "暴露服务", "kubectl expose deploy web --port=80 --type=NodePort", "创建 Service 对外暴露应用", "Expose a deployment"],
    ["kubectl get svc",   "查看服务", "kubectl get svc", "类型：ClusterIP / NodePort / LoadBalancer", "List services"],
    ["kubectl get ingress", "查看 Ingress", "kubectl get ingress", "查看入口路由规则", "List ingresses"],
    ["kubectl describe svc", "服务详情", "kubectl describe svc web", "查看 Endpoints 后端地址", "Show service details"],
    ["kubectl get endpoints", "查看端点", "kubectl get endpoints", "查看服务对应的 Pod 地址", "List service endpoints"],
    ["kubectl create service", "创建 Service", "kubectl create service clusterip web --tcp=80:80", "按命令行创建 Service", "Create a Service"],
    ["kubectl delete svc", "删除服务", "kubectl delete svc web", "删除 Service", "Delete a service"],
    ["kubectl get nodes", "查看节点", "kubectl get nodes -o wide", "查看节点状态、IP 与角色", "List cluster nodes"],
  ];

  var CONFIG_CMDS = [
    ["kubectl create configmap", "创建 ConfigMap", "kubectl create configmap app-config --from-file=config.yaml", "从文件或 --from-literal 创建", "Create a ConfigMap"],
    ["kubectl get configmap", "查看 ConfigMap", "kubectl get configmap", "列出所有 ConfigMap", "List ConfigMaps"],
    ["kubectl create secret generic", "创建 Secret", "kubectl create secret generic db-pass --from-literal=password=xxx", "创建通用类型 Secret", "Create a generic Secret"],
    ["kubectl get secret", "查看 Secret", "kubectl get secret", "列出所有 Secret", "List Secrets"],
    ["kubectl get secret -o yaml", "查看 Secret 内容", "kubectl get secret db-pass -o yaml", "value 为 base64 编码", "View a Secret as YAML"],
    ["kubectl create secret tls", "创建 TLS Secret", "kubectl create secret tls tls-cert --cert=cert.pem --key=key.pem", "为 Ingress 提供 TLS 证书", "Create a TLS Secret"],
    ["kubectl get cm,secret", "批量查看", "kubectl get cm,secret", "一次查看 ConfigMap 与 Secret", "List configs and secrets"],
  ];

  var STORAGE_CMDS = [
    ["kubectl get pv",    "查看 PV", "kubectl get pv", "查看持久卷", "List persistent volumes"],
    ["kubectl get pvc",   "查看 PVC", "kubectl get pvc", "查看持久卷声明", "List persistent volume claims"],
    ["kubectl get storageclass", "查看存储类", "kubectl get storageclass", "查看动态供给存储类", "List storage classes"],
    ["kubectl describe pvc", "PVC 详情", "kubectl describe pvc data-pvc", "查看绑定状态、容量与访问模式", "Inspect a PVC"],
    ["kubectl delete pvc", "删除 PVC", "kubectl delete pvc data-pvc", "⚠ 可能同时删除底层数据", "Delete a PVC"],
  ];

  var RBAC_CMDS = [
    ["kubectl get ns",    "查看命名空间", "kubectl get ns", "列出所有命名空间", "List namespaces"],
    ["kubectl create ns", "创建命名空间", "kubectl create ns staging", "创建命名空间", "Create a namespace"],
    ["kubectl config use-context", "切换上下文", "kubectl config use-context cluster-prod", "切换 kubeconfig 中的上下文", "Switch cluster context"],
    ["kubectl get sa",    "查看服务账号", "kubectl get sa -A", "列出 ServiceAccount", "List service accounts"],
    ["kubectl create token", "生成 Token", "kubectl create token my-sa", "为服务账号生成临时 Token", "Create a service account token"],
    ["kubectl auth can-i", "权限检查", "kubectl auth can-i create deployments", "检查当前用户是否有权限", "Check current permissions"],
    ["kubectl get role,rolebinding", "查看 RBAC", "kubectl get role,rolebinding -n app", "查看角色与角色绑定", "List roles and bindings"],
  ];

  var OPS_CMDS = [
    ["kubectl get events", "查看事件", "kubectl get events --sort-by=.lastTimestamp", "排查问题的第一入口", "List cluster events"],
    ["kubectl top",       "资源占用", "kubectl top node && kubectl top pod", "需要已安装 metrics-server", "Show node and pod usage"],
    ["kubectl describe node", "节点详情", "kubectl describe node node-1", "查看节点状态、压力与问题", "Inspect a node"],
    ["kubectl logs -p",   "崩溃前日志", "kubectl logs my-pod --previous", "查看容器重启前的日志", "Logs from the previous container"],
    ["kubectl apply --dry-run", "试运行", "kubectl apply -f deploy.yaml --dry-run=client", "校验 YAML 但不真正应用", "Validate without applying"],
    ["kubectl diff",      "对比变更", "kubectl diff -f deploy.yaml", "预览将要发生的变更", "Show diff before applying"],
    ["kubectl delete -f", "按清单删除", "kubectl delete -f deploy.yaml", "删除文件中定义的所有资源", "Delete resources from a file"],
    ["kubectl drain",     "排空节点", "kubectl drain node-1 --ignore-daemonsets", "迁移节点上所有 Pod", "Drain a node"],
    ["kubectl cordon / uncordon", "暂停 / 恢复调度", "kubectl cordon node-1 && kubectl uncordon node-1", "标记节点不再调度新 Pod 后恢复", "Mark a node unschedulable and back"],
    ["kubectl taint",     "节点污点", "kubectl taint nodes node-1 key=value:NoSchedule", "控制哪些 Pod 能调度到节点", "Taint a node"],
  ];

  // 常用地址：Each group item: [name, url, description (zh), description (en)]
  var LINKS = [
    {
      i18n: "kubernetes.linksOfficial",
      items: [
        ["Kubernetes 官网", "https://kubernetes.io", "官方主页与文档", "Official home page and docs"],
        ["Kubernetes 中文文档", "https://kubernetes.io/zh-cn/", "官方中文文档", "Official Chinese documentation"],
        ["kubectl 速查表", "https://kubernetes.io/docs/reference/kubectl/cheatsheet/", "官方 kubectl Cheat Sheet", "Official kubectl cheat sheet"],
        ["kubectl 命令参考", "https://kubernetes.io/docs/reference/kubectl/", "全部 kubectl 命令索引", "Full kubectl command index"],
        ["Kubernetes API 参考", "https://kubernetes.io/docs/reference/kubernetes-api/", "资源对象 API 参考", "Resource API reference"],
      ],
    },
    {
      i18n: "kubernetes.linksTools",
      items: [
        ["Helm", "https://helm.sh", "Kubernetes 包管理工具", "Kubernetes package manager"],
        ["K9s", "https://k9scli.io", "终端 Kubernetes UI", "Terminal UI for managing Kubernetes"],
        ["Minikube", "https://minikube.sigs.k8s.io/docs/", "本地单机集群", "Local single-node cluster"],
        ["kubeadm", "https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/", "生产环境集群搭建", "Bootstrap production clusters"],
        ["Kuboard", "https://www.kuboard.cn", "国内常用 K8s 图形化运维与学习", "Popular Chinese K8s web UI and learning site"],
      ],
    },
    {
      i18n: "kubernetes.linksPractice",
      items: [
        ["Play with Kubernetes", "https://labs.play-with-k8s.com", "免费在线 K8s 练习环境", "Free online Kubernetes lab"],
      ],
    },
  ];

  // "全部" tab = merge of all categories
  var ALL_CMDS = [].concat(BASIC_CMDS, POD_CMDS, WORKLOAD_CMDS, SERVICE_CMDS, CONFIG_CMDS, STORAGE_CMDS, RBAC_CMDS, OPS_CMDS);

  var TABS = [
    { id: "all",    i18n: "kubernetes.all",    data: ALL_CMDS },
    { id: "basic",  i18n: "kubernetes.basic",  data: BASIC_CMDS },
    { id: "pod",    i18n: "kubernetes.pod",    data: POD_CMDS },
    { id: "workload", i18n: "kubernetes.workload", data: WORKLOAD_CMDS },
    { id: "service", i18n: "kubernetes.service", data: SERVICE_CMDS },
    { id: "config", i18n: "kubernetes.config", data: CONFIG_CMDS },
    { id: "storage", i18n: "kubernetes.storage", data: STORAGE_CMDS },
    { id: "rbac",   i18n: "kubernetes.rbac",   data: RBAC_CMDS },
    { id: "ops",    i18n: "kubernetes.ops",    data: OPS_CMDS },
    { id: "links",  i18n: "kubernetes.links",  data: LINKS, links: true },
  ];

  // ═══ Build ═══

  function buildLinks(groups) {
    var h = '';
    groups.forEach(function (g) {
      h += '<h3 class="at-group-title">' + t(g.i18n) + '</h3>';
      h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("kubernetes.linkName") + '</th><th>' + t("kubernetes.linkDesc") + '</th><th>' + t("kubernetes.linkUrl") + '</th></tr></thead><tbody>';
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
    var h = '<div class="at-search-wrap"><input id="' + searchId + '" class="search-input" type="text" placeholder="' + t("kubernetes.searchPlaceholder") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("kubernetes.command") + '</th><th>' + t("kubernetes.description") + '</th><th>' + t("kubernetes.example") + '</th><th>' + t("kubernetes.note") + '</th></tr></thead><tbody id="kbody-' + tabId + '">';
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
      h += '<button class="b64-tab' + (i === 0 ? ' active' : '') + '" data-ktab="' + tab.id + '">' + t(tab.i18n) + '</button>';
    });
    h += '</div>';

    TABS.forEach(function (tab, i) {
      var body = tab.links ? buildLinks(tab.data) : buildTable(tab.data, "ksearch-" + tab.id, tab.id);
      h += '<div id="ktab-' + tab.id + '" class="android-section' + (i === 0 ? '' : ' hidden') + '">' + body + '</div>';
    });

    h += '</div>';
    parent.innerHTML = h;

    document.querySelectorAll(".b64-tab[data-ktab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchKTab(this.dataset.ktab);
      });
    });

    parent.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var el = e.target.closest("[data-copy]");
      if (!el) return;
      navigator.clipboard.writeText(el.dataset.copy).then(function () {
        showCopyToast("✓ " + t("kubernetes.copied"));
      });
    });

    TABS.forEach(function (tab) {
      var input = document.getElementById("ksearch-" + tab.id);
      if (!input) return;
      input.addEventListener("input", function () {
        var q = this.value.toLowerCase();
        document.querySelectorAll("#kbody-" + tab.id + " tr").forEach(function (tr) {
          tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
        });
      });
    });
  }

  function switchKTab(name) {
    activeTabId = name;
    document.querySelectorAll(".b64-tab[data-ktab]").forEach(function (b) {
      b.className = "b64-tab" + (b.dataset.ktab === name ? " active" : "");
    });
    document.querySelectorAll("[id^='ktab-']").forEach(function (s) {
      s.classList.toggle("hidden", s.id !== "ktab-" + name);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  return { init: init };
})();
