"""FastAPI backend for Image Protect.

Endpoints:
    GET  /health   -- liveness probe
    POST /protect  -- run PGD attack, store in S3, return presigned URLs
"""

import io
import os
import traceback
import uuid

import boto3
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from attack import pgd_attack

# ---------------------------------------------------------------------------
# Config from environment
# ---------------------------------------------------------------------------

CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")
S3_BUCKET = os.environ.get("S3_BUCKET", "")

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

s3 = boto3.client("s3")

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
    # Read uploaded bytes and open as PIL RGB image
    raw_bytes = await file.read()
    image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    # Run PGD attack (steps fixed at 8 per spec)
    protected_image, predictions = pgd_attack(image, eps=epsilon, steps=8)

    # Encode protected image to PNG bytes
    protected_buf = io.BytesIO()
    protected_image.save(protected_buf, format="PNG")
    protected_bytes = protected_buf.getvalue()

    # Generate a unique job ID and derive S3 keys
    job_id = str(uuid.uuid4())
    original_key = f"originals/{job_id}.png"
    protected_key = f"protected/{job_id}.png"

    # Upload original bytes (re-encoded as PNG for consistency)
    original_buf = io.BytesIO()
    image.save(original_buf, format="PNG")
    original_png_bytes = original_buf.getvalue()

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=original_key,
        Body=original_png_bytes,
        ContentType="image/png",
    )
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=protected_key,
        Body=protected_bytes,
        ContentType="image/png",
    )

    # Generate 1-hour presigned GET URLs
    original_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": original_key},
        ExpiresIn=3600,
    )
    protected_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": protected_key},
        ExpiresIn=3600,
    )

    return {
        "protected_url": protected_url,
        "original_url": original_url,
        "job_id": job_id,
        "predictions": predictions,
    }
