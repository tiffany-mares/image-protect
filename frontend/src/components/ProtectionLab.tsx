import { useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { authHeaders } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Prediction = {
  index: number;
  label: string;
  confidence: number;
};

type ModelPredictions = {
  original: Prediction;
  protected: Prediction;
};

type ApiResult = {
  original_url: string;
  protected_url: string;
  job_id: string;
  image_id?: string;
  predictions: {
    resnet50: ModelPredictions;
    mobilenet: ModelPredictions;
  };
};

const MAX_DIM = 768;

export function ProtectionLab() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [epsilon, setEpsilon] = useState(0.02);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { loggedIn } = useAuth();

  const loadFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) return;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const runProtection = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setElapsed(0);
    setError(null);
    setResult(null);

    // Start elapsed-seconds timer while the server runs PGD.
    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    const form = new FormData();
    form.append("file", file);
    form.append("epsilon", String(epsilon));

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:8082"}/protect`,
        { method: "POST", body: form, headers: authHeaders() },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text.slice(0, 200)}`);
      }
      const data: ApiResult = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Protection failed");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setLoading(false);
    }
  }, [file, epsilon]);

  const download = useCallback(() => {
    if (!result) return;
    // protected_url is a cross-origin S3 presigned URL. Try an anchor with the
    // download attribute; if the browser ignores it cross-origin, it still
    // navigates/opens the file.
    const a = document.createElement("a");
    a.href = result.protected_url;
    a.download = `inkshield-protected-${result.job_id}.png`;
    a.rel = "noopener";
    a.click();
  }, [result]);

  const hasImage = file !== null;

  return (
    <section id="lab" className="border-t border-border bg-ink">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-12 gap-10 mb-14">
          <div className="lg:col-span-3">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-lime flex items-center gap-3">
              <span className="w-8 h-px bg-lime" />
              § lab · try it live
            </div>
          </div>
          <div className="lg:col-span-9">
            <h2 className="font-display text-4xl lg:text-6xl leading-none">
              See what a scraper sees.
              <br />
              <span className="italic text-lime">Then break its vision.</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Drop in an image and apply Inkshield. Your file is uploaded and
              protected server-side by a real ensemble PGD attack against
              ResNet-50 and MobileNetV2. Before-and-after predictions from both
              models show exactly how each is fooled, then download the
              protected file.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) loadFile(f);
          }}
          className={`border bg-background/40 p-6 grid md:grid-cols-12 gap-6 items-center transition-colors ${
            dragOver ? "border-lime bg-lime/5" : "border-border"
          }`}
        >
          <div className="md:col-span-5">
            <div className="font-mono text-xs uppercase tracking-widest text-lime mb-2">
              epsilon · perturbation strength
            </div>
            <input
              type="range"
              min={0.005}
              max={0.05}
              step={0.005}
              value={epsilon}
              onChange={(e) => setEpsilon(parseFloat(e.target.value))}
              className="w-full accent-lime"
            />
            <div className="mt-2 font-mono text-sm text-foreground">
              ε = {epsilon.toFixed(3)}
            </div>
          </div>
          <div className="md:col-span-7 flex flex-wrap gap-3 md:justify-end">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="font-mono text-xs uppercase tracking-widest px-4 py-3 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors hover-lift"
            >
              {hasImage ? "Change image" : "↑ Upload artwork"}
            </button>
            <button
              onClick={runProtection}
              disabled={!hasImage || loading}
              className="font-mono text-xs uppercase tracking-widest px-4 py-3 bg-lime text-primary-foreground hover:bg-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 hover-lift"
            >
              {loading ? (
                <>
                  <span className="inline-block w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                  Running PGD… {elapsed}s
                </>
              ) : (
                "⚡ Protect with PGD"
              )}
            </button>
            <button
              onClick={download}
              disabled={!result}
              className="font-mono text-xs uppercase tracking-widest px-4 py-3 border border-border text-foreground hover:border-lime hover:text-lime transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover-lift"
            >
              ↓ Download protected
            </button>
          </div>

          {/* Save-to-dashboard status */}
          {loggedIn && result?.image_id && (
            <p className="md:col-span-12 mt-1 font-mono text-xs text-lime">
              Saved to your dashboard ✓{" "}
              <Link to="/dashboard" className="underline hover:text-amber">
                view
              </Link>
            </p>
          )}
          {!loggedIn && result && (
            <p className="md:col-span-12 mt-1 font-mono text-xs text-muted-foreground">
              <Link to="/auth" className="text-lime hover:text-amber">
                Sign in
              </Link>{" "}
              to save results to a dashboard.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 font-mono text-xs text-magenta border border-magenta/40 bg-magenta/5 px-4 py-3">
            {error}
          </div>
        )}

        {/* Image panels */}
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          <LabPane
            label="Original"
            accent="text-muted-foreground"
            imgSrc={result?.original_url ?? previewUrl}
            hasImage={hasImage}
            onUploadClick={() => fileRef.current?.click()}
            predictions={result ? result.predictions : null}
            which="original"
            predictionLabel="model reads"
          />
          <LabPane
            label="Inkshielded"
            accent="text-lime"
            imgSrc={result?.protected_url ?? null}
            hasImage={hasImage}
            onUploadClick={() => fileRef.current?.click()}
            predictions={result ? result.predictions : null}
            which="protected"
            predictionLabel="model now sees"
            accentBorder
            loading={loading}
          />
        </div>

        <p className="mt-8 text-xs text-muted-foreground font-mono max-w-2xl">
          note: your image is uploaded and protected server-side by a real
          4-step ensemble PGD attack against ResNet-50 and MobileNetV2 (~5–15s
          on CPU). files are stored privately on S3 and returned as time-limited
          presigned URLs. stronger ε = stronger disruption at the cost of slight
          visible grain.
        </p>
      </div>
    </section>
  );
}

function LabPane({
  label,
  accent,
  imgSrc,
  hasImage,
  onUploadClick,
  predictions,
  which,
  predictionLabel,
  accentBorder,
  loading,
}: {
  label: string;
  accent: string;
  imgSrc: string | null;
  hasImage: boolean;
  onUploadClick: () => void;
  predictions: ApiResult["predictions"] | null;
  which: "original" | "protected";
  predictionLabel: string;
  accentBorder?: boolean;
  loading?: boolean;
}) {
  const resnet = predictions?.resnet50[which] ?? null;
  const mobile = predictions?.mobilenet[which] ?? null;

  return (
    <div
      className={`border ${accentBorder ? "border-lime" : "border-border"} bg-background/40`}
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className={`font-mono text-xs uppercase tracking-[0.3em] ${accent}`}>
          {label}
        </div>
      </div>
      <div className="bg-black/40 flex items-center justify-center overflow-hidden aspect-square relative">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={label}
            className="max-w-full max-h-full h-auto block object-contain"
            style={{ maxHeight: MAX_DIM }}
          />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-lime font-mono text-xs uppercase tracking-widest">
            <span className="text-3xl animate-spin">⟳</span>
            <span>Running PGD attack…</span>
          </div>
        ) : (
          <button
            onClick={onUploadClick}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-lime transition-colors font-mono text-xs uppercase tracking-widest hover-lift"
          >
            <span className="text-3xl">+</span>
            <span>upload to preview</span>
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {resnet && mobile ? (
          <div className="space-y-2 font-mono text-xs">
            <div className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground mb-1">
              {predictionLabel}
            </div>
            <ScanRow
              k="ResNet-50"
              v={`${resnet.label} (${Math.round(resnet.confidence * 100)}%)`}
            />
            <ScanRow
              k="MobileNetV2"
              v={`${mobile.label} (${Math.round(mobile.confidence * 100)}%)`}
            />
          </div>
        ) : (
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            {loading ? "awaiting result…" : "run protection to see prediction"}
          </div>
        )}
      </div>
    </div>
  );
}

function ScanRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 pb-1">
      <span className="uppercase tracking-widest text-[0.65rem] text-muted-foreground">
        {k}
      </span>
      <span className="text-foreground text-right ml-4">{v}</span>
    </div>
  );
}
