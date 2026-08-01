import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { fetchGallery, like, type GalleryImage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/gallery")({ component: GalleryPage });

function GalleryPage() {
  const { loggedIn } = useAuth();
  const navigate = useNavigate();
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = (s: "recent" | "popular") =>
    fetchGallery(s).then(setImages).catch((e) => setError(String(e.message ?? e)));

  useEffect(() => {
    reload(sort);
  }, [sort]);

  function onLike(id: string) {
    if (!loggedIn) {
      navigate({ to: "/signin" });
      return;
    }
    like(id).then(() => reload(sort)).catch((e) => setError(e.message));
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="mx-auto max-w-6xl px-6 pt-32 pb-16">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl">Gallery</h1>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "popular")}
            className="font-mono text-xs uppercase tracking-widest bg-background border border-border px-3 py-2 focus:outline-none focus:border-lime"
          >
            <option value="recent">Recent</option>
            <option value="popular">Popular</option>
          </select>
        </div>
        {error && <p className="font-mono text-xs text-magenta mb-4">{error}</p>}
        {images.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground">Nothing published yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((img) => (
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
                <div className="p-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(img.created_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onLike(img.id)}
                    title={loggedIn ? "Like" : "Sign in to like"}
                    className="font-mono text-xs uppercase tracking-widest px-3 py-1 border border-border hover:border-magenta hover:text-magenta transition-colors"
                  >
                    ♥ {img.like_count}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
