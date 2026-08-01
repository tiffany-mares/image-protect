package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

type imageJSON struct {
	ID          string    `json:"id"`
	URL         string    `json:"url"`
	IsFavorite  bool      `json:"is_favorite"`
	IsPublished bool      `json:"is_published"`
	LikeCount   int       `json:"like_count"`
	CreatedAt   time.Time `json:"created_at"`
}

func toJSON(rows []ImageRow, ps Presigner) []imageJSON {
	out := make([]imageJSON, 0, len(rows))
	for _, r := range rows {
		out = append(out, imageJSON{
			ID: r.ID, URL: ps.URL(r.S3Key), IsFavorite: r.IsFavorite,
			IsPublished: r.IsPublished, LikeCount: r.LikeCount, CreatedAt: r.CreatedAt,
		})
	}
	return out
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeStoreErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "image not found"})
	case errors.Is(err, errForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "not your image"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
}

func newRouter(cfg config, store *Store, ps Presigner) *http.ServeMux {
	mux := http.NewServeMux()
	secret := cfg.jwtSecretB64

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	list := func(fetch func(*http.Request, string) ([]ImageRow, error)) http.HandlerFunc {
		return requireAuth(secret, func(w http.ResponseWriter, r *http.Request, uid string) {
			rows, err := fetch(r, uid)
			if err != nil {
				writeStoreErr(w, err)
				return
			}
			writeJSON(w, http.StatusOK, toJSON(rows, ps))
		})
	}
	mux.Handle("GET /dashboard", list(func(r *http.Request, uid string) ([]ImageRow, error) {
		return store.Dashboard(r.Context(), uid)
	}))
	mux.Handle("GET /dashboard/liked", list(func(r *http.Request, uid string) ([]ImageRow, error) {
		return store.Liked(r.Context(), uid)
	}))

	mux.HandleFunc("GET /gallery", func(w http.ResponseWriter, r *http.Request) {
		rows, err := store.Gallery(r.Context(), r.URL.Query().Get("sort"))
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, toJSON(rows, ps))
	})

	patch := func(act func(*http.Request, string, string) error, okMsg string) http.HandlerFunc {
		return requireAuth(secret, func(w http.ResponseWriter, r *http.Request, uid string) {
			if err := act(r, r.PathValue("id"), uid); err != nil {
				writeStoreErr(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]string{"message": okMsg})
		})
	}
	mux.Handle("PATCH /images/{id}/favorite", patch(func(r *http.Request, id, uid string) error {
		return store.ToggleFavorite(r.Context(), id, uid)
	}, "favorite toggled"))
	mux.Handle("PATCH /images/{id}/publish", patch(func(r *http.Request, id, uid string) error {
		return store.Publish(r.Context(), id, uid)
	}, "published"))
	mux.Handle("POST /images/{id}/like", patch(func(r *http.Request, id, uid string) error {
		return store.Like(r.Context(), uid, id)
	}, "liked"))
	mux.Handle("DELETE /images/{id}/like", patch(func(r *http.Request, id, uid string) error {
		return store.Unlike(r.Context(), uid, id)
	}, "unliked"))

	return mux
}
