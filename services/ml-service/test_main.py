"""Tests for main.py wiring (ensemble attack, job logging, /jobs).

Run from backend/:  python -m pytest test_main.py -v

The attack and DB functions are patched out, so tests are fast and need
no MongoDB/AWS. Importing main still loads ResNet-50 once (cached weights).
"""

import io
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

import main


def _fake_attack(image, eps=0.02, steps=4):
    pred = {"index": 1, "label": "goldfish", "confidence": 0.9}
    per_model = {"original": pred, "protected": pred}
    return image, {"resnet50": per_model, "mobilenet": per_model}


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), "red").save(buf, format="PNG")
    return buf.getvalue()


def test_protect_returns_ensemble_predictions_and_logs_job():
    with patch.object(main, "ensemble_pgd_attack", side_effect=_fake_attack), \
         patch.object(main, "log_job") as mock_log:
        client = TestClient(main.app)
        resp = client.post(
            "/protect",
            files={"file": ("t.png", _png_bytes(), "image/png")},
            data={"epsilon": "0.02"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "resnet50" in body["predictions"]
    assert "mobilenet" in body["predictions"]
    assert body["original_url"].startswith("data:image/png;base64,")
    assert body["protected_url"].startswith("data:image/png;base64,")

    mock_log.assert_called_once()
    doc = mock_log.call_args[0][0]
    assert doc["job_id"] == body["job_id"]
    assert doc["epsilon"] == 0.02
    assert doc["steps"] == 4
    assert "timestamp" in doc
    assert doc["original_s3_key"] is None      # no S3_BUCKET in local mode
    assert doc["protected_s3_key"] is None


def test_jobs_endpoint_returns_array():
    with patch.object(main, "get_recent_jobs", return_value=[{"job_id": "x"}]) as m:
        client = TestClient(main.app)
        resp = client.get("/jobs?limit=5")

    assert resp.status_code == 200
    assert resp.json() == [{"job_id": "x"}]
    m.assert_called_once_with(5)
