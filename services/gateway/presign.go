package main

import (
	"context"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Presigner turns a stored S3 key into a fetchable URL at read time.
// (Amends section 6's "presigned by the uploader": lists are served here,
// so the gateway presigns; documented in the README at Step 7.)
type Presigner interface{ URL(key string) string }

type noopPresigner struct{}

func (noopPresigner) URL(string) string { return "" }

type s3Presigner struct {
	client *s3.PresignClient
	bucket string
}

func newS3Presigner(ctx context.Context, bucket, region string) (Presigner, error) {
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, err
	}
	return &s3Presigner{client: s3.NewPresignClient(s3.NewFromConfig(cfg)), bucket: bucket}, nil
}

func (p *s3Presigner) URL(key string) string {
	if key == "" {
		return ""
	}
	req, err := p.client.PresignGetObject(context.Background(), &s3.GetObjectInput{
		Bucket: &p.bucket, Key: &key,
	}, s3.WithPresignExpires(time.Hour))
	if err != nil {
		return ""
	}
	return req.URL
}
