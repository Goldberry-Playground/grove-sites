"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

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
 * Inert until a channel id is configured, so this is safe to ship ahead of the
 * channel config: no channel id → render nothing, no script, no network.
 * Nursery ONLY in phase 1.
 *
 * Loaded on first interaction, not on page load (2026-10-20). `lazyOnload`
 * only deferred the bundle to after `onload`; it still downloaded and parsed
 * it on EVERY page view. `assets_embed.js` is Odoo's whole web-client slice:
 * 3.1 MB uncompressed (QA serves it raw), 727 KB zstd on prod, and
 * `Cache-Control: no-cache`, so it revalidates every visit. Lighthouse on
 * nursery.qa put it at ~1.7 MB of unused JS and 200-290 ms of blocking time on
 * every page. Now nothing loads until the visitor first scrolls, taps, clicks
 * or types (`useFirstInteraction`); a visitor who might want help has
 * interacted by the time they look for the chat bubble, and a bounce never
 * pays for it.
 *
 * Config source (GOL-3302): the root layout (a Server Component) resolves the
 * RUNTIME env (`LIVECHAT_CHANNEL_ID` / `LIVECHAT_ODOO_URL`, set on the App
 * Platform spec in odoocker TF) via `resolveLivechatConfig` and passes it in as
 * props. The `NEXT_PUBLIC_*` reads below are only a build-time fallback for
 * local dev -- they are inlined by `next build` in grove-sites CI, so a value
 * set on the DO app can never reach them. See livechat-config.ts.
 */

import { DEFAULT_LIVECHAT_ODOO_URL } from "./livechat-config";

const DEFAULT_ODOO_URL = DEFAULT_LIVECHAT_ODOO_URL;

export type SupportChatProps = {
  /** Runtime-resolved `im_livechat.channel` id; undefined => fall back to NEXT_PUBLIC_. */
  channelId?: string;
  /** Runtime-resolved Odoo origin; undefined => NEXT_PUBLIC_ fallback, then prod default. */
  odooUrl?: string;
};

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

/** Events that count as "the visitor is engaging with the page". */
export const FIRST_INTERACTION_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

/**
 * True once the visitor has interacted with the page at all; false until then
 * (and during SSR). Listens once, passively, and removes every listener on the
 * first hit or on unmount.
 */
export function useFirstInteraction(enabled = true): boolean {
  const [interacted, setInteracted] = useState(false);
  useEffect(() => {
    if (!enabled || interacted) return;
    const onFirst = () => setInteracted(true);
    const opts: AddEventListenerOptions = { once: true, passive: true };
    for (const type of FIRST_INTERACTION_EVENTS) window.addEventListener(type, onFirst, opts);
    return () => {
      for (const type of FIRST_INTERACTION_EVENTS) window.removeEventListener(type, onFirst, opts);
    };
  }, [enabled, interacted]);
  return interacted;
}

export function SupportChat({ channelId: channelIdProp, odooUrl: odooUrlProp }: SupportChatProps) {
  const channelId = channelIdProp || process.env.NEXT_PUBLIC_LIVECHAT_CHANNEL_ID;
  // Gate the widget bundle on the loader having executed, so `livechatData` is
  // populated before the bundle boots.
  const [loaderReady, setLoaderReady] = useState(false);
  const interacted = useFirstInteraction(Boolean(channelId));
  if (!channelId || !interacted) return null;
  const odooUrl = odooUrlProp || process.env.NEXT_PUBLIC_LIVECHAT_ODOO_URL || DEFAULT_ODOO_URL;
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
