# Image Protect

> Protect your artwork from AI scraping with adversarial perturbations — visually identical to the human eye, but invisible poison to machine-learning models.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Description](#2-solution-description)
3. [AI Approach & Architecture](#3-ai-approach--architecture)
4. [Selected Challenge Theme](#4-selected-challenge-theme)
5. [How IBM Bob Was Used](#5-how-ibm-bob-was-used)
6. [Known Tradeoffs](#6-known-tradeoffs)
7. [Roadmap](#7-roadmap)
8. [Stack](#stack)
9. [Quick Start](#quick-start)
10. [Deployment](#deployment)

---

## 1. Problem Statement

Artists, photographers, and illustrators publish their work online to reach audiences — but doing so exposes every image to automated AI scrapers that harvest and train on that work without consent, attribution, or compensation. Once an image is scraped into a training dataset, it can be used to replicate an artist's style indefinitely. Current mitigations (watermarks, terms of service) are easily bypassed or ignored by automated pipelines.

Artists need a tool that lets them share their work publicly while making it unusable as training data for AI vision models — without any visible degradation of the image itself.

---

## 2. Solution Description

**Image Protect** is a web application that applies an *adversarial perturbation* to any uploaded image. The perturbation is imperceptible to human viewers but causes AI image-classification models to misclassify the image — making it effectively poisonous to any vision pipeline that ingests it.

**User workflow:**

1. Upload an image (JPEG or PNG).
2. Choose a protection strength (epsilon) via a slider — higher values give stronger protection at the cost of very slightly increased pixel noise.
3. Click **Protect Image**.
4. Download the protected image and inspect before/after model predictions side-by-side as proof the attack succeeded.

The protected image is stored privately in S3; the user receives time-limited presigned URLs for both the original and protected versions. No image is made publicly readable.

---

## 3. AI Approach & Architecture

### Adversarial Attack: Projected Gradient Descent (PGD)

The core technique is an **ensemble PGD (Projected Gradient Descent) untargeted attack** that runs simultaneously against two pretrained proxy models: **ResNet-50** (PyTorch) and **MobileNetV2** (TensorFlow). PGD is an iterative variant of the Fast Gradient Sign Method (FGSM) that produces stronger, more robust perturbations within a bounded pixel budget. Using two architectures makes the perturbation more likely to transfer to unseen scrapers.

**Algorithm:**

```
x_0 = x
x_{t+1} = Clip_{x,eps}( x_t + alpha * sign(grad_x L(theta, x_t, y)) )
```

Where:
- `x` is the original image tensor (values in `[0, 1]`).
- `eps` (epsilon) is the perturbation budget — the maximum L∞ distance any pixel may move from its original value. Typical values: `0.01` (subtle) to `0.04` (strong).
- `alpha` is the per-step size, computed as `alpha = eps / steps * 2.5` — a rule-of-thumb that scales step size to the budget and number of iterations.
- `steps` controls how many PGD iterations are run. More steps → stronger attack, slower inference. Default: `4` (each step runs two sub-steps: one ResNet-50 gradient, one MobileNetV2 gradient).
- `L(theta, x_t, y)` is the cross-entropy loss of the proxy model against the original predicted class `y`. Maximising this loss pushes the image away from the original classification.
- `Clip_{x,eps}` projects back onto the L∞ ball centred at `x` with radius `eps`, then clamps to `[0, 1]`.

**Tradeoff summary:**

| Parameter | Higher value | Lower value |
|-----------|-------------|-------------|
| `eps`     | Stronger protection, slightly more visible noise | Weaker protection, cleaner image |
| `steps`   | Stronger attack, slower (CPU-bound)              | Faster, potentially weaker        |
| `alpha`   | Larger gradient steps (coarser)                  | Finer convergence                 |

Proxy models used:
- **ResNet-50 (PyTorch)** — `ResNet50_Weights.IMAGENET1K_V2`, loaded once at startup.
- **MobileNetV2 (TensorFlow)** — `tf.keras.applications.MobileNetV2(weights="imagenet")`, loaded once at startup.

Both models run on CPU; weights are downloaded automatically by `torchvision` and `keras` on first run and cached locally.

### System Architecture

```
[React SPA on Vercel]
        |
        | HTTPS POST /protect (multipart image + epsilon)
        v
[FastAPI on EC2 :8000]
   |            |
   |            v
   |     [Ensemble PGD attack]
   |       |             |
   |       v             v
   |  [ResNet-50]   [MobileNetV2]
   |  (PyTorch)     (TensorFlow)
   |            |
   v            v
[boto3] --> [S3 bucket: originals/ + protected/]
   |
   v
[MongoDB Atlas: inkshield.jobs]
   |
   v
[JSON response: protected image URL, predictions (resnet50 + mobilenet), job_id]
```

**Key design decisions:**
- Two proxy architectures (ResNet-50 + MobileNetV2) increase the likelihood that perturbations transfer to unseen scrapers. Because many vision models share convolutional feature representations, perturbations crafted against multiple architectures simultaneously are more robust than single-model attacks.
- S3 is private (`BlockPublicAccess` enabled); images are served via **presigned URLs** with a 1-hour expiry, so no image is ever publicly readable.
- The EC2 instance uses an **IAM instance role** — no AWS credentials are stored in code or environment files.
- Every `/protect` call logs a job document to **MongoDB Atlas** (`inkshield.jobs`) containing job_id, timestamp, epsilon, steps, and both models' predictions. The `GET /jobs` endpoint returns recent job history. MongoDB errors are fail-silent and never crash the API.

---

## 4. Selected Challenge Theme

**Reimagine Creative Industries with AI**

Image Protect directly addresses one of the most pressing concerns in the creative industries today: the erosion of artists' rights in the age of generative AI. Rather than using AI to replace creative work, this tool weaponises AI techniques (adversarial machine learning) *in service of* human artists — giving them a practical defense against the same class of models used to scrape and replicate their work.

---

## 5. How IBM Bob Was Used

IBM Bob (the AI software engineering assistant) was used throughout every phase of this project:

- **Project planning:** Bob produced the full multi-sub-task implementation plan (`image-protect-plan.md`), decomposing the project into six independently verifiable sub-tasks with explicit expected outcomes and validation steps for each.
- **Architecture design:** Bob designed the full system architecture — the choice of PGD over FGSM, ResNet-50 as proxy, FastAPI over Flask for async readiness, presigned URLs over public-read S3, and the Vercel + EC2 hosting split.
- **ML core generation:** Bob wrote `backend/attack.py` (PGD attack loop, gradient computation, pixel clamping, per-step alpha calculation) and `backend/labels.py` (ImageNet-1K class name lookup).
- **FastAPI backend generation:** Bob wrote `backend/main.py` — CORS middleware, multipart upload handling, UUID job IDs, S3 upload via boto3, presigned URL generation, and the health check endpoint.
- **React frontend generation:** Bob scaffolded and wrote the full `frontend/` directory — `ProtectTool.tsx` with epsilon slider, file upload zone, loading state, before/after prediction cards using shadcn/ui, and Tailwind styling.
- **S3 provisioning script:** Bob wrote `backend/s3_setup.py` — idempotent bucket creation, block-all-public-access, and least-privilege bucket policy scoped to the EC2 IAM role ARN.
- **Deployment config:** Bob wrote `backend/protect-api.service` (systemd unit for EC2) and `frontend/vercel.json` (SPA rewrite rules).
- **README structure:** Bob authored this README, ensuring all IBM AI Builders Challenge submission checklist items are covered.

---

## 6. Known Tradeoffs

**CPU inference on EC2 is slow.**
Both PyTorch and TensorFlow models run on CPU unless a GPU instance is used. The ensemble attack runs two sub-steps per PGD iteration (one per model); at `steps=4`, a single 224×224 image takes approximately 5–15 seconds on CPU. A GPU-enabled EC2 instance (e.g., `g4dn.xlarge`) would reduce this significantly, but increases hosting cost.

**Two-model proxy (ResNet-50 + MobileNetV2).**
The perturbation is crafted against these two architectures. A scraper using a Vision Transformer or CLIP-based model may not be fully fooled. Extending the ensemble to include ViT-B/16 and CLIP ViT-L/14 is the stated next step.

**Presigned URLs chosen over public-read S3.**
Images are stored in a private S3 bucket and served via 1-hour presigned URLs. This is the correct security posture — originals and protected images are never publicly accessible. The tradeoff is that links expire; a user who saves the URL and returns after an hour will get a 403. Downloading the protected image immediately (rather than bookmarking the URL) is the intended workflow.

---

## 7. Roadmap

| Priority | Feature |
|----------|---------|
| High | **Extended ensemble** — add ViT-B/16 and CLIP ViT-L/14 to the ensemble for stronger cross-architecture transferability |
| High | **Grad-CAM before/after visualisation** — show a saliency heatmap of which regions the model attends to before and after perturbation |
| Medium | **Batch processing** — accept a ZIP of images and return a ZIP of protected images; progress via Server-Sent Events |
| Medium | **FGSM comparison mode** — run both FGSM (single-step) and PGD side-by-side so users can see the strength difference visually |
| Low | **Job history UI** — surface MongoDB job history in the frontend so users can review past protection runs |

---

## Stack

| Layer | Technology |
|-------|-----------|
| ML core (PyTorch) | Python 3.11 + PyTorch 2.x + torchvision (ResNet-50) |
| ML core (TensorFlow) | TensorFlow 2.x + Keras (MobileNetV2) |
| Attack | Ensemble PGD — alternating ResNet-50 and MobileNetV2 gradient steps |
| API | FastAPI + Uvicorn |
| Image storage | AWS S3 (private bucket, presigned URLs) |
| Job logging | MongoDB Atlas M0 (free tier), pymongo + dnspython |
| Frontend | React 19 + TanStack Start + TypeScript + Tailwind v4 |
| Frontend hosting | Vercel |
| Backend hosting | AWS EC2 (Ubuntu, systemd-managed) |
| AWS auth | EC2 IAM instance role (no hardcoded credentials) |

---

## Quick Start

### Prerequisites

- Python 3.11+, `pip`
- Node 18+, `npm`
- AWS credentials configured locally (for S3; not needed for pure local dev without S3)

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt

# S3 is optional -- omit S3_BUCKET to use base64 data URL fallback
$env:S3_BUCKET = "my-image-protect-bucket"   # PowerShell
$env:CORS_ORIGIN = "http://localhost:5173"

# MongoDB is optional -- omit to skip job logging
# Local:  $env:MONGODB_URI = "mongodb://localhost:27017"
# Atlas:  $env:MONGODB_URI = "mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true"

uvicorn main:app --reload --port 8000
```

Health check:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # edit VITE_API_URL if needed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Deployment

### Backend — AWS EC2

1. **Provision an EC2 instance** (Ubuntu 22.04 LTS recommended; `t3.medium` or larger for acceptable CPU inference speed).
2. **Attach an IAM instance profile** with a role that has `s3:PutObject` and `s3:GetObject` on your S3 bucket. No credentials in code or `.env`.
3. **Run S3 setup** once from your local machine (requires IAM user credentials with S3 admin rights):
   ```bash
   cd backend
   $env:S3_BUCKET = "my-image-protect-bucket"
   $env:AWS_REGION = "us-east-1"
   $env:IAM_ROLE_ARN = "arn:aws:iam::123456789012:role/ImageProtectEC2Role"
   python s3_setup.py
   ```
4. **Clone the repo** onto the EC2 instance and install dependencies:
   ```bash
   git clone <repo-url> /home/ubuntu/app
   cd /home/ubuntu/app/backend
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```
5. **Create `/home/ubuntu/app/.env`** on the instance:
   ```
   S3_BUCKET=my-image-protect-bucket
   CORS_ORIGIN=https://your-app.vercel.app
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true
   ```
6. **Install the systemd service**:
   ```bash
   sudo cp /home/ubuntu/app/backend/protect-api.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable protect-api
   sudo systemctl start protect-api
   sudo systemctl status protect-api
   ```
   The service file (`backend/protect-api.service`) sets `WorkingDirectory`, `EnvironmentFile`, and `Restart=always` — the API restarts automatically on crash or reboot.
7. **Open port 8000** in the EC2 security group (or put the API behind an Nginx reverse proxy on port 443).

### Frontend — Vercel

1. Push the `frontend/` directory to a GitHub repository.
2. Import the project in [Vercel](https://vercel.com) — set root directory to `frontend`.
3. Add environment variable `VITE_API_URL=https://<your-ec2-ip-or-domain>:8000` in the Vercel project settings.
4. Deploy. The `frontend/vercel.json` handles SPA routing rewrites automatically.

---

*IBM AI Builders Challenge — Reimagine Creative Industries with AI*
