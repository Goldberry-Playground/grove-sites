export type TenantSlug = "hub" | "goldberry" | "ggg" | "nursery" | "shared";

// Resolves a tenant-scoped asset reference. In QA/prod NEXT_PUBLIC_ASSETS_URL
// points at the CDN (see infra/terraform/environments/assets); in local dev
// it's unset and we fall back to /public/ so `pnpm dev` needs no network.
export function assetPath(tenant: TenantSlug, subpath: string): string {
  const base = process.env.NEXT_PUBLIC_ASSETS_URL;
  const clean = subpath.replace(/^\/+/, "");
  return base ? `${base}/${tenant}/${clean}` : `/${clean}`;
}
