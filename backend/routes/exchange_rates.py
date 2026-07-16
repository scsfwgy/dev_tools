"""Cached reference exchange rates used by the currency comparison tool."""
import json
import logging
import time

import requests
from flask import Blueprint, jsonify

import app_settings
from service import cache_store

exchange_rates_bp = Blueprint("exchange_rates", __name__)
logger = logging.getLogger(__name__)

REQUIRED_CURRENCIES = ("EUR", "CNY", "USD", "JPY", "KRW", "HKD")


def _valid_payload(payload):
    if (
        not isinstance(payload, dict)
        or not isinstance(payload.get("rates"), dict)
        or not isinstance(payload.get("currencies"), list)
    ):
        return False
    rates = payload["rates"]
    currency_codes = {item.get("code") for item in payload["currencies"] if isinstance(item, dict)}
    return (
        len(rates) >= 20
        and len(currency_codes) >= 20
        and all(isinstance(rates.get(code), (int, float)) and rates[code] > 0 for code in REQUIRED_CURRENCIES)
        and all(code in currency_codes for code in REQUIRED_CURRENCIES)
    )


def _load_remote_rates():
    rates_response = requests.get(
        app_settings._EXCHANGE_RATE_URL,
        params={"base": "EUR"},
        timeout=10,
    )
    rates_response.raise_for_status()
    rows = rates_response.json()
    if not isinstance(rows, list):
        raise ValueError("Unexpected exchange-rate response")

    currencies_response = requests.get(app_settings._EXCHANGE_CURRENCY_URL, timeout=10)
    currencies_response.raise_for_status()
    currency_rows = currencies_response.json()
    if not isinstance(currency_rows, list):
        raise ValueError("Unexpected currency-list response")

    rates = {"EUR": 1.0}
    dates = set()
    for row in rows:
        if not isinstance(row, dict) or row.get("base") != "EUR":
            continue
        quote = row.get("quote")
        rate = row.get("rate")
        if isinstance(quote, str) and len(quote) == 3 and isinstance(rate, (int, float)) and rate > 0:
            rates[quote] = float(rate)
            if row.get("date"):
                dates.add(row["date"])

    currencies = []
    for item in currency_rows:
        if not isinstance(item, dict):
            continue
        code = item.get("iso_code")
        if code not in rates:
            continue
        currencies.append({
            "code": code,
            "name": str(item.get("name") or code),
            "symbol": str(item.get("symbol") or code),
        })
    currencies.sort(key=lambda item: item["code"])

    payload = {
        "date": max(dates) if dates else "",
        "base": "EUR",
        "rates": rates,
        "currencies": currencies,
        "fetched_at": int(time.time()),
    }
    if not _valid_payload(payload):
        raise ValueError("Exchange-rate response is incomplete")
    return payload


def _read_shared_cache():
    raw = cache_store.cache_get(app_settings._EXCHANGE_RATE_CACHE_KEY)
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None
    return payload if _valid_payload(payload) else None


def _remember(payload):
    app_settings._EXCHANGE_RATE_CACHE["payload"] = payload
    app_settings._EXCHANGE_RATE_CACHE["expires_at"] = time.time() + app_settings._EXCHANGE_RATE_CACHE_TTL


def _response(payload, cached, stale=False):
    response = jsonify({
        "ok": True,
        "date": payload.get("date", ""),
        "base": payload["base"],
        "rates": payload["rates"],
        "currencies": payload["currencies"],
        "cached": cached,
        "stale": stale,
    })
    response.headers["Cache-Control"] = "public, max-age=300, s-maxage=1800, stale-while-revalidate=21600"
    return response


@exchange_rates_bp.route("/api/exchange-rates")
def exchange_rates():
    now = time.time()
    local_payload = app_settings._EXCHANGE_RATE_CACHE.get("payload")
    if local_payload and app_settings._EXCHANGE_RATE_CACHE.get("expires_at", 0) > now:
        logger.info("event=exchange_rates_success source=memory stale=false currencies=%s", len(local_payload["currencies"]))
        return _response(local_payload, cached=True)

    with app_settings._EXCHANGE_RATE_LOCK:
        now = time.time()
        local_payload = app_settings._EXCHANGE_RATE_CACHE.get("payload")
        if local_payload and app_settings._EXCHANGE_RATE_CACHE.get("expires_at", 0) > now:
            logger.info("event=exchange_rates_success source=memory stale=false currencies=%s", len(local_payload["currencies"]))
            return _response(local_payload, cached=True)

        shared_payload = _read_shared_cache()
        if shared_payload and now - shared_payload.get("fetched_at", 0) <= app_settings._EXCHANGE_RATE_CACHE_TTL:
            _remember(shared_payload)
            logger.info("event=exchange_rates_success source=shared_cache stale=false currencies=%s", len(shared_payload["currencies"]))
            return _response(shared_payload, cached=True)
        if shared_payload and not local_payload:
            local_payload = shared_payload

        try:
            payload = _load_remote_rates()
        except (ValueError, requests.exceptions.RequestException) as exc:
            logger.warning("event=exchange_rates_remote_failed error_type=%s", type(exc).__name__)
            if local_payload and now - local_payload.get("fetched_at", 0) <= app_settings._EXCHANGE_RATE_STALE_TTL:
                logger.warning("event=exchange_rates_success source=stale_cache stale=true currencies=%s", len(local_payload["currencies"]))
                return _response(local_payload, cached=True, stale=True)
            return jsonify({"ok": False, "error": "exchange rates unavailable"}), 502

        _remember(payload)
        cache_store.cache_set(
            app_settings._EXCHANGE_RATE_CACHE_KEY,
            json.dumps(payload, separators=(",", ":")),
            app_settings._EXCHANGE_RATE_STALE_TTL,
        )
        logger.info("event=exchange_rates_success source=remote stale=false currencies=%s", len(payload["currencies"]))
        return _response(payload, cached=False)
