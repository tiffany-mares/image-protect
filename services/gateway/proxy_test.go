package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestProxiesForwardPathAndAuthHeader(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, r.URL.Path+"|"+r.Header.Get("Authorization"))
	}))
	defer backend.Close()

	mux := http.NewServeMux()
	addProxies(mux, backend.URL, backend.URL)

	for _, tc := range []struct{ method, path, want string }{
		{"POST", "/auth/login", "/auth/login|Bearer tok"},
		{"GET", "/auth/verify", "/auth/verify|Bearer tok"},
		{"POST", "/protect", "/protect|Bearer tok"},
	} {
		r := httptest.NewRequest(tc.method, tc.path, strings.NewReader(""))
		r.Header.Set("Authorization", "Bearer tok")
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, r)
		if rec.Body.String() != tc.want {
			t.Errorf("%s %s: got %q want %q", tc.method, tc.path, rec.Body.String(), tc.want)
		}
	}
}
