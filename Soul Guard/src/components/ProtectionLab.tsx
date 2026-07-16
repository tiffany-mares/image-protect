import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scanImage } from "@/lib/scan.functions";

type ScanResult = {
  ok: boolean;
  subject?: string;
  style?: string;
  tags?: string[];
  confidence?: number | null;
  error?: string;
};

const MAX_DIM = 768;

// Apply an adversarial-style perturbation to imageData in place.
// Uses structured high-frequency sign patterns per channel plus a
// pseudo-random sign mask — visually mimics FGSM-style noise.
function perturb(imageData: ImageData, epsilon: number) {
  const { data, width, height } = imageData;
  const amp = Math.round(epsilon * 255); // e.g. eps=0.02 → ±5
  if (amp <= 0) return;

  // Simple deterministic hash for a per-pixel sign
  const hash = (x: number, y: number, c: number) => {
    let h = (x * 374761393 + y * 668265263 + c * 2246822519) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) & 1) === 0 ? -1 : 1;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Three overlapping high-frequency carriers (different phases per channel)
      const s0 =
        Math.sin(x * 1.7 + y * 2.3) +
        Math.sin(x * 0.9 - y * 1.1) * 0.6 +
        Math.cos(x * 2.9 + y * 0.7) * 0.4;
      const s1 =
        Math.cos(x * 2.1 + y * 1.5) +
        Math.sin(x * 1.3 - y * 2.7) * 0.7 +
        Math.cos(x * 0.5 + y * 3.1) * 0.5;
      const s2 =
        Math.sin(x * 2.5 - y * 0.9) +
        Math.cos(x * 1.1 + y * 2.1) * 0.6 +
        Math.sin(x * 3.3 - y * 1.7) * 0.4;

      const dr = (s0 > 0 ? 1 : -1) * hash(x, y, 0) * amp;
      const dg = (s1 > 0 ? 1 : -1) * hash(x, y, 1) * amp;
      const db = (s2 > 0 ? 1 : -1) * hash(x, y, 2) * amp;

      data[i] = Math.max(0, Math.min(255, data[i] + dr));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + dg));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + db));
    }
  }
}

function psnr(a: ImageData, b: ImageData) {
  let mse = 0;
  const n = a.data.length;
  for (let i = 0; i < n; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = a.data[i + c] - b.data[i + c];
      mse += d * d;
    }
  }
  mse /= (n / 4) * 3;
  if (mse === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / mse);
}

