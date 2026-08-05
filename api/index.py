"""Vercel serverless entry point."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app import app  # noqa: E402, F401


class _RestorePathMiddleware:
    """Vercel rewrites route every request to /api/index, leaving WSGI PATH_INFO
    as /api/index (the original path is no longer available anywhere in the
    environ). vercel.json injects the original path as the __path query param;
    restore PATH_INFO from it so Flask routes on the real path.
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
