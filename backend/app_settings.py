"""Shared app settings and mutable module state."""
import os
import threading
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"
SITE_URL = os.getenv("SITE_URL", "https://dev.tools24.uk").rstrip("/")
SUPPORTED_LANGS = {"zh", "en"}
_AREA_CONFIG_DIR = BACKEND_DIR / "config"

_AREA_CHINA_CACHE = None
_AREA_WORLD_CACHE = None
_AREA_SEARCH_DEFAULT_LIMIT = 30
_AREA_SEARCH_MAX_LIMIT = 50
_AREA_INTRO_RATE_MAX = 10
_AREA_INTRO_RATE_WINDOW = 600
_AREA_INTRO_CACHE_TTL = 7 * 24 * 3600
_AREA_INTRO_LOCAL_CACHE = {}
_AREA_INTRO_RATE_STORE = {}
_AREA_INTRO_LOCK = threading.Lock()
_AREA_INTRO_PROMPT = None

_VISIT_KEY = "visit_count"
_COUNTER_PATH = Path("/tmp/visit_count.json") if Path("/tmp").exists() else BACKEND_DIR / "config" / "visit_count.json"
_counter_lock = threading.Lock()
_UNIQUE_VISIT_KEY_PREFIX = "unique_visits:"
_UNIQUE_VISIT_DAILY_COUNTS_KEY = "unique_visit_daily_counts"
_UNIQUE_VISIT_TTL = 31 * 24 * 3600
_UNIQUE_VISIT_PATH = Path("/tmp/unique_visits.json") if Path("/tmp").exists() else BACKEND_DIR / "config" / "unique_visits.json"
_unique_visit_lock = threading.Lock()
_TOOL_CLICK_KEY = "tool_clicks"

_EXCHANGE_RATE_URL = "https://api.frankfurter.dev/v2/rates"
_EXCHANGE_CURRENCY_URL = "https://api.frankfurter.dev/v2/currencies"
_EXCHANGE_RATE_CACHE_KEY = "exchange_rates:v1"
_EXCHANGE_RATE_CACHE_TTL = 24 * 3600
_EXCHANGE_RATE_STALE_TTL = 7 * 24 * 3600
_EXCHANGE_RATE_CACHE = {"payload": None, "expires_at": 0.0}
_EXCHANGE_RATE_LOCK = threading.Lock()

_DEEPSEEK_KEY = os.getenv("DEV_TOOLS_DEEPSEEK_API_KEY", "")
_DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

_MAX_CONTENT_SIZE = 1024
_CONTENT_TTL = 7 * 24 * 3600
_CONTENT_KEY_PREFIX = "content:"
_CONTENT_LIST_KEY = "content_list"
_CONTENT_STORE_DIR = Path("/tmp/content_store") if Path("/tmp").exists() else BACKEND_DIR / "config" / "content_store"
