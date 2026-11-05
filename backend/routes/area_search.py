"""Area search and intro routes."""
import json
import logging
import time

import requests
from flask import Blueprint, jsonify, request

import app_settings
from http_utils import _client_ip
from service import cache_store
from service.area_data import (
    _load_china_tree, _load_world_countries, _resolve_area_path,
    _area_intro_cache_key, _area_intro_cache_get, _area_intro_cache_set,
    _check_area_intro_rate_limit,
)

area_search_bp = Blueprint("area_search", __name__, url_prefix="/api/area-search")
logger = logging.getLogger(__name__)


def _area_search_limit() -> int:
    try:
        return min(max(int(request.args.get("limit", app_settings._AREA_SEARCH_DEFAULT_LIMIT)), 1), app_settings._AREA_SEARCH_MAX_LIMIT)
    except (TypeError, ValueError):
        return app_settings._AREA_SEARCH_DEFAULT_LIMIT


def _contains_query(item: dict, query: str) -> bool:
    query = query.casefold()
    return any(query in str(item.get(key, "")).casefold() for key in ("name", "cname", "pinyin", "code", "code_full"))


def _load_intro_prompt():
    if app_settings._AREA_INTRO_PROMPT is not None:
        return app_settings._AREA_INTRO_PROMPT
    path = app_settings._AREA_CONFIG_DIR / "area_intro_prompt.json"
    if path.exists():
        app_settings._AREA_INTRO_PROMPT = json.loads(path.read_text(encoding="utf-8"))
    else:
        app_settings._AREA_INTRO_PROMPT = {
            "china": {"system": "You are a knowledgeable geography assistant.", "user_template": "Briefly introduce: {region_path}"},
            "world": {"system": "You are a knowledgeable geography assistant.", "user_template": "Briefly introduce: {region_path}"},
        }
    return app_settings._AREA_INTRO_PROMPT


@area_search_bp.route("/china")
def area_search_china():
    parent = request.args.get("parent", "")
    tree = _load_china_tree()

    if not parent:
        result = [{"code": key, "name": value["n"], "pinyin": value.get("y", "")} for key, value in tree.items()]
        result.sort(key=lambda item: item["code"])
        return jsonify({"ok": True, "data": result})

    if len(parent) == 2:
        node = tree.get(parent)
    elif len(parent) == 4:
        province = tree.get(parent[:2])
        node = province["c"].get(parent) if province else None
    else:
        return jsonify({"ok": False, "error": "Invalid parent code"}), 400

    if not node or "c" not in node:
        return jsonify({"ok": True, "data": []})

    children = [{"code": key, "name": value["n"], "pinyin": value.get("y", "")} for key, value in node["c"].items()]
    children.sort(key=lambda item: item["code"])
    return jsonify({"ok": True, "data": children})


@area_search_bp.route("/world/countries")
def area_search_world_countries():
    countries = _load_world_countries()
    result = [{"code": country["code"], "name": country["name"], "cname": country["cname"]} for country in countries]
    result.sort(key=lambda item: item["cname"] or item["name"])
    return jsonify({"ok": True, "data": result})


@area_search_bp.route("/world/cities")
def area_search_world_cities():
    country_code = request.args.get("country", "").upper()
    if not country_code:
        return jsonify({"ok": False, "error": "country parameter required"}), 400

    countries = _load_world_countries()
    country = next((item for item in countries if item["code"] == country_code), None)
    if not country:
        return jsonify({"ok": False, "error": "Country not found"}), 404

    result = [
        {
            "code": city.get("code", ""),
            "name": city.get("name", ""),
            "cname": city.get("cname", ""),
            "code_full": city.get("code_full", ""),
        }
        for city in country.get("cities") or []
    ]
    seen = set()
    deduped = []
    for city in result:
        key = city["code_full"] or city["cname"] or city["name"]
        if key not in seen:
            seen.add(key)
            deduped.append(city)
    deduped.sort(key=lambda item: item["cname"] or item["name"])
    return jsonify({"ok": True, "data": deduped})


