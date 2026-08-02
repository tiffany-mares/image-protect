"""FastAPI backend for Image Protect.

Endpoints:
    GET  /health   -- liveness probe
    POST /protect  -- run ensemble PGD attack, return presigned S3 URLs (if
                      S3_BUCKET is set) or base64 data URLs (fallback for
                      local/demo use)
    GET  /jobs     -- recent job history from MongoDB (empty list if Mongo
                      unavailable)
"""

import base64
import io
import os
import uuid
from datetime import datetime, timezone

import boto3
from fastapi import FastAPI, File, Form, Header, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from attack import ensemble_pgd_attack
from auth import get_user_id
from db import get_recent_jobs, log_job
from pgdb import insert_image

# ---------------------------------------------------------------------------
# Config from environment
# ---------------------------------------------------------------------------

CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")
S3_BUCKET   = os.environ.get("S3_BUCKET", "")

# Lazily instantiate the S3 client only when a bucket is configured so the
# server starts cleanly without AWS credentials in local/demo mode.
_s3 = None

def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Image Protect API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_png_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _to_data_url(png_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/protect")
async def protect(
    file: UploadFile = File(...),
    epsilon: float = Form(0.02),
    authorization: str | None = Header(None),
):
    # Optional auth: a valid Bearer JWT identifies the user for persistence;
    # missing or invalid tokens fall back to anonymous Phase 1 behavior.
    user_id = get_user_id(authorization)

    # Read and decode uploaded image
    raw_bytes = await file.read()
    image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    # Run ensemble PGD attack (each step: one ResNet-50 + one MobileNetV2 sub-step)
    protected_image, predictions = ensemble_pgd_attack(image, eps=epsilon, steps=4)

    job_id = str(uuid.uuid4())

    original_png  = _to_png_bytes(image)
    protected_png = _to_png_bytes(protected_image)

    original_key  = None
    protected_key = None

    if S3_BUCKET:
        # --- S3 path: upload and return presigned URLs ---
        s3 = _get_s3()
        original_key  = f"originals/{job_id}.png"
        protected_key = f"protected/{job_id}.png"

        s3.put_object(Bucket=S3_BUCKET, Key=original_key,  Body=original_png,  ContentType="image/png")
        s3.put_object(Bucket=S3_BUCKET, Key=protected_key, Body=protected_png, ContentType="image/png")

        original_url  = s3.generate_presigned_url("get_object", Params={"Bucket": S3_BUCKET, "Key": original_key},  ExpiresIn=3600)
        protected_url = s3.generate_presigned_url("get_object", Params={"Bucket": S3_BUCKET, "Key": protected_key}, ExpiresIn=3600)
        # Same object, but signed with a Content-Disposition override so S3 serves
        # it as an attachment — makes the browser download rather than open it
        # (the plain presigned URL is cross-origin, so the <a download> attribute
        # is ignored). Used only by the "Download protected" button.
        download_url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": protected_key,
                "ResponseContentDisposition": f'attachment; filename="inkshield-protected-{job_id}.png"',
            },
            ExpiresIn=3600,
        )
    else:
        # --- Fallback: return images as base64 data URLs (no AWS needed) ---
        original_url  = _to_data_url(original_png)
        protected_url = _to_data_url(protected_png)
        # Data URLs are same-origin, so the <a download> attribute already works.
        download_url = protected_url

    # Fail-silent job log (db.log_job never raises); user_id is None for
    # anonymous lab use — Phase 1 behavior preserved.
    mongo_job_id = log_job({
        "job_id":            job_id,
        "user_id":           user_id,
        "timestamp":         datetime.now(timezone.utc).isoformat(),
        "epsilon":           epsilon,
        "steps":             4,
        "predictions":       predictions,
        "original_s3_key":   original_key,
        "protected_s3_key":  protected_key,
    })

    response = {
        "protected_url": protected_url,
        "download_url":  download_url,
        "original_url":  original_url,
        "job_id":        job_id,
        "predictions":   predictions,
    }

    if user_id:
        # images.s3_url stores the durable S3 key (presigned at read time by
        # the gateway later) — never the 1-hour presigned URL.
        image_id = insert_image(user_id, mongo_job_id or job_id, protected_key or "")
        if image_id:
            response["image_id"] = image_id

    return response


@app.get("/jobs")
def jobs(limit: int = 20):
    """Return recent protection jobs (empty list if MongoDB is unavailable)."""
    return get_recent_jobs(limit)
