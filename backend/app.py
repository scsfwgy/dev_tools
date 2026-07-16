"""DevTools — Flask app."""
import logging
import os
import re
from time import perf_counter
from uuid import uuid4

from flask import Flask, request, send_from_directory
from flask_cors import CORS

import app_settings
from routes import translate
from routes.area_search import (
    _area_intro_cache_get,
    _area_intro_cache_key,
    _area_intro_cache_set,
    _check_area_intro_rate_limit,
    _load_world_countries,
    _resolve_area_path,
    area_search_bp,
)
from routes.content import content_bp
from routes.exchange_rates import exchange_rates_bp
from routes.site import content_last_modified, immutable_asset_cache_enabled, public_tool_ids, site_bp
from routes.stats import stats_bp
from routes.translate import _build_prompt, _is_chinese, _is_short, translate_bp
from routes.wishes import wishes_bp
from service import cache_store
from tool_data import TOOLS, TOOL_REGISTRY

app = Flask(__name__, static_folder=None)
CORS(app)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Werkzeug's access logger includes the raw query string. Keep its startup
# warnings, but rely on the structured request log below so admin tokens or
# other query values are never copied into service logs.
logging.getLogger("werkzeug").setLevel(logging.WARNING)

app.register_blueprint(site_bp)
app.register_blueprint(wishes_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(translate_bp)
app.register_blueprint(area_search_bp)
app.register_blueprint(content_bp)
app.register_blueprint(exchange_rates_bp)


def _request_logging_enabled() -> bool:
    return os.getenv("REQUEST_LOG", "1").lower() not in ("0", "false", "no", "off")


def _log_path(path: str) -> str:
    return re.sub(r"^/api/(content|wishes)/[^/]+", r"/api/\1/:id", path)


@app.before_request
def mark_request_start():
    request.environ["devtools_request_id"] = uuid4().hex[:12]
    if _request_logging_enabled():
        request.environ["devtools_request_start"] = perf_counter()


@app.after_request
def prevent_api_indexing(response):
    request_id = request.environ.get("devtools_request_id", "-")
    response.headers["X-Request-ID"] = request_id
    if request.path.startswith("/api/"):
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
    if response.status_code == 404:
        response.headers["Cache-Control"] = "public, max-age=0, s-maxage=300"
    elif request.path.startswith(("/css/", "/js/")) and not immutable_asset_cache_enabled():
        response.headers["Cache-Control"] = "no-store"
    elif request.path.startswith(("/locales/", "/api/tool-manifest")) and not immutable_asset_cache_enabled():
        response.headers["Cache-Control"] = "no-store"
    elif request.path.startswith(("/css/", "/js/")):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif request.path.startswith("/locales/"):
        response.headers["Cache-Control"] = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    elif request.path == "/api/tool-manifest":
        response.headers["Cache-Control"] = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    elif request.method == "GET" and (
        request.path in ("/", "/robots.txt", "/sitemap.xml")
        or not request.path.startswith("/api/")
    ):
        response.headers["Cache-Control"] = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
    if _request_logging_enabled() and request.path.startswith("/api/"):
        start = request.environ.get("devtools_request_start")
        if start is not None:
            duration_ms = (perf_counter() - start) * 1000
            logger.info(
                "event=http_request request_id=%s method=%s path=%s status=%s duration_ms=%.1f",
                request_id,
                request.method,
                _log_path(request.path),
                response.status_code,
                duration_ms,
            )
    return response


@app.errorhandler(404)
def not_found(_error):
    response = send_from_directory(str(app_settings.FRONTEND_DIR), "404.html")
    response.status_code = 404
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["Cache-Control"] = "public, max-age=0, s-maxage=300"
    return response


if set(public_tool_ids()) != set(TOOLS):
    raise RuntimeError("TOOL_REGISTRY indexable entries must match TOOLS SEO entries")

logger.info(
    "event=app_start environment=%s host=%s flask_debug=%s site_url=%s tools=%s indexable_tools=%s redis=%s deepseek=%s immutable_assets=%s",
    os.getenv("VERCEL_ENV", "local"),
    os.getenv("HOST", "0.0.0.0"),
    os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "yes", "on"),
    app_settings.SITE_URL,
    len(TOOL_REGISTRY),
    len(public_tool_ids()),
    cache_store.is_enabled(),
    bool(app_settings._DEEPSEEK_KEY),
    immutable_asset_cache_enabled(),
)


_AREA_INTRO_LOCAL_CACHE = app_settings._AREA_INTRO_LOCAL_CACHE
_AREA_INTRO_RATE_STORE = app_settings._AREA_INTRO_RATE_STORE


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8731"))
    debug = os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "yes", "on")
    app.run(host=host, port=port, debug=debug)