@area_search_bp.route("/china/ancestors")
def area_search_china_ancestors():
    code = request.args.get("code", "").strip()
    if not code or len(code) not in (2, 4, 6) or not code.isdigit():
        return jsonify({"ok": False, "error": "Invalid code"}), 400

    tree = _load_china_tree()
    chain = []
    if len(code) >= 2:
        province = tree.get(code[:2])
        if province:
            chain.append({"code": code[:2], "name": province["n"], "pinyin": province.get("y", "")})
    if len(code) >= 4:
        province = tree.get(code[:2])
        if province and province.get("c"):
            city = province["c"].get(code[:4])
            if city:
                chain.append({"code": code[:4], "name": city["n"], "pinyin": city.get("y", "")})
    if len(code) == 6:
        province = tree.get(code[:2])
        if province and province.get("c"):
            city = province["c"].get(code[:4])
            if city and city.get("c"):
                district = city["c"].get(code)
                if district:
                    chain.append({"code": code, "name": district["n"], "pinyin": district.get("y", "")})
    return jsonify({"ok": True, "data": chain})


@area_search_bp.route("/china/all")
def area_search_china_all():
    level = request.args.get("level", "2")
    if level not in ("2", "3"):
        return jsonify({"ok": False, "error": "level must be 2 or 3"}), 400

    tree = _load_china_tree()
    result = []
    for province_code, province in tree.items():
        if "c" not in province:
            continue
        for city_code, city in province["c"].items():
            if level == "2":
                result.append({
                    "code": city_code,
                    "name": city["n"],
                    "pinyin": city.get("y", ""),
                    "parentCode": province_code,
                    "parentName": province["n"],
                    "parentPinyin": province.get("y", ""),
                })
            elif "c" in city:
                for district_code, district in city["c"].items():
                    result.append({
                        "code": district_code,
                        "name": district["n"],
                        "pinyin": district.get("y", ""),
                        "parentCode": city_code,
                        "parentName": city["n"],
                        "parentPinyin": city.get("y", ""),
                        "grandparentCode": province_code,
                        "grandparentName": province["n"],
                        "grandparentPinyin": province.get("y", ""),
                    })
    result.sort(key=lambda item: item["code"])
    return jsonify({"ok": True, "data": result})


@area_search_bp.route("/china/search")
def area_search_china_search():
    query = request.args.get("q", "").strip()
    level = request.args.get("level", "3")
    if len(query) < 1 or level not in ("2", "3"):
        return jsonify({"ok": False, "error": "invalid_search"}), 400
    tree = _load_china_tree()
    result = []
    limit = _area_search_limit()
    for province_code, province in tree.items():
        for city_code, city in (province.get("c") or {}).items():
            if level == "2":
                item = {
                    "code": city_code,
                    "name": city["n"],
                    "pinyin": city.get("y", ""),
                    "parentCode": province_code,
                    "parentName": province["n"],
                    "parentPinyin": province.get("y", ""),
                }
                if _contains_query(item, query):
                    result.append(item)
            else:
                for district_code, district in (city.get("c") or {}).items():
                    item = {
                        "code": district_code,
                        "name": district["n"],
                        "pinyin": district.get("y", ""),
                        "parentCode": city_code,
                        "parentName": city["n"],
                        "parentPinyin": city.get("y", ""),
                        "grandparentCode": province_code,
                        "grandparentName": province["n"],
                        "grandparentPinyin": province.get("y", ""),
                    }
                    if _contains_query(item, query):
                        result.append(item)
            if len(result) >= limit:
                return jsonify({"ok": True, "data": result, "limited": True})
    return jsonify({"ok": True, "data": result, "limited": False})


@area_search_bp.route("/world/all-cities")
def area_search_world_all_cities():
    countries = _load_world_countries()
    result = []
    for country in countries:
        for city in country.get("cities") or []:
            result.append({
                "code": city.get("code", ""),
                "name": city.get("name", ""),
                "cname": city.get("cname", ""),
                "code_full": city.get("code_full", ""),
                "countryCode": country["code"],
                "countryName": country["name"],
                "countryCname": country["cname"],
            })
    seen = set()
    deduped = []
    for row in result:
        key = row["code_full"] or (row["countryCode"] + row["cname"])
        if key not in seen:
            seen.add(key)
            deduped.append(row)
    deduped.sort(key=lambda item: item["cname"] or item["name"])
    return jsonify({"ok": True, "data": deduped})


