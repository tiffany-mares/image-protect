"""FastAPI backend for Image Protect.

Endpoints:
    GET  /health   -- liveness probe
    POST /protect  -- run PGD attack, return presigned S3 URLs (if S3_BUCKET
                      is set) or base64 data URLs (fallback for local/demo use)
"""

import base64
import io
import os
import uuid

import boto3
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from attack import pgd_attack

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
):
    # Read and decode uploaded image
    raw_bytes = await file.read()
    image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    # Run PGD attack (4 steps: faster with negligible strength loss)
    protected_image, predictions = pgd_attack(image, eps=epsilon, steps=4)

    job_id = str(uuid.uuid4())

    original_png  = _to_png_bytes(image)
    protected_png = _to_png_bytes(protected_image)

    if S3_BUCKET:
        # --- S3 path: upload and return presigned URLs ---
        s3 = _get_s3()
        original_key  = f"originals/{job_id}.png"
        protected_key = f"protected/{job_id}.png"

        s3.put_object(Bucket=S3_BUCKET, Key=original_key,  Body=original_png,  ContentType="image/png")
        s3.put_object(Bucket=S3_BUCKET, Key=protected_key, Body=protected_png, ContentType="image/png")

        original_url  = s3.generate_presigned_url("get_object", Params={"Bucket": S3_BUCKET, "Key": original_key},  ExpiresIn=3600)
        protected_url = s3.generate_presigned_url("get_object", Params={"Bucket": S3_BUCKET, "Key": protected_key}, ExpiresIn=3600)
    else:
        # --- Fallback: return images as base64 data URLs (no AWS needed) ---
        original_url  = _to_data_url(original_png)
        protected_url = _to_data_url(protected_png)

    return {
        "protected_url": protected_url,
        "original_url":  original_url,
        "job_id":        job_id,
        "predictions":   predictions,
    }
