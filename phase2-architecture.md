# Architecture Doc — Phase 2: Auth, Dashboard, Gallery

Covers the expanded system: user accounts, saved images, personal dashboard, and public gallery with likes. Builds on top of the existing Phase 1 ML pipeline (PGD protection via FastAPI).

---

## 0. What Part 2 Does

Phase 1 was a single anonymous "lab" flow: upload an image, run PGD, get back a protected version, nothing persisted. Part 2 turns that into a real product by adding accounts and a social layer on top, without changing how the protection itself works.

Concretely, Part 2 adds:
- **Accounts** — users can sign up, verify their email, and log in, so the app knows who's making a request
- **Persistence** — a logged-in user's protected images are saved, not just returned once and forgotten
- **A personal dashboard** — every image a user has created, with the ability to mark favorites and control whether an image is public
- **A public gallery** — a browsable, sortable feed of images their owners chose to publish, open to anyone
- **Likes** — signed-in users can like gallery images; a "Liked" tab in the dashboard collects everything they've liked, tying the social loop back to the user

Anonymous use is preserved throughout — someone can still land on the lab and protect an image without ever creating an account, exactly as in Phase 1. Part 2 is additive: it introduces the auth, dashboard, and gallery layer as new services and tables sitting alongside the existing ML pipeline, not a rewrite of it.

---

## 1. System Overview

```
                         ┌─────────────────────┐
                         │   React (Vercel)     │
                         │  Sign in / Lab /      │
                         │  Dashboard / Gallery  │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    v
                    ┌───────────────────────────────┐
                    │   Go API Gateway (k3s)         │
                    │   - JWT validation middleware  │
                    │   - routes to services below   │
                    │   - owns gallery/dashboard/     │
                    │     likes/favorites logic      │
                    └───┬──────────┬──────────┬──────┘
                        │          │          │
          /auth/*       │  /protect│   /gallery, /dashboard,
                        │          │   /images/:id/*
                        v          v          v
              ┌──────────────┐ ┌──────────┐  (handled in Go itself,
              │ Spring Boot   │ │ FastAPI   │   queries Postgres)
              │ Auth Service  │ │ ML Service│
              │ (k3s)         │ │ (k3s)     │
              └──┬─────────┬──┘ └─┬───────┬─┘
                 │         │      │       │
                 v         v      v       v
            ┌────────┐ ┌─────┐ ┌─────┐ ┌────────┐
            │Postgres│ │ SES │ │ S3  │ │MongoDB │
            │ (k3s   │ │     │ │     │ │ Atlas  │
            │  pod)  │ │     │ │     │ │ (M0)   │
            └────────┘ └─────┘ └─────┘ └────────┘
                 ^
                 │ (Go writes gallery/likes/favorites data here;
                 │  FastAPI also writes the `images` row on save)
```

**Ownership split:**
- **Spring Boot** owns identity — signup, email verification, login, JWT issuance. Nothing else touches the `users` table directly.
- **FastAPI (ML service)** owns the protection pipeline — runs PGD, uploads to S3, writes job metadata to MongoDB, and writes the corresponding `images` row to Postgres when a logged-in user saves.
- **Go gateway** owns everything gallery/dashboard/social — reads and writes `images` and `likes` in Postgres, routes auth and protect requests through to their services, validates JWTs on every protected route.
- **Postgres** is the source of truth for anything relational and app-facing: users, images (ownership, publish/favorite state), likes.
- **MongoDB** is the source of truth for ML job details: epsilon, steps, model version, raw predictions — flexible schema, not queried by the frontend directly, only referenced by `mongo_job_id`.

---

## 2. Data Models

### Postgres

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  mongo_job_id TEXT NOT NULL,
  s3_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_favorite BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_images_user ON images(user_id);
CREATE INDEX idx_images_published ON images(is_published, created_at DESC);

