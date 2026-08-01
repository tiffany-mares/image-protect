"""Tests for auth.get_user_id. No FastAPI/model imports - runs in ms."""
import base64
import time

import jwt as pyjwt

from auth import get_user_id

SECRET_B64 = base64.b64encode(b"k" * 48).decode()
KEY = base64.b64decode(SECRET_B64)


def _token(sub="user-123", key=KEY, alg="HS256", exp_offset=3600, include_sub=True):
    now = int(time.time())
    payload = {"email": "a@b.com", "iat": now, "exp": now + exp_offset}
    if include_sub:
        payload["sub"] = sub
    return pyjwt.encode(payload, key, algorithm=alg)


def test_valid_bearer_token_returns_sub(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_B64)
    assert get_user_id("Bearer " + _token(sub="abc-def")) == "abc-def"


def test_missing_header_returns_none(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_B64)
    assert get_user_id(None) is None


def test_not_bearer_scheme_returns_none(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_B64)
    assert get_user_id("Basic abcdef") is None


def test_garbage_token_returns_none(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_B64)
    assert get_user_id("Bearer not.a.jwt") is None


def test_wrong_key_returns_none(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_B64)
    assert get_user_id("Bearer " + _token(key=b"x" * 48)) is None


def test_expired_token_returns_none(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_B64)
    assert get_user_id("Bearer " + _token(exp_offset=-10)) is None


def test_missing_sub_returns_none(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_B64)
    assert get_user_id("Bearer " + _token(include_sub=False)) is None


def test_no_secret_configured_returns_none(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    assert get_user_id("Bearer " + _token()) is None
