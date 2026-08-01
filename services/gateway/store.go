package main

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	errNotFound  = errors.New("not found")
	errForbidden = errors.New("forbidden")
)

type ImageRow struct {
	ID          string
	UserID      string
	S3Key       string
	IsFavorite  bool
	IsPublished bool
	LikeCount   int
	CreatedAt   time.Time
}

type Store struct{ pool *pgxpool.Pool }

func newStore(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &Store{pool: pool}, nil
}

const imageCols = `i.id::text, i.user_id::text, i.s3_url, i.is_favorite, i.is_published, i.created_at,
	count(l.user_id) AS like_count`

func scanImages(rows pgx.Rows) ([]ImageRow, error) {
	defer rows.Close()
	out := []ImageRow{}
	for rows.Next() {
		var r ImageRow
		if err := rows.Scan(&r.ID, &r.UserID, &r.S3Key, &r.IsFavorite, &r.IsPublished, &r.CreatedAt, &r.LikeCount); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) Dashboard(ctx context.Context, userID string) ([]ImageRow, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+imageCols+` FROM images i
		LEFT JOIN likes l ON l.image_id = i.id
		WHERE i.user_id = $1 GROUP BY i.id ORDER BY i.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	return scanImages(rows)
}

func (s *Store) Liked(ctx context.Context, userID string) ([]ImageRow, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+imageCols+` FROM images i
		JOIN likes mine ON mine.image_id = i.id AND mine.user_id = $1
		LEFT JOIN likes l ON l.image_id = i.id
		GROUP BY i.id, mine.created_at ORDER BY mine.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	return scanImages(rows)
}

func (s *Store) Gallery(ctx context.Context, sort string) ([]ImageRow, error) {
	order := `i.created_at DESC`
	if sort == "popular" {
		order = `count(l.user_id) DESC, i.created_at DESC`
	}
	rows, err := s.pool.Query(ctx, `SELECT `+imageCols+` FROM images i
		LEFT JOIN likes l ON l.image_id = i.id
		WHERE i.is_published = true GROUP BY i.id ORDER BY `+order)
	if err != nil {
		return nil, err
	}
	return scanImages(rows)
}

// ownedUpdate runs the ownership check contract: 404 if the image doesn't
// exist, 403 if it belongs to someone else, else apply the update.
func (s *Store) ownedUpdate(ctx context.Context, imageID, userID, updateSQL string) error {
	var owner string
	err := s.pool.QueryRow(ctx, `SELECT user_id::text FROM images WHERE id = $1`, imageID).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNotFound
	}
	if err != nil {
		return err
	}
	if owner != userID {
		return errForbidden
	}
	_, err = s.pool.Exec(ctx, updateSQL, imageID)
	return err
}

func (s *Store) ToggleFavorite(ctx context.Context, imageID, userID string) error {
	return s.ownedUpdate(ctx, imageID, userID, `UPDATE images SET is_favorite = NOT is_favorite WHERE id = $1`)
}

func (s *Store) Publish(ctx context.Context, imageID, userID string) error {
	return s.ownedUpdate(ctx, imageID, userID, `UPDATE images SET is_published = true WHERE id = $1`)
}

func (s *Store) Like(ctx context.Context, userID, imageID string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO likes (user_id, image_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, imageID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" { // FK violation: image or user missing
		return errNotFound
	}
	return err
}

func (s *Store) Unlike(ctx context.Context, userID, imageID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM likes WHERE user_id = $1 AND image_id = $2`, userID, imageID)
	return err
}