CREATE TABLE likes (
  user_id UUID NOT NULL REFERENCES users(id),
  image_id UUID NOT NULL REFERENCES images(id),
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, image_id)
);
CREATE INDEX idx_likes_image ON likes(image_id);
```

`users` owned exclusively by Spring Boot. `images` and `likes` owned by Go (with FastAPI given write access to `images` for the initial insert on save).

### MongoDB (job metadata — owned by FastAPI)

```json
{
  "_id": "ObjectId",
  "user_id": "uuid-or-null",
  "epsilon": 0.02,
  "steps": 4,
  "predictions": {
    "resnet50":  { "original": { "label": "...", "confidence": 0.91 },
                   "protected": { "label": "...", "confidence": 0.03 } },
    "mobilenet": { "original": { "label": "...", "confidence": 0.69 },
                   "protected": { "label": "...", "confidence": 0.18 } }
  },
  "s3_original_key": "originals/<job_id>.png",
  "s3_protected_key": "protected/<job_id>.png",
  "created_at": "ISODate"
}
```

`user_id` is null for anonymous "lab" use (Phase 1 behavior preserved). Populated when a logged-in user runs a protection.

---

## 3. API Contracts

### Auth Service (Spring Boot) — mounted at `/auth`

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/signup` | `{email, password}` | `201`, triggers verification email |
| GET | `/auth/verify?token=` | — | `200`, sets `verified=true` |
| POST | `/auth/login` | `{email, password}` | `{token: "<jwt>"}` |

JWT payload: `{ sub: user_id, email, iat, exp }`. Signed with a shared secret (HS256 is fine at this scale) that both Spring Boot and Go hold — Go verifies signature/expiry locally, no network call back to Spring Boot per request.

### ML Service (FastAPI) — mounted at `/protect`

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/protect` | optional Bearer JWT | multipart: `file`, `epsilon` | `{protected_url, original_url, predictions, image_id}` |

`image_id` is only present in the response if the request was authenticated (i.e., the image was actually saved). Anonymous requests get the same protection behavior as Phase 1, just no `image_id`, no persistence.

### Gateway (Go) — everything else

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/dashboard` | required | all images for `user_id` from JWT |
| GET | `/dashboard/liked` | required | images joined through `likes` for this user |
| PATCH | `/images/:id/favorite` | required, must own image | toggles `is_favorite` |
| PATCH | `/images/:id/publish` | required, must own image | sets `is_published=true` |
| GET | `/gallery?sort=recent\|popular` | none | published images only; `popular` = `ORDER BY like_count DESC` via subquery/join |
| POST | `/images/:id/like` | required | insert into `likes`, idempotent (ignore conflict) |
| DELETE | `/images/:id/like` | required | unlike |

Gateway also reverse-proxies `/auth/*` → Spring Boot and `/protect` → FastAPI so the frontend has one base URL.

---

## 4. Auth Flow (sequence)

1. User submits signup form → Go proxies to Spring Boot → Spring Boot creates `users` row (`verified=false`), generates token, calls SES to send verification email
2. User clicks email link → hits Spring Boot `/auth/verify` directly (or via gateway) → `verified=true`
3. User logs in → Spring Boot checks `verified`, issues JWT → frontend stores it
4. Every subsequent request to Go or FastAPI includes `Authorization: Bearer <jwt>` → each service validates the signature independently using the shared secret — no service calls Spring Boot to check a token after issuance

---

## 5. Deployment Topology (single EC2 instance, k3s)

```
EC2 (t4g.medium, ARM/Graviton) running k3s
    — t4g.medium (4GB) not t4g.small: the ML service keeps the Phase 1
      ensemble (PyTorch ResNet-50 + TF MobileNetV2), which needs >2GB on its own
├── Deployment: ml-service (FastAPI + PyTorch)     → ClusterIP
├── Deployment: auth-service (Spring Boot)          → ClusterIP
├── Deployment: gateway (Go)                        → exposed via Traefik Ingress
├── Secret: jwt-signing-key, db-credentials, ses-credentials, s3-credentials
└── ConfigMap: bucket name, mongo connection string, postgres connection string (non-secret parts)

External:
├── Postgres — Neon or Supabase free tier (managed, outside the cluster)
├── MongoDB Atlas M0 (managed, outside the cluster)
├── S3 bucket
├── SES
└── Vercel (frontend, outside the cluster entirely)
```

Postgres is no longer self-hosted in the cluster — moved to a managed free tier (Neon or Supabase) to free up memory on a small instance, and to drop one more stateful component (and its PVC) from the k3s node. `auth-service`, `ml-service`, and `gateway` connect to it the same way they'd connect to any Postgres instance, just over a connection string pointing off-box instead of to a ClusterIP.

Only the Go gateway is externally reachable (via Traefik Ingress, which ships with k3s by default). `ml-service` and `auth-service` stay internal-only — nothing but the gateway needs to reach them, and Postgres is reached directly by whichever service needs it (auth-service for users, gateway for images/likes, ml-service for the `images` insert on save).

