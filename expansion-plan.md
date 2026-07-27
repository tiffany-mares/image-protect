# Expansion Plan — MongoDB Job Logging + TensorFlow MobileNetV2 Ensemble

## Overview

Extend the existing backend with two capabilities:

1. **MongoDB job logging** — every `/protect` call writes a document to MongoDB
   containing job_id, timestamp, epsilon, original/protected class and confidence
   from both models. A new `GET /jobs` endpoint returns recent job history.

2. **TensorFlow MobileNetV2 ensemble attack** — extend pgd_attack to also run
   gradient steps against TF MobileNetV2 on each PGD iteration, producing one
   protected image that misleads both ResNet-50 (PyTorch) and MobileNetV2 (TensorFlow).
   The API returns before/after predictions from both models.

### Current state (already implemented, do not regress)
- attack.py: pgd_attack() with 4 steps default, ResNet-50 only
- main.py: POST /protect with 1024px cap, base64 fallback when S3_BUCKET unset,
  lazy S3 client, 4-step PGD call
- requirements.txt: fastapi, uvicorn, torch, torchvision, pillow, boto3, python-multipart

### Files to create/modify
```
backend/
    tf_model.py        # NEW: TF MobileNetV2 loaded at module level
    db.py              # NEW: MongoDB client, log_job(), get_recent_jobs()
    attack.py          # MODIFY: add ensemble_pgd_attack()
    main.py            # MODIFY: use ensemble attack, log to MongoDB, add /jobs
    requirements.txt   # MODIFY: add tensorflow, pymongo, dnspython

frontend/
    src/components/ProtectionLab.tsx  # MODIFY: display both model predictions
    src/routes/index.tsx              # MODIFY: update stack/features copy
```

---

## Sub-Task 1 - TensorFlow MobileNetV2 module (tf_model.py)

**Status:** [x] complete

### Intent
Create a new module that loads MobileNetV2 once at import time and exposes
tf_predict(pil_image) -> dict returning the same shape as attack.predict().
This keeps TF concerns fully isolated from the PyTorch attack code.

### Expected Outcomes
- backend/tf_model.py exists
- tf_predict(pil_image) returns {"index": int, "label": str, "confidence": float}
- Running python backend/tf_model.py backend/sample.jpg prints a valid prediction dict
- tensorflow added to requirements.txt

### Todo List
1. Create backend/tf_model.py:
   - Import tensorflow, numpy, PIL.Image
   - Module-level: load tf.keras.applications.MobileNetV2(weights="imagenet")
   - _preprocess(pil_image): resize to 224x224, float32 array,
     apply tf.keras.applications.mobilenet_v2.preprocess_input (scales to [-1,1])
   - tf_predict(pil_image) -> dict: run model, decode top-1 via
     tf.keras.applications.mobilenet_v2.decode_predictions, return
     {"index": int, "label": str, "confidence": float}
   - if __name__ == "__main__" smoke test block
2. Add tensorflow to backend/requirements.txt

### Validation
- python backend/tf_model.py backend/sample.jpg prints dict with index, label, confidence
- import tensorflow works in the same environment as import torch

### Relevant Context
- Must match attack.predict() return shape: {"index": int, "label": str, "confidence": float}
- MobileNetV2 decode_predictions returns list of (class_id, label, prob) tuples
- MobileNetV2 class indices differ from ResNet-50 -- expected and fine

---

## Sub-Task 2 - Ensemble PGD attack (attack.py)

**Status:** [x] complete

### Intent
Add ensemble_pgd_attack() to attack.py that alternates gradient steps
between ResNet-50 (PyTorch) and MobileNetV2 (TensorFlow) on each PGD iteration.
The existing pgd_attack() is unchanged.

### Expected Outcomes
- ensemble_pgd_attack(image, eps, steps) in attack.py
- Returns (protected_image, predictions) where predictions shape is:
  {
    "resnet50":  {"original": {...}, "protected": {...}},
    "mobilenet": {"original": {...}, "protected": {...}},
  }
- python attack.py backend/sample.jpg --ensemble prints both models' predictions
- pgd_attack() signature and behaviour unchanged

### Todo List
1. Lazy-import tf_model inside ensemble_pgd_attack
2. Implement ensemble_pgd_attack(image, eps=0.02, steps=4):
   - Record original predictions from both models before the loop
   - On each step:
     a. Compute ResNet-50 CE loss, backward, apply alpha * sign(grad) step
     b. Convert x_adv to PIL, run MobileNetV2 gradient via tf.GradientTape,
        convert numpy grad to torch tensor on _DEVICE, apply second sign step
     c. Clip to epsilon-ball and clamp to [0,1]
   - Record protected predictions from both models after the loop
   - Return (protected_PIL, nested_predictions_dict)
3. Extend __main__ to accept --ensemble flag

