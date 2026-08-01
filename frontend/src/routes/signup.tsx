import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { ApiError, signup } from "@/lib/api";

export const Route = createFileRoute("/signup")({ component: SignupPage });

const labelClass = "font-mono text-xs uppercase tracking-widest text-muted-foreground";
const inputClass =
  "w-full bg-background border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-lime";

function SignupPage() {
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
      await signup(email, password);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="mx-auto max-w-sm px-6 pt-32 pb-16">
        {sent ? (
          <div className="border border-lime p-6 space-y-3">
            <h1 className="font-display text-2xl">Check your email</h1>
            <p className="font-mono text-sm text-muted-foreground">
              We sent a verification link to <span className="text-lime">{email}</span>.
              Click it, then sign in. (Check spam.)
            </p>
            <Link
              to="/signin"
              className="inline-block font-mono text-xs uppercase tracking-widest text-lime hover:text-amber"
            >
              Go to sign in →
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <h1 className="font-display text-2xl">Create account</h1>
            <div className="space-y-1">
              <label htmlFor="email" className={labelClass}>Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className={labelClass}>Password (min 8 chars)</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            {error && <p className="font-mono text-xs text-magenta">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full font-mono text-xs uppercase tracking-widest px-4 py-3 bg-lime text-primary-foreground hover:bg-amber transition-colors disabled:opacity-40"
            >
              {busy ? "Creating…" : "Sign up"}
            </button>
            <p className="font-mono text-xs text-muted-foreground">
              Have an account?{" "}
              <Link to="/signin" className="text-lime hover:text-amber">Sign in</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
