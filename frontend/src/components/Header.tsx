import { Link, useNavigate } from "@tanstack/react-router";
import { clearToken, useAuth } from "@/lib/auth";

const navClass = "hover:text-lime transition-colors";

export function Header() {
  const { loggedIn, email } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/60 border-b border-border">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-mono text-sm tracking-tight">
          <span className="inline-block w-2 h-2 bg-lime rounded-full animate-pulse" />
          <span className="text-foreground">inkshield</span>
          <span className="text-muted-foreground">/ protect</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <a href="/#lab" className={navClass}>Lab</a>
          <a href="/#how" className={navClass}>How it works</a>
          <Link to="/gallery" className={navClass}>Gallery</Link>
          {loggedIn && (
            <Link to="/dashboard" className={navClass}>Dashboard</Link>
          )}
        </nav>
        {loggedIn ? (
          <button
            type="button"
            title={email ?? undefined}
            onClick={() => {
              clearToken();
              navigate({ to: "/" });
            }}
            className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-border text-muted-foreground hover:border-magenta hover:text-magenta transition-colors"
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/signin"
            className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
