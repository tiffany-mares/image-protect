import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Light/dark theme toggle. Default is dark (the brand look); the choice is
 * persisted in localStorage and applied by toggling a `light` class on <html>,
 * which flips the palette defined in styles.css. SSR renders dark; the browser
 * applies the stored preference on mount. */
const KEY = "inkshield-theme";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isLight = window.localStorage.getItem(KEY) === "light";
    setLight(isLight);
    document.documentElement.classList.toggle("light", isLight);
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, next ? "light" : "dark");
    document.documentElement.classList.toggle("light", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      title="Toggle light / dark"
      className="text-muted-foreground hover:text-lime transition-colors hover-lift"
    >
      {light ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
    </button>
  );
}
