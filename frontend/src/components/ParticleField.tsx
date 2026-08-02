import { useEffect, useRef } from "react";

/**
 * Ambient hero backdrop inspired by inngest.com: faint monospace glyphs drift
 * upward through the frame while a sparse field of accent dots twinkles — which
 * doubles as a nod to Inkshield's own theme (perturbation / noise). Canvas 2D,
 * client-only, DPR-aware, pauses when the tab is hidden, and respects
 * prefers-reduced-motion (renders a single static frame).
 */

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789∇ε∂θλ·+{}/".split("");
// Approx RGB of the palette tokens — kept literal so canvas fillStyle is valid
// on every browser (avoids oklch()/color-mix parsing quirks in <canvas>).
const ACCENTS: Array<[number, number, number]> = [
  [190, 230, 70], // lime
  [232, 176, 92], // amber
  [226, 70, 158], // magenta
];
const FG: [number, number, number] = [235, 228, 208];

type Char = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ch: string;
  size: number;
  alpha: number;
};
type Dot = {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  c: [number, number, number];
};

export function ParticleField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let raf = 0;
    let t = 0;
    let chars: Char[] = [];
    let dots: Dot[] = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const seed = () => {
      const area = width * height;
      const nChars = Math.max(18, Math.min(80, Math.round(area / 20000)));
      const nDots = Math.max(8, Math.min(30, Math.round(area / 55000)));
      chars = Array.from({ length: nChars }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: rand(-0.12, 0.12),
        vy: rand(-0.22, -0.05),
        ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        size: rand(10, 18),
        alpha: rand(0.05, 0.18),
      }));
      dots = Array.from({ length: nDots }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: rand(0.8, 2.2),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.4, 1.4),
        c: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
      }));
    };

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = (animate: boolean) => {
      ctx.clearRect(0, 0, width, height);

      // Drifting glyphs.
      ctx.shadowBlur = 0;
      ctx.textBaseline = "middle";
      for (const c of chars) {
        if (animate) {
          c.x += c.vx;
          c.y += c.vy;
          if (c.y < -24) {
            c.y = height + 24;
            c.x = Math.random() * width;
          }
          if (c.x < -24) c.x = width + 24;
          else if (c.x > width + 24) c.x = -24;
        }
        ctx.globalAlpha = c.alpha;
        ctx.fillStyle = `rgb(${FG[0]},${FG[1]},${FG[2]})`;
        ctx.font = `${c.size}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.fillText(c.ch, c.x, c.y);
      }

      // Twinkling accent dots with a soft glow.
      ctx.shadowBlur = 6;
      for (const d of dots) {
        const tw = animate ? 0.5 + 0.5 * Math.sin(d.phase + t * d.speed) : 0.7;
        const rgb = `rgb(${d.c[0]},${d.c[1]},${d.c[2]})`;
        ctx.globalAlpha = 0.22 + 0.55 * tw;
        ctx.fillStyle = rgb;
        ctx.shadowColor = rgb;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const loop = () => {
      t += 0.016;
      draw(true);
      raf = requestAnimationFrame(loop);
    };

    resize();
    if (reduce) {
      draw(false);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!reduce && !raf) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
