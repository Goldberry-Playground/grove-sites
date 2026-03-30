/**
 * Shop listing page — will fetch from Odoo via @grove/odoo-client.
 * Currently renders a placeholder skeleton.
 */
export default function ShopPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-display font-bold text-primary mb-8">
        Farm Shop
      </h1>
      <p className="text-foreground/60 mb-8">
        Fresh produce and artisan goods — coming soon from our Odoo storefront.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-primary/10 p-4 animate-pulse"
          >
            <div className="h-48 bg-secondary/40 rounded mb-4" />
            <div className="h-4 bg-secondary/40 rounded w-3/4 mb-2" />
            <div className="h-4 bg-secondary/40 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
