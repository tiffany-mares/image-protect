import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { fetchGallery, like, type GalleryImage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/gallery")({ component: GalleryPage });

type SortOption = "recent" | "popular";

function GalleryPage() {
  const { loggedIn } = useAuth();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>("recent");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reload(s: SortOption) {
    fetchGallery(s)
      .then(setImages)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    reload(sort);
  }, [sort]);

  function onLike(id: string) {
    if (!loggedIn) {
      navigate({ to: "/auth" });
      return;
    }
    like(id)
      .then(() => reload(sort))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />

      <main className="pt-24 pb-24 max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-10 mb-14">
          <div className="lg:col-span-3">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-lime flex items-center gap-3">
              <span className="w-8 h-px bg-lime" />
              § gallery
            </div>
          </div>
          <div className="lg:col-span-9">
            <h1 className="font-display text-4xl lg:text-6xl leading-none">
              Works from the community.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Protected images published by Inkshield users.{" "}
              {loggedIn ? "Tap ♥ to like." : "Sign in to like your favorites."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <label
                htmlFor="gallery-sort"
                className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
              >
                Sort by
              </label>
              <select
                id="gallery-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="font-mono text-xs uppercase bg-background border border-border px-3 py-2 pr-8 text-foreground focus:outline-none focus:border-lime hover:border-lime transition-colors cursor-pointer"
              >
                <option value="recent">Recent</option>
                <option value="popular">Popular</option>
              </select>
            </div>
          </div>
        </div>

        {error && <p className="font-mono text-xs text-magenta mb-4">{error}</p>}

        {images.length === 0 ? (
          <div className="border border-dashed border-border p-12 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Nothing published yet.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((img) => (
              <article
                key={img.id}
                className="border border-border bg-background/40 flex flex-col hover-lift"
              >
                <div className="group relative aspect-square bg-ink overflow-hidden">
                  {img.url ? (
                    <img
                      src={img.url}
                      alt="Published protected image"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-ink" />
                  )}
                </div>
                <div className="p-4 flex items-center justify-between font-mono text-xs">
                  <span className="text-muted-foreground uppercase tracking-widest">
                    {new Date(img.created_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onLike(img.id)}
                    title={loggedIn ? "Like" : "Sign in to like"}
                    aria-label={loggedIn ? "Like" : "Sign in to like"}
                    className="inline-flex items-center gap-1 uppercase tracking-widest px-3 py-1 border border-border hover:border-magenta hover:text-magenta transition-colors"
                  >
                    ♥ {img.like_count}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
