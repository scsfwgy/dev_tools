"""Visit and tool stats routes."""
import hashlib
import hmac
import json
import logging
import os
import re
import time
from datetime import date, timedelta

from flask import Blueprint, jsonify, redirect, request

import app_settings
from service import cache_store, visitor_geo
from tool_data import TOOLS
from routes.content import _list_contents, _load_content

stats_bp = Blueprint("stats", __name__, url_prefix="/api")
logger = logging.getLogger(__name__)

_ANONYMOUS_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


def _telemetry_writes_enabled():
    configured = os.getenv("TELEMETRY_WRITES")
    if configured is None:
        return bool(os.getenv("VERCEL"))
    return configured.lower() not in ("0", "false", "no", "off")


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


def _last_days(days=30):
    today = date.today()
    return [(today - timedelta(days=offset)).isoformat() for offset in range(days - 1, -1, -1)]


def _unique_visit_key(day):
    return app_settings._UNIQUE_VISIT_KEY_PREFIX + day


def _hash_anonymous_id(anonymous_id):
    anonymous_id = str(anonymous_id or "").strip()
    if not _ANONYMOUS_ID_RE.match(anonymous_id):
        return ""
    return hashlib.sha256(anonymous_id.encode("utf-8")).hexdigest()


def _read_unique_visits():
    try:
        if app_settings._UNIQUE_VISIT_PATH.exists():
            data = json.loads(app_settings._UNIQUE_VISIT_PATH.read_text())
            if isinstance(data, dict):
                return {str(day): list(values) for day, values in data.items() if isinstance(values, list)}
    except Exception:
        pass
    return {}


def _write_unique_visits(data):
    app_settings._UNIQUE_VISIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    app_settings._UNIQUE_VISIT_PATH.write_text(json.dumps(data, ensure_ascii=False, sort_keys=True))


def _cleanup_unique_visits(data):
    keep_days = set(_last_days(30))
    return {
        day: sorted({str(value) for value in values if isinstance(value, str)})
        for day, values in data.items()
        if day in keep_days
    }


def _record_unique_visit(anonymous_id):
    digest = _hash_anonymous_id(anonymous_id)
    if not digest:
        return None
    day = date.today().isoformat()
    if cache_store.is_enabled():
        key = _unique_visit_key(day)
        added = cache_store.cache_sadd(key, digest)
        if added == 1:
            cache_store.cache_expire(key, app_settings._UNIQUE_VISIT_TTL)
            cache_store.cache_hincrby(app_settings._UNIQUE_VISIT_DAILY_COUNTS_KEY, day)
        return {"day": day, "count": None, "new": added == 1}
    with app_settings._unique_visit_lock:
        data = _cleanup_unique_visits(_read_unique_visits())
        users = set(data.get(day, []))
        before = len(users)
        users.add(digest)
        data[day] = sorted(users)
        _write_unique_visits(data)
    return {"day": day, "count": len(users), "new": len(users) > before}


def _unique_visit_series():
    days = _last_days(30)
    if cache_store.is_enabled():
        counts = cache_store.cache_hgetall(app_settings._UNIQUE_VISIT_DAILY_COUNTS_KEY)
        return [
            {"date": day, "users": int(counts.get(day, 0) or 0)}
            for day in days
        ]
    with app_settings._unique_visit_lock:
        data = _cleanup_unique_visits(_read_unique_visits())
        _write_unique_visits(data)
    return [{"date": day, "users": len(data.get(day, []))} for day in days]


def _record_geo_if_new(unique_visit):
    if unique_visit and unique_visit.get("new"):
        visitor_geo.record(unique_visit["day"], visitor_geo.country_from_headers(request.headers, request.remote_addr))


@stats_bp.route("/visits")
def visits():
    return jsonify({"count": _current_visit_count()})


def _current_visit_count():
    if cache_store.is_enabled():
        result = cache_store.cache_get(app_settings._VISIT_KEY)
        if result is not None:
            try:
                return int(result)
            except (TypeError, ValueError):
                pass
    with app_settings._counter_lock:
        return _read_counter()


@stats_bp.route("/visits/increment", methods=["POST"])
def visits_increment():
    if not _telemetry_writes_enabled():
        return jsonify({"count": _current_visit_count(), "skipped": True})
    if cache_store.is_enabled():
        count = cache_store.cache_incr(app_settings._VISIT_KEY)
        if count is not None:
            payload = {"count": count}
            unique_visit = _record_unique_visit((request.get_json(silent=True) or {}).get("anonymous_id"))
            _record_geo_if_new(unique_visit)
            if unique_visit:
                payload["unique_users_today"] = unique_visit["count"]
                payload["is_new_daily_user"] = unique_visit["new"]
            return jsonify(payload)
    with app_settings._counter_lock:
        count = _read_counter() + 1
        _write_counter(count)
    payload = {"count": count}
    unique_visit = _record_unique_visit((request.get_json(silent=True) or {}).get("anonymous_id"))
    _record_geo_if_new(unique_visit)
    if unique_visit:
        payload["unique_users_today"] = unique_visit["count"]
        payload["is_new_daily_user"] = unique_visit["new"]
    return jsonify(payload)


