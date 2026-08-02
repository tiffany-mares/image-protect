import { Link } from "@tanstack/react-router";
import { Github } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

const navClass = "hover:text-lime transition-colors";

export function Header() {
  const { loggedIn, email } = useAuth();

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/60 border-b border-border">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-3 font-mono text-sm tracking-tight shrink-0"
        >
          <span className="eq-live" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="text-foreground">inkshield</span>
          <span className="text-muted-foreground">/ protect</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <a href="/#lab" className={navClass}>Lab</a>
          <a href="/#how" className={navClass}>How it works</a>
          <a href="/#strength" className={navClass}>Strength</a>
          <a href="/#privacy" className={navClass}>Privacy</a>
          <a href="/#stack" className={navClass}>Tech Stack</a>
          <Link to="/gallery" className={navClass}>Gallery</Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <a
            href="https://tiffanymares.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={`hidden sm:inline ${navClass} hover-lift`}
          >
            Contact
          </a>
          <a
            href="https://github.com/tiffany-mares/inkshield"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="hover:text-lime transition-colors hover-lift"
          >
            <Github size={16} strokeWidth={1.5} />
          </a>
          <ThemeToggle />
          <a
            href="/#lab"
            className="hidden sm:inline-block font-mono text-xs uppercase tracking-widest px-4 py-2 bg-lime text-primary-foreground hover:bg-amber transition-colors hover-lift"
          >
            Open lab
          </a>
          {loggedIn ? (
            <Link
              to="/profile"
              title={email ?? undefined}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors hover-lift"
            >
              Profile
            </Link>
          ) : (
            <Link
              to="/auth"
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors hover-lift"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
