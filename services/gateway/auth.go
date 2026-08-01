package main

import (
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// parseUserID extracts and verifies the Bearer JWT (HS256, shared secret,
// key = base64-decoded JWT_SECRET exactly as Spring/Python derive it) and
// returns the sub claim.
func parseUserID(r *http.Request, secretB64 string) (string, bool) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") || secretB64 == "" {
		return "", false
	}
	key, err := base64.StdEncoding.DecodeString(secretB64)
	if err != nil {
		return "", false
	}
	tok, err := jwt.Parse(strings.TrimPrefix(header, "Bearer "),
		func(t *jwt.Token) (any, error) { return key, nil },
		jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !tok.Valid {
		return "", false
	}
	sub, err := tok.Claims.GetSubject()
	if err != nil || sub == "" {
		return "", false
	}
	return sub, true
}

func requireAuth(secretB64 string, next func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := parseUserID(r, secretB64)
		if !ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}
		next(w, r, uid)
	}
}
