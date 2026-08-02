import { useEffect } from "react";

/**
 * Drives the scroll-reveal effect: on mount it flags the document so the
 * `[data-reveal]` CSS (in styles.css) takes hold, then reveals each tagged
 * element once as it scrolls into view. Renders nothing.
 *
 * Gating the hidden state behind the `reveal-active` class (added here, in an
 * effect that only runs client-side) means server-rendered / no-JS output shows
 * all content normally — the effect is pure progressive enhancement.
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (els.length === 0) return;

    root.classList.add("reveal-active");

    // Respect reduced motion: mark everything visible immediately, no observer.
    if (reduce || typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-visible"));
      return () => root.classList.remove("reveal-active");
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    els.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      root.classList.remove("reveal-active");
    };
  }, []);

  return null;
}
