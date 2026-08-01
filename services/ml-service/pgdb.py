"""Postgres (Neon) writes for the ML service.

Owns exactly one operation: inserting the images row when an authenticated
user's protection run is saved (phase2-architecture.md section 1 ownership
split - everything else on images/likes belongs to the Go gateway).

Fail-silent like db.py: persistence problems must never break /protect.
"""

import logging
import os

import psycopg

logger = logging.getLogger(__name__)

_INSERT_SQL = (
    "INSERT INTO images (user_id, mongo_job_id, s3_url) "
    "VALUES (%s, %s, %s) RETURNING id"
)


def insert_image(user_id: str, mongo_job_id: str, s3_url: str) -> str | None:
    """Insert an images row; return its UUID as str, or None on any failure."""
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        logger.warning("DATABASE_URL not set - skipping images insert")
        return None
    try:
        with psycopg.connect(dsn, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(_INSERT_SQL, (user_id, mongo_job_id, s3_url))
                return str(cur.fetchone()[0])
    except Exception as exc:
        logger.warning("insert_image failed: %s", exc)
        return None
