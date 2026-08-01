import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { ApiError, login, signup } from "@/lib/api";
import { setToken } from "@/lib/auth";

export const Route = createFileRoute("/auth")({ component: AuthPage });

type Mode = "signin" | "signup";

const labelClass =
  "font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-2";
const inputClass =
  "w-full bg-background border border-border focus:border-lime outline-none px-4 py-3 font-mono text-sm text-foreground transition-colors";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup(email, password);
        setSent(true);
      } else {
        setToken(await login(email, password));
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : mode === "signup"
            ? "signup failed"
            : "sign in failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleMode() {
    setMode(mode === "signup" ? "signin" : "signup");
    setError(null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="flex items-center justify-center px-6 pt-32 pb-16">
        <div className="w-full max-w-md">
          {sent ? (
            <div className="border border-lime p-6 space-y-3">
              <h1 className="font-display text-2xl">Check your email</h1>
              <p className="font-mono text-sm text-muted-foreground">
                We sent a verification link to <span className="text-lime">{email}</span>.
                Click it, then sign in. (Check spam.)
              </p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setMode("signin");
                  setPassword("");
                }}
                className="inline-block font-mono text-xs uppercase tracking-widest text-lime hover:text-amber transition-colors hover-lift"
              >
                Go to sign in →
              </button>
            </div>
          ) : (
            <>
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-lime mb-6 flex items-center gap-3">
                <span className="w-8 h-px bg-lime" />
                {mode === "signup" ? "new operator" : "returning operator"}
              </div>
              <h1 className="font-display font-light text-4xl sm:text-5xl leading-[0.95] tracking-tight text-foreground mb-3">
                {mode === "signup" ? "Create your account." : "Welcome back."}
              </h1>
              <p className="text-muted-foreground text-sm mb-10">
                {mode === "signup"
                  ? "We'll email you a verification link to confirm your address."
                  : "Sign in to sync your protection settings across sessions."}
              </p>

              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@studio.art"
                  />
                </div>
                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder={mode === "signup" ? "8+ characters" : "••••••••"}
                  />
                </div>

                {error && <p className="font-mono text-xs text-magenta">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full font-mono text-xs uppercase tracking-widest px-4 py-3 bg-lime text-primary-foreground hover:bg-amber disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover-lift"
                >
                  {busy
                    ? mode === "signup"
                      ? "Creating…"
                      : "Signing in…"
                    : mode === "signup"
                      ? "Create account"
                      : "Sign in"}
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-border font-mono text-xs">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-muted-foreground hover:text-lime transition-colors hover-lift"
                >
                  {mode === "signup"
                    ? "Have an account? Sign in →"
                    : "New here? Create account →"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
