"""Shared local area catalog, canonical paths and intro cache helpers."""
import hashlib
import json
import time
import app_settings
from service import cache_store

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
            "latitude": props.get("latitude"),
            "longitude": props.get("longitude"),
        })
    app_settings._AREA_WORLD_CACHE = countries
    return app_settings._AREA_WORLD_CACHE


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
    digest = hashlib.sha256(f"v2:{mode}:{region_path}".encode()).hexdigest()
    return f"area_intro_cache:v2:{digest}"


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