export function ProtectionLab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const origCanvasRef = useRef<HTMLCanvasElement>(null);
  const protCanvasRef = useRef<HTMLCanvasElement>(null);
  const origImageDataRef = useRef<ImageData | null>(null);

  const [hasImage, setHasImage] = useState(false);
  const [epsilon, setEpsilon] = useState(0.02);
  const [psnrDb, setPsnrDb] = useState<number | null>(null);
  const [origScan, setOrigScan] = useState<ScanResult | null>(null);
  const [protScan, setProtScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState<"orig" | "prot" | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const scan = useServerFn(scanImage);

  const loadImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const oc = origCanvasRef.current!;
      const pc = protCanvasRef.current!;
      oc.width = pc.width = w;
      oc.height = pc.height = h;
      const octx = oc.getContext("2d")!;
      octx.drawImage(img, 0, 0, w, h);
      origImageDataRef.current = octx.getImageData(0, 0, w, h);
      // reset protected canvas to original
      pc.getContext("2d")!.putImageData(origImageDataRef.current, 0, 0);
      URL.revokeObjectURL(url);
      setHasImage(true);
      setPsnrDb(null);
      setOrigScan(null);
      setProtScan(null);
    };
    img.src = url;
  }, []);

  const applyProtection = useCallback(() => {
    if (!origImageDataRef.current) return;
    const orig = origImageDataRef.current;
    const copy = new ImageData(
      new Uint8ClampedArray(orig.data),
      orig.width,
      orig.height,
    );
    perturb(copy, epsilon);
    const pc = protCanvasRef.current!;
    pc.getContext("2d")!.putImageData(copy, 0, 0);
    setPsnrDb(psnr(orig, copy));
    setProtScan(null);
  }, [epsilon]);

  // auto-preview when epsilon changes
  useEffect(() => {
    if (hasImage) applyProtection();
  }, [epsilon, hasImage, applyProtection]);

  const download = useCallback(() => {
    const pc = protCanvasRef.current;
    if (!pc) return;
    pc.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `inkshield-protected-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, []);

  const runScan = useCallback(
    async (which: "orig" | "prot") => {
      const canvas = which === "orig" ? origCanvasRef.current : protCanvasRef.current;
      if (!canvas) return;
      setScanning(which);
      // JPEG at moderate quality → smaller payload, realistic scraper flow
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      try {
        const result = await scan({ data: { imageDataUrl: dataUrl } });
        if (which === "orig") setOrigScan(result);
        else setProtScan(result);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Scan failed";
        const err = { ok: false, error: msg };
        if (which === "orig") setOrigScan(err);
        else setProtScan(err);
      } finally {
        setScanning(null);
      }
    },
    [scan],
  );

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    loadImage(f);
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
            <h2 className="font-display text-4xl lg:text-6xl leading-none">
              See what a scraper sees.
              <br />
              <span className="italic text-lime">Then break its vision.</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Drop in an image. Ask a real vision model to describe it. Apply
              Inkshield in your browser — nothing uploaded until you scan — then
              download and re-test. Everything runs client-side except the AI
              scan itself.
            </p>
          </div>
        </div>

        {/* Always-visible controls */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFile(e.dataTransfer.files?.[0]);
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
              {psnrDb !== null && (
                <span className="text-muted-foreground ml-4">
                  PSNR ≈ {psnrDb.toFixed(1)} dB
                </span>
              )}
            </div>
          </div>
          <div className="md:col-span-7 flex flex-wrap gap-3 md:justify-end">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="font-mono text-xs uppercase tracking-widest px-4 py-3 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors"
            >
              {hasImage ? "Change image" : "↑ Upload artwork"}
            </button>
            <button
              onClick={download}
              disabled={!hasImage}
              className="font-mono text-xs uppercase tracking-widest px-4 py-3 bg-lime text-primary-foreground hover:bg-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↓ Download protected
            </button>
          </div>
        </div>

        {/* Canvases */}
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          <LabPane
            label="Original"
            accent="text-muted-foreground"
            canvasRef={origCanvasRef}
            onScan={() => runScan("orig")}
            scanning={scanning === "orig"}
            result={origScan}
            buttonLabel="Scan original with AI"
            hasImage={hasImage}
            onUploadClick={() => fileRef.current?.click()}
          />
          <LabPane
            label="Inkshielded"
            accent="text-lime"
            canvasRef={protCanvasRef}
            onScan={() => runScan("prot")}
            scanning={scanning === "prot"}
            result={protScan}
            buttonLabel="Scan protected with AI"
            accentBorder
            hasImage={hasImage}
            onUploadClick={() => fileRef.current?.click()}
          />
        </div>

        <p className="mt-8 text-xs text-muted-foreground font-mono max-w-2xl">
          note: inkshield runs entirely in your browser. modern VLMs are
          robust, so expect degraded tags, lower confidence, or drifted
          subjects — not always full misreads. crank ε higher for stronger
          disruption at the cost of some visible grain.
        </p>

      </div>
    </section>
  );
}


function LabPane({
  label,
  accent,
  canvasRef,
  onScan,
  scanning,
  result,
  buttonLabel,
  accentBorder,
  hasImage,
  onUploadClick,
}: {
  label: string;
  accent: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onScan: () => void;
  scanning: boolean;
  result: ScanResult | null;
  buttonLabel: string;
  accentBorder?: boolean;
  hasImage: boolean;
  onUploadClick: () => void;
}) {
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
        <canvas
          ref={canvasRef}
          className={`max-w-full max-h-full h-auto block ${hasImage ? "" : "hidden"}`}
        />
        {!hasImage && (
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
        <button
          onClick={onScan}
          disabled={scanning || !hasImage}
          className="w-full font-mono text-xs uppercase tracking-widest px-4 py-3 border border-border hover:border-lime hover:text-lime transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground"
        >
          {scanning ? "scanning…" : buttonLabel}
        </button>

        {result && !result.ok && (
          <div className="font-mono text-xs text-magenta">
            {result.error}
          </div>
        )}
        {result && result.ok && (
          <div className="space-y-2 font-mono text-xs">
            <ScanRow k="subject" v={result.subject ?? "—"} />
            <ScanRow k="style" v={result.style ?? "—"} />
            <ScanRow
              k="confidence"
              v={
                result.confidence !== null && result.confidence !== undefined
                  ? `${Math.round((result.confidence ?? 0) * 100)}%`
                  : "—"
              }
            />
            {result.tags && result.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {result.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-1 border border-border text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
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
