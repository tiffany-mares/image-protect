package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSHeadersAndPreflight(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	h := withCORS("http://localhost:8080", inner)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/gallery", nil))
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:8080" {
		t.Fatalf("origin header: %q", got)
	}

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("OPTIONS", "/images/x/like", nil))
	if rec.Code != 204 {
		t.Fatalf("preflight status: %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); got != "Authorization, Content-Type" {
		t.Fatalf("allow-headers: %q", got)
	}
}

func TestProxyStripsUpstreamCORSSoExactlyOneOriginHeaderSurvives(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*") // ml-service sets its own
		w.WriteHeader(200)
	}))
	defer backend.Close()

	mux := http.NewServeMux()
	addProxies(mux, backend.URL, backend.URL)
	h := withCORS("*", mux)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/protect", nil))
	if got := rec.Header().Values("Access-Control-Allow-Origin"); len(got) != 1 {
		t.Fatalf("want exactly 1 Access-Control-Allow-Origin header, got %v", got)
	}
}