### Validation
- python backend/attack.py backend/sample.jpg --ensemble prints both models before/after
- At least one model predicted class changes post-attack

### Relevant Context
- TF preprocess_input scales to [-1,1]: convert x_adv from [0,1] via x*2-1
- tf.GradientTape: watch input, compute sparse_categorical_crossentropy,
  call tape.gradient(loss, x_tf) for gradient
- Keep pgd_attack() completely unchanged

---

## Sub-Task 3 - MongoDB module (db.py)

**Status:** [x] complete

### Intent
Create backend/db.py with module-level MongoDB connection and two public
functions. DB errors must never crash the API -- log_job fails silently.

### Expected Outcomes
- backend/db.py with MongoClient connected to MONGODB_URI (default: mongodb://localhost:27017)
- log_job(doc) inserts into inkshield.jobs, silent on failure with warning log
- get_recent_jobs(limit=20) returns list sorted by timestamp desc, _id as string
- pymongo and dnspython added to requirements.txt

### Todo List
1. Create backend/db.py:
   - MONGODB_URI from os.environ, default mongodb://localhost:27017
   - Module-level: _client = MongoClient(MONGODB_URI), _db = _client["inkshield"]
   - log_job(doc: dict) -> None: insert_one inside try/except, warn on failure
   - get_recent_jobs(limit=20) -> list: sort timestamp desc, _id to string
2. Add pymongo and dnspython to requirements.txt

### Validation
- With mongo running: insert and retrieve via python one-liners succeed
- With MongoDB NOT running: log_job({}) prints a warning and does not raise

### Relevant Context
- MongoDB Atlas M0 (free tier) recommended for cloud; needs dnspython for srv:// URIs
- Fail-silent is intentional

---

## Sub-Task 4 - Wire into main.py + GET /jobs endpoint

**Status:** [x] complete

### Intent
Update main.py to use ensemble_pgd_attack, log every job to MongoDB, and
expose GET /jobs. All existing behaviour (1024px cap, base64/S3 fallback,
lazy S3 client) must be preserved exactly.

### Expected Outcomes
- POST /protect predictions field has resnet50 and mobilenet keys
- Every successful protect call writes a job doc to MongoDB
- GET /jobs?limit=20 returns JSON array of recent jobs
- GET /health unchanged
- Base64 fallback and 1024px cap unchanged

### Todo List
1. Replace pgd_attack import with ensemble_pgd_attack
2. Call ensemble_pgd_attack(image, eps=epsilon, steps=4) in POST /protect
3. After URLs resolved: call db.log_job({...}) with job_id, timestamp, epsilon,
   steps, predictions, original_s3_key (or None), protected_s3_key (or None)
4. Add datetime and db imports
5. Add GET /jobs route calling db.get_recent_jobs(limit)

### Validation
- Without S3 or MongoDB: POST /protect returns base64 URLs with ensemble predictions
- With MongoDB: curl /jobs returns array containing the job after a protect call
- Response predictions contains both resnet50 and mobilenet keys

### Relevant Context
- Sub-Tasks 1, 2, 3 must be complete first
- datetime.now(timezone.utc).isoformat() for timestamp
- Frontend ApiResult type must be updated in Sub-Task 5

---

## Sub-Task 5 - Update frontend (ProtectionLab.tsx + index.tsx)

**Status:** [ ] pending

### Intent
Update frontend to handle new predictions shape (two models) and update
stack/features copy for TensorFlow and MongoDB.

### Expected Outcomes
- ApiResult.predictions type updated to ensemble shape
- Both model predictions displayed in each lab panel
- npm run build passes with zero TypeScript errors
- Stack and features reflect actual tech

### Todo List
1. In ProtectionLab.tsx:
   - Update ApiResult type: predictions has resnet50 and mobilenet keys,
     each with original and protected Prediction objects
   - Update LabPane to accept predictions dict and which ("original"|"protected"),
     render two ScanRow groups labeled "ResNet-50" and "MobileNetV2"
2. In index.tsx:
   - Backend stack card: add TensorFlow MobileNetV2 and MongoDB
   - Features list: add ensemble attack and MongoDB job history entries

### Validation
- npm run build -- zero TypeScript errors
- Browser: both model predictions visible in each panel after protect call

### Relevant Context
- LabPane currently takes single prediction prop -- needs to change
- which prop tells panel whether to show .original or .protected from each model

---

## Sub-Task 6 - Update README

**Status:** [ ] pending

### Intent
Update README to document the new stack accurately.

### Todo List
1. Add MONGODB_URI to env vars section with local and Atlas example formats
2. Stack table: add MongoDB and TensorFlow/MobileNetV2 rows
3. AI approach: describe ensemble attack
4. Remove MongoDB and TF from roadmap

### Validation
- Stack table matches actual deployed stack
- MONGODB_URI documented with both URI formats
