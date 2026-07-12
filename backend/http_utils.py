"""Shared HTTP helpers."""
import hmac
import os

from flask import request


def _client_ip() -> str:
    """Best-effort client IP from X-Forwarded-For, fallback remote_addr."""
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _check_admin_token() -> bool:
    """Verify admin token from ?token= query param."""
    token = request.args.get("token", "")
    admin = os.getenv("WISH_ADMIN_TOKEN", "")
    if not admin or not token:
        return False
    return hmac.compare_digest(token, admin)
