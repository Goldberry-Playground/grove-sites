terraform {
  # 1.6+ matches the AgenticOS estate baseline. Native S3 state locking
  # (`use_lockfile`) would need 1.10+; we instead guard concurrency with CI
  # `concurrency:` groups (mirrors the AgenticOS GOL-38/GOL-39 decision), so we
  # do NOT force a newer floor here.
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # PINNED to v4.x on purpose. v5 is a ground-up rewrite of the provider
      # schema (ruleset/bot-management/cache-rules resources all change shape).
      # GOL-264 scope is explicit: do NOT bump to v5. A v5 migration is its own
      # gated task once this estate is codified and importing cleanly on v4.
      version = "~> 4.40"
    }
  }

  # Remote state — DigitalOcean Spaces (S3-compatible), mirroring the AgenticOS
  # `agenticos-tfstate` pattern but in the SEPARATE Grove estate bucket
  # `grove-tf-state`. Blast-radius isolation: a lifecycle/key mistake on the
  # Grove edge config must not be able to touch AgenticOS platform state, and
  # vice-versa. Backend config is partial on purpose — bucket/key are here,
  # credentials come from AWS_* env at init time (see .env.op + README).
  backend "s3" {
    # DigitalOcean Spaces speaks the S3-compatible protocol; this is NOT AWS.
    # The skip_* flags stop the backend from calling real AWS STS/IAM (which
    # would 403 with a Spaces key). Same rationale as AgenticOS main.tf.
    endpoints                   = { s3 = "https://nyc3.digitaloceanspaces.com" }
    region                      = "us-east-1" # required by the backend, ignored by Spaces
    bucket                      = "grove-tf-state"
    key                         = "cloudflare-edge/terraform.tfstate"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    # Spaces returns 501 for the integrity checksums newer AWS SDKs send.
    skip_s3_checksum = true
  }
}
