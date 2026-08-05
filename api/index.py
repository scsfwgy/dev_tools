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
            # vercel.json rewrites every route to /api/index and injects the
            # original path as the __path query param (Vercel no longer passes
            # the original path anywhere in the WSGI environ). First value wins
            # so the rewrite's own injection takes precedence over any client
            # forgery.
            path = None
            for part in environ.get("QUERY_STRING", "").split("&"):
                if part.startswith("__path="):
                    path = part[len("__path="):]
                    break
            if path is not None:
                from urllib.parse import unquote

                environ["PATH_INFO"] = unquote(path) or "/"
        return self._wsgi_app(environ, start_response)


app.wsgi_app = _RestorePathMiddleware(app.wsgi_app)