@area_search_bp.route("/world/search")
def area_search_world_search():
    query = request.args.get("q", "").strip()
    if len(query) < 1:
        return jsonify({"ok": False, "error": "invalid_search"}), 400
    limit = _area_search_limit()
    result = []
    seen = set()
    for country in _load_world_countries():
        for city in country.get("cities") or []:
            item = {
                "code": city.get("code", ""),
                "name": city.get("name", ""),
                "cname": city.get("cname", ""),
                "code_full": city.get("code_full", ""),
                "countryCode": country["code"],
                "countryName": country["name"],
                "countryCname": country["cname"],
            }
            key = item["code_full"] or (item["countryCode"] + item["cname"])
            if key in seen or not _contains_query(item, query):
                continue
            seen.add(key)
            result.append(item)
            if len(result) >= limit:
                return jsonify({"ok": True, "data": result, "limited": True})
    return jsonify({"ok": True, "data": result, "limited": False})


@area_search_bp.route("/intro", methods=["POST"])
def area_search_intro():
    started = time.perf_counter()
    if not app_settings._DEEPSEEK_KEY:
        return jsonify({"ok": False, "error": "not_configured"}), 503

    data = request.get_json(silent=True) or {}
    mode = (data.get("mode") or "china").strip()
    if mode not in ("china", "world"):
        return jsonify({"ok": False, "error": "invalid_region"}), 400
    region_path = _resolve_area_path(mode, data.get("codes"))
    if not region_path:
        return jsonify({"ok": False, "error": "invalid_region"}), 400

    cache_key = _area_intro_cache_key(mode, region_path)
    cached_intro = _area_intro_cache_get(cache_key)
    if cached_intro:
        logger.info(
            "event=area_intro_success mode=%s cached=true duration_ms=%.1f",
            mode,
            (time.perf_counter() - started) * 1000,
        )
        return jsonify({"ok": True, "intro": cached_intro, "cached": True})
    allowed, retry_after = _check_area_intro_rate_limit(_client_ip())
    if not allowed:
        logger.warning("event=area_intro_rate_limited mode=%s retry_after=%s", mode, retry_after)
        response = jsonify({"ok": False, "error": "rate_limited", "retry_after": retry_after})
        response.headers["Retry-After"] = str(retry_after)
        return response, 429

    cfg = _load_intro_prompt()
    section = cfg.get(mode, cfg.get("china", {}))
    user_prompt = section.get("user_template", "Introduce: {region_path}").replace("{region_path}", region_path)

    try:
        resp = requests.post(
            app_settings._DEEPSEEK_URL,
            headers={
                "Authorization": f"Bearer {app_settings._DEEPSEEK_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-v4-flash",
                "messages": [
                    {"role": "system", "content": section.get("system", "")},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.7,
                "max_tokens": 2048,
            },
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        choice = body["choices"][0]
        if choice.get("finish_reason") == "length":
            return jsonify({"ok": False, "error": "generation_incomplete"}), 502
        intro = choice["message"]["content"].strip()
    except (KeyError, requests.exceptions.RequestException) as e:
        logger.warning(
            "event=area_intro_failed mode=%s error_type=%s duration_ms=%.1f",
            mode,
            type(e).__name__,
            (time.perf_counter() - started) * 1000,
        )
        return jsonify({"ok": False, "error": "generation_failed"}), 500

    _area_intro_cache_set(cache_key, intro)
    cache_store.cache_incr("area_intro_count")
    entry = json.dumps({"path": region_path[:200], "intro": intro[:200], "mode": mode}, ensure_ascii=False)
    cache_store.cache_lpush("area_intro_history", entry)
    cache_store.cache_ltrim("area_intro_history", 0, 199)
    logger.info(
        "event=area_intro_success mode=%s cached=false chars=%s duration_ms=%.1f",
        mode,
        len(intro),
        (time.perf_counter() - started) * 1000,
    )
    return jsonify({"ok": True, "intro": intro})
