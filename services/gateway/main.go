package main

import (
	"context"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

type config struct {
	port         string
	jwtSecretB64 string
	databaseURL  string
	authURL      string
	mlURL        string
	s3Bucket     string
	awsRegion    string
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func loadConfig() config {
	return config{
		port:         env("PORT", "8080"),
		jwtSecretB64: os.Getenv("JWT_SECRET"),
		databaseURL:  os.Getenv("DATABASE_URL"),
		authURL:      env("AUTH_SERVICE_URL", "http://localhost:8081"),
		mlURL:        env("ML_SERVICE_URL", "http://localhost:8000"),
		s3Bucket:     os.Getenv("S3_BUCKET"),
		awsRegion:    env("AWS_DEFAULT_REGION", "us-east-1"),
	}
}

func addProxies(mux *http.ServeMux, authURL, mlURL string) {
	authTarget, err := url.Parse(authURL)
	if err != nil {
		log.Fatalf("bad AUTH_SERVICE_URL: %v", err)
	}
	mlTarget, err := url.Parse(mlURL)
	if err != nil {
		log.Fatalf("bad ML_SERVICE_URL: %v", err)
	}
	mux.Handle("/auth/", httputil.NewSingleHostReverseProxy(authTarget))
	mux.Handle("POST /protect", httputil.NewSingleHostReverseProxy(mlTarget))
}

func main() {
	ctx := context.Background()
	cfg := loadConfig()

	store, err := newStore(ctx, cfg.databaseURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}

	var ps Presigner = noopPresigner{}
	if cfg.s3Bucket != "" {
		if sp, err := newS3Presigner(ctx, cfg.s3Bucket, cfg.awsRegion); err == nil {
			ps = sp
		} else {
			log.Printf("presigner init failed (%v) - image urls will be empty", err)
		}
	}

	mux := newRouter(cfg, store, ps)
	addProxies(mux, cfg.authURL, cfg.mlURL)

	log.Printf("gateway listening on :%s", cfg.port)
	log.Fatal(http.ListenAndServe(":"+cfg.port, mux))
}