@stats_bp.route("/tool-click", methods=["POST"])
def tool_click():
    data = request.get_json(silent=True) or {}
    tool_id = data.get("tool_id", "")
    if not tool_id or tool_id == "home":
        return jsonify({"ok": False, "error": "invalid tool_id"}), 400
    if not _telemetry_writes_enabled():
        return jsonify({"ok": True, "tool_id": tool_id, "count": None, "skipped": True})
    count = cache_store.cache_hincrby(app_settings._TOOL_CLICK_KEY, tool_id)
    logger.info("event=tool_click tool_id=%s count=%s", tool_id, count)
    return jsonify({"ok": True, "tool_id": tool_id, "count": count})


@stats_bp.route("/tool-stats")
def tool_stats(for_admin_api=False):
    if request.args.get('view') and not for_admin_api:
        return redirect('https://www.tools24.uk/admin/sites?source=devtools', code=302)
    stats = cache_store.cache_hgetall(app_settings._TOOL_CLICK_KEY) or {}
    sorted_stats = sorted(stats.items(), key=lambda x: x[1], reverse=True)
    if for_admin_api:
        visit_count = cache_store.cache_get(app_settings._VISIT_KEY)
        if visit_count is None:
            visit_count = str(_read_counter())
        total_clicks = sum(stats.values())
        user_series = _unique_visit_series()
        today_users = user_series[-1]["users"] if user_series else 0
        month_user_days = sum(item["users"] for item in user_series)
        tr_count = cache_store.cache_get("translate_count") or "0"
        def history(key, fields):
            rows = []
            for raw in cache_store.cache_lrange(key, 0, 49):
                try:
                    entry = json.loads(raw)
                    rows.append([str(entry.get(field, ''))[:2000] for field in fields])
                except (ValueError, TypeError, AttributeError):
                    continue
            return rows
        contents = []
        content_ids = _list_contents()
        if cache_store.is_enabled():
            raw_entries = cache_store.cache_mget([app_settings._CONTENT_KEY_PREFIX + cid for cid in content_ids[:50]])
            if raw_entries is None:
                return jsonify({'ok': False, 'error': {'code': 'unavailable', 'message': 'Content statistics unavailable'}}), 503, {'Cache-Control': 'no-store'}
            entries = []
            for raw in raw_entries:
                try:
                    entry = json.loads(raw) if raw else None
                    entries.append(entry if isinstance(entry, dict) else None)
                except (ValueError, TypeError):
                    entries.append(None)
        else:
            entries = [_load_content(cid) for cid in content_ids[:50]]
        for cid, entry in zip(content_ids[:50], entries):
            if entry:
                contents.append([cid, str(entry.get('text', ''))[:2000], str(entry.get('created_at', '')), str(entry.get('size', ''))])
        return jsonify({"ok": True, "data": {
            "schemaVersion": 1, "source": "devtools",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "timezone": time.tzname[0],
            "storage": "redis" if cache_store.is_enabled() else "local-fallback",
            "metrics": [
                {"label": "累计页面访问", "value": int(visit_count)},
                {"label": "今日访客", "value": today_users},
                {"label": "近30日用户天次", "value": month_user_days},
                {"label": "累计工具点击", "value": total_clicks},
                {"label": "有点击记录的工具数", "value": len(sorted_stats)},
                {"label": "累计翻译次数", "value": int(tr_count)},
                {"label": "累计地区介绍", "value": int(cache_store.cache_get("area_intro_count") or 0)},
                {"label": "现存分享内容", "value": len(content_ids)},
            ],
            "dailyUsers": user_series,
            "geo": visitor_geo.periods(),
            "breakdowns": [{"label": "工具点击排行 · 累计", "rows": [
                {"name": TOOLS.get(tid, {}).get("zh", {}).get("name", tid), "value": int(count)}
                for tid, count in sorted_stats]}],
            "records": [
                {"label": "最近翻译记录", "columns": ["方向", "原文", "译文"], "rows": history('translate_history', ['dir', 'src', 'tgt'])},
                {"label": "最近地区介绍", "columns": ["模式", "地区", "介绍"], "rows": history('area_intro_history', ['mode', 'path', 'intro'])},
                {"label": "分享内容记录", "columns": ["ID", "内容预览", "创建时间（Unix 秒）", "字符数"], "rows": contents}
            ],
            "notes": ["访客按匿名 UUID 每日去重；用户天次为每日访客之和，不是月活。",
                      "地区分布只计入带网络国家码的新日访客。日是今天；周、月是近 7、30 个自然日的用户天次之和，不是周活或月活。",
                      "本地降级数据不代表跨实例完整统计；明细最多显示最近 50 条，每格文本最多 2000 字，不包含 IP。"],
        }}), 200, {"Cache-Control": "no-store"}
    return jsonify(dict(sorted_stats))


@stats_bp.get("/admin/stats")
def admin_stats():
    """Read-only aggregate export for HomeTools. Never accept URL credentials."""
    expected = os.getenv("STATS_READ_TOKEN", "")
    supplied = request.headers.get("Authorization", "")
    if not expected or not hmac.compare_digest(supplied.encode(), f"Bearer {expected}".encode()):
        return jsonify({"ok": False, "error": {"code": "unauthorized", "message": "Unauthorized"}}), 401, {"Cache-Control": "no-store"}
    return tool_stats(for_admin_api=True)
