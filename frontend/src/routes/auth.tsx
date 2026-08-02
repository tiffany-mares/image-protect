import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Header } from "@/components/Header";
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardFooter,
} from "@/components/ui/glass-card";
import { ApiError, apiBase, login, signup } from "@/lib/api";
import { setToken } from "@/lib/auth";

export const Route = createFileRoute("/auth")({ component: AuthPage });

type Mode = "signin" | "signup";

const heroImg = "/carmen-aguado.png";

// Set VITE_GOOGLE_CLIENT_ID to enable the Google button (see README/setup notes).
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Minimal shape of the Google Identity Services global we use.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

/** Exchange a Google ID token for our app JWT via the gateway. Mirrors login(). */
async function loginWithGoogle(credential: string): Promise<string> {
  const res = await fetch(`${apiBase()}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.error === "string") message = body.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(res.status, message);
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

const labelClass =
  "font-mono text-[10px] uppercase tracking-widest text-white/60 block mb-2";
const inputClass =
  "w-full bg-background/50 border border-white/15 focus:border-lime outline-none px-4 py-3 font-mono text-sm text-white placeholder:text-white/40 transition-colors";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  async function handleGoogleCredential(resp: { credential?: string }) {
    if (!resp.credential) return;
    setError(null);
    setBusy(true);
    try {
      setToken(await loginWithGoogle(resp.credential));
      navigate({ to: "/profile" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  // Load Google Identity Services and render its official button. No-op unless
  // VITE_GOOGLE_CLIENT_ID is set. Re-renders on mode change to swap the label.
  useEffect(() => {
    if (!googleClientId) return;
    const SCRIPT_ID = "google-gsi";

    const render = () => {
      const g = window.google;
      const el = googleBtnRef.current;
      if (!g || !el) return;
      g.accounts.id.initialize({
        client_id: googleClientId,
        callback: (resp) => {
          void handleGoogleCredential(resp);
        },
      });
      el.innerHTML = "";
      g.accounts.id.renderButton(el, {
        theme: "filled_black",
        size: "large",
        type: "standard",
        shape: "rectangular",
        text: mode === "signup" ? "signup_with" : "signin_with",
        logo_alignment: "center",
        width: Math.min(el.offsetWidth || 320, 400),
      });
    };

    if (document.getElementById(SCRIPT_ID)) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
    // handleGoogleCredential is stable enough for this effect's purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // No email verification: after signup we log straight in.
      if (mode === "signup") {
        await signup(email, password);
      }
      setToken(await login(email, password));
      navigate({ to: "/profile" });
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
        <div className="w-full max-w-md">
          <GlassCard>
              <GlassCardHeader>
                <div className="font-mono text-xs uppercase tracking-[0.3em] text-lime mb-1 flex items-center gap-3">
                  <span className="w-8 h-px bg-lime" />
                  {mode === "signup" ? "new operator" : "returning operator"}
                </div>
                <GlassCardTitle className="font-display font-bold uppercase tracking-tight text-3xl sm:text-4xl leading-[0.95]">
                  {mode === "signup" ? "Create your account." : "Welcome back."}
                </GlassCardTitle>
                <GlassCardDescription className="text-white/70">
                  {mode === "signup"
                    ? "Create an account to save, favorite, and publish your protected images."
                    : "Sign in to sync your protection settings across sessions."}
                </GlassCardDescription>
              </GlassCardHeader>

              <GlassCardContent>
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
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete={
                          mode === "signup" ? "new-password" : "current-password"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputClass} pr-12`}
                        placeholder={mode === "signup" ? "8+ characters" : "••••••••"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        title={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 px-4 flex items-center text-white/60 hover:text-lime transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff size={16} strokeWidth={1.5} />
                        ) : (
                          <Eye size={16} strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="font-mono text-xs text-magenta">{error}</p>
                  )}

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

                {googleClientId && (
                  <div className="mt-5">
                    <div className="my-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-white/15" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                        or
                      </span>
                      <span className="h-px flex-1 bg-white/15" />
                    </div>
                    <div
                      ref={googleBtnRef}
                      className="flex justify-center [color-scheme:light]"
                    />
                  </div>
                )}
              </GlassCardContent>

              <GlassCardFooter className="border-t border-white/15 pt-6">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-mono text-xs text-white/70 hover:text-lime transition-colors hover-lift"
                >
                  {mode === "signup"
                    ? "Have an account? Sign in →"
                    : "New here? Create account →"}
                </button>
              </GlassCardFooter>
            </GlassCard>
        </div>
      </main>
    </div>
  );
}