**ARM/Graviton note:** all container images (FastAPI/PyTorch, Spring Boot, Go, k3s itself) need ARM64-compatible builds. Python and Go base images generally support `arm64` out of the box; confirm your Dockerfiles aren't pinning an amd64-only base image, and confirm your PyTorch install pulls the ARM wheel.

---

## 6. Security Notes

- Passwords: BCrypt hashed in Spring Boot, never touch Go or FastAPI
- JWT secret stored as a k3s `Secret`, injected as an env var — not hardcoded in any service
- S3 bucket: keep private, serve via presigned URLs generated by whichever service uploads (ML service) rather than making objects public — this was a shortcut in the Phase 1 MVP, worth tightening now that real user accounts exist
- CORS on the gateway restricted to the Vercel frontend origin only
- Postgres is managed (Neon/Supabase) and reached over TLS with credentials held only in the `db-credentials` k8s Secret — never in code, manifests, or the ConfigMap

---

## 6a. Cost (t4g.medium spot, Postgres on managed free tier)

| Item | Monthly |
|---|---|
| EC2 `t4g.medium` (4GB, ARM/Graviton), spot (persistent request, stop-on-interruption), 24/7 | ~$8-9.50 |
| Elastic IP / public IPv4 ($0.005/hr — AWS bills all public IPv4s since 2024) | ~$3.65 |
| EBS root volume (15GB gp3) | ~$1.20 |
| Postgres — Neon or Supabase free tier | $0 |
| MongoDB Atlas M0 | $0 |
| S3 storage + requests | pennies at demo scale |
| SES | $0 (well under free-tier email volume) |
| Data transfer out | ~$0-1 at demo/judging traffic |
| Vercel frontend | $0 |
| **Total** | **~$13.50-15/month, always on** |

Cost-optimized always-on configuration: Graviton instead of x86 (~20% cheaper for the same RAM/vCPU), spot instead of on-demand (~65% cheaper; a persistent request with stop-on-interruption plus the Elastic IP and k3s auto-start makes interruptions self-healing — same setup Phase 1 ran on), and Postgres moved off the instance to a managed free tier (no self-hosted DB or PVC on the node). 4GB rather than 2GB is a deliberate trade: it keeps the Phase 1 ensemble attack (ResNet-50 + MobileNetV2) in Phase 2 instead of regressing to single-model protection. The rare spot interruption costs a few minutes of downtime while the instance stops and restarts — acceptable at demo scale; on-demand (~$24.50/mo for the instance) buys that away if it ever matters.

---

## 7. What Stays the Same from Phase 1

- PGD attack logic (`attack.py`) — unchanged
- Anonymous "lab" use — unchanged, still works without an account
- S3 storage mechanism — unchanged, just tightened to presigned URLs
- Deployment philosophy — still one EC2 instance, still cost-minimized (k3s instead of EKS, spot instead of on-demand, Neon/Supabase free tier instead of RDS, MongoDB Atlas free tier)

---

## 8. Implementation Plan

Ordered so each step produces something testable before moving to the next. Estimates assume focused work, not calendar time.

### Step 1 — Infra foundation (~2-3 hrs)
- [x] EC2 `t4g.medium` (ARM/Graviton, persistent spot) up with a 15GB gp3 root volume, Elastic IP attached, k3s installed (`curl -sfL https://get.k3s.io | sh -`)
- [x] Postgres provisioned on Neon free tier (us-east-1), connection string saved as k3s Secret `db-credentials` (key `DATABASE_URL`); verified reachable from in-cluster pod
- [x] MongoDB Atlas M0 cluster (reused from Phase 1), connection string saved as k3s Secret `mongo-uri`
- [x] S3 bucket + IAM role reused from Phase 1 (verified from in-cluster pod via instance role)
- [x] SES email verified (tiffany.m.mares@gmail.com, send test passed); note sandbox mode limits sending to verified addresses only until production access is approved
- [x] Monorepo restructured: `services/ml-service/`, `services/auth-service/`, `services/gateway/`, `frontend/`, `k8s/` for manifests

**Test:** deploy a placeholder "hello world" container to k3s, confirm it's reachable via Traefik Ingress from your laptop, and confirm a shell inside the cluster can reach both Postgres and MongoDB Atlas.

