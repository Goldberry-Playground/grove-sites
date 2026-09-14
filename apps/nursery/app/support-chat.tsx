import Script from "next/script";

/**
 * grove_support phase 1 (GOL-2023): embed Odoo's `im_livechat` external loader
 * on the nursery storefront.
 *
 * The storefronts are Next.js on App Platform, so `website_livechat`'s
 * server-side auto-injection never fires — we inject the loader ourselves,
 * pointed at the prod Odoo host. The loader (`/im_livechat/loader/<channel_id>`)
 * is served by `im_livechat` once the module + a livechat channel exist
 * (GOL-2021). It bootstraps the widget and opens its realtime connection back to
 * that origin's `/longpolling/*` endpoint, which prod Caddy proxies to
 * `odoo:8072` (`Caddyfile-odoo.tpl`).
 *
 * Inert until `NEXT_PUBLIC_LIVECHAT_CHANNEL_ID` is set, so this is safe to ship
 * ahead of the channel config: no channel id → render nothing, no script, no
 * network. `strategy="lazyOnload"` keeps the widget off the critical path so it
 * cannot regress catalog/checkout LCP. Nursery ONLY in phase 1.
 */

const DEFAULT_ODOO_URL = "https://odoo.gatheringatthegrove.com";

/** Build the im_livechat loader URL for a given Odoo host + channel id. */
export function livechatLoaderSrc(odooUrl: string, channelId: string): string {
  const base = odooUrl.replace(/\/+$/, "");
  return `${base}/im_livechat/loader/${encodeURIComponent(channelId)}`;
}

export function SupportChat() {
  const channelId = process.env.NEXT_PUBLIC_LIVECHAT_CHANNEL_ID;
  if (!channelId) return null;
  const odooUrl = process.env.NEXT_PUBLIC_LIVECHAT_ODOO_URL || DEFAULT_ODOO_URL;
  return (
    <Script
      id="grove-support-livechat"
      src={livechatLoaderSrc(odooUrl, channelId)}
      strategy="lazyOnload"
    />
  );
}
