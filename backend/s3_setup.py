"""
s3_setup.py -- One-time S3 bucket provisioning script for Image Protect.

Usage
-----
Set the following environment variables before running:

    S3_BUCKET       Name of the S3 bucket to create (e.g. "my-image-protect-bucket")
    AWS_REGION      AWS region where the bucket should be created (e.g. "us-east-2")
    IAM_ROLE_ARN    Full ARN of the EC2 instance IAM role that needs access
                    (e.g. "arn:aws:iam::123456789012:role/ImageProtectEC2Role")

Then run once from a developer machine that has AWS CLI credentials configured:

    python s3_setup.py

One-time IAM setup (before running this script):
    1. Create an IAM role (e.g. "ImageProtectEC2Role") with a trust policy for ec2.amazonaws.com.
    2. Record the role ARN and set it as IAM_ROLE_ARN above.
    3. After running this script, attach the role as an instance profile to your EC2 instance.
    The bucket policy applied here grants that role the minimum required permissions.
"""

import json
import os
import sys

import boto3
from botocore.exceptions import ClientError


def _require_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        print("ERROR: Required environment variable '{}' is not set.".format(name), file=sys.stderr)
        return ""
    return value


def main():
    bucket = _require_env("S3_BUCKET")
    region = _require_env("AWS_REGION")
    role_arn = _require_env("IAM_ROLE_ARN")

    if not bucket or not region or not role_arn:
        print(
            "\nUsage: set S3_BUCKET, AWS_REGION, and IAM_ROLE_ARN environment variables, "
            "then run:  python s3_setup.py",
            file=sys.stderr,
        )
        sys.exit(1)

    s3 = boto3.client("s3", region_name=region)

    # 1. Create bucket
    print("Creating bucket '{}' in region '{}' ...".format(bucket, region))
    try:
        if region == "us-east-1":
            s3.create_bucket(Bucket=bucket)
        else:
            s3.create_bucket(
                Bucket=bucket,
                CreateBucketConfiguration={"LocationConstraint": region},
            )
        print("  Bucket created.")
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        if error_code == "BucketAlreadyOwnedByYou":
            print("  Bucket already exists and is owned by you -- continuing.")
        else:
            print("ERROR: Could not create bucket: {}".format(exc), file=sys.stderr)
            sys.exit(1)

    # 2. Block all public access
    print("Applying public access block ...")
    s3.put_public_access_block(
        Bucket=bucket,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    print("  All four public-access-block flags set to True.")

    # 3. Apply bucket policy
    print("Applying bucket policy ...")
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AllowEC2RoleAccess",
                "Effect": "Allow",
                "Principal": {"AWS": role_arn},
                "Action": ["s3:PutObject", "s3:GetObject"],
                "Resource": "arn:aws:s3:::{}/*".format(bucket),
            }
        ],
    }
    s3.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
    print("  Bucket policy applied.")

    # 4. Summary
    print("")
    print("S3 setup complete.")
    print("  Bucket  : {}".format(bucket))
    print("  Region  : {}".format(region))
    print("  Policy  : s3:PutObject + s3:GetObject granted to {}".format(role_arn))
    print("")
    print("REMINDER: Attach the IAM role to your EC2 instance as an instance profile")
    print("          before starting the backend service.")


if __name__ == "__main__":
    main()