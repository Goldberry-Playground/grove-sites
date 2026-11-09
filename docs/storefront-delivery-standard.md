# Storefront delivery standard

Applies to every Grove storefront: nursery, Goldberry, Gathering hub and George George George Woodworking.

## Images

- Serve WebP only, through `groveImageDefaults` in `@grove/config/images`. Apps set only their allowed hosts. AVIF took about 2s to encode from cold and WebP about 0.5s on the nursery (2026-11-09). WebP files were about twice as large. Revisit AVIF only once a shared image cache makes cold encodes rare.
- Set `sizes` from a measured layout. If a container has a maximum width, cap the value, for example `min(33vw, 340px)`. A bare `33vw` over-requests on wide and retina screens.
- Check grids that stretch. `auto-fit` grids widen cards when few results show, so keep a larger `sizes` for those.

## Cloudflare

The proxy changes more than routing: it also turns on the zone's bot, speed and firewall features. Treat each change as a storefront release.

Turning on the proxy for a storefront, or changing its zone features:

1. Compare the zone's Security and Speed settings with a working storefront zone. Don't rely on Terraform alone; some settings live only in the dashboard.
2. Change one zone at a time, in a quiet window, with the rollback command ready.
3. Pass a real browser check before leaving it on: the checkout canary on all devices, and product pages on a real phone. `curl` doesn't run page JavaScript, so it can't catch script problems.
4. Keep bot-detection scripts off storefront pages unless a browser check has passed with them on.
5. Only then add the zone to `next_image_cache_zones` and confirm `x-grove-img-cache` shows `HIT`.

Workers only run on proxied records. Keep the route fail-open, and check daily requests against the plan limit.

### Nursery incident, 2026-11-09

Proxying the nursery injected JS Detections on its pages, the canary timed out on product pages, and product pages showed odd redirects. It was rolled back the same day. The cause is unconfirmed: product pages were also intermittently slow from the origin with the proxy off.
