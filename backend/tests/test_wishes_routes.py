from unittest.mock import Mock

import routes.wishes as wishes_routes


def test_list_and_captcha_routes(client, monkeypatch):
    monkeypatch.setattr(wishes_routes, "list_wishes", lambda: [{"id": "1"}])
    monkeypatch.setattr(wishes_routes.captcha, "generate", lambda: ("captcha-id", "<svg/>"))

    wishes = client.get("/api/wishes")
    captcha = client.get("/api/wishes/captcha")

    assert wishes.get_json() == {"wishes": [{"id": "1"}]}
    assert captcha.get_json() == {"captcha_id": "captcha-id", "svg": "<svg/>"}


def test_post_wish_rejects_bad_captcha(client, monkeypatch):
    monkeypatch.setattr(wishes_routes.captcha, "verify", lambda _cid, _answer: False)

    response = client.post("/api/wishes", json={"text": "hello"})

    assert response.status_code == 400
    assert "验证码" in response.get_json()["error"]


def test_post_wish_enforces_rate_limit(client, monkeypatch):
    monkeypatch.setattr(wishes_routes.captcha, "verify", lambda _cid, _answer: True)
    monkeypatch.setattr(wishes_routes, "check_rate_limit", lambda _ip: False)

    response = client.post(
        "/api/wishes",
        json={"text": "hello", "captcha_id": "id", "captcha_answer": "answer"},
    )

    assert response.status_code == 429


def test_post_wish_uses_forwarded_ip(client, monkeypatch):
    add_wish = Mock(return_value={"id": "wish-id", "text": "hello"})
    rate_limit = Mock(return_value=True)
    monkeypatch.setattr(wishes_routes.captcha, "verify", lambda _cid, _answer: True)
    monkeypatch.setattr(wishes_routes, "check_rate_limit", rate_limit)
    monkeypatch.setattr(wishes_routes, "add_wish", add_wish)

    response = client.post(
        "/api/wishes",
        headers={"X-Forwarded-For": "203.0.113.9, 10.0.0.1"},
        json={
            "text": "hello",
            "nick": "tester",
            "captcha_id": "id",
            "captcha_answer": "answer",
        },
    )

    assert response.status_code == 201
    rate_limit.assert_called_once_with("203.0.113.9")
    add_wish.assert_called_once_with("hello", "tester", "203.0.113.9")


def test_post_wish_returns_validation_error(client, monkeypatch):
    monkeypatch.setattr(wishes_routes.captcha, "verify", lambda _cid, _answer: True)
    monkeypatch.setattr(wishes_routes, "check_rate_limit", lambda _ip: True)
    monkeypatch.setattr(wishes_routes, "add_wish", Mock(side_effect=ValueError("bad text")))

    response = client.post(
        "/api/wishes",
        json={"captcha_id": "id", "captcha_answer": "answer"},
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "bad text"}


def test_admin_verification_route(client, monkeypatch):
    monkeypatch.setattr(wishes_routes, "verify_admin_token", lambda token: token == "good")

    assert client.post("/api/wishes/verify-admin", headers={"X-Admin-Token": "good"}).status_code == 200
    assert client.post("/api/wishes/verify-admin", headers={"X-Admin-Token": "bad"}).status_code == 403


def test_reply_route_statuses(client, monkeypatch):
    monkeypatch.setattr(wishes_routes, "reply_wish", Mock(side_effect=PermissionError("denied")))
    assert client.patch("/api/wishes/1/reply", json={"reply": "hello"}).status_code == 403

    monkeypatch.setattr(wishes_routes, "reply_wish", Mock(side_effect=ValueError("bad reply")))
    assert client.patch("/api/wishes/1/reply", json={"reply": ""}).status_code == 400

    monkeypatch.setattr(wishes_routes, "reply_wish", lambda _id, _reply, _token: None)
    assert client.patch("/api/wishes/1/reply", json={"reply": "hello"}).status_code == 404

    monkeypatch.setattr(wishes_routes, "reply_wish", lambda _id, _reply, _token: {"id": "1", "reply": "hello"})
    response = client.patch("/api/wishes/1/reply", json={"reply": "hello"})
    assert response.status_code == 200
    assert response.get_json()["reply"] == "hello"


def test_delete_route_statuses(client, monkeypatch):
    monkeypatch.setattr(wishes_routes, "delete_wish", Mock(side_effect=PermissionError("denied")))
    assert client.delete("/api/wishes/1").status_code == 403

    monkeypatch.setattr(wishes_routes, "delete_wish", lambda _id, _token: False)
    assert client.delete("/api/wishes/1").status_code == 404

    monkeypatch.setattr(wishes_routes, "delete_wish", lambda _id, _token: True)
    response = client.delete("/api/wishes/1")
    assert response.status_code == 200
    assert response.get_json() == {"ok": True}
