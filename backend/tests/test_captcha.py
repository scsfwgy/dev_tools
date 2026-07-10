from service.wishes import captcha


def test_generate_returns_id_and_svg(monkeypatch):
    choices = iter("ABCD")
    monkeypatch.setattr(captcha.random, "choice", lambda values: next(choices) if values == captcha._ALPHABET else values[0])
    monkeypatch.setattr(captcha.random, "randint", lambda start, _end: start)

    captcha_id, svg = captcha.generate()

    assert len(captcha_id) == 32
    assert svg.startswith("<svg")
    assert svg.count("<text ") == 4
    assert captcha.verify(captcha_id, "abcd") is True


def test_verify_is_case_insensitive_and_one_time():
    captcha._store_answer("captcha-id", "abcd")

    assert captcha.verify("captcha-id", " AbCd ") is True
    assert captcha.verify("captcha-id", "abcd") is False


def test_verify_rejects_missing_values():
    assert captcha.verify("", "answer") is False
    assert captcha.verify("captcha-id", "") is False


def test_expired_answers_are_purged(monkeypatch):
    monkeypatch.setattr(captcha.time, "time", lambda: 1000.0)
    captcha._local_store["expired"] = ("abcd", 999.0)
    captcha._local_store["active"] = ("efgh", 1001.0)

    assert captcha.verify("expired", "abcd") is False
    assert "expired" not in captcha._local_store
    assert captcha.verify("active", "efgh") is True
