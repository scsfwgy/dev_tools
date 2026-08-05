"""Vercel serverless entry point."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app import app  # noqa: E402, F401


class _RestorePathMiddleware:
    """Vercel rewrites route every request to /api/index and pass the original
    URL via the x-vercel-forwarded-url header, so WSGI PATH_INFO becomes
    /api/index and Flask can't match any route. Restore PATH_INFO from that
    header (parsing only the path component) so Flask routes on the real path.
    Direct calls to /api/index carry the same forwarded URL and stay untouched.
    """

    def __init__(self, wsgi_app):
        self._wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        if environ.get("PATH_INFO") == "/api/index":
            forwarded = (
                environ.get("HTTP_X_VERCEL_FORWARDED_URL")
                or environ.get("HTTP_X_VERCEL_FORWARDED_PATH")
            )
            if forwarded:
                from urllib.parse import urlsplit

                path = urlsplit(forwarded).path
                if path:
                    environ["PATH_INFO"] = path
            else:
                # Temporary probe: no recognized forwarded header — return the
                # x-vercel-* header names the runtime actually set (names only,
                # never values) so we can correct the lookup. Removed once fixed.
                names = sorted(key[5:].lower() for key in environ if key.startswith("HTTP_X_VERCEL"))
                body = ("vercel_rewrite_no_forwarded_path headers=" + ",".join(names)).encode("utf-8")
                start_response("200 OK", [("Content-Type", "text/plain; charset=utf-8"), ("Content-Length", str(len(body)))])
                return [body]
        return self._wsgi_app(environ, start_response)


app.wsgi_app = _RestorePathMiddleware(app.wsgi_app)
