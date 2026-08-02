import { useEffect, useState } from "react";

/** Session-scoped intro overlay: timestamped log lines fade in, an
 * equalizer row pulses, then the layer dissolves. */

const STORAGE_KEY = "inkshield-boot-seen";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function stampOffset(seconds: number) {
  const base = new Date();
  base.setSeconds(base.getSeconds() + seconds);
  return `${pad(base.getHours())}:${pad(base.getMinutes())}:${pad(base.getSeconds())}`;
}

export function BootLoader() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
    sessionStorage.setItem(STORAGE_KEY, "1");

    const t1 = setTimeout(() => setStep(1), 350);
    const t2 = setTimeout(() => setStep(2), 900);
    const t3 = setTimeout(() => setStep(3), 1500);
    const t4 = setTimeout(() => setFading(true), 2300);
    const t5 = setTimeout(() => setVisible(false), 2900);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, []);

  if (!visible) return null;

  const lines = [
    { stamp: stampOffset(-4), text: "boot · initializing protection pipeline", tone: "muted" },
    { stamp: stampOffset(-2), text: "ensemble · ResNet-50 + MobileNetV2 loaded", tone: "muted" },
    { stamp: stampOffset(0), text: "OK ready, drop in an image to protect it", tone: "lime" },
  ];

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] bg-background flex items-center justify-center transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6 px-6">
        <div className="w-full max-w-md space-y-1.5 font-mono text-[11px] leading-relaxed">
          {lines.map((l, i) => (
            <div
              key={i}
              className={`transition-all duration-500 ${
                step > i ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
              } ${l.tone === "lime" ? "text-lime" : "text-muted-foreground"}`}
            >
              <span className="text-muted-foreground/70">[ {l.stamp} ]</span>{" "}
              <span>{l.text}</span>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-[3px] h-8 px-5 py-2 border border-border bg-card rounded-full">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] bg-lime rounded-full"
              style={{ animation: `eq-bar 900ms ease-in-out ${i * 60}ms infinite`, height: "40%" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
