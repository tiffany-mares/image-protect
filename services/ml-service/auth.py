"""Optional JWT verification for /protect.

Shared-secret contract with the Spring Boot auth service (phase2-architecture.md
section 3): HS256, key = base64-decoded JWT_SECRET (Spring does
Keys.hmacShaKeyFor(Base64.decode(secret)) - the raw bytes are the HMAC key).

Missing or invalid tokens are treated identically: the caller is anonymous.
This module never raises.
"""

import base64
import logging
import os

import jwt as pyjwt

logger = logging.getLogger(__name__)


def get_user_id(authorization: str | None) -> str | None:
    """Return the JWT ``sub`` claim from a ``Bearer`` header, or None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    secret_b64 = os.environ.get("JWT_SECRET", "")
    if not secret_b64:
        logger.warning("JWT_SECRET not set - treating request as anonymous")
        return None
    token = authorization[len("Bearer "):]
    try:
        key = base64.b64decode(secret_b64)
        claims = pyjwt.decode(token, key, algorithms=["HS256"])
        return claims.get("sub") or None
    except Exception as exc:
        logger.info("JWT rejected (%s) - treating request as anonymous", exc)
        return None
