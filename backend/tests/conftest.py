import pytest


@pytest.fixture(autouse=True)
def isolate_external_state(monkeypatch, tmp_path):
    import app_settings
    from service import cache_store
    from service.wishes import captcha, wishes_service

    monkeypatch.setattr(cache_store, "is_enabled", lambda: False)
    monkeypatch.setattr(app_settings, "_COUNTER_PATH", tmp_path / "visit_count.json")
    monkeypatch.setattr(app_settings, "_UNIQUE_VISIT_PATH", tmp_path / "unique_visits.json")
    monkeypatch.setattr(wishes_service, "_WISHES_PATH", tmp_path / "wishes.json")
    monkeypatch.setenv("WISH_ADMIN_TOKEN", "test-admin-token")

    captcha._local_store.clear()
    wishes_service._rate_store.clear()
    yield
    captcha._local_store.clear()
    wishes_service._rate_store.clear()


@pytest.fixture
def client():
    from app import app

    app.config.update(TESTING=True)
    with app.test_client() as test_client:
        yield test_client
