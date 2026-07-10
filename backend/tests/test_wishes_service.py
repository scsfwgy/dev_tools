import pytest

from service.wishes import wishes_service


def test_clean_text_and_validation():
    assert wishes_service._clean_text("  hello\x00\x7f\nworld  ") == "hello\nworld"
    with pytest.raises(ValueError, match="不能为空"):
        wishes_service.add_wish("\x00 ", None, "127.0.0.1")
    with pytest.raises(ValueError, match="不能超过"):
        wishes_service.add_wish("x" * (wishes_service.MAX_TEXT + 1), None, "127.0.0.1")


def test_local_storage_is_newest_first_and_truncates_nick(monkeypatch):
    timestamps = iter([100, 200])
    monkeypatch.setattr(wishes_service.time, "time", lambda: next(timestamps))

    first = wishes_service.add_wish("first", "a" * 30, "127.0.0.1")
    second = wishes_service.add_wish("second", None, "127.0.0.1")

    assert first["nick"] == "a" * wishes_service.MAX_NICK
    assert [wish["id"] for wish in wishes_service.list_wishes()] == [second["id"], first["id"]]


def test_admin_token_reply_and_delete(monkeypatch):
    monkeypatch.setattr(wishes_service.time, "time", lambda: 100)
    wish = wishes_service.add_wish("hello", None, "127.0.0.1")

    with pytest.raises(PermissionError):
        wishes_service.reply_wish(wish["id"], "reply", "wrong")
    with pytest.raises(PermissionError):
        wishes_service.delete_wish(wish["id"], "wrong")

    replied = wishes_service.reply_wish(wish["id"], "answer", "test-admin-token")
    assert replied["reply"] == "answer"
    assert wishes_service.delete_wish(wish["id"], "test-admin-token") is True
    assert wishes_service.delete_wish("missing", "test-admin-token") is False


def test_reply_validation_and_missing_wish():
    with pytest.raises(ValueError, match="不能为空"):
        wishes_service.reply_wish("missing", " ", "test-admin-token")
    with pytest.raises(ValueError, match="不能超过"):
        wishes_service.reply_wish(
            "missing",
            "x" * (wishes_service.MAX_TEXT + 1),
            "test-admin-token",
        )
    assert wishes_service.reply_wish("missing", "valid", "test-admin-token") is None


def test_local_rate_limit_uses_rolling_window(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(wishes_service.time, "time", lambda: now[0])

    for _ in range(wishes_service.RATE_MAX):
        assert wishes_service.check_rate_limit("127.0.0.1") is True
    assert wishes_service.check_rate_limit("127.0.0.1") is False

    now[0] += wishes_service.RATE_WINDOW + 1
    assert wishes_service.check_rate_limit("127.0.0.1") is True
