from unittest.mock import Mock

import requests

from service import cache_store


def test_disabled_cache_is_a_safe_noop(monkeypatch):
    session = Mock()
    monkeypatch.setattr(cache_store, "_session", session)

    assert cache_store.cache_get("key") is None
    assert cache_store.cache_set("key", "value", 60) is False
    assert cache_store.cache_incr("key") is None
    assert cache_store.cache_ttl("key") is None
    assert cache_store.cache_lrange("key", 0, 10) == []
    assert cache_store.cache_sadd("set", "value") is None
    assert cache_store.cache_scard("set") is None
    session.assert_not_called()


def test_command_parses_result(monkeypatch):
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"result": "PONG"}
    session = Mock()
    session.post.return_value = response
    monkeypatch.setattr(cache_store, "is_enabled", lambda: True)
    monkeypatch.setattr(cache_store, "_session", lambda: session)

    assert cache_store.ping() is True
    session.post.assert_called_once_with(
        cache_store._BASE_URL,
        json=["PING"],
        timeout=cache_store._REST_TIMEOUT,
    )


def test_command_handles_http_and_redis_errors(monkeypatch):
    response = Mock()
    response.raise_for_status.side_effect = requests.RequestException("offline")
    session = Mock()
    session.post.return_value = response
    monkeypatch.setattr(cache_store, "is_enabled", lambda: True)
    monkeypatch.setattr(cache_store, "_session", lambda: session)

    assert cache_store._command(["GET", "key"]) is None

    response.raise_for_status.side_effect = None
    response.json.return_value = {"error": "bad command"}
    assert cache_store._command(["GET", "key"]) is None


def test_cache_helpers_convert_results(monkeypatch):
    results = iter(["42", "not-a-number", "59", ["a", 1, "b"], "1", "bad", ["x", "2", "name", "value"]])
    monkeypatch.setattr(cache_store, "_command", lambda _args: next(results))

    assert cache_store.cache_incr("counter") == 42
    assert cache_store.cache_lpush("items", "value") is None
    assert cache_store.cache_ttl("counter") == 59
    assert cache_store.cache_lrange("items", 0, -1) == ["a", "b"]
    assert cache_store.cache_sadd("users", "u1") == 1
    assert cache_store.cache_scard("users") is None
    assert cache_store.cache_hgetall("stats") == {"x": 2, "name": "value"}


def test_cache_write_helpers_report_success(monkeypatch):
    results = iter(["OK", 1, "OK", 3, 1, 2, 5])
    monkeypatch.setattr(cache_store, "_command", lambda _args: next(results))

    assert cache_store.cache_set("key", "value", 60) is True
    assert cache_store.cache_del("key") is True
    assert cache_store.cache_ltrim("items", 0, 10) is True
    assert cache_store.cache_lpush("items", "value") == 3
    assert cache_store.cache_expire("key", 60) is True
    assert cache_store.cache_lrem("items", 1, "value") == 2
    assert cache_store.cache_hincrby("stats", "json") == 5
