# Image Protect â€” Implementation Plan

## Overview

Build a live web app where artists upload an image, apply an adversarial PGD perturbation
(against a pretrained ResNet-50), and download a visually near-identical protected image that
misleads AI vision models. Before/after model predictions are shown side-by-side as proof.

**Stack:** Python + PyTorch (ML core) â†’ FastAPI (API) â†’ React + Vite + shadcn/ui (frontend)
â†’ AWS EC2 (backend hosting) â†’ AWS S3 with presigned URLs (image storage) â†’ Vercel (frontend hosting)

**Repo structure target:**
```
image-protect/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ attack.py          # PGD adversarial attack + ResNet-50 inference
â”‚   â”œâ”€â”€ main.py            # FastAPI app
â”‚   â”œâ”€â”€ labels.py          # ImageNet class index â†’ label lookup
â”‚   â”œâ”€â”€ requirements.txt
â”‚   â”œâ”€â”€ protect-api.service  # systemd unit for EC2
â”‚   â””â”€â”€ s3_setup.py          # one-time S3 bucket + policy bootstrap script
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ App.tsx
â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â””â”€â”€ ProtectTool.tsx
â”‚   â”‚   â””â”€â”€ main.tsx
â”‚   â”œâ”€â”€ index.html
â”‚   â”œâ”€â”€ package.json
â”‚   â”œâ”€â”€ tailwind.config.ts
â”‚   â”œâ”€â”€ tsconfig.json
â”‚   â””â”€â”€ vite.config.ts
â””â”€â”€ README.md
```

---

## Sub-Task 1 â€” ML Core (`attack.py` + `labels.py`)

**Status:** [x] done

### Intent
Implement the PGD adversarial attack and ResNet-50 inference as a standalone Python module.
This is the heart of the application â€” all other layers depend on it working correctly. It must
be verifiable in isolation before wiring into the API.

### Expected Outcomes
- `attack.py` loads ResNet-50 weights once at module import time (not per call).
- `predict()` returns `(class_index, class_label, confidence)` for a given image tensor.
- `pgd_attack()` accepts a PIL Image and `eps`/`steps` parameters and returns a protected PIL
  Image plus a structured predictions dict containing before/after index, label, and confidence.
- `labels.py` provides a `get_label(index: int) -> str` function backed by the standard
  ImageNet 1K class names list.
- Running `python attack.py` with a sample image prints before/after predictions and saves
  `test_protected.png` to disk â€” proving the attack works before the API is built.

### Todo List
1. Create `backend/` directory.
2. Create `backend/labels.py` â€” embed or load the 1000 ImageNet class name strings, expose
   `get_label(idx: int) -> str`.
3. Create `backend/attack.py`:
   - Import torch, torchvision, PIL, labels.
   - Module-level: load ResNet-50 with `ResNet50_Weights.IMAGENET1K_V2`, set `.eval()`, move
     to device (CUDA if available, else CPU).
   - Define `preprocess` transform (Resize 256 â†’ CenterCrop 224 â†’ ToTensor) and `normalize`
     (ImageNet mean/std) as module-level constants.
   - `predict(tensor) -> dict` â€” returns `{"index": int, "label": str, "confidence": float}`.
   - `pgd_attack(image: Image, eps: float, steps: int) -> (Image, dict)` â€” implements the
     iterative PGD loop described in the outline. `alpha = eps / steps * 2.5`. Clips to
     `[x_orig - eps, x_orig + eps]` and `[0, 1]` after each step. Returns protected PIL Image
     and `{"original": predict_result, "protected": predict_result}`.
   - `if __name__ == "__main__"` block: load a sample image from argv, run the attack, print
     predictions, save `test_protected.png`.
4. Create `backend/requirements.txt` listing: `fastapi`, `uvicorn[standard]`, `torch`,
   `torchvision`, `pillow`, `boto3`, `python-multipart`.

### Validation
- Run `python attack.py <path-to-sample-image>` â€” output must print original and protected
  prediction dicts and write `test_protected.png` to disk.
- Confirm the `protected.predictions.original.label` and `protected.predictions.protected.label`
  differ (or at minimum confidence drops), proving the attack perturbed the model output.
