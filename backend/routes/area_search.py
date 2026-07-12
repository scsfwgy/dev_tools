"""Area search and intro routes."""
import hashlib
import json
import logging
import time

import requests
from flask import Blueprint, jsonify, request

import app_settings
from http_utils import _client_ip
from service import cache_store

area_search_bp = Blueprint("area_search", __name__, url_prefix="/api/area-search")
logger = logging.getLogger(__name__)


def _load_china_tree():
    if app_settings._AREA_CHINA_CACHE is not None:
        return app_settings._AREA_CHINA_CACHE
    path = app_settings._AREA_CONFIG_DIR / "area_format_object_level3.json"
    app_settings._AREA_CHINA_CACHE = json.loads(path.read_text(encoding="utf-8-sig"))
    return app_settings._AREA_CHINA_CACHE


def _load_world_countries():
    if app_settings._AREA_WORLD_CACHE is not None:
        return app_settings._AREA_WORLD_CACHE
    path = app_settings._AREA_CONFIG_DIR / "allCountriesGeojson.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    countries = []
    for feat in raw.get("features", []):
        props = feat.get("properties", {})
        countries.append({
            "code": props.get("code", feat.get("id", "")),
            "name": props.get("name", ""),
            "cname": props.get("cname", ""),
            "cities": props.get("cities", []),
        })
    app_settings._AREA_WORLD_CACHE = countries
    return app_settings._AREA_WORLD_CACHE


def _area_search_limit() -> int:
    try:
        return min(max(int(request.args.get("limit", app_settings._AREA_SEARCH_DEFAULT_LIMIT)), 1), app_settings._AREA_SEARCH_MAX_LIMIT)
    except (TypeError, ValueError):
        return app_settings._AREA_SEARCH_DEFAULT_LIMIT


def _contains_query(item: dict, query: str) -> bool:
    query = query.casefold()
    return any(query in str(item.get(key, "")).casefold() for key in ("name", "cname", "pinyin", "code", "code_full"))


def _resolve_area_path(mode: str, codes: list) -> str | None:
    if not isinstance(codes, list) or not codes:
        return None
    codes = [str(code).strip() for code in codes[:3] if str(code).strip()]
    if mode == "china":
        final_code = codes[-1]
        if len(final_code) not in (2, 4, 6) or not final_code.isdigit():
            return None
        tree = _load_china_tree()
        names = []
        province = tree.get(final_code[:2])
        if not province:
            return None
        names.append(province["n"])
        if len(final_code) >= 4:
            city = (province.get("c") or {}).get(final_code[:4])
            if not city:
                return None
            names.append(city["n"])
        if len(final_code) == 6:
            district = (city.get("c") or {}).get(final_code)
            if not district:
                return None
            names.append(district["n"])
        return " ".join(names)

    country = next((item for item in _load_world_countries() if item["code"] == codes[0].upper()), None)
    if not country:
        return None
    names = [country.get("cname") or country.get("name")]
    if len(codes) > 1:
        city_code = codes[1]
        city = next((item for item in country.get("cities", []) if str(item.get("code", "")) == city_code), None)
        if not city:
            return None
        names.append(city.get("cname") or city.get("name"))
    return " ".join(names)


def _area_intro_cache_key(mode: str, region_path: str) -> str:
    digest = hashlib.sha256(f"{mode}:{region_path}".encode()).hexdigest()
    return f"area_intro_cache:{digest}"


def _area_intro_cache_get(key: str) -> str | None:
    cached = cache_store.cache_get(key)
    if cached:
        return cached
    now = time.time()
    with app_settings._AREA_INTRO_LOCK:
        item = app_settings._AREA_INTRO_LOCAL_CACHE.get(key)
        if item and item[1] > now:
            return item[0]
        app_settings._AREA_INTRO_LOCAL_CACHE.pop(key, None)
    return None


def _area_intro_cache_set(key: str, value: str) -> None:
    cache_store.cache_set(key, value, app_settings._AREA_INTRO_CACHE_TTL)
    with app_settings._AREA_INTRO_LOCK:
        app_settings._AREA_INTRO_LOCAL_CACHE[key] = (value, time.time() + app_settings._AREA_INTRO_CACHE_TTL)


def _check_area_intro_rate_limit(ip: str) -> tuple[bool, int]:
    key = f"area_intro_rate:{ip or 'unknown'}"
    if cache_store.is_enabled():
        count = cache_store.cache_incr(key)
        if count == 1:
            cache_store.cache_expire(key, app_settings._AREA_INTRO_RATE_WINDOW)
        allowed = count is not None and count <= app_settings._AREA_INTRO_RATE_MAX
        return allowed, 0 if allowed else (cache_store.cache_ttl(key) or app_settings._AREA_INTRO_RATE_WINDOW)
    now = time.time()
    with app_settings._AREA_INTRO_LOCK:
        hits = [timestamp for timestamp in app_settings._AREA_INTRO_RATE_STORE.get(key, []) if now - timestamp < app_settings._AREA_INTRO_RATE_WINDOW]
        if len(hits) >= app_settings._AREA_INTRO_RATE_MAX:
            app_settings._AREA_INTRO_RATE_STORE[key] = hits
            retry_after = max(1, int(app_settings._AREA_INTRO_RATE_WINDOW - (now - hits[0])))
            return False, retry_after
        hits.append(now)
        app_settings._AREA_INTRO_RATE_STORE[key] = hits
    return True, 0


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
        return jsonify({"ok": True, "intro": cached_intro, "cached": True})
    allowed, retry_after = _check_area_intro_rate_limit(_client_ip())
    if not allowed:
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
                "max_tokens": 1024,
            },
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        intro = body["choices"][0]["message"]["content"].strip()
    except (KeyError, requests.exceptions.RequestException) as e:
        logger.warning("Area intro failed: %s", e)
        return jsonify({"ok": False, "error": "generation_failed"}), 500

    _area_intro_cache_set(cache_key, intro)
    cache_store.cache_incr("area_intro_count")
    entry = json.dumps({"path": region_path[:200], "intro": intro[:200], "mode": mode}, ensure_ascii=False)
    cache_store.cache_lpush("area_intro_history", entry)
    cache_store.cache_ltrim("area_intro_history", 0, 199)
    return jsonify({"ok": True, "intro": intro})
