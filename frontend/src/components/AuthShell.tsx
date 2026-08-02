import type { ReactNode } from "react";
import { Header } from "@/components/Header";

const heroImg = "/carmen-aguado.png";

/**
 * The auth page chrome: the painting backdrop + texture and a centered column,
 * shared by /auth, /forgot-password, and /reset-password so they all wear the
 * same glass-over-painting look.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full font-sans text-foreground overflow-hidden">
      {/* Painting backdrop */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImg}
          alt=""
          aria-hidden
          className="w-full h-full object-cover object-[center_20%]"
        />
        <div className="absolute inset-0 bg-background/70" />
        <div className="absolute inset-0 scanlines opacity-30 pointer-events-none" />
        <div className="absolute inset-0 noise pointer-events-none" />
      </div>

      <Header />

      <main className="relative z-10 min-h-screen flex items-center justify-center px-6 pt-28 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

export const authLabelClass =
  "font-mono text-[10px] uppercase tracking-widest text-white/60 block mb-2";
export const authInputClass =
  "w-full bg-background/50 border border-white/15 focus:border-lime outline-none px-4 py-3 font-mono text-sm text-white placeholder:text-white/40 transition-colors";