- Open `test_protected.png` visually â€” it should look identical to the source image to the
  naked eye.

### Relevant Context
- PGD formula from outline Section 5: `x_{t+1} = Clip_{x,eps}( x_t + alpha * sign(grad_x L) )`
- Model must be loaded once at module level â€” loading per-request adds ~1-2s dead time.
- `labels.py` feeds the "both index and label" API contract agreed in planning.

---

## Sub-Task 2 â€” FastAPI Backend (`main.py`)

**Status:** [x] done

### Intent
Wrap `pgd_attack()` in a single `POST /protect` HTTP endpoint. Handle multipart upload,
invoke the attack, store original and protected images in S3 (private bucket), return
presigned URLs plus before/after predictions. Include CORS middleware so the Vercel frontend
can call it.

### Expected Outcomes
- `POST /protect` accepts a multipart form with `file` (image) and `epsilon` (float, default 0.02).
- Stores original bytes and protected PNG in S3 under `originals/{uuid}.png` and
  `protected/{uuid}.png`.
- Returns presigned GET URLs (1-hour expiry) for both keys plus the full predictions dict.
- CORS origin is read from an environment variable `CORS_ORIGIN` (not hardcoded), defaulting
  to `*` for local development.
- S3 bucket name is read from environment variable `S3_BUCKET`.
- boto3 uses the EC2 instance IAM role â€” no hardcoded credentials anywhere.
- Running `uvicorn main:app --reload --port 8000` locally works end-to-end (tested with curl).

### Todo List
1. Create `backend/main.py`:
   - Import FastAPI, CORSMiddleware, UploadFile, File, Form, io, uuid, boto3, PIL, attack module.
   - Read `CORS_ORIGIN` and `S3_BUCKET` from `os.environ` at startup.
   - Add CORSMiddleware with `allow_origins=[CORS_ORIGIN]`, `allow_methods=["POST", "GET"]`,
     `allow_headers=["*"]`.
   - Instantiate `boto3.client("s3")` at module level.
   - Implement `POST /protect`:
     - Read file bytes, open as PIL RGB image.
     - Call `pgd_attack(image, eps=epsilon)` â€” use default `steps=8`.
     - Generate UUID job_id, derive S3 keys.
     - Upload original bytes and protected PNG bytes to S3 (ContentType `image/png`).
     - Generate presigned URLs for both keys with `ExpiresIn=3600`.
     - Return JSON: `{ protected_url, original_url, job_id, predictions }`.
   - Add a `GET /health` endpoint returning `{"status": "ok"}` â€” useful for EC2 deployment
     verification.
2. Verify with `curl -F "file=@sample.jpg" -F "epsilon=0.02" http://localhost:8000/protect`.

### Validation
- Start the server: `uvicorn main:app --reload --port 8000` (from `backend/` directory).
- Hit the health check: `curl http://localhost:8000/health` must return `{"status":"ok"}`.
- Test the protect endpoint: `curl -F "file=@sample.jpg" -F "epsilon=0.02" http://localhost:8000/protect`
  must return JSON with `protected_url`, `original_url`, `job_id`, and `predictions`.
- Confirm both S3 keys exist in the bucket (via AWS console or `aws s3 ls s3://BUCKET/`).
- Confirm presigned URLs are accessible in a browser (objects should load without auth).

### Relevant Context
- Sub-Task 1 must be complete before this can run.
- IAM role approach: EC2 instance profile with `s3:PutObject` + `s3:GetObject` on the bucket â€”
  no keys in code or environment.
- Presigned URL generation uses `s3.generate_presigned_url("get_object", ...)` with
  `ExpiresIn=3600`.

---

## Sub-Task 3 â€” React Frontend

**Status:** [x] done

### Intent
Build a single-page React app (Vite + TypeScript + Tailwind + shadcn/ui) with: image file
upload, epsilon strength slider, a "Protect Image" submit button, and a before/after panel
showing both images with their predicted class labels and confidence scores. API base URL is
injected via environment variable.

### Expected Outcomes
- `npm run dev` starts a local dev server that calls the FastAPI backend at
  `VITE_API_URL` (default `http://localhost:8000`).
