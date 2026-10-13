/**
 * grove_support live chat (GOL-2023 / GOL-3302): resolve the widget config
 * from the RUNTIME environment, on the server, at request time.
 *
 * Why this is not just `process.env.NEXT_PUBLIC_LIVECHAT_CHANNEL_ID` in the
 * client component: `NEXT_PUBLIC_*` values are inlined into the bundle by
 * `next build`, which for the storefronts runs ONCE in grove-sites CI
 * (`.github/workflows/docker.yml`) before the image is pushed to GHCR. App
 * Platform then pulls that prebuilt image, so an env var set on the DO app spec
 * -- any scope, including BUILD_TIME -- can never reach the client bundle. It
 * also means one image serves BOTH QA and prod, which cannot carry two
 * different channel ids / Odoo hosts.
 *
 * The root layout is an async Server Component (it calls `headers()`), so it
 * re-renders per request and sees the container's real `process.env`. It calls
 * this resolver and hands the result to `<SupportChat>` as props. The runtime
 * keys are deliberately NOT `NEXT_PUBLIC_*`, so Next cannot inline them; the
 * `NEXT_PUBLIC_*` names remain as a fallback for local `pnpm dev` and for any
 * image that was built with them baked in.
 *
 * Precedence per key: runtime (`LIVECHAT_*`) > build-time (`NEXT_PUBLIC_LIVECHAT_*`).
 * No channel id (after trimming) => `null` => the widget renders nothing, no
 * script, no network -- the same inert contract the component has always had.
 */

export const DEFAULT_LIVECHAT_ODOO_URL = "https://odoo.gatheringatthegrove.com";

export type LivechatConfig = {
  /** `im_livechat.channel` id on the Odoo host; the loader path segment. */
  channelId: string;
  /** Odoo origin the loader + widget bundle are fetched from (no trailing slash required). */
  odooUrl: string;
};

type EnvLike = Record<string, string | undefined>;

function pick(env: EnvLike, runtimeKey: string, buildKey: string): string {
  const runtime = env[runtimeKey]?.trim();
  if (runtime) return runtime;
  return env[buildKey]?.trim() ?? "";
}

/**
 * Pure: pass `process.env` (whole object, so Next cannot inline anything) or a
 * plain map in tests.
 */
export function resolveLivechatConfig(env: EnvLike): LivechatConfig | null {
  const channelId = pick(env, "LIVECHAT_CHANNEL_ID", "NEXT_PUBLIC_LIVECHAT_CHANNEL_ID");
  if (!channelId) return null;
  const odooUrl =
    pick(env, "LIVECHAT_ODOO_URL", "NEXT_PUBLIC_LIVECHAT_ODOO_URL") || DEFAULT_LIVECHAT_ODOO_URL;
  return { channelId, odooUrl };
}
