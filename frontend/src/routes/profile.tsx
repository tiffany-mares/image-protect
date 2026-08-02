import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import {
  fetchDashboard,
  fetchLiked,
  publish,
  toggleFavorite,
  unlike,
  type GalleryImage,
} from "@/lib/api";
import { clearToken, getToken, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type Tab = "all" | "favorites" | "liked";

function ProfilePage() {
  const { loggedIn, email } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [mine, setMine] = useState<GalleryImage[]>([]);
  const [liked, setLiked] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read localStorage directly: during SSR hydration the useAuth snapshot
    // is still the server's logged-out value, which must not trigger a bounce.
    if (!getToken()) navigate({ to: "/auth" });
  }, [navigate]);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard().then(setMine), fetchLiked().then(setLiked)])
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loggedIn) reload();
  }, [loggedIn, reload]);

  if (!loggedIn) return null;

  const favorites = mine.filter((i) => i.is_favorite);
  const shown = tab === "liked" ? liked : tab === "favorites" ? favorites : mine;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All images", count: mine.length },
    { key: "favorites", label: "★ Favorites", count: favorites.length },
    { key: "liked", label: "♥ Liked", count: liked.length },
  ];

  function signOut() {
    clearToken();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />

      <main className="pt-24 pb-24 max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* LEFT VERTICAL NAV */}
          <aside className="lg:w-64 shrink-0 lg:sticky lg:top-24 lg:self-start lg:min-h-[calc(100vh-8rem)] flex flex-col">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-lime flex items-center gap-3 mb-5">
              <span className="w-8 h-px bg-lime" />
              § profile
            </div>
            <h1 className="font-display font-bold uppercase tracking-tight text-3xl leading-none">Profile</h1>
            {email && (
              <p className="mt-3 font-mono text-xs text-muted-foreground break-all">
                {email}
              </p>
            )}

            <nav className="mt-8 flex flex-col gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center justify-between font-mono text-xs uppercase tracking-widest px-4 py-3 border transition-colors hover-lift ${
                    tab === t.key
                      ? "bg-lime text-primary-foreground border-lime"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                  }`}
                >
                  <span>{t.label}</span>
                  <span
                    className={
                      tab === t.key ? "text-primary-foreground/70" : "text-muted-foreground/60"
                    }
                  >
                    {t.count}
                  </span>
                </button>
              ))}
            </nav>

            {/* SIGN OUT — separate section at the bottom */}
            <div className="mt-auto pt-8">
              <div className="border-t border-border pt-6">
                <div className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground mb-3">
                  session
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full font-mono text-xs uppercase tracking-widest px-4 py-3 border border-border text-muted-foreground hover:border-magenta hover:text-magenta transition-colors hover-lift"
                >
                  → Sign out
                </button>
              </div>
            </div>
          </aside>

          {/* CONTENT */}
          <section className="flex-1 min-w-0">
            <h2 className="font-display font-bold uppercase tracking-tight text-3xl lg:text-4xl leading-none mb-2">
              {tab === "liked"
                ? "Images you've liked."
                : tab === "favorites"
                  ? "Your favorites."
                  : "Your protected works."}
            </h2>
            <p className="text-muted-foreground mb-10 max-w-2xl">
              {tab === "liked"
                ? "Everything you've liked across the gallery."
                : "Every image you save from the lab lives here. Favorite the ones you want to keep close, or publish them to the gallery."}
            </p>

            {error && <p className="font-mono text-xs text-magenta mb-6">{error}</p>}

            {loading ? (
              <div className="font-mono text-sm text-muted-foreground">loading…</div>
            ) : shown.length === 0 ? (
              <div className="border border-dashed border-border p-12 text-center">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                  {tab === "liked"
                    ? "no liked images yet"
                    : tab === "favorites"
                      ? "no favorites yet"
                      : "no saved images yet"}
                </div>
                <Link
                  to={tab === "liked" ? "/gallery" : "/"}
                  className="inline-block font-mono text-xs uppercase tracking-widest px-4 py-3 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors hover-lift"
                >
                  {tab === "liked" ? "♥ Explore the gallery" : "▶ Go to the lab"}
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {shown.map((img) => (
                  <article
                    key={img.id}
                    className="border border-border bg-background/40 flex flex-col hover-lift"
                  >
                    <div className="relative aspect-square bg-ink overflow-hidden">
                      {img.url ? (
                        <img
                          src={img.url}
                          alt="protected artwork"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-ink" />
                      )}
                      {tab === "liked" ? (
                        <button
                          type="button"
                          onClick={() =>
                            unlike(img.id).then(reload).catch((e) => setError(e.message))
                          }
                          className="absolute top-2 right-2 px-2 py-1 text-lg leading-none border border-magenta text-magenta bg-background/80 transition-colors hover-lift"
                          title="Unlike"
                          aria-label="Unlike"
                        >
                          ♥
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            toggleFavorite(img.id).then(reload).catch((e) => setError(e.message))
                          }
                          className={`absolute top-2 right-2 px-2 py-1 text-lg leading-none border transition-colors hover-lift ${
                            img.is_favorite
                              ? "border-amber text-amber bg-background/80"
                              : "border-border text-muted-foreground bg-background/60 hover:text-amber hover:border-amber"
                          }`}
                          title={img.is_favorite ? "Unfavorite" : "Favorite"}
                          aria-label={img.is_favorite ? "Unfavorite" : "Favorite"}
                        >
                          {img.is_favorite ? "★" : "☆"}
                        </button>
                      )}
                    </div>
                    <div className="p-4 space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>{new Date(img.created_at).toLocaleDateString()}</span>
                        <span>♥ {img.like_count}</span>
                      </div>
                      {tab !== "liked" && (
                        <div className="flex gap-2 pt-2">
                          {img.is_published ? (
                            <span className="flex-1 text-center px-3 py-2 border border-lime text-lime bg-lime/10 uppercase tracking-widest">
                              ✓ Published
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                publish(img.id).then(reload).catch((e) => setError(e.message))
                              }
                              className="flex-1 text-center px-3 py-2 border border-border text-muted-foreground hover:border-lime hover:text-lime transition-colors uppercase tracking-widest hover-lift"
                            >
                              ↗ Publish
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
