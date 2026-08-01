import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { ApiError, login } from "@/lib/api";
import { setToken } from "@/lib/auth";

export const Route = createFileRoute("/signin")({ component: SigninPage });

const labelClass = "font-mono text-xs uppercase tracking-widest text-muted-foreground";
const inputClass =
  "w-full bg-background border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-lime";

function SigninPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setToken(await login(email, password));
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="mx-auto max-w-sm px-6 pt-32 pb-16">
        <form onSubmit={onSubmit} className="space-y-5">
          <h1 className="font-display text-2xl">Sign in</h1>
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
            <label htmlFor="password" className={labelClass}>Password</label>
            <input
              id="password"
              type="password"
              required
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
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="font-mono text-xs text-muted-foreground">
            No account?{" "}
            <Link to="/signup" className="text-lime hover:text-amber">Sign up</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
