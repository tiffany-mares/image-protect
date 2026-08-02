import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, authInputClass, authLabelClass } from "@/components/AuthShell";
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardFooter,
} from "@/components/ui/glass-card";
import { apiBase, ApiError } from "@/lib/api";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

async function requestReset(email: string): Promise<void> {
  const res = await fetch(`${apiBase()}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.error === "string") message = body.error;
    } catch {
      // keep generic
    }
    throw new ApiError(res.status, message);
  }
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="font-display font-bold uppercase tracking-tight text-2xl sm:text-3xl">
              Check your email
            </GlassCardTitle>
            <GlassCardDescription className="text-white/70">
              If an account exists for{" "}
              <span className="text-lime">{email}</span>, we've sent a link to
              reset your password. The link expires in 1 hour. (Check spam.)
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardFooter>
            <Link
              to="/auth"
              className="font-mono text-xs uppercase tracking-widest text-lime hover:text-amber transition-colors hover-lift"
            >
              ← Back to sign in
            </Link>
          </GlassCardFooter>
        </GlassCard>
      ) : (
        <GlassCard>
          <GlassCardHeader>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-lime mb-1 flex items-center gap-3">
              <span className="w-8 h-px bg-lime" />
              reset access
            </div>
            <GlassCardTitle className="font-display font-bold uppercase tracking-tight text-3xl sm:text-4xl leading-[0.95]">
              Forgot your password?
            </GlassCardTitle>
            <GlassCardDescription className="text-white/70">
              Enter your email and we'll send you a link to set a new one.
            </GlassCardDescription>
          </GlassCardHeader>

          <GlassCardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className={authLabelClass}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authInputClass}
                  placeholder="you@studio.art"
                />
              </div>

              {error && <p className="font-mono text-xs text-magenta">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full font-mono text-xs uppercase tracking-widest px-4 py-3 bg-lime text-primary-foreground hover:bg-amber disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover-lift"
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </GlassCardContent>

          <GlassCardFooter className="border-t border-white/15 pt-6">
            <Link
              to="/auth"
              className="font-mono text-xs text-white/70 hover:text-lime transition-colors hover-lift"
            >
              ← Back to sign in
            </Link>
          </GlassCardFooter>
        </GlassCard>
      )}
    </AuthShell>
  );
}
