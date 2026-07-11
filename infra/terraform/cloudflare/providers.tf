provider "cloudflare" {
  # Scoped API token (NOT a global key). Required permissions for GOL-264:
  #   Zone:Read, Zone WAF:Edit, Firewall Services:Edit, Cache Rules:Edit
  # on the storefront Cloudflare account. Injected as TF_VAR_cloudflare_api_token
  # via `op run --env-file=.env.op` — never committed, never in shell history.
  api_token = var.cloudflare_api_token
}
