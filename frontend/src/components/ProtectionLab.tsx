import { useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  getSnapshot,
  loadFile,
  publishResult,
  runProtection,
  setEpsilon,
  subscribe,
  type ProtectResult,
} from "@/lib/protectionStore";

type ApiResult = ProtectResult;

const MAX_DIM = 768;

export function ProtectionLab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { loggedIn } = useAuth();
  const navigate = useNavigate();

  // The run itself lives in a module-level store (see protectionStore.ts), so it
  // keeps running and its result survives if the user navigates away and back.
  const {
    file,
    previewUrl,
    epsilon,
    loading,
    elapsed,
    error,
    result,
    publishing,
    published,
    publishError,
  } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const hasImage = file !== null;

  const download = () => {
    if (!result) return;
    // Prefer download_url, a presigned URL signed with a Content-Disposition
    // override, so S3 serves it as an attachment and the browser downloads it
    // (the plain cross-origin protected_url would just open in the tab, since
    // the <a download> attribute is ignored cross-origin). Fall back to
    // protected_url for older responses without download_url.
    const a = document.createElement("a");
    a.href = result.download_url ?? result.protected_url;
    a.download = `inkshield-protected-${result.job_id}.png`;
    a.rel = "noopener";
    a.click();
  };

  const onPublish = async () => {
    // Publishing requires an account. A logged-out click is a sign-in prompt.
    if (!loggedIn) {
      navigate({ to: "/auth" });
      return;
    }
    const ok = await publishResult();
    // Signed-in publish succeeded, take the user straight to the gallery.
    if (ok) navigate({ to: "/gallery" });
  };

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
            <h2 className="font-display font-bold uppercase tracking-tight text-4xl lg:text-6xl leading-[0.95]">
              See what a scraper sees.
              <br />
              <span className="text-lime">Then break its vision.</span>
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
              ) : result ? (
                "⚡ Re-run at this ε"
              ) : (
                "⚡ Protect with PGD"
              )}
            </button>
            {result && (
              <button
                onClick={download}
                className="font-mono text-xs uppercase tracking-widest px-5 py-3 bg-amber text-primary-foreground border border-amber hover:bg-lime hover:border-lime transition-colors hover-lift inline-flex items-center gap-2"
              >
                ↓ Download protected
              </button>
            )}
          </div>

          {/* Prominent publish CTA, appears once a protected image exists */}
          {result && !published && (
            <div className="md:col-span-12">
              <button
                type="button"
                onClick={onPublish}
                disabled={publishing}
                className="w-full font-mono text-sm uppercase tracking-widest px-6 py-4 bg-lime text-primary-foreground hover:bg-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 hover-lift"
              >
                {publishing ? "publishing…" : "▲ Publish to gallery"}
              </button>
              <p className="mt-2 font-mono text-xs text-muted-foreground text-center">
                {loggedIn
                  ? "Publishing adds this image to the public gallery and takes you there."
                  : "You'll be asked to sign in first."}
              </p>
            </div>
          )}

          {/* Save + publish status */}
          {result && (
            <div className="md:col-span-12 mt-1 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs">
              {loggedIn && result.image_id ? (
                <span className="text-lime">
                  Saved to your profile ✓{" "}
                  <Link to="/profile" className="underline hover:text-amber">
                    view
                  </Link>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  <Link to="/auth" className="text-lime hover:text-amber">
                    Sign in
                  </Link>{" "}
                  to save results to your profile.
                </span>
              )}

              {published && (
                <span className="text-lime">
                  Published to gallery ✓{" "}
                  <Link to="/gallery" className="underline hover:text-amber">
                    view gallery
                  </Link>
                </span>
              )}

              {publishError && (
                <span className="text-magenta">{publishError}</span>
              )}
            </div>
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
            accent="text-lime"
            imgSrc={result?.original_url ?? previewUrl}
            hasImage={hasImage}
            onUploadClick={() => fileRef.current?.click()}
            predictions={result ? result.predictions : null}
            which="original"
            predictionLabel="model reads"
            accentBorder
          />
          <LabPane
            label="Inkshielded"
            accent="text-muted-foreground"
            imgSrc={result?.protected_url ?? null}
            hasImage={hasImage}
            predictions={result ? result.predictions : null}
            which="protected"
            predictionLabel="model now sees"
            loading={loading}
          />
        </div>

        <p className="mt-8 text-base sm:text-lg text-foreground font-mono max-w-3xl leading-relaxed border-l-2 border-lime pl-5">
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
  onUploadClick?: () => void;
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
          <div className="flex flex-col items-center justify-center gap-3 text-lime font-mono text-xs uppercase tracking-widest px-6 text-center">
            <span className="text-3xl animate-spin">⟳</span>
            <span>Running PGD attack…</span>
            <span className="text-muted-foreground normal-case tracking-normal">
              this usually takes 30 seconds to 1 minute
            </span>
            {/* The run lives in a module store, so browsing away keeps it going. */}
            <div className="flex flex-col items-stretch gap-2 pt-3 w-full max-w-xs normal-case tracking-normal">
              <a
                href="#how"
                className="px-3 py-2 border border-border text-muted-foreground hover:border-lime hover:text-lime transition-colors hover-lift"
              >
                Read the pipeline in the meantime →
              </a>
              <Link
                to="/gallery"
                className="px-3 py-2 border border-border text-muted-foreground hover:border-lime hover:text-lime transition-colors hover-lift"
              >
                Explore gallery in the meantime →
              </Link>
            </div>
          </div>
        ) : which === "original" ? (
          <button
            onClick={onUploadClick}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-lime transition-colors font-mono text-xs uppercase tracking-widest hover-lift"
          >
            <span className="text-3xl">+</span>
            <span>upload to preview</span>
          </button>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground font-mono text-xs uppercase tracking-widest">
            <span className="text-2xl">◇</span>
            <span>protected result appears here</span>
          </div>
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
