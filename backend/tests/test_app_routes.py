import json
from unittest.mock import Mock

import requests


def test_health_and_ip_routes(client):
    health = client.get("/api/health")
    ip = client.get("/api/ip", headers={"X-Forwarded-For": "203.0.113.10, 10.0.0.1"})

    assert health.status_code == 200
    assert health.get_json() == {"status": "ok"}
    assert ip.get_json() == {"ip": "203.0.113.10"}


def test_spa_routes_render_seo_and_fallback(client):
    response = client.get("/en/tool/json")
    fallback = client.get("/fr/tool/unknown")

    html = response.get_data(as_text=True)
    assert response.status_code == 200
    assert '<html lang="en">' in html
    assert "https://www.tools24.uk/en/tool/json" in html
    assert "JSON Formatter and Validator Online" in html
    assert fallback.status_code == 200
    assert "<!--SEO_TITLE-->" in fallback.get_data(as_text=True)


def test_visit_counter_is_read_only_then_increments(client):
    assert client.get("/api/visits").get_json() == {"count": 0}
    assert client.get("/api/visits").get_json() == {"count": 0}
    assert client.post("/api/visits/increment").get_json() == {"count": 1}
    assert client.get("/api/visits").get_json() == {"count": 1}


def test_translate_requires_api_key(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module, "_DEEPSEEK_KEY", "")

    response = client.post("/api/translate", json={"text": "hello"})

    assert response.status_code == 503
    assert response.get_json()["ok"] is False


def test_translate_validates_input(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module, "_DEEPSEEK_KEY", "test-key")

    empty = client.post("/api/translate", json={"text": "  "})
    too_long = client.post("/api/translate", json={"text": "x" * 5001})

    assert empty.status_code == 400
    assert too_long.status_code == 400


def test_translate_parses_success_response(client, monkeypatch):
    import app as app_module

    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [{"message": {"content": "```json\n{\"translation\": \"你好\", \"phonetic\": \"nǐ hǎo\", \"pos\": \"感叹词\"}\n```"}}]
    }
    post = Mock(return_value=response)
    monkeypatch.setattr(app_module, "_DEEPSEEK_KEY", "test-key")
    monkeypatch.setattr(app_module.requests, "post", post)

    result = client.post("/api/translate", json={"text": "hello"})

    assert result.status_code == 200
    assert result.get_json() == {
        "ok": True,
        "translation": "你好",
        "phonetic": "nǐ hǎo",
        "pos": "感叹词",
        "is_short": True,
        "source_lang": "auto",
        "target_lang": "zh",
    }
    assert post.call_args.kwargs["timeout"] == 15


def test_translate_handles_request_failure(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module, "_DEEPSEEK_KEY", "test-key")
    monkeypatch.setattr(
        app_module.requests,
        "post",
        Mock(side_effect=requests.RequestException("unavailable")),
    )

    response = client.post("/api/translate", json={"text": "hello"})

    assert response.status_code == 500
    assert response.get_json()["ok"] is False


def test_translation_helpers_cover_language_and_length():
    import app as app_module

    assert app_module._is_chinese("你好世界") is True
    assert app_module._is_chinese("hello") is False
    assert app_module._is_short("one two three four five") is True
    assert app_module._is_short("one two three four five six") is False
    assert "English translation" in app_module._build_prompt("你好")
    assert "Simplified Chinese" in app_module._build_prompt("hello world")
