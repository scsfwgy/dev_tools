"""Visit and tool stats routes."""
import html
import json
import time

from flask import Blueprint, Response, jsonify, request

import app_settings
from http_utils import _check_admin_token
from service import cache_store
from tool_data import TOOLS
from routes.content import _list_contents, _load_content

stats_bp = Blueprint("stats", __name__, url_prefix="/api")


def _read_counter():
    try:
        if app_settings._COUNTER_PATH.exists():
            return json.loads(app_settings._COUNTER_PATH.read_text()).get("count", 0)
    except Exception:
        pass
    return 0


def _write_counter(count):
    app_settings._COUNTER_PATH.parent.mkdir(parents=True, exist_ok=True)
    app_settings._COUNTER_PATH.write_text(json.dumps({"count": count}))


@stats_bp.route("/visits")
def visits():
    if cache_store.is_enabled():
        result = cache_store.cache_get(app_settings._VISIT_KEY)
        if result is not None:
            try:
                return jsonify({"count": int(result)})
            except (TypeError, ValueError):
                pass
    with app_settings._counter_lock:
        count = _read_counter()
    return jsonify({"count": count})


@stats_bp.route("/visits/increment", methods=["POST"])
def visits_increment():
    if cache_store.is_enabled():
        count = cache_store.cache_incr(app_settings._VISIT_KEY)
        if count is not None:
            return jsonify({"count": count})
    with app_settings._counter_lock:
        count = _read_counter() + 1
        _write_counter(count)
    return jsonify({"count": count})


@stats_bp.route("/tool-click", methods=["POST"])
def tool_click():
    data = request.get_json(silent=True) or {}
    tool_id = data.get("tool_id", "")
    if not tool_id or tool_id == "home":
        return jsonify({"ok": False, "error": "invalid tool_id"}), 400
    count = cache_store.cache_hincrby(app_settings._TOOL_CLICK_KEY, tool_id)
    return jsonify({"ok": True, "tool_id": tool_id, "count": count})


