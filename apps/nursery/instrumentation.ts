import { registerGroveOtel } from "@grove/otel";

/**
 * Next.js server instrumentation hook — runs once when the server process boots.
 * Registers OpenTelemetry (traces → OpenObserve, incl. auto fetch spans for
 * BFF→Odoo/Ghost calls). No-op until the OTEL_* env vars are set.
 * On the Node runtime it also starts the catalog warmer (only when the shared cache env
 * is set); the imports stay inside the guard so nothing reaches the Edge bundle.
 */
export async function register(): Promise<void> {
  registerGroveOtel();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { collectPaths, startCatalogWarmer } = await import("@grove/next-cache/warmer");
      const { odoo } = await import("./lib/clients");
      startCatalogWarmer({
        listPaths: () =>
          collectPaths(
            async (offset, limit) => {
              const page = await odoo.products.list({ offset, limit });
              return { count: page.count, items: page.products };
            },
            (p) => (p.slug ? `/shop/${p.slug}` : null),
          ),
      });
    } catch (err) {
      console.warn("[grove-warmer] not started", err instanceof Error ? err.message : err);
    }
  }
}
