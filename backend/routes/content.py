"""Content generator routes."""
import html
import json
import logging
import secrets
import time
from pathlib import Path

from flask import Blueprint, Response, jsonify, request

import app_settings
from http_utils import _check_admin_token, _client_ip
from service import cache_store

content_bp = Blueprint("content", __name__, url_prefix="/api/content")
logger = logging.getLogger(__name__)


def _content_store_path(content_id: str) -> Path:
    return app_settings._CONTENT_STORE_DIR / f"{content_id}.json"


def _save_content_file(content_id: str, data: dict) -> None:
    app_settings._CONTENT_STORE_DIR.mkdir(parents=True, exist_ok=True)
    _content_store_path(content_id).write_text(json.dumps(data, ensure_ascii=False))


def _load_content_file(content_id: str) -> dict | None:
    path = _content_store_path(content_id)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return None
    return None


def _delete_content_file(content_id: str) -> bool:
    path = _content_store_path(content_id)
    if path.exists():
        path.unlink()
        return True
    return False


def _list_content_files() -> list[str]:
    if not app_settings._CONTENT_STORE_DIR.exists():
        return []
    return sorted(
        [path.stem for path in app_settings._CONTENT_STORE_DIR.glob("*.json") if path.stem != "_list"],
        key=lambda content_id: app_settings._CONTENT_STORE_DIR.joinpath(f"{content_id}.json").stat().st_mtime,
        reverse=True,
    )


def _save_content(content_id: str, text: str) -> None:
    now = int(time.time())
    data = {"text": text, "created_at": now, "size": len(text), "ip": _client_ip()}
    if cache_store.is_enabled():
        cache_store.cache_set(f"{app_settings._CONTENT_KEY_PREFIX}{content_id}", json.dumps(data, ensure_ascii=False), app_settings._CONTENT_TTL)
        cache_store.cache_lpush(app_settings._CONTENT_LIST_KEY, content_id)
        return
    _save_content_file(content_id, data)
    list_path = app_settings._CONTENT_STORE_DIR / "_list.json"
    ids = []
    if list_path.exists():
        try:
            ids = json.loads(list_path.read_text())
        except Exception:
            ids = []
    ids.insert(0, content_id)
    list_path.write_text(json.dumps(ids))


def _load_content(content_id: str) -> dict | None:
    if cache_store.is_enabled():
        raw = cache_store.cache_get(f"{app_settings._CONTENT_KEY_PREFIX}{content_id}")
        if raw:
            try:
                return json.loads(raw)
            except Exception:
                return None
    return _load_content_file(content_id)


def _delete_content(content_id: str) -> bool:
    if cache_store.is_enabled():
        cache_store.cache_del(f"{app_settings._CONTENT_KEY_PREFIX}{content_id}")
        cache_store.cache_lrem(app_settings._CONTENT_LIST_KEY, 0, content_id)
    return _delete_content_file(content_id)


def _list_contents() -> list[str]:
    if cache_store.is_enabled():
        return cache_store.cache_lrange(app_settings._CONTENT_LIST_KEY, 0, -1)
    return _list_content_files()


@content_bp.route("", methods=["POST"])
def content_create():
    """Create a new content entry. Body: {"text": "..."}"""
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    if not text:
        return jsonify({"ok": False, "error": "empty text"}), 400
    if len(text) > app_settings._MAX_CONTENT_SIZE:
        return jsonify({"ok": False, "error": f"content too large (max {app_settings._MAX_CONTENT_SIZE} chars)"}), 400

    content_id = secrets.token_hex(4)
    _save_content(content_id, text)
    logger.info(
        "event=content_created chars=%s storage=%s",
        len(text),
        "redis" if cache_store.is_enabled() else "file",
    )
    return jsonify({
        "ok": True,
        "id": content_id,
        "url": f"{request.host_url.rstrip('/')}/api/content/{content_id}",
        "size": len(text),
    })


@content_bp.route("", methods=["GET"])
def content_list():
    """Admin view: ?view=1&token=xxx shows all content entries."""
    if not request.args.get("view"):
        return jsonify({"ok": False, "error": "use ?view=1&token=xxx for admin dashboard"}), 400
    if not _check_admin_token():
        return Response("<h1>401 Unauthorized</h1><p>需要 ?token= 鉴权参数</p>", status=401)

    ids = _list_contents()
    rows = ""
    for cid in ids[:50]:
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
        rows += (
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
<meta charset="utf-8"><title>内容管理</title>
<style>
body{{font-family:system-ui;max-width:960px;margin:30px auto;padding:0 16px;background:#111;color:#eee}}
h1{{font-size:1.3rem;margin-bottom:4px}}h2{{font-size:1rem;margin:24px 0 10px;color:#ccc}}
table{{width:100%;border-collapse:collapse;margin-bottom:8px}}
th,td{{padding:7px 10px;text-align:left;border-bottom:1px solid #333;vertical-align:top}}
th{{color:#999;font-size:.75rem;font-weight:600}}
td{{font-size:.82rem}}tr:hover{{background:#1a1a1a}}
code{{color:#4fc3f7;font-size:.8rem}}
a{{text-decoration:none}}a:hover{{text-decoration:underline}}
.sub{{font-size:.7rem;color:#666}}
</style>
<h1>📝 内容管理</h1>
<p class="sub">共 {len(ids)} 条记录 · 数据来源：{'Redis' if cache_store.is_enabled() else '本地文件'} · 访问链接直接返回纯文本 · HTTP(S) 链接自动 302 重定向</p>
<table><thead><tr><th>ID</th><th>内容预览</th><th>链接</th><th>时间</th><th>大小</th><th>IP</th></tr></thead><tbody>{rows or '<tr><td colspan="6" style="color:#666">暂无内容</td></tr>'}</tbody></table>"""


@content_bp.route("/<content_id>")
def content_get(content_id: str):
    """Serve raw text content, or redirect if the content is a URL."""
    entry = _load_content(content_id)
    if not entry:
        return Response("Content not found or expired.", status=404, mimetype="text/plain")
    text = entry["text"].strip()
    if text.startswith(("http://", "https://")):
        logger.info("event=content_served kind=redirect chars=%s", len(text))
        return Response("", status=302, headers={"Location": text})
    logger.info("event=content_served kind=text chars=%s", len(text))
    return Response(text, content_type="text/plain; charset=utf-8")


@content_bp.route("/<content_id>", methods=["DELETE"])
def content_delete(content_id: str):
    """Delete a content entry (admin only)."""
    if not _check_admin_token():
        return jsonify({"ok": False, "error": "unauthorized"}), 401
    deleted = _delete_content(content_id)
    logger.info("event=content_deleted deleted=%s", deleted)
    return jsonify({"ok": deleted})