- User can select an image file, adjust the epsilon slider (0.005 â€“ 0.04, step 0.005).
- On submit: button shows "Protectingâ€¦" spinner while the request is in flight.
- On success: before/after images are displayed side-by-side; each panel shows the predicted
  class label, class index, and confidence percentage.
- `npm run build` produces a static bundle deployable to Vercel.

### Todo List
1. Scaffold `frontend/` with `npm create vite@latest frontend -- --template react-ts`.
2. Install Tailwind CSS (`tailwindcss`, `@tailwindcss/vite`) and configure
   `tailwind.config.ts` and `vite.config.ts`.
3. Install and initialize shadcn/ui (`npx shadcn@latest init`); add components:
   `slider`, `button`, `card`, `badge`.
4. Create `frontend/src/components/ProtectTool.tsx`:
   - State: `file`, `epsilon`, `result`, `loading`, `error`.
   - File input (hidden, triggered by a styled Card click zone showing filename or a drop hint).
   - shadcn Slider for epsilon (0.005 â€“ 0.04, step 0.005) with live label showing current value.
   - shadcn Button for submit, disabled when no file or loading; shows spinner text when loading.
   - On submit: build FormData, POST to `${import.meta.env.VITE_API_URL}/protect`, set result.
   - Result panel: two shadcn Cards side by side ("Original" / "Protected"), each showing the
     image and a Badge with `label (index) â€” X.X%` confidence.
   - Error state: display a red alert if the request fails.
5. Wire `ProtectTool` into `frontend/src/App.tsx` with a simple page header.
6. Create `frontend/.env.example` with `VITE_API_URL=http://localhost:8000`.
7. Confirm `npm run build` succeeds with no TypeScript errors.

### Validation
- Run `npm run dev` â€” browser opens, page loads with no console errors.
- Select a sample image, leave epsilon at default, click "Protect Image" â€” loading state
  appears then before/after cards render with images and prediction badges.
- Run `npm run build` â€” must complete with zero TypeScript errors and zero Vite warnings.
- Open `dist/index.html` in a browser via `npx serve dist` â€” confirm the built app works
  identically to dev mode.

### Relevant Context
- shadcn/ui docs: components are added via `npx shadcn@latest add <component>` which copies
  source files into `src/components/ui/`.
- API response shape: `{ protected_url, original_url, job_id, predictions: { original: { index, label, confidence }, protected: { index, label, confidence } } }`.
- Vite environment variables must be prefixed `VITE_` to be exposed to the browser bundle.

---

## Sub-Task 4 â€” Deployment Config Files

**Status:** [x] done

### Intent
Create all the deployment artifacts needed to go live: systemd service unit for the EC2
backend process, a `.gitignore`, and a Vercel config. These are static config files â€” no
running infrastructure changes are made in this sub-task, just the files committed to the repo.

### Expected Outcomes
- `backend/protect-api.service` is a ready-to-copy systemd unit that starts uvicorn, restarts
  on failure, and expects the app at `/home/ubuntu/app/backend/`.
- `.gitignore` excludes `__pycache__`, `.env`, `node_modules`, `dist`, `*.pyc`, `.venv`.
- `frontend/vercel.json` rewrites all routes to `index.html` (SPA routing) and sets the
  output directory to `dist`.

### Todo List
1. Create `backend/protect-api.service` â€” systemd unit with `ExecStart` pointing at uvicorn,
   `WorkingDirectory=/home/ubuntu/app/backend`, `EnvironmentFile=/home/ubuntu/app/.env`,
   `Restart=always`.
2. Create `.gitignore` at repo root covering Python and Node artifacts.
3. Create `frontend/vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.

### Validation
- Lint the service file: confirm `ExecStart`, `WorkingDirectory`, `EnvironmentFile`, and
  `Restart=always` are all present.
- Confirm `.gitignore` excludes `.env` by running `git status` after creating a dummy `.env`
  file â€” it must not appear as untracked.
- Validate `vercel.json` is valid JSON: `python -c "import json; json.load(open('frontend/vercel.json'))"`.

### Relevant Context
- The `.env` file on EC2 will hold `S3_BUCKET=...` and `CORS_ORIGIN=https://your-app.vercel.app`.
- `EnvironmentFile` in the systemd unit means secrets never live in the service file itself.

