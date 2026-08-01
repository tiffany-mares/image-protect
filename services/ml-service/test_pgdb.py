"""Tests for pgdb.insert_image. Connection is mocked - no live DB needed."""
from unittest.mock import MagicMock, patch

import pgdb


def test_no_database_url_returns_none(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert pgdb.insert_image("u", "m", "s") is None


def test_insert_returns_id(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://x")
    fake_cur = MagicMock()
    fake_cur.fetchone.return_value = ("11111111-2222-3333-4444-555555555555",)
    fake_conn = MagicMock()
    fake_conn.__enter__.return_value = fake_conn
    fake_conn.cursor.return_value.__enter__.return_value = fake_cur
    with patch.object(pgdb.psycopg, "connect", return_value=fake_conn) as mock_connect:
        image_id = pgdb.insert_image("user-1", "mongo-1", "protected/x.png")
    assert image_id == "11111111-2222-3333-4444-555555555555"
    mock_connect.assert_called_once_with("postgresql://x", autocommit=True)
    sql, params = fake_cur.execute.call_args[0]
    assert "INSERT INTO images" in sql
    assert params == ("user-1", "mongo-1", "protected/x.png")


def test_connection_failure_returns_none(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://x")
    with patch.object(pgdb.psycopg, "connect", side_effect=RuntimeError("boom")):
        assert pgdb.insert_image("u", "m", "s") is None
