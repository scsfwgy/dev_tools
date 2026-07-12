"""DevTools — Flask app."""
import logging
import os

from flask import Flask, request
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
from routes.site import content_last_modified, public_tool_ids, site_bp
from routes.stats import stats_bp
from routes.translate import _build_prompt, _is_chinese, _is_short, translate_bp
from routes.wishes import wishes_bp
from service import cache_store
from tool_data import TOOLS, TOOL_REGISTRY

app = Flask(__name__, static_folder=None)
CORS(app)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app.register_blueprint(site_bp)
app.register_blueprint(wishes_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(translate_bp)
app.register_blueprint(area_search_bp)
app.register_blueprint(content_bp)


@app.after_request
def prevent_api_indexing(response):
    if request.path.startswith("/api/"):
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response


if set(public_tool_ids()) != set(TOOLS):
    raise RuntimeError("TOOL_REGISTRY indexable entries must match TOOLS SEO entries")


_AREA_INTRO_LOCAL_CACHE = app_settings._AREA_INTRO_LOCAL_CACHE
_AREA_INTRO_RATE_STORE = app_settings._AREA_INTRO_RATE_STORE


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8731"))
    debug = os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "yes", "on")
    app.run(host=host, port=port, debug=debug)