---

## Sub-Task 5 â€” S3 Bucket Setup (`s3_setup.py`)

**Status:** [x] done

### Intent
Create a one-time Python script that provisions the S3 bucket with the correct configuration:
private ACL, block all public access, and a least-privilege bucket policy scoped to the EC2
instance IAM role. Running this script once from a developer machine with appropriate AWS
credentials is the only manual AWS step required before the backend can store images.

### Expected Outcomes
- `backend/s3_setup.py` creates the S3 bucket in the specified region (idempotent â€” safe to
  re-run if the bucket already exists).
- All public access is blocked on the bucket.
- A bucket policy is applied that grants `s3:PutObject` and `s3:GetObject` only to the
  named EC2 IAM role ARN (passed as a CLI argument or environment variable).
- Running `python s3_setup.py` prints a confirmation summary: bucket name, region, policy
  applied, and a reminder to attach the IAM role to the EC2 instance.
- The script requires no hardcoded credentials â€” it uses the AWS CLI profile / environment
  credentials of whoever runs it locally.

### Todo List
1. Create `backend/s3_setup.py`:
   - Accept `S3_BUCKET`, `AWS_REGION`, and `IAM_ROLE_ARN` from environment variables
     (with clear error messages if missing).
   - Use `boto3.client("s3")` to call `create_bucket` (with `CreateBucketConfiguration`
     for regions other than `us-east-1`).
   - Call `put_public_access_block` with all four block flags set to `True`.
   - Build and call `put_bucket_policy` with a policy that allows `s3:PutObject` and
     `s3:GetObject` on `arn:aws:s3:::BUCKET/*` for the specified IAM role ARN principal.
   - Print a confirmation summary on success.
   - Handle `BucketAlreadyOwnedByYou` gracefully (idempotent).
2. Add a usage comment block at the top of the script documenting the three required
   environment variables and the one-time IAM role setup step.

### Validation
- Run `python s3_setup.py` with the three env vars set â€” script must exit cleanly and print
  the confirmation summary.
- Re-run immediately â€” must handle `BucketAlreadyOwnedByYou` gracefully (no stack trace).
- Verify in the AWS console: bucket exists, "Block all public access" shows all four settings
  enabled, bucket policy is attached and matches the IAM role ARN.

### Relevant Context
- boto3 `create_bucket` requires `CreateBucketConfiguration: {LocationConstraint: region}`
  for every region except `us-east-1` â€” omitting it causes an error.
- The IAM role ARN format is `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`; the EC2 instance
  profile must reference this role.
- This script runs once from a dev machine, not on EC2 â€” credentials come from the local
  AWS CLI profile, not an instance role.

---

## Sub-Task 6 â€” README

**Status:** [x] done

### Intent
Write the project README fulfilling the IBM AI Builders Challenge submission checklist:
problem statement, solution description, AI approach (PGD math), architecture, theme,
how IBM Bob was used, known tradeoffs, and roadmap.

### Expected Outcomes
- `README.md` at repo root covers all 6 checklist items from the outline.
- Includes the PGD formula rendered in a code block.
- Architecture section contains the ASCII diagram from the outline.
- Tradeoffs section explicitly states CPU inference speed, single-model scope, and presigned
  URL choice.
- Roadmap section lists: ensemble attack (ResNet-50 + ViT + CLIP), Grad-CAM visualization,
  batch processing, FGSM comparison, PostgreSQL job history.

### Todo List
1. Create `README.md` with all sections above.
2. Verify checklist from outline Section 11 is fully covered.

### Validation
- Read through the rendered README on GitHub â€” all 6 checklist items from the outline's
  Section 11 must be present and substantive (not placeholder text).
- Confirm the PGD formula code block renders correctly.
- Confirm the ASCII architecture diagram is intact (no line-wrap corruption).

### Relevant Context
- Outline Sections 10 and 11 are the source of truth for tradeoffs and submission checklist.
- "How IBM Bob was used" section should be specific: planning, architecture design, code
  generation for ML core and API, README structure.
