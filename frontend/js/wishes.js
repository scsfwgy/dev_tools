// Wish Wall — anonymous submissions with SVG CAPTCHA + admin moderation.
var WishTool = (function () {
  var captchaId = null, loaded = false;
  var WISHES_API = "/api/wishes";
  var ADMIN_KEY = "wishAdminToken";

  function t(key) { return (window.__t && window.__t(key)) || key; }

  function init(parent) {
    parent.innerHTML =
      '<div class="wish-tool">' +
      '  <div class="wish-header">' +
      '    <h2 class="wish-title">' + t("wishes.title") + '</h2>' +
      '    <button id="wish-admin-toggle" class="wish-admin-toggle" title="' + t("wishes.manage") + '">&#9881;</button>' +
      '  </div>' +
      '  <div id="wish-admin-row" class="wish-admin-row" style="display:none">' +
      '    <span class="wish-admin-label">' + t("wishes.adminToken") + '</span>' +
      '    <input type="password" id="wish-admin-token" class="wish-admin-input" placeholder="' + t("wishes.adminPlaceholder") + '">' +
      '    <button id="wish-admin-save" class="jt-btn">' + t("wishes.save") + '</button>' +
      '    <span id="wish-admin-hint" class="wish-admin-hint"></span>' +
      '  </div>' +
      '  <div class="wish-form">' +
      '    <textarea id="wish-text" class="wish-textarea" maxlength="200" placeholder="' + t("wishes.placeholder") + '"></textarea>' +
      '    <div class="wish-form-row">' +
      '      <input type="text" id="wish-nick" class="wish-nick" maxlength="24" placeholder="' + t("wishes.nickname") + '">' +
      '      <span id="wish-captcha-box" class="wish-captcha-box" title="' + t("wishes.captchaHint") + '"></span>' +
      '      <input type="text" id="wish-captcha-input" class="wish-captcha-input" maxlength="8" placeholder="' + t("wishes.captcha") + '" style="text-transform:uppercase">' +
      '      <button id="wish-submit" class="jt-btn jt-btn-primary">' + t("wishes.submit") + '</button>' +
      '    </div>' +
      '    <div id="wish-msg" class="wish-msg" style="display:none"></div>' +
      '  </div>' +
      '  <div id="wish-loading" class="wish-loading">...</div>' +
      '  <div id="wish-empty" class="wish-empty" style="display:none">' + t("wishes.empty") + '</div>' +
      '  <div id="wish-list" class="wish-list"></div>' +
      '</div>';

    document.getElementById("wish-submit").addEventListener("click", submitWish);
    document.getElementById("wish-captcha-box").addEventListener("click", loadCaptcha);
    initAdmin();
    loadCaptcha();
    loadWishes();
  }

  // ── admin ──
  function getAdminToken() { return sessionStorage.getItem(ADMIN_KEY) || ""; }

  function initAdmin() {
    document.getElementById("wish-admin-toggle").addEventListener("click", function () {
      var row = document.getElementById("wish-admin-row");
      row.style.display = row.style.display === "none" ? "flex" : "none";
    });
    document.getElementById("wish-admin-save").addEventListener("click", function () {
      var val = document.getElementById("wish-admin-token").value.trim();
      var hint = document.getElementById("wish-admin-hint");
      if (!val) { sessionStorage.removeItem(ADMIN_KEY); hint.textContent = ""; loadWishes(); return; }
      var btn = document.getElementById("wish-admin-save");
      btn.disabled = true;
      hint.textContent = t("wishes.verifying");
      fetch(WISHES_API + "/verify-admin", { method: "POST", headers: { "X-Admin-Token": val } })
        .then(function (r) {
          if (!r.ok) throw new Error(t("wishes.invalidToken"));
          sessionStorage.setItem(ADMIN_KEY, val);
          hint.textContent = t("wishes.adminEnabled");
          loadWishes();
        })
        .catch(function () { sessionStorage.removeItem(ADMIN_KEY); hint.textContent = t("wishes.invalidToken"); loadWishes(); })
        .finally(function () { btn.disabled = false; });
    });
  }

  // ── captcha ──
  function loadCaptcha() {
    var box = document.getElementById("wish-captcha-box");
    box.textContent = "...";
    fetch(WISHES_API + "/captcha")
      .then(function (r) { return r.json(); })
      .then(function (d) { captchaId = d.captcha_id; box.innerHTML = d.svg; })
      .catch(function () { box.textContent = t("wishes.loadFailed"); });
  }

  // ── wishes ──
  function loadWishes() {
    document.getElementById("wish-loading").style.display = "flex";
    document.getElementById("wish-empty").style.display = "none";
    fetch(WISHES_API)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        document.getElementById("wish-loading").style.display = "none";
        var list = document.getElementById("wish-list");
        list.innerHTML = "";
        var wishes = (d && d.wishes) || [];
        if (!wishes.length) { document.getElementById("wish-empty").style.display = "block"; return; }
        wishes.forEach(function (w) { list.appendChild(renderCard(w)); });
      })
      .catch(function () { document.getElementById("wish-loading").style.display = "none"; });
  }

  function renderCard(wish) {
    var card = document.createElement("div");
    card.className = "wish-card";

    var text = document.createElement("div");
    text.className = "wish-card-text";
    text.textContent = wish.text || "";
    card.appendChild(text);

    var meta = document.createElement("div");
    meta.className = "wish-card-meta";

    var nick = document.createElement("span");
    nick.className = "wish-card-nick";
    nick.textContent = wish.nick || t("wishes.anonymous");
    meta.appendChild(nick);

    var right = document.createElement("span");
    var time = document.createElement("span");
    time.textContent = formatTime(wish.ts);
    right.appendChild(time);

    if (getAdminToken()) {
      var del = document.createElement("span");
      del.className = "wish-card-del";
      del.textContent = "  " + t("wishes.delete");
      del.addEventListener("click", function () { deleteWish(wish.id); });
      right.appendChild(del);
    }
    meta.appendChild(right);
    card.appendChild(meta);

    // admin reply
    if (wish.reply) {
      var replyEl = document.createElement("div");
      replyEl.className = "wish-card-reply";
      replyEl.innerHTML = '<span class="wish-card-reply-label">' + t("wishes.adminReply") + '</span> ' +
        '<span class="wish-card-reply-text">' + esc(wish.reply) + '</span>' +
        (wish.reply_ts ? ' <span class="wish-card-reply-time">· ' + formatTime(wish.reply_ts) + '</span>' : '');
      card.appendChild(replyEl);
    }

    if (getAdminToken()) {
      var form = document.createElement("div");
      form.className = "wish-reply-form";
      form.innerHTML = '<input type="text" class="wish-reply-input" maxlength="200" value="' + esc(wish.reply || "") + '" placeholder="' + t("wishes.replyPlaceholder") + '">' +
        '<button class="jt-btn" style="font-size:12px;padding:4px 12px">' + (wish.reply ? t("wishes.updateReply") : t("wishes.reply")) + '</button>';
      form.querySelector("button").addEventListener("click", function () {
        replyWish(wish.id, form.querySelector("input").value, form.querySelector("button"));
      });
      card.appendChild(form);
    }

    return card;
  }

  function submitWish() {
    var text = document.getElementById("wish-text").value.trim();
    var nick = document.getElementById("wish-nick").value.trim();
    var answer = document.getElementById("wish-captcha-input").value.trim();
    if (!text) { showMsg(t("wishes.errorEmpty"), true); return; }
    if (!answer) { showMsg(t("wishes.errorCaptcha"), true); return; }

    var btn = document.getElementById("wish-submit");
    btn.disabled = true;
    fetch(WISHES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, nick: nick, captcha_id: captchaId, captcha_answer: answer }),
    })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || t("wishes.errorSubmit")); return d; }); })
      .then(function () {
        document.getElementById("wish-text").value = "";
        document.getElementById("wish-captcha-input").value = "";
        showMsg(t("wishes.success"), false);
        loadCaptcha();
        loadWishes();
      })
      .catch(function (e) { showMsg(e.message || t("wishes.errorSubmit"), true); loadCaptcha(); })
      .finally(function () { btn.disabled = false; });
  }

  function replyWish(wishId, text, btn) {
    var reply = (text || "").trim();
    if (!reply) { showMsg(t("wishes.errorReplyEmpty"), true); return; }
    if (btn) btn.disabled = true;
    fetch(WISHES_API + "/" + encodeURIComponent(wishId) + "/reply", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Admin-Token": getAdminToken() },
      body: JSON.stringify({ reply: reply }),
    })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || t("wishes.errorReply")); return d; }); })
      .then(function () { showMsg(t("wishes.replySuccess"), false); loadWishes(); })
      .catch(function (e) { showMsg(e.message || t("wishes.errorReply"), true); })
      .finally(function () { if (btn) btn.disabled = false; });
  }

  function deleteWish(wishId) {
    fetch(WISHES_API + "/" + encodeURIComponent(wishId), {
      method: "DELETE", headers: { "X-Admin-Token": getAdminToken() },
    })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || t("wishes.errorDelete")); return d; }); })
      .then(function () { loadWishes(); })
      .catch(function (e) { showMsg(e.message || t("wishes.errorDelete"), true); });
  }

  function showMsg(text, isError) {
    var el = document.getElementById("wish-msg");
    el.textContent = text;
    el.className = "wish-msg " + (isError ? "is-error" : "is-ok");
    el.style.display = "block";
  }

  function formatTime(ts) {
    if (!ts) return "";
    var d = new Date(ts * 1000);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  return { init: init };
})();
