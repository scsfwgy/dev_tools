// Mind Map — XMind-style visual editor via Mind Elixir v5 (MIT).
var MindmapTool = (function () {
  "use strict";

  // Mind Elixir v5: JS bundle + separate stylesheet (CSS is no longer auto-injected).
  var ME_JS  = "https://cdn.jsdelivr.net/npm/mind-elixir@5/dist/MindElixir.js";
  var ME_CSS = "https://cdn.jsdelivr.net/npm/mind-elixir@5/dist/style.css";

  var container = null;
  var mind = null;
  var rootId = null;
  var resizeObserver = null;
  var themeObserver = null;
  var isFullscreen = false;
  var uid = 0;
  var meLoaded = false;  // reset on script reload → always picks up new ME version

  function t(key) {
    return (window.__t && window.__t(key)) || key;
  }

  function ensureCss() {
    if (document.getElementById("mindmap-elixir-css")) return;
    var link = document.createElement("link");
    link.id = "mindmap-elixir-css";
    link.rel = "stylesheet";
    link.href = ME_CSS;
    document.head.appendChild(link);
  }

  function loadMindElixir(cb) {
    ensureCss();
    // meLoaded resets on script reload, so version upgrades always re-import.
    if (meLoaded && window.MindElixir) return cb();
    import(ME_JS).then(function (mod) {
      window.MindElixir = mod.default || mod;
      meLoaded = true;
      cb();
    }).catch(function () {
      var el = container && container.querySelector("#mindmap-loading");
      if (el) { el.textContent = t("mindmap.loadFailed"); el.style.color = "var(--chart-red)"; }
    });
  }

  // Map the site's theme tokens onto Mind Elixir's cssVar so the map follows dark/light.
  function buildTheme() {
    var cs = getComputedStyle(document.documentElement);
    function v(name, fallback) {
      var val = cs.getPropertyValue(name);
      return (val && val.trim()) || fallback;
    }
    var accent = v("--accent", "#4f8cff");
    return {
      name: "site",
      palette: [accent, v("--chart-green", "#37b679"), v("--chart-red", "#e5484d"),
                v("--text-secondary", "#8a94a6"), accent, v("--chart-green", "#37b679")],
      cssVar: {
        "--main-color": v("--text", "#e6e9ef"),
        "--main-bgcolor": v("--bg-card", "#1b1f27"),
        "--main-radius": "24px",
        "--color": v("--text-secondary", "#c2c8d2"),
        "--bgcolor": v("--bg", "#12151b"),
        "--panel-color": v("--text", "#e6e9ef"),
        "--panel-bgcolor": v("--bg-card", "#1b1f27"),
        "--panel-border-color": v("--border", "#2a2f3a"),
        "--root-color": v("--bg", "#12151b"),
        "--root-bgcolor": accent,
        "--root-border-color": accent,
        "--root-radius": "28px",
        "--selected": accent,
        "--sub-bgcolor": v("--select-bg", "#222733"),
        "--topic-padding": "6px 15px",
        "--node-gap-x": "18px",
        "--node-gap-y": "8px",
      },
    };
  }

  function applyTheme() {
    if (!mind) return;
    try { mind.changeTheme(buildTheme()); } catch (_) {}
  }

  function node(topic) { return { topic: topic, id: "me" + (++uid) }; }

  function initMindMap() {
    var el = container.querySelector("#mindmap-container");
    if (!el || !window.MindElixir) return;
    try {
      var root = node(t("mindmap.rootNode"));
      rootId = root.id;
      root.children = [
        node(t("mindmap.child1")), node(t("mindmap.child2")), node(t("mindmap.child3")),
      ];
      root.children[0].children = [node(t("mindmap.grandchild1")), node(t("mindmap.grandchild2"))];
      root.children[1].children = [node(t("mindmap.grandchild3"))];

      mind = new window.MindElixir({
        el: el,
        direction: window.MindElixir.SIDE,
        draggable: true,      // drag nodes to re-parent
        contextMenu: {
          focus: true,
          link: true,
          extend: [
            { name: t("mindmap.addChild"), onclick: function () { addChild(); } },
            { name: t("mindmap.addSibling"), onclick: function () { addSibling(); } },
            { name: t("mindmap.rename"), onclick: function () { renameNode(); } },
            { name: t("mindmap.remove"), onclick: function () { removeNode(); } },
          ],
        },
        toolBar: true,        // built-in zoom / center toolbar
        nodeMenu: true,       // style panel for selected node
        keypress: true,
        theme: buildTheme(),
      });
      mind.init({ nodeData: root });

      // Inline "+" / "→" buttons on the selected node.
      function renderSelButtons() {
        clearNodeButtons();
        if (!mind.currentNode) return;
        var cur = mind.currentNode;
        if (cur.nodeObj && cur.nodeObj.id) {
          var el = mind.findEl(cur.nodeObj.id);
          if (el) showNodeButtons(el, cur.nodeObj.id);
        }
      }
      mind.bus.addListener("selectNodes", renderSelButtons);
      // Re-attach after operations that may re-render DOM (e.g. finish edit).
      mind.bus.addListener("operation", function (op) {
        if (op && op.name === "finishEdit") setTimeout(renderSelButtons, 30);
      });

      // XMind-style: floating "+" button that follows hovered node.
      var floatPlus = document.createElement("button");
      floatPlus.className = "mindmap-float-plus";
      floatPlus.textContent = "+";
      floatPlus.title = t("mindmap.addChild");
      var hoveredParent = null;
      floatPlus.addEventListener("mousedown", function (ev) {
        ev.stopPropagation(); ev.preventDefault();
        if (hoveredParent && mind) {
          try { mind.selectNode(hoveredParent); } catch (_) {}
        }
        addChild();
      });
      var stageEl = container.querySelector("#mindmap-stage");
      stageEl.appendChild(floatPlus);
      el.addEventListener("mousemove", function (ev) {
        var tpc = ev.target.closest("me-tpc");
        if (!tpc || !stageEl) { floatPlus.style.display = "none"; hoveredParent = null; return; }
        hoveredParent = tpc.closest("me-parent");
        var r = tpc.getBoundingClientRect();
        var sr = stageEl.getBoundingClientRect();
        var x = r.right - sr.left + 3;
        var y = r.top - sr.top + r.height / 2 - 11;
        if (x < 0 || x > sr.width || y < 0 || y > sr.height) { floatPlus.style.display = "none"; return; }
        floatPlus.style.display = "";
        floatPlus.style.transform = "translate(" + x + "px, " + y + "px)";
      });
      el.addEventListener("mouseleave", function () { floatPlus.style.display = "none"; hoveredParent = null; });

      var loading = container.querySelector("#mindmap-loading");
      if (loading) loading.hidden = true;

      // Follow site theme switches at runtime.
      themeObserver = new MutationObserver(applyTheme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch (e) {
      var loadEl = container.querySelector("#mindmap-loading");
      if (loadEl) { loadEl.textContent = t("mindmap.loadFailed"); loadEl.style.color = "var(--chart-red)"; }
    }
  }

  // Inline "+" / "→" buttons on the selected node.
  function clearNodeButtons() {
    var all = container.querySelectorAll(".mindmap-inline-btn");
    for (var i = 0; i < all.length; i++) all[i].remove();
  }
  function showNodeButtons(el, id) {
    var span = document.createElement("span");
    span.className = "mindmap-inline-btns";
    var childBtn = document.createElement("button");
    childBtn.className = "mindmap-inline-btn";
    childBtn.textContent = "+";
    childBtn.title = t("mindmap.addChild");
    childBtn.addEventListener("mousedown", function (e) {
      e.stopPropagation(); e.preventDefault();
      addChild();
    });
    var sibBtn = document.createElement("button");
    sibBtn.className = "mindmap-inline-btn";
    sibBtn.textContent = "→";
    sibBtn.title = t("mindmap.addSibling");
    sibBtn.addEventListener("mousedown", function (e) {
      e.stopPropagation(); e.preventDefault();
      addSibling();
    });
    span.appendChild(childBtn);
    span.appendChild(sibBtn);
    el.appendChild(span);
  }

  // Resolve the node to act on: the selected one, else the root.
  function activeEl() {
    if (mind && mind.currentNode) return mind.currentNode;
    if (mind && rootId) {
      var el = mind.findEl ? mind.findEl(rootId) : null;
      if (el) { try { mind.selectNode(el); } catch (_) {} return el; }
    }
    return null;
  }

  function countNodes() {
    try {
      var data = mind.getData ? mind.getData() : mind.getAllData();
      var n = 0;
      (function walk(d) { if (!d) return; n++; (d.children || []).forEach(walk); })(data.nodeData);
      return n;
    } catch (_) { return -1; }
  }

  function showHint(key) {
    var hint = container && container.querySelector("#mindmap-hint");
    if (!hint) return;
    hint.textContent = t(key);
    hint.classList.add("is-visible");
    clearTimeout(showHint._tm);
    showHint._tm = setTimeout(function () { hint.classList.remove("is-visible"); }, 2600);
  }

  // Run an add op and verify it took effect; hint the user if nothing changed.
  function runAdd(fn) {
    if (!mind) return;
    var before = countNodes();
    var el = activeEl();
    if (!el) { showHint("mindmap.hintSelect"); return; }
    try { fn(el); } catch (_) {}
    if (countNodes() === before) showHint("mindmap.hintSelect");
  }

  function addChild()   { runAdd(function () { mind.addChild(); }); }
  function addSibling() { runAdd(function () { mind.insertSibling(); }); }
  function renameNode() {
    if (!mind) return;
    var el = activeEl();
    if (!el) { showHint("mindmap.hintSelect"); return; }
    try { mind.beginEdit(el); } catch (_) {}
  }
  function removeNode() {
    if (!mind) return;
    var el = activeEl();
    if (!el || (rootId && el.nodeObj && el.nodeObj.id === rootId)) { showHint("mindmap.hintRoot"); return; }
    try { mind.removeNodes ? mind.removeNodes([el]) : mind.removeNode(el); } catch (_) {}
  }

  function resizeStage() {
    var stage = container && container.querySelector("#mindmap-stage");
    var mapEl = container && container.querySelector("#mindmap-container");
    if (!stage) return;
    if (isFullscreen) {
      // In fullscreen the stage is fixed inset:0 100dvh. The toolbar is 50px.
      // Give mind-elixir an explicit pixel height it can measure.
      stage.style.height = "";
      if (mapEl) mapEl.style.height = (window.innerHeight - 50) + "px";
      return;
    }
    var h = window.innerHeight - stage.getBoundingClientRect().top - 20;
    stage.style.height = h + "px";
    if (mapEl) mapEl.style.height = stage.clientHeight + "px";
  }

  function toggleFullscreen() {
    var stage = container.querySelector("#mindmap-stage");
    if (!stage) return;
    isFullscreen = !isFullscreen;
    stage.classList.toggle("is-viewport-fullscreen", isFullscreen);
    stage.classList.toggle("is-fullscreen", isFullscreen);
    document.body.classList.toggle("ball-game-fullscreen-active", isFullscreen);
    container.querySelector("#mindmap-fullscreen").setAttribute("aria-pressed", String(isFullscreen));
    resizeStage();
    // Help mind-elixir pick up the new container size after the layout settles.
    if (mind) {
      setTimeout(function () {
        try {
          if (mind.toCenter) mind.toCenter();
          window.dispatchEvent(new Event("resize"));
        } catch (_) {}
      }, 120);
    }
  }

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPng() {
    if (!mind || typeof mind.exportPng !== "function") { showHint("mindmap.pngUnavailable"); return; }
    try {
      var out = mind.exportPng(false);
      if (out && typeof out.then === "function") {
        out.then(function (blob) { if (blob) saveBlob(blob, "mindmap.png"); });
      } else if (out instanceof Blob) {
        saveBlob(out, "mindmap.png");
      }
    } catch (_) { showHint("mindmap.pngUnavailable"); }
  }

  function downloadJson() {
    if (!mind) return;
    try {
      var data = mind.getData ? mind.getData() : mind.getAllData();
      saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "mindmap.json");
    } catch (_) {}
  }

  function handleKeydownGlobal(e) {
    if (e.key === "Escape" && container && isFullscreen) toggleFullscreen();
  }

  function on(id, fn) {
    var el = container.querySelector(id);
    if (el) el.addEventListener("click", fn);
  }

  function bindEvents() {
    on("#mindmap-add-child", addChild);
    on("#mindmap-add-sibling", addSibling);
    on("#mindmap-rename", renameNode);
    on("#mindmap-remove", removeNode);
    on("#mindmap-download-png", downloadPng);
    on("#mindmap-download-json", downloadJson);
    on("#mindmap-fullscreen", toggleFullscreen);
    on("#mindmap-exit-fullscreen", toggleFullscreen);
    document.addEventListener("keydown", handleKeydownGlobal);
    resizeObserver = new ResizeObserver(resizeStage);
    resizeObserver.observe(document.body);
  }

  function init(element) {
    deactivate();
    container = element;
    container.innerHTML =
      '<div class="ball-game-tool mindmap-tool">' +
        '<div class="ball-game-layout">' +
          '<aside class="ball-game-config">' +
            '<h3>' + t("mindmap.guideTitle") + '</h3>' +
            '<p class="math-curiosities-desc">' + t("mindmap.guideText") + '</p>' +
            '<div class="mindmap-ops">' +
              '<button id="mindmap-add-child" class="ball-game-primary" type="button">' + t("mindmap.addChild") + '</button>' +
              '<button id="mindmap-add-sibling" type="button">' + t("mindmap.addSibling") + '</button>' +
              '<button id="mindmap-rename" type="button">' + t("mindmap.rename") + '</button>' +
              '<button id="mindmap-remove" type="button">' + t("mindmap.remove") + '</button>' +
            '</div>' +
            '<p id="mindmap-hint" class="mindmap-hint" role="status" aria-live="polite"></p>' +
            '<ul class="mindmap-shortcuts">' +
              '<li><kbd>Tab</kbd> ' + t("mindmap.shortcutTab") + '</li>' +
              '<li><kbd>Enter</kbd> ' + t("mindmap.shortcutEnter") + '</li>' +
              '<li><kbd>F2</kbd> / ' + t("mindmap.shortcutDblclick") + '</li>' +
              '<li>' + t("mindmap.shortcutDrag") + '</li>' +
              '<li>' + t("mindmap.shortcutZoom") + '</li>' +
            '</ul>' +
            '<div class="ball-game-actions">' +
              '<button id="mindmap-download-png" type="button">' + t("mindmap.downloadPng") + '</button>' +
              '<button id="mindmap-download-json" type="button">' + t("mindmap.downloadJson") + '</button>' +
              '<button id="mindmap-fullscreen" type="button" aria-pressed="false" style="grid-column:1/-1">' + t("fishGame.fullscreen") + '</button>' +
            '</div>' +
          '</aside>' +
          '<main id="mindmap-stage" class="ball-game-stage-card mindmap-stage">' +
            '<div class="ball-game-fullscreen-toolbar"><span>' + t("mindmap.fullscreenTitle") + '</span><button id="mindmap-exit-fullscreen" type="button">' + t("fishGame.exitFullscreen") + '</button></div>' +
            '<div id="mindmap-loading" class="mindmap-loading">' + t("mindmap.loading") + '</div>' +
            '<div id="mindmap-container" class="mindmap-container"></div>' +
          '</main>' +
        '</div>' +
      '</div>';

    resizeStage();
    loadMindElixir(function () {
      initMindMap();
      bindEvents();
      resizeStage();
    });
  }

  function deactivate() {
    document.removeEventListener("keydown", handleKeydownGlobal);
    document.body.classList.remove("ball-game-fullscreen-active");
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (themeObserver) { themeObserver.disconnect(); themeObserver = null; }
    if (mind) { try { mind.destroy && mind.destroy(); } catch (_) {} mind = null; }
    container = null;
    rootId = null;
    isFullscreen = false;
  }

  return { init: init, deactivate: deactivate };
})();
