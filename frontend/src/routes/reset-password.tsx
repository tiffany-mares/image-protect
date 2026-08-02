import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: ResetPasswordPage,
});

async function performReset(token: string, password: string): Promise<void> {
  const res = await fetch(`${apiBase()}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
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

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("this reset link is missing its token");
      return;
    }
    if (password !== confirm) {
      setError("passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await performReset(token, password);
      // Success — send them to sign in with the new password.
      navigate({ to: "/auth" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <GlassCard>
        <GlassCardHeader>
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-lime mb-1 flex items-center gap-3">
            <span className="w-8 h-px bg-lime" />
            new password
          </div>
          <GlassCardTitle className="font-display font-bold uppercase tracking-tight text-3xl sm:text-4xl leading-[0.95]">
            Set a new password.
          </GlassCardTitle>
          <GlassCardDescription className="text-white/70">
            Choose a new password for your account, then sign in with it.
          </GlassCardDescription>
        </GlassCardHeader>

        <GlassCardContent>
          {token ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className={authLabelClass}>
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${authInputClass} pr-12`}
                    placeholder="8+ characters"
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

              <div>
                <label htmlFor="confirm" className={authLabelClass}>
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={authInputClass}
                  placeholder="repeat it"
                />
              </div>

              {error && <p className="font-mono text-xs text-magenta">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full font-mono text-xs uppercase tracking-widest px-4 py-3 bg-lime text-primary-foreground hover:bg-amber disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover-lift"
              >
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          ) : (
            <p className="font-mono text-xs text-magenta">
              This reset link is invalid or incomplete. Request a new one from the{" "}
              <Link to="/forgot-password" className="text-lime hover:text-amber underline">
                forgot-password
              </Link>{" "}
              page.
            </p>
          )}
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
    </AuthShell>
  );
}
