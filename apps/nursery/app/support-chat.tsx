"use client";

import Script from "next/script";
import { useState } from "react";

/**
 * grove_support phase 1 (GOL-2023): embed Odoo's `im_livechat` widget on the
 * nursery storefront.
 *
 * The storefronts are Next.js on App Platform, so `website_livechat`'s
 * server-side auto-injection never fires — we inject the scripts ourselves,
 * pointed at the prod Odoo host. Odoo 19 splits the embed into TWO scripts that
 * must run IN ORDER (verified on QA channel 2, 2026-09-21):
 *
 *   1. `/im_livechat/loader/<channel_id>` — a tiny inline script that only sets
 *      `odoo.__session_info__.livechatData` (server URL, channel options). It
 *      does NOT mount the widget. Served once the module + a livechat channel
 *      exist (GOL-2021).
 *   2. `/im_livechat/assets_embed.js` — the widget bundle. It reads the
 *      `livechatData` the loader stashed, so it MUST load AFTER the loader has
 *      executed; loading it first mounts nothing (silent no-op). We gate it on
 *      the loader's `onLoad` rather than trusting `next/script` inter-script
 *      ordering, which isn't guaranteed for `lazyOnload`.
 *
 * The mounted widget opens its realtime connection back to the same origin's
 * `/websocket` endpoint (Odoo 19 uses the websocket bus, not `/longpolling`),
 * which prod Caddy proxies to `odoo:8072` (`Caddyfile-odoo.tpl`).
 *
 * Inert until `NEXT_PUBLIC_LIVECHAT_CHANNEL_ID` is set, so this is safe to ship
 * ahead of the channel config: no channel id → render nothing, no script, no
 * network. `strategy="lazyOnload"` keeps both scripts off the critical path so
 * the widget cannot regress catalog/checkout LCP. Nursery ONLY in phase 1.
 */

const DEFAULT_ODOO_URL = "https://odoo.gatheringatthegrove.com";

function stripTrailingSlash(odooUrl: string): string {
  return odooUrl.replace(/\/+$/, "");
}

/** Build the im_livechat loader URL for a given Odoo host + channel id. */
export function livechatLoaderSrc(odooUrl: string, channelId: string): string {
  return `${stripTrailingSlash(odooUrl)}/im_livechat/loader/${encodeURIComponent(channelId)}`;
}

/** Build the im_livechat widget-bundle URL for a given Odoo host. */
export function livechatAssetsEmbedSrc(odooUrl: string): string {
  return `${stripTrailingSlash(odooUrl)}/im_livechat/assets_embed.js`;
}

export function SupportChat() {
  const channelId = process.env.NEXT_PUBLIC_LIVECHAT_CHANNEL_ID;
  // Gate the widget bundle on the loader having executed, so `livechatData` is
  // populated before the bundle boots.
  const [loaderReady, setLoaderReady] = useState(false);
  if (!channelId) return null;
  const odooUrl = process.env.NEXT_PUBLIC_LIVECHAT_ODOO_URL || DEFAULT_ODOO_URL;
  return (
    <>
      <Script
        id="grove-support-livechat-loader"
        src={livechatLoaderSrc(odooUrl, channelId)}
        strategy="lazyOnload"
        onLoad={() => setLoaderReady(true)}
      />
      {loaderReady ? (
        <Script
          id="grove-support-livechat-embed"
          src={livechatAssetsEmbedSrc(odooUrl)}
          strategy="lazyOnload"
        />
      ) : null}
    </>
  );
}
