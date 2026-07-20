import Image from "next/image";
import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl } from "@grove/odoo-client";

/**
 * Guild-companions strip (design spec §"Companions", v1 tag-inference).
 * Promotes food-forest add-ons: plants that share tags and an overlapping zone
 * range with the one being viewed. Renders nothing when there are no matches so
 * the page doesn't show an empty rail.
 */
export function CompanionsStrip({
  companions,
  odooBase,
}: {
  companions: Product[];
  odooBase: string;
}) {
  if (companions.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="companions-heading">
      <h2 id="companions-heading" className="text-lg font-display font-semibold text-foreground mb-1">
        Plant it with
      </h2>
      <p className="text-sm text-foreground/55 mb-4">
        Guild companions that share this plant’s conditions.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {companions.map((c) => {
          const img = resolveOdooImageUrl(c.imageUrl, odooBase);
          return (
            <Link
              key={c.id}
              href={`/shop/${c.id}`}
              className="group rounded-lg border border-primary/10 overflow-hidden hover:border-primary/40 transition"
            >
              <div className="relative aspect-square bg-secondary/20">
                {img && (
                  <Image
                    src={img}
                    alt={c.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {c.name}
                </p>
                {typeof c.priceMin === "number" && (
                  <p className="text-xs text-foreground/50 mt-1">from ${c.priceMin.toFixed(2)}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