### Step 2 — `users` table + Spring Boot auth service (~1 day)
- [x] Create `users` table (section 2 SQL) — live in Neon
- [x] Spring Boot project (landed on Boot 4.1 — start.spring.io no longer serves 3.x): security, data-jpa, Postgres driver, jjwt 0.13
- [x] `POST /auth/signup`, `GET /auth/verify`, `POST /auth/login` per §3 contract (HS256 pinned explicitly; 14 tests incl. integration vs real Postgres)
- [x] SES integration for the verification email (note: SES-from-gmail fails Gmail SPF alignment → lands in spam; production fix is a domain identity)
- [x] JWT signing key generated, stored as k3s Secret `jwt-signing-key` (key `JWT_SECRET`), read by Spring config `app.jwt-secret`

**Test:** via curl/Postman — signup, receive email, hit verify link, login, confirm a decodable JWT comes back with the right `sub`/`email` claims.

### Step 3 — `images`/`likes` tables + ML service auth awareness (~half day)
- [ ] Create `images` and `likes` tables (section 2 SQL)
- [ ] FastAPI `/protect`: accept optional `Authorization` header, verify JWT locally (same shared secret as Spring Boot, no network call)
- [ ] On valid token: after S3 upload, write the MongoDB job doc with `user_id` populated, then insert the corresponding `images` row in Postgres, return `image_id` in the response
- [ ] On missing/invalid token: unchanged Phase 1 behavior — protect and return, nothing persisted

**Test:** protect an image logged in → confirm one Mongo doc and one Postgres row, linked by `mongo_job_id`. Protect one anonymously → confirm neither table gets a new row.

### Step 4 — Go gateway (~1 day)
- [ ] Go service scaffolded with a Postgres driver and JWT middleware (verifies the same shared secret)
- [ ] Reverse proxy routes: `/auth/*` → auth-service, `/protect` → ml-service
- [ ] Implement `GET /dashboard`, `GET /dashboard/liked`, `PATCH /images/:id/favorite`, `PATCH /images/:id/publish`, `GET /gallery`, `POST /images/:id/like`, `DELETE /images/:id/like` per section 3 — enforce ownership checks (`user_id` from JWT must match `images.user_id`) on the PATCH routes
- [ ] `popular` sort implemented as a `LEFT JOIN` against `likes` with `GROUP BY` + `COUNT`, ordered descending

**Test:** full curl/Postman walkthrough — signup two test users, protect+save an image as user A, publish it, like it as user B, confirm it shows in user B's Liked tab and in `/gallery?sort=popular`.

### Step 5 — Frontend (~1-1.5 days)
- [ ] Sign-in/sign-up pages, JWT stored client-side, attached to all authenticated fetch calls
- [ ] "Check your email" pending state post-signup
- [ ] Lab page: add "Save to dashboard" (only rendered if logged in), calls existing `/protect` with the auth header
- [ ] Dashboard page: grid of `GET /dashboard` results, tabs for All / Favorites / Liked, favorite/publish toggle buttons wired to the PATCH routes
- [ ] Gallery page: `GET /gallery` with a sort dropdown, like button — logged-out click redirects to sign-in instead of calling the API

**Test:** the full user journey clickable end to end in the browser against a local or dev backend.

### Step 6 — Deploy to k3s (~half day)
- [ ] Dockerfile per service; build and push images (or build directly on the EC2 host if skipping a registry)
- [ ] k8s manifests: Deployment + Service for `ml-service`, `auth-service`, `gateway`; Traefik Ingress on the gateway only
- [ ] Secrets applied: `jwt-signing-key`, `db-credentials`, `ses-credentials`, `s3-credentials`
- [ ] Switch S3 access from public objects to presigned URLs generated by `ml-service`, tighten CORS on the gateway to the live Vercel origin
- [ ] Frontend redeployed to Vercel pointed at the gateway's public Ingress URL

**Test:** the entire flow — signup through email verification through protect/save/publish/like — works against the live k3s-hosted backend and live Vercel frontend, from two separate browser sessions (to verify the cross-user like flow for real).

### Step 7 — README, video, submission
- [ ] README architecture section written from this doc directly — it already has the diagram, data models, and contracts
- [ ] Demo video shot list: signup+verify → protect an image → save to dashboard → publish → switch to a second account, like it in the gallery → back to first account, show it wasn't lost
- [ ] Roadmap section: anything cut (Rust pre/post-processing service, Grad-CAM) stays honestly listed rather than implied as done — the ensemble attack is KEPT in Phase 2 (hence t4g.medium), not cut

---

## 9. Fallback If Time Runs Short

Ship Steps 1-3 only (infra + auth + save-to-dashboard, no gallery/likes/publish) as the submission, and list gallery/social features explicitly as "next" in the README roadmap. That's a smaller but fully honest and fully working submission — better than a half-wired gallery feature demoed live.
