"""MongoDB job logging module.

Provides:
    log_job(doc)          -- insert a job document, return its _id as str;
                             fails silently (returns None) on error
    get_recent_jobs(limit) -- return recent jobs sorted by timestamp desc

Environment:
    MONGODB_URI  -- default: mongodb://localhost:27017
                   For Atlas: mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true
"""

import logging
import os

from pymongo import MongoClient, DESCENDING

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level connection (opened once at import time)
# ---------------------------------------------------------------------------

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")

try:
    _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
    _db = _client["inkshield"]
except Exception as exc:  # pragma: no cover
    logger.warning("MongoDB connection failed at import time: %s", exc)
    _client = None
    _db = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def log_job(doc: dict) -> str | None:
    """Insert *doc* into inkshield.jobs; return the inserted _id as str.

    Fails silently (returns None) on any error.
    """
    if _db is None:
        logger.warning("MongoDB unavailable — skipping log_job")
        return None
    try:
        result = _db["jobs"].insert_one(doc)
        return str(result.inserted_id)
    except Exception as exc:
        logger.warning("log_job failed: %s", exc)
        return None


def get_recent_jobs(limit: int = 20) -> list:
    """Return the most recent *limit* jobs, sorted by timestamp descending.

    Returns an empty list if MongoDB is unavailable.
    """
    if _db is None:
        return []
    try:
        cursor = (
            _db["jobs"]
            .find({}, {"_id": 1, "job_id": 1, "timestamp": 1, "epsilon": 1,
                       "steps": 1, "predictions": 1})
            .sort("timestamp", DESCENDING)
            .limit(limit)
        )
        jobs = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            jobs.append(doc)
        return jobs
    except Exception as exc:
        logger.warning("get_recent_jobs failed: %s", exc)
        return []
