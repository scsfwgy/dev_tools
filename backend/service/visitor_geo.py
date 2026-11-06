"""Daily unique visitors by network country, for the shared admin map."""

import json
import logging
import os
import re
import threading
from datetime import date, timedelta
from pathlib import Path

from service import cache_store

logger = logging.getLogger(__name__)

_CODE_RE = re.compile(r"^[A-Z]{2}$")
_DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_WINDOW = {"day": 1, "week": 7, "month": 30}
_KEY = "geo_visit_daily_counts"
_PATH = Path("/tmp/devtools_geo_visits.json") if os.path.exists("/tmp") else (
    Path(__file__).resolve().parent.parent / "config" / "geo_visits.json"
)
_lock = threading.Lock()
LABELS = {
    "day": "今日去重访客",
    "week": "近 7 日用户天次",
    "month": "近 30 日用户天次",
}
NOTE = ("日是今天的去重访客，国家取当天第一次计入时的网络位置。"
        "周、月把近 7 日和近 30 日的每日人数相加，同一个人跨天会再计一次，不是周活或月活。"
        "没有国家码的访问不计入，上线前的访问也不会补进来。")


def _today():
    return date.today()


def country_from_headers(headers):
    raw = str(headers.get("X-Vercel-IP-Country") or "").strip().upper()
    if raw == "XX" or not _CODE_RE.fullmatch(raw):
        return ""
    return raw


def _keep_days(today=None):
    today = today or _today()
    return [(today - timedelta(days=offset)).isoformat() for offset in range(_WINDOW["month"] - 1, -1, -1)]


def _read_local():
    try:
        payload = json.loads(_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return {}
    if not isinstance(payload, dict):
        return {}
    counts = {}
    for day, bucket in payload.items():
        if not _DAY_RE.fullmatch(str(day)) or not isinstance(bucket, dict):
            continue
        parsed = {str(code): value for code, value in bucket.items()
                  if _CODE_RE.fullmatch(str(code)) and isinstance(value, int) and value > 0}
        if parsed:
            counts[str(day)] = parsed
    return counts


def _write_local(counts):
    _PATH.parent.mkdir(parents=True, exist_ok=True)
    _PATH.write_text(json.dumps(counts, ensure_ascii=False, sort_keys=True), encoding="utf-8")


def record(day, code):
    if not code or not _DAY_RE.fullmatch(str(day)) or str(day) not in set(_keep_days()):
        return
    try:
        if cache_store.is_enabled():
            cache_store.cache_hincrby(_KEY, f"{day}:{code}")
            return
        with _lock:
            counts = _read_local()
            keep = set(_keep_days())
            counts = {kept: counts[kept] for kept in keep if kept in counts}
            bucket = counts.setdefault(str(day), {})
            bucket[code] = bucket.get(code, 0) + 1
            _write_local(counts)
    except Exception:  # noqa: BLE001 - analytics must never break a visit
        logger.warning("Geo analytics write failed")


def periods():
    try:
        if cache_store.is_enabled():
            counts = {}
            for field, value in cache_store.cache_hgetall(_KEY).items():
                day, separator, code = str(field).partition(":")
                if not separator or not _DAY_RE.fullmatch(day) or not _CODE_RE.fullmatch(code):
                    continue
                try:
                    count = int(value)
                except (TypeError, ValueError):
                    continue
                if count > 0:
                    counts.setdefault(day, {})[code] = count
        else:
            with _lock:
                counts = _read_local()
    except Exception:  # noqa: BLE001 - a geo read must not take down the rest of the export
        logger.warning("Geo analytics read failed")
        counts = {}
    today = _today()
    report = {}
    for name, days in _WINDOW.items():
        merged = {}
        for offset in range(days - 1, -1, -1):
            for code, value in counts.get((today - timedelta(days=offset)).isoformat(), {}).items():
                merged[code] = merged.get(code, 0) + value
        report[name] = [{"code": code, "value": value}
                        for code, value in sorted(merged.items(), key=lambda item: (-item[1], item[0]))]
    report["labels"] = dict(LABELS)
    report["note"] = NOTE
    return report
