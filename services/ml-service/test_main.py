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
         patch.object(main, "log_job", return_value=None) as mock_log:
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
    assert doc["user_id"] is None              # anonymous request
    assert doc["original_s3_key"] is None      # no S3_BUCKET in local mode
    assert doc["protected_s3_key"] is None


def test_protect_anonymous_has_no_image_id_and_skips_postgres():
    with patch.object(main, "ensemble_pgd_attack", side_effect=_fake_attack), \
         patch.object(main, "log_job", return_value=None) as mock_log, \
         patch.object(main, "insert_image") as mock_insert:
        client = TestClient(main.app)
        resp = client.post(
            "/protect",
            files={"file": ("t.png", _png_bytes(), "image/png")},
            data={"epsilon": "0.02"},
        )

    assert resp.status_code == 200
    assert "image_id" not in resp.json()
    mock_insert.assert_not_called()
    assert mock_log.call_args[0][0]["user_id"] is None


def test_protect_authenticated_persists_and_returns_image_id():
    with patch.object(main, "ensemble_pgd_attack", side_effect=_fake_attack), \
         patch.object(main, "log_job", return_value="mongo-oid-1") as mock_log, \
         patch.object(main, "get_user_id", return_value="user-uuid-1") as mock_auth, \
         patch.object(main, "insert_image", return_value="image-uuid-1") as mock_insert:
        client = TestClient(main.app)
        resp = client.post(
            "/protect",
            files={"file": ("t.png", _png_bytes(), "image/png")},
            data={"epsilon": "0.02"},
            headers={"Authorization": "Bearer some.jwt.token"},
        )

    assert resp.status_code == 200
    assert resp.json()["image_id"] == "image-uuid-1"
    mock_auth.assert_called_once_with("Bearer some.jwt.token")
    assert mock_log.call_args[0][0]["user_id"] == "user-uuid-1"
    # s3_url is the S3 key; empty string in local no-S3 mode
    mock_insert.assert_called_once_with("user-uuid-1", "mongo-oid-1", "")


def test_protect_authenticated_mongo_down_falls_back_to_job_id():
    with patch.object(main, "ensemble_pgd_attack", side_effect=_fake_attack), \
         patch.object(main, "log_job", return_value=None), \
         patch.object(main, "get_user_id", return_value="user-uuid-1"), \
         patch.object(main, "insert_image", return_value="image-uuid-2") as mock_insert:
        client = TestClient(main.app)
        resp = client.post(
            "/protect",
            files={"file": ("t.png", _png_bytes(), "image/png")},
            data={"epsilon": "0.02"},
            headers={"Authorization": "Bearer some.jwt.token"},
        )

    assert resp.json()["image_id"] == "image-uuid-2"
    # falls back to the app-level job_id so images.mongo_job_id stays NOT NULL
    assert mock_insert.call_args[0][1] == resp.json()["job_id"]


def test_protect_authenticated_postgres_down_omits_image_id():
    with patch.object(main, "ensemble_pgd_attack", side_effect=_fake_attack), \
         patch.object(main, "log_job", return_value="mongo-oid-1"), \
         patch.object(main, "get_user_id", return_value="user-uuid-1"), \
         patch.object(main, "insert_image", return_value=None):
        client = TestClient(main.app)
        resp = client.post(
            "/protect",
            files={"file": ("t.png", _png_bytes(), "image/png")},
            data={"epsilon": "0.02"},
            headers={"Authorization": "Bearer some.jwt.token"},
        )

    assert resp.status_code == 200
    assert "image_id" not in resp.json()


def test_jobs_endpoint_returns_array():
    with patch.object(main, "get_recent_jobs", return_value=[{"job_id": "x"}]) as m:
        client = TestClient(main.app)
        resp = client.get("/jobs?limit=5")

    assert resp.status_code == 200
    assert resp.json() == [{"job_id": "x"}]
    m.assert_called_once_with(5)