@stats_bp.route("/tool-stats")
def tool_stats():
    stats = cache_store.cache_hgetall(app_settings._TOOL_CLICK_KEY) or {}
    sorted_stats = sorted(stats.items(), key=lambda x: x[1], reverse=True)
    if request.args.get("view"):
        if not _check_admin_token():
            return Response("<h1>401 Unauthorized</h1><p>需要 ?token= 鉴权参数</p>", status=401)
        tool_rows = ""
        for rank, (tid, count) in enumerate(sorted_stats, 1):
            name = TOOLS.get(tid, {}).get("zh", {}).get("name", tid)
            tool_rows += f'<tr><td>{rank}</td><td>{html.escape(name)}</td><td><code>{html.escape(tid)}</code></td><td>{count}</td></tr>'
        visit_count = cache_store.cache_get("visit_count") or "0"
        total_clicks = sum(stats.values())
        tr_count = cache_store.cache_get("translate_count") or "0"
        tr_history = cache_store.cache_lrange("translate_history", 0, 49)
        ai_count = cache_store.cache_get("area_intro_count") or "0"
        ai_history = cache_store.cache_lrange("area_intro_history", 0, 49)
        tr_rows = ""
        for item in tr_history:
            try:
                d = json.loads(item)
                tr_rows += f'<tr><td><code>{html.escape(d.get("dir", ""))}</code></td><td>{html.escape(d.get("src", ""))}</td><td>{html.escape(d.get("tgt", ""))}</td></tr>'
            except Exception:
                pass
        ai_rows = ""
        for item in ai_history:
            try:
                d = json.loads(item)
                ai_rows += f'<tr><td><code>{html.escape(d.get("mode", ""))}</code></td><td>{html.escape(d.get("path", ""))}</td><td>{html.escape(d.get("intro", ""))}</td></tr>'
            except Exception:
                pass
        content_ids = _list_contents()
        content_rows = ""
        for cid in content_ids[:50]:
            entry = _load_content(cid)
            if not entry:
                continue
            full_text = html.escape(entry.get("text", ""))
            text_preview = full_text[:60].replace("\n", " ")
            created = entry.get("created_at", 0)
            created_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(created)) if created else "-"
            size = entry.get("size", 0)
            ip = html.escape(entry.get("ip", "-"))
            link = f"{request.host_url.rstrip('/')}/api/content/{cid}"
            content_rows += (
                f'<tr>'
                f'<td><code>{html.escape(cid)}</code></td>'
                f'<td>{text_preview}{"…" if len(entry.get("text", "")) > 60 else ""}</td>'
                f'<td style="font-size:.75rem"><a href="{html.escape(link)}" target="_blank" style="color:var(--accent,#4fc3f7)">{html.escape(link)}</a></td>'
                f'<td style="font-size:.75rem">{created_str}</td>'
                f'<td>{size}</td>'
                f'<td style="font-size:.7rem;color:#888">{ip}</td>'
                f'</tr>'
            )
        return f"""<!DOCTYPE html>
<meta charset="utf-8"><title>站点统计</title>
<style>
body{{font-family:system-ui;max-width:960px;margin:30px auto;padding:0 16px;background:#111;color:#eee}}
h1{{font-size:1.3rem;margin-bottom:4px}}h2{{font-size:1rem;margin:28px 0 10px;color:#ccc}}
table{{width:100%;border-collapse:collapse;margin-bottom:8px}}
th,td{{padding:7px 10px;text-align:left;border-bottom:1px solid #333;vertical-align:top}}
th{{color:#999;font-size:.75rem;font-weight:600}}
td{{font-size:.82rem}}tr:hover{{background:#1a1a1a}}
code{{color:#4fc3f7;font-size:.8rem}}
.badge{{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;background:#1a3a2a;color:#4caf50}}
.summary{{display:flex;gap:20px;margin:16px 0;flex-wrap:wrap}}
.summary-card{{background:#1a1a1a;border-radius:10px;padding:14px 20px;min-width:120px}}
.summary-card .num{{font-size:2rem;font-weight:700;color:var(--accent,#4fc3f7)}}
.summary-card .label{{font-size:.75rem;color:#999;margin-top:2px}}
.sub{{font-size:.7rem;color:#666}}
a{{text-decoration:none}}a:hover{{text-decoration:underline}}
</style>
<h1>📊 站点统计</h1>
<div class="summary">
<div class="summary-card"><div class="num">{visit_count}</div><div class="label">页面访问</div></div>
<div class="summary-card"><div class="num">{total_clicks}</div><div class="label">工具点击</div></div>
<div class="summary-card"><div class="num">{len(sorted_stats)}</div><div class="label">工具总数</div></div>
<div class="summary-card"><div class="num">{tr_count}</div><div class="label">翻译次数</div></div>
<div class="summary-card"><div class="num">{len(content_ids)}</div><div class="label">内容生成</div></div>
<div class="summary-card"><div class="num">{ai_count}</div><div class="label">地区介绍</div></div>
</div>

<h2>🔥 工具点击排行 <span class="sub">（所有用户累计，Redis HINCRBY）</span></h2>
<table><thead><tr><th>#</th><th>工具</th><th>ID</th><th>次数</th></tr></thead><tbody>{tool_rows}</tbody></table>

<h2>📝 最近翻译记录 <span class="sub">（最新 {len(tr_history)} 条）</span></h2>
<table><thead><tr><th>方向</th><th>原文</th><th>译文</th></tr></thead><tbody>{tr_rows or '<tr><td colspan="3" style="color:#666">暂无翻译记录</td></tr>'}</tbody></table>

<h2>🌍 最近地区介绍 <span class="sub">（最新 {len(ai_history)} 条）</span></h2>
<table><thead><tr><th>模式</th><th>地区</th><th>介绍预览</th></tr></thead><tbody>{ai_rows or '<tr><td colspan="3" style="color:#666">暂无记录</td></tr>'}</tbody></table>

<h2>🔗 内容生成记录 <span class="sub">（共 {len(content_ids)} 条，显示最近 50 条）</span></h2>
<table><thead><tr><th>ID</th><th>内容预览</th><th>链接</th><th>时间</th><th>大小</th><th>IP</th></tr></thead><tbody>{content_rows or '<tr><td colspan="6" style="color:#666">暂无内容</td></tr>'}</tbody></table>

<p class="sub" style="margin-top:24px">数据来源：Redis <code>dev_tools:tool_clicks</code> / <code>dev_tools:translate_history</code> / <code>dev_tools:area_intro_history</code> / <code>dev_tools:content:*</code></p>"""
    return jsonify(dict(sorted_stats))
