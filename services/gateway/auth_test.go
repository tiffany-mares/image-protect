package main

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var testSecretB64 = base64.StdEncoding.EncodeToString(make([]byte, 48))

func mintToken(t *testing.T, sub string, key []byte, expIn time.Duration) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": sub, "email": "a@b.com",
		"iat": time.Now().Unix(), "exp": time.Now().Add(expIn).Unix(),
	})
	s, err := tok.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func testKey() []byte { k, _ := base64.StdEncoding.DecodeString(testSecretB64); return k }

func TestParseUserIDValid(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("Authorization", "Bearer "+mintToken(t, "user-1", testKey(), time.Hour))
	uid, ok := parseUserID(r, testSecretB64)
	if !ok || uid != "user-1" {
		t.Fatalf("got %q ok=%v", uid, ok)
	}
}

func TestParseUserIDRejects(t *testing.T) {
	cases := map[string]string{
		"missing":    "",
		"not-bearer": "Basic xyz",
		"garbage":    "Bearer nope.nope.nope",
		"wrong-key":  "Bearer " + mintToken(t, "user-1", []byte("0123456789012345678901234567890123456789012345678"), time.Hour),
		"expired":    "Bearer " + mintToken(t, "user-1", testKey(), -time.Minute),
	}
	for name, header := range cases {
		r := httptest.NewRequest("GET", "/", nil)
		if header != "" {
			r.Header.Set("Authorization", header)
		}
		if _, ok := parseUserID(r, testSecretB64); ok {
			t.Errorf("%s: expected rejection", name)
		}
	}
}

func TestRequireAuthReturns401(t *testing.T) {
	h := requireAuth(testSecretB64, func(w http.ResponseWriter, r *http.Request, uid string) {
		w.WriteHeader(http.StatusOK)
	})
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestRequireAuthPassesUserID(t *testing.T) {
	var got string
	h := requireAuth(testSecretB64, func(w http.ResponseWriter, r *http.Request, uid string) { got = uid })
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("Authorization", "Bearer "+mintToken(t, "user-9", testKey(), time.Hour))
	h(httptest.NewRecorder(), r)
	if got != "user-9" {
		t.Fatalf("got %q", got)
	}
}
