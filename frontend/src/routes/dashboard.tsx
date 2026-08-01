import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { getToken, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

type Tab = "all" | "favorites" | "liked";
const tabs: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "favorites", label: "Favorites" },
  { key: "liked", label: "Liked" },
];

function DashboardPage() {
  const { loggedIn } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [mine, setMine] = useState<GalleryImage[]>([]);
  const [liked, setLiked] = useState<GalleryImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read localStorage directly: during SSR hydration the useAuth snapshot
    // is still the server's logged-out value, which must not trigger a bounce.
    if (!getToken()) navigate({ to: "/signin" });
  }, [navigate]);

  const reload = useCallback(() => {
    fetchDashboard().then(setMine).catch((e) => setError(String(e.message ?? e)));
    fetchLiked().then(setLiked).catch((e) => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (loggedIn) reload();
  }, [loggedIn, reload]);

  if (!loggedIn) return null;

  const shown =
    tab === "liked" ? liked : tab === "favorites" ? mine.filter((i) => i.is_favorite) : mine;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="mx-auto max-w-6xl px-6 pt-32 pb-16">
        <h1 className="font-display text-3xl mb-6">Dashboard</h1>
        <div className="flex gap-2 mb-8">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`font-mono text-xs uppercase tracking-widest px-4 py-2 border transition-colors ${
                tab === t.key
                  ? "bg-lime text-primary-foreground border-lime"
                  : "border-border text-muted-foreground hover:text-lime"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {error && <p className="font-mono text-xs text-magenta mb-4">{error}</p>}
        {shown.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground">
            {tab === "liked"
              ? "Nothing liked yet — browse the gallery."
              : "No images yet — protect one in the lab."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shown.map((img) => (
              <div key={img.id} className="border border-border">
                {img.url ? (
                  <img
                    src={img.url}
                    alt="protected artwork"
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-ink" />
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                    <span>{new Date(img.created_at).toLocaleDateString()}</span>
                    <span>♥ {img.like_count}</span>
                  </div>
                  <div className="flex gap-2">
                    {tab === "liked" ? (
                      <button
                        type="button"
                        onClick={() => unlike(img.id).then(reload).catch((e) => setError(e.message))}
                        className="font-mono text-xs uppercase tracking-widest px-3 py-1 border border-border hover:border-magenta hover:text-magenta transition-colors"
                      >
                        Unlike
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            toggleFavorite(img.id).then(reload).catch((e) => setError(e.message))
                          }
                          className={`font-mono text-xs uppercase tracking-widest px-3 py-1 border transition-colors ${
                            img.is_favorite
                              ? "border-amber text-amber"
                              : "border-border hover:border-amber hover:text-amber"
                          }`}
                        >
                          ★ {img.is_favorite ? "Favorited" : "Favorite"}
                        </button>
                        {img.is_published ? (
                          <span className="font-mono text-xs uppercase tracking-widest px-3 py-1 text-lime border border-lime">
                            Published
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              publish(img.id).then(reload).catch((e) => setError(e.message))
                            }
                            className="font-mono text-xs uppercase tracking-widest px-3 py-1 border border-border hover:border-lime hover:text-lime transition-colors"
                          >
                            Publish
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
