package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newTestRouter() *http.ServeMux {
	cfg := config{jwtSecretB64: testSecretB64}
	return newRouter(cfg, store, noopPresigner{})
}

func doReq(t *testing.T, mux *http.ServeMux, method, path, sub string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, path, nil)
	if sub != "" {
		r.Header.Set("Authorization", "Bearer "+mintToken(t, sub, testKey(), time.Hour))
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, r)
	return rec
}

func TestHandlersEndToEnd(t *testing.T) {
	// Self-contained state: tests in this package run in file order, so never
	// rely on another file's side effects.
	ctx := context.Background()
	if _, err := store.pool.Exec(ctx, `DELETE FROM likes`); err != nil {
		t.Fatal(err)
	}
	if _, err := store.pool.Exec(ctx, `UPDATE images SET is_favorite = false, is_published = false`); err != nil {
		t.Fatal(err)
	}
	mux := newTestRouter()

	// auth required
	if rec := doReq(t, mux, "GET", "/dashboard", ""); rec.Code != 401 {
		t.Fatalf("dashboard anon: %d", rec.Code)
	}
	// dashboard lists A's images
	rec := doReq(t, mux, "GET", "/dashboard", userA)
	if rec.Code != 200 {
		t.Fatalf("dashboard: %d %s", rec.Code, rec.Body)
	}
	var imgs []map[string]any
	json.Unmarshal(rec.Body.Bytes(), &imgs)
	if len(imgs) != 2 {
		t.Fatalf("want 2 images, got %d", len(imgs))
	}
	// ownership on PATCH
	if rec := doReq(t, mux, "PATCH", "/images/"+imgA1+"/favorite", userB); rec.Code != 403 {
		t.Fatalf("foreign favorite: %d", rec.Code)
	}
	if rec := doReq(t, mux, "PATCH", "/images/00000000-0000-0000-0000-000000000000/publish", userA); rec.Code != 404 {
		t.Fatalf("missing publish: %d", rec.Code)
	}
	if rec := doReq(t, mux, "PATCH", "/images/"+imgA1+"/favorite", userA); rec.Code != 200 {
		t.Fatalf("own favorite: %d", rec.Code)
	}
	// publish both of A's images through the API so the gallery has content
	if rec := doReq(t, mux, "PATCH", "/images/"+imgA1+"/publish", userA); rec.Code != 200 {
		t.Fatalf("publish A1: %d", rec.Code)
	}
	if rec := doReq(t, mux, "PATCH", "/images/"+imgA2+"/publish", userA); rec.Code != 200 {
		t.Fatalf("publish A2: %d", rec.Code)
	}
	// gallery public, popular sort reflects likes
	if rec := doReq(t, mux, "POST", "/images/"+imgA1+"/like", userB); rec.Code != 200 {
		t.Fatalf("like: %d", rec.Code)
	}
	rec = doReq(t, mux, "GET", "/gallery?sort=popular", "")
	if rec.Code != 200 {
		t.Fatalf("gallery anon should be public: %d", rec.Code)
	}
	json.Unmarshal(rec.Body.Bytes(), &imgs)
	if len(imgs) != 2 || imgs[0]["id"] != imgA1 || imgs[0]["like_count"].(float64) != 1 {
		t.Fatalf("popular gallery wrong: %v", imgs)
	}
	// liked tab
	rec = doReq(t, mux, "GET", "/dashboard/liked", userB)
	json.Unmarshal(rec.Body.Bytes(), &imgs)
	if len(imgs) != 1 || imgs[0]["id"] != imgA1 {
		t.Fatalf("liked tab wrong: %v", imgs)
	}
	// unlike
	if rec := doReq(t, mux, "DELETE", "/images/"+imgA1+"/like", userB); rec.Code != 200 {
		t.Fatalf("unlike: %d", rec.Code)
	}
	rec = doReq(t, mux, "GET", "/dashboard/liked", userB)
	json.Unmarshal(rec.Body.Bytes(), &imgs)
	if len(imgs) != 0 {
		t.Fatalf("liked tab after unlike: %v", imgs)
	}
}
