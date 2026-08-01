# Image Protect — InkShield

> Protect your artwork from AI scraping with adversarial perturbations — visually identical to the human eye, but invisible poison to machine-learning models.

**Live demo:** [image-protect-beta.vercel.app](https://image-protect-beta.vercel.app) · **API:** [inkshield-api.duckdns.org](https://inkshield-api.duckdns.org)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Description](#2-solution-description)
3. [AI Approach & Architecture](#3-ai-approach--architecture)
4. [Selected Challenge Theme](#4-selected-challenge-theme)
5. [How AI Assistance Was Used](#5-how-ai-assistance-was-used)
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

**InkShield** is a web application that applies an *adversarial perturbation* to any uploaded image. The perturbation is imperceptible to human viewers but causes AI image-classification models to misclassify the image — making it effectively poisonous to any vision pipeline that ingests it.

The product has two layers, built in phases:

**Phase 1 — the anonymous protection lab.** Anyone can land on the site and protect an image without an account:

1. Upload an image (JPEG or PNG).
2. Choose a protection strength (epsilon) via a slider — higher values give stronger protection at the cost of very slightly increased pixel noise.
3. Click **Protect with PGD**.
4. Download the protected image and inspect before/after model predictions side-by-side (for both proxy models) as proof the attack succeeded.

**Phase 2 — accounts and a social layer.** Signed-in users get persistence and a gallery, layered *on top of* the same protection pipeline without changing it:

- **Accounts** — email/password signup with email verification and JWT login.
- **A personal dashboard** — every image a user has protected is saved, with tabs for **All / Favorites / Liked** and controls to favorite an image or publish it.
- **A public gallery** — a browsable feed of published images, sortable by **Recent** or **Popular**, open to anyone.
- **Likes** — signed-in users can like gallery images; a "Liked" tab collects everything they've liked.

Anonymous use is preserved throughout — the lab still works with no account, exactly as in Phase 1. Protected images are stored privately in S3 and served via time-limited presigned URLs; no image is ever publicly readable.

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

The system is a set of small services behind a single API gateway, all running on one EC2 instance under k3s (lightweight Kubernetes). The React frontend is hosted separately on Vercel and talks only to the gateway.

```
                       [ React frontend — Vercel ]
                                   |
                                   | HTTPS  (CORS pinned to the Vercel origin)
                                   v
                  [ Traefik Ingress — Let's Encrypt TLS ]
                     inkshield-api.duckdns.org  (k3s)
                                   |
                                   v
                        [ Go API Gateway ]
        - validates JWTs locally (shared HS256 secret, no callback)
        - owns dashboard / gallery / likes / favorites (Postgres)
        - presigns S3 image URLs at read time
        - reverse-proxies /auth/* and /protect
           |                    |                     |
   /auth/* |          /protect  |     /dashboard /gallery /images/:id/*
           v                    v                     |
  [ Spring Boot Auth ]   [ FastAPI ML Service ]   (handled in Go,
  - signup / verify /    - ensemble PGD attack     queries Postgres)
    login, JWT issue     - uploads to S3
  - BCrypt, SES email    - logs job to MongoDB
                         - inserts images row on
                           an authenticated save
           |                 |         |        |
           v                 v         v        v
      [ Postgres ]        [ S3 ]  [ MongoDB ] [ SES ]
      (Neon, managed)    (private, (Atlas M0)  (email
       users / images /   presigned              verification)
       likes              URLs)
```

**Ownership split:**
- **Spring Boot (auth-service)** owns identity — signup, email verification via SES, login, JWT issuance. Nothing else touches the `users` table.
- **FastAPI (ml-service)** owns the protection pipeline — runs the ensemble PGD attack, uploads to S3, logs job metadata to MongoDB, and (for a logged-in user) inserts the corresponding `images` row in Postgres.
- **Go (gateway)** owns everything gallery/dashboard/social — reads and writes `images` and `likes` in Postgres, presigns S3 URLs for the lists it serves, validates JWTs on every protected route, and reverse-proxies auth and protect requests so the frontend has one base URL.

**Key design decisions:**
- Two proxy architectures (ResNet-50 + MobileNetV2) increase the likelihood that perturbations transfer to unseen scrapers, since many vision models share convolutional feature representations.
- **Stateless JWT auth** — all three services verify the same HS256-signed token locally with a shared secret; no service calls the auth service to validate a token after issuance.
- S3 is private (`BlockPublicAccess` enabled); images are served via **presigned URLs** with a 1-hour expiry, generated at read time by whichever service serves the image.
- The EC2 instance uses an **IAM instance role** for both S3 (`PutObject`/`GetObject`) and SES (`SendEmail`) — no AWS credentials are stored in code, environment files, or the cluster.
- **Two databases by shape:** Postgres (Neon) is the source of truth for anything relational and app-facing (users, images, likes); MongoDB (Atlas) stores flexible ML job metadata (epsilon, steps, per-model predictions) referenced by `mongo_job_id`. MongoDB errors are fail-silent and never crash the API.
- **Anonymous use is preserved** — the `/protect` endpoint accepts an *optional* JWT. With a valid token it persists the result and returns an `image_id`; without one it behaves exactly as in Phase 1 (protect and return, nothing saved).

---

## 4. Selected Challenge Theme

**Reimagine Creative Industries with AI**

InkShield directly addresses one of the most pressing concerns in the creative industries today: the erosion of artists' rights in the age of generative AI. Rather than using AI to replace creative work, this tool weaponises AI techniques (adversarial machine learning) *in service of* human artists — giving them a practical defense against the same class of models used to scrape and replicate their work.

---

## 5. How AI Assistance Was Used

An AI software-engineering assistant was used throughout both phases of this project — planning, architecture, implementation, and deployment:

- **Project planning:** decomposed each phase into independently verifiable, test-driven tasks with explicit expected outcomes and validation steps (`image-protect-plan.md`, `expansion-plan.md`, `phase2-architecture.md`).
- **ML core:** wrote `services/ml-service/attack.py` (ensemble PGD loop, gradient computation, pixel clamping), `tf_model.py` (TensorFlow MobileNetV2 wrapper), and `labels.py` (ImageNet-1K lookup).
- **FastAPI backend:** wrote `services/ml-service/main.py` (multipart upload, S3 upload + presigning, optional JWT verification via `auth.py`, Postgres insert via `pgdb.py`, MongoDB logging via `db.py`).
- **Spring Boot auth service:** wrote `services/auth-service/` — signup/verify/login endpoints, BCrypt hashing, JWT issuance, and SES email integration, with unit and Testcontainers integration tests.
- **Go gateway:** wrote `services/gateway/` — JWT middleware, the dashboard/gallery/likes SQL layer, read-time S3 presigning, CORS, and the reverse proxies, tested against real Postgres.
- **React frontend:** wrote the landing-page lab (`ProtectionLab.tsx`), the auth/dashboard/gallery routes, and the client auth/API libraries (`src/lib/auth.ts`, `src/lib/api.ts`).
- **Infrastructure & deployment:** wrote the Dockerfiles, the k3s manifests (`k8s/`), and drove the AWS/k3s/Traefik/Vercel deployment.

---

## 6. Known Tradeoffs

**CPU inference is slow.**
Both PyTorch and TensorFlow models run on CPU (ARM Graviton in production). The ensemble runs two sub-steps per PGD iteration; at `steps=4`, a single image takes roughly 30–90 seconds on the deployment instance. A GPU instance would cut this dramatically at higher cost.

**Two-model proxy (ResNet-50 + MobileNetV2).**
The perturbation is crafted against these two architectures. A scraper using a Vision Transformer or CLIP-based model may not be fully fooled. Extending the ensemble to include ViT-B/16 and CLIP ViT-L/14 is the stated next step.

**SES is in sandbox mode.**
Amazon SES starts sandboxed: verification emails can only be delivered to email addresses that have themselves been verified in SES. This is fine for a demo but means public signups won't receive their verification email until SES production access is requested and granted. Additionally, sending *from* a Gmail address fails Gmail's SPF alignment, so verification emails land in spam — production would use a verified sending domain.

**Presigned URLs expire.**
Images are stored in a private S3 bucket and served via 1-hour presigned URLs — the correct security posture, but links go stale. The frontend requests fresh URLs on each page load, so this is invisible in normal use.

**Spot instance.**
The backend runs on a persistent spot instance to minimise cost. A spot interruption causes a few minutes of downtime while the instance restarts; k3s and the services recover automatically, and an Elastic IP keeps the address stable.

---

## 7. Roadmap

| Priority | Feature |
|----------|---------|
| High | **SES production access** — move out of the sandbox with a verified sending domain so any user can receive verification email |
| High | **Extended ensemble** — add ViT-B/16 and CLIP ViT-L/14 for stronger cross-architecture transferability |
| Medium | **Grad-CAM before/after visualisation** — saliency heatmaps showing which regions the model attends to before and after perturbation |
| Medium | **Batch processing** — accept a ZIP of images and return a ZIP of protected images |
| Low | **GPU inference** — a GPU instance to cut protection time from ~minute to seconds |
| Low | **Rust pre/post-processing service** — offload image encode/decode from the Python service |

---

## Stack

| Layer | Technology |
|-------|-----------|
| ML core | Python 3.12 + PyTorch (ResNet-50) + TensorFlow/Keras (MobileNetV2) |
| Attack | Ensemble PGD — alternating ResNet-50 and MobileNetV2 gradient steps |
| ML API | FastAPI + Uvicorn |
| Auth service | Java 21 + Spring Boot 4 (Spring Security, Data JPA, jjwt) |
| API gateway | Go (stdlib net/http, pgx, golang-jwt, AWS SDK v2) |
| Relational DB | PostgreSQL on Neon (managed free tier) — users, images, likes |
| Job metadata | MongoDB Atlas M0 (free tier) — ML job history |
| Image storage | AWS S3 (private bucket, presigned URLs) |
| Email | AWS SES (verification emails) |
| Auth model | Stateless HS256 JWT, shared secret across all three services |
| Frontend | React 19 + TanStack Start + TypeScript + Tailwind v4 |
| Frontend hosting | Vercel |
| Backend hosting | Single AWS EC2 spot instance (`t4g.medium`, ARM/Graviton) running k3s |
| Ingress / TLS | Traefik (bundled with k3s) + Let's Encrypt on a DuckDNS domain |
| AWS auth | EC2 IAM instance role for S3 + SES (no hardcoded credentials) |

---

## Quick Start

Everything runs locally against the same managed data stores (or local substitutes). Ports used: gateway `8082`, auth `8081`, ML `8000`, frontend `8080`.

### Prerequisites

- Python 3.12+, Node 18+, Go 1.22+, Java 21, Docker (for the auth service's integration tests)
- A `JWT_SECRET` (base64-encoded, ≥256-bit) shared by all three services
- Optional: AWS credentials (S3/SES), a Postgres connection string, a MongoDB URI — each service degrades gracefully when its store is absent

### ML service

```bash
cd services/ml-service
python -m venv .venv && . .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements.txt

# All optional — omit S3_BUCKET for base64 fallback, omit MONGODB_URI to skip logging,
# omit DATABASE_URL/JWT_SECRET to run anonymous-only (Phase 1 behaviour).
export S3_BUCKET=my-bucket AWS_DEFAULT_REGION=us-east-1
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/"
export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
export JWT_SECRET="<base64 secret>"

uvicorn main:app --reload --port 8000
# tests: pip install -r requirements-dev.txt && pytest
```

### Auth service

```bash
cd services/auth-service
export SPRING_DATASOURCE_URL="jdbc:postgresql://host/db?sslmode=require"
export SPRING_DATASOURCE_USERNAME=user SPRING_DATASOURCE_PASSWORD=pass
export JWT_SECRET="<same base64 secret>" SERVER_PORT=8081
export APP_BASE_URL=http://localhost:8082   # verification links point at the gateway
./mvnw spring-boot:run
# tests (needs Docker): ./mvnw test
```

### Gateway

```bash
cd services/gateway
export PORT=8082 JWT_SECRET="<same base64 secret>"
export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
export AUTH_SERVICE_URL=http://127.0.0.1:8081 ML_SERVICE_URL=http://127.0.0.1:8000
export S3_BUCKET=my-bucket AWS_DEFAULT_REGION=us-east-1 CORS_ORIGIN='*'
go run .
# tests (needs a local Postgres on :55432): go test ./...
```

> Note: use `127.0.0.1`, not `localhost`, in the service URLs — on some systems `localhost` resolves to IPv6 first while uvicorn binds IPv4 only.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL defaults to http://localhost:8082 (the gateway)
npm run dev                   # opens http://localhost:8080
# tests: npm test
```

---

## Deployment

The backend runs on a single EC2 instance under **k3s** (lightweight Kubernetes). Three services (`ml-service`, `auth-service`, `gateway`) run as Deployments with ClusterIP Services; only the gateway is exposed, via a **Traefik Ingress** with automatic Let's Encrypt TLS on a DuckDNS domain. The frontend is hosted on **Vercel**. Manifests live in `k8s/`, Dockerfiles in each `services/*/` directory.

1. **Provision an EC2 instance** — Ubuntu 24.04, ARM `t4g.medium` (4 GB, needed for the ensemble), persistent spot request, ~30 GB disk, an Elastic IP, and an IAM instance profile whose role grants `s3:PutObject`/`s3:GetObject` on your bucket and `ses:SendEmail`. Install k3s: `curl -sfL https://get.k3s.io | sh -`.

2. **Provision the managed stores** — Neon Postgres (create the `users`, `images`, `likes` tables — schema in `phase2-architecture.md` §2), a MongoDB Atlas M0 cluster, an S3 bucket, and an SES verified sender. Point a DuckDNS subdomain at the Elastic IP.

3. **Create the k3s secrets and config** (referenced by the manifests via `envFrom`):
   ```bash
   kubectl create secret generic jwt-signing-key --from-literal=JWT_SECRET=<base64 secret>
   kubectl create secret generic db-credentials \
     --from-literal=DATABASE_URL=postgresql://... \
     --from-literal=SPRING_DATASOURCE_URL=jdbc:postgresql://... \
     --from-literal=SPRING_DATASOURCE_USERNAME=... \
     --from-literal=SPRING_DATASOURCE_PASSWORD=...
   kubectl create secret generic mongo-uri --from-literal=MONGODB_URI=mongodb+srv://...
   kubectl create configmap app-config \
     --from-literal=S3_BUCKET=... --from-literal=AWS_DEFAULT_REGION=us-east-1 \
     --from-literal=SES_FROM=you@example.com \
     --from-literal=APP_BASE_URL=https://your-api.duckdns.org \
     --from-literal=CORS_ORIGIN=https://your-app.vercel.app
   ```

4. **Build the ARM images on the host and import them into k3s** (no registry needed):
   ```bash
   # from the repo, ship the build context to the host:
   git archive HEAD services | ssh ubuntu@<host> "mkdir -p ~/build && tar -x -C ~/build"
   # on the host:
   for s in gateway auth-service ml-service; do
     sudo docker build -t inkshield/$s:p2 services/$s
     sudo docker save inkshield/$s:p2 | sudo k3s ctr images import -
   done
   ```
   The manifests use `imagePullPolicy: Never`, so they run the imported images directly.

5. **Enable Let's Encrypt on Traefik and deploy** the manifests:
   ```bash
   kubectl apply -f k8s/traefik-acme.yaml     # adds the ACME cert resolver
   kubectl apply -f k8s/ml.yaml -f k8s/auth.yaml -f k8s/gateway.yaml
   ```
   Traefik fetches the TLS certificate on the first HTTPS request to the domain. The ML pod takes ~1–2 minutes on first start to download model weights.

6. **Deploy the frontend to Vercel** — import the repo with root directory `frontend` and set the project env var `VITE_API_URL=https://your-api.duckdns.org`. The Nitro build target auto-switches to Vercel's serverless output when `VERCEL=1` is set (see `frontend/vite.config.ts`).

7. **Smoke test:** `curl https://your-api.duckdns.org/health` → `{"status":"ok"}` with a valid certificate; the gallery and auth flow should work from the Vercel URL.

---

*IBM AI Builders Challenge — Reimagine Creative Industries with AI*
