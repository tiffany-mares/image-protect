package main

import (
	"context"
	"os"
	"testing"
)

const testDSN = "postgresql://postgres:test@localhost:55432/postgres"

var store *Store

var (
	userA, userB string
	imgA1, imgA2 string // A's images: A1 gets published in tests, A2 published later for sort checks
)

func TestMain(m *testing.M) {
	ctx := context.Background()
	s, err := newStore(ctx, testDSN)
	if err != nil {
		panic(err)
	}
	store = s
	mustExec := func(sql string) {
		if _, err := s.pool.Exec(ctx, sql); err != nil {
			panic(err)
		}
	}
	mustExec(`DROP TABLE IF EXISTS likes; DROP TABLE IF EXISTS images; DROP TABLE IF EXISTS users`)
	mustExec(`CREATE TABLE users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, verified BOOLEAN DEFAULT false, verification_token TEXT, created_at TIMESTAMP DEFAULT now())`)
	mustExec(`CREATE TABLE images (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), mongo_job_id TEXT NOT NULL, s3_url TEXT NOT NULL, thumbnail_url TEXT, is_favorite BOOLEAN DEFAULT false, is_published BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT now())`)
	mustExec(`CREATE TABLE likes (user_id UUID NOT NULL REFERENCES users(id), image_id UUID NOT NULL REFERENCES images(id), created_at TIMESTAMP DEFAULT now(), PRIMARY KEY (user_id, image_id))`)
	row := s.pool.QueryRow(ctx, `INSERT INTO users (email, password_hash, verified) VALUES ('a@t.com','h',true) RETURNING id::text`)
	if err := row.Scan(&userA); err != nil {
		panic(err)
	}
	row = s.pool.QueryRow(ctx, `INSERT INTO users (email, password_hash, verified) VALUES ('b@t.com','h',true) RETURNING id::text`)
	if err := row.Scan(&userB); err != nil {
		panic(err)
	}
	row = s.pool.QueryRow(ctx, `INSERT INTO images (user_id, mongo_job_id, s3_url) VALUES ($1,'m1','protected/a1.png') RETURNING id::text`, userA)
	if err := row.Scan(&imgA1); err != nil {
		panic(err)
	}
	row = s.pool.QueryRow(ctx, `INSERT INTO images (user_id, mongo_job_id, s3_url) VALUES ($1,'m2','protected/a2.png') RETURNING id::text`, userA)
	if err := row.Scan(&imgA2); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func TestDashboardReturnsOwnImagesOnly(t *testing.T) {
	rows, err := store.Dashboard(context.Background(), userA)
	if err != nil || len(rows) != 2 {
		t.Fatalf("rows=%v err=%v", rows, err)
	}
	rowsB, _ := store.Dashboard(context.Background(), userB)
	if len(rowsB) != 0 {
		t.Fatalf("user B should have none, got %d", len(rowsB))
	}
}

func TestToggleFavoriteOwnershipChecks(t *testing.T) {
	if _, err := store.pool.Exec(context.Background(), `UPDATE images SET is_favorite = false`); err != nil {
		t.Fatal(err)
	}
	if err := store.ToggleFavorite(context.Background(), imgA1, userB); err != errForbidden {
		t.Fatalf("want errForbidden, got %v", err)
	}
	if err := store.ToggleFavorite(context.Background(), "00000000-0000-0000-0000-000000000000", userA); err != errNotFound {
		t.Fatalf("want errNotFound, got %v", err)
	}
	if err := store.ToggleFavorite(context.Background(), imgA1, userA); err != nil {
		t.Fatal(err)
	}
	rows, _ := store.Dashboard(context.Background(), userA)
	for _, r := range rows {
		if r.ID == imgA1 && !r.IsFavorite {
			t.Fatal("favorite not toggled on")
		}
	}
}

func TestPublishAndGallery(t *testing.T) {
	ctx := context.Background()
	if _, err := store.pool.Exec(ctx, `UPDATE images SET is_published = false`); err != nil {
		t.Fatal(err)
	}
	if err := store.Publish(ctx, imgA1, userB); err != errForbidden {
		t.Fatalf("want errForbidden, got %v", err)
	}
	if err := store.Publish(ctx, imgA1, userA); err != nil {
		t.Fatal(err)
	}
	gallery, err := store.Gallery(ctx, "recent")
	if err != nil || len(gallery) != 1 || gallery[0].ID != imgA1 {
		t.Fatalf("gallery=%v err=%v", gallery, err)
	}
}

func TestLikeUnlikeAndPopularSort(t *testing.T) {
	ctx := context.Background()
	if _, err := store.pool.Exec(ctx, `DELETE FROM likes`); err != nil {
		t.Fatal(err)
	}
	// publish both so popular ordering is observable
	if err := store.Publish(ctx, imgA1, userA); err != nil {
		t.Fatal(err)
	}
	if err := store.Publish(ctx, imgA2, userA); err != nil {
		t.Fatal(err)
	}
	if err := store.Like(ctx, userB, imgA1); err != nil {
		t.Fatal(err)
	}
	if err := store.Like(ctx, userB, imgA1); err != nil { // idempotent
		t.Fatal(err)
	}
	if err := store.Like(ctx, userB, "00000000-0000-0000-0000-000000000000"); err != errNotFound {
		t.Fatalf("want errNotFound, got %v", err)
	}
	liked, err := store.Liked(ctx, userB)
	if err != nil || len(liked) != 1 || liked[0].ID != imgA1 {
		t.Fatalf("liked=%v err=%v", liked, err)
	}
	popular, err := store.Gallery(ctx, "popular")
	if err != nil || len(popular) != 2 {
		t.Fatalf("popular=%v err=%v", popular, err)
	}
	if popular[0].ID != imgA1 || popular[0].LikeCount != 1 || popular[1].LikeCount != 0 {
		t.Fatalf("popular order wrong: %+v", popular)
	}
	if err := store.Unlike(ctx, userB, imgA1); err != nil {
		t.Fatal(err)
	}
	liked, _ = store.Liked(ctx, userB)
	if len(liked) != 0 {
		t.Fatal("unlike did not remove")
	}
}
