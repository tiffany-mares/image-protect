import { useCallback, useRef, useState } from "react";

type Prediction = {
  index: number;
  label: string;
  confidence: number;
};

type ApiResult = {
  original_url: string;
  protected_url: string;
  job_id: string;
  predictions: {
    original: Prediction;
    protected: Prediction;
  };
};

const MAX_DIM = 768;

export function ProtectionLab() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [epsilon, setEpsilon] = useState(0.02);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("epsilon", String(epsilon));

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/protect`,
        { method: "POST", body: form },
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
      setLoading(false);
    }
  }, [file, epsilon]);

  const download = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.protected_url;
    a.download = `inkshield-protected-${result.job_id}.png`;
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
              Drop in an image. Apply Inkshield, the real PyTorch PGD attack
              runs server-side against ResNet-50. Before and after predictions
              show exactly how the model is fooled. Download the protected file
              from S3.
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
              className="font-mono text-xs uppercase tracking-widest px-4 py-3 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors"
            >
              {hasImage ? "Change image" : "↑ Upload artwork"}
            </button>
            <button
              onClick={runProtection}
              disabled={!hasImage || loading}
              className="font-mono text-xs uppercase tracking-widest px-4 py-3 bg-lime text-primary-foreground hover:bg-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Running PGD…" : "⚡ Protect with PGD"}
            </button>
            <button
              onClick={download}
              disabled={!result}
              className="font-mono text-xs uppercase tracking-widest px-4 py-3 border border-border text-foreground hover:border-lime hover:text-lime transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↓ Download protected
            </button>
          </div>
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
            imgSrc={previewUrl}
            hasImage={hasImage}
            onUploadClick={() => fileRef.current?.click()}
            prediction={result?.predictions.original ?? null}
            predictionLabel="model reads"
          />
          <LabPane
            label="Inkshielded"
            accent="text-lime"
            imgSrc={result?.protected_url ?? null}
            hasImage={hasImage}
            onUploadClick={() => fileRef.current?.click()}
            prediction={result?.predictions.protected ?? null}
            predictionLabel="model now sees"
            accentBorder
            loading={loading}
          />
        </div>

        <p className="mt-8 text-xs text-muted-foreground font-mono max-w-2xl">
          note: protection runs a real 8-step PGD attack on ResNet-50 server-side
          (~5–10s on CPU). images are stored privately on S3 and returned as
          time-limited presigned URLs. stronger ε = stronger disruption at the
          cost of slight visible grain.
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
  prediction,
  predictionLabel,
  accentBorder,
  loading,
}: {
  label: string;
  accent: string;
  imgSrc: string | null;
  hasImage: boolean;
  onUploadClick: () => void;
  prediction: Prediction | null;
  predictionLabel: string;
  accentBorder?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={`border ${accentBorder ? "border-lime" : "border-border"} bg-background/40`}>
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
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-lime transition-colors font-mono text-xs uppercase tracking-widest"
          >
            <span className="text-3xl">+</span>
            <span>upload to preview</span>
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {prediction ? (
          <div className="space-y-2 font-mono text-xs">
            <div className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground mb-2">
              {predictionLabel}
            </div>
            <ScanRow k="class" v={`${prediction.label} (${prediction.index})`} />
            <ScanRow
              k="confidence"
              v={`${(prediction.confidence * 100).toFixed(1)}%`}
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
