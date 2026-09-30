import Link from "next/link";
import type { Product } from "@grove/odoo-client";

/** How many plant chips a card shows before collapsing the rest into "+N more".
 *  Miller's Law: past about half a dozen the chips stop being scannable and
 *  become a wall, and the card's job is "is this the right guild?", not a
 *  full manifest — the PDP carries that. */
const CHIP_CAP = 6;

export interface GuildCardProps {
  guild: Product;
  /** One-line purpose, from the guild's own Odoo copy. Null renders no line. */
  purpose?: string | null;
  /** Plant names in this guild, best-effort from the bundle's components. */
  plants: string[];
  /** Department names the guild draws from, for the "From:" line. */
  departments: string[];
}

/**
 * One guild card (GOL-2745, spec § Storefront — Guilds page).
 *
 * A guild is a curated cross-department set — "plants that grow better
 * together" — so the card has to answer three questions in order: what is it,
 * what's in it, and where does it draw from. That ordering IS the visual
 * hierarchy: name (largest), purpose, chips, "From:", then price + action
 * pinned to the foot so every card in a row shares an action line.
 */
export function GuildCard({ guild, purpose = null, plants, departments }: GuildCardProps) {
  const shown = plants.slice(0, CHIP_CAP);
  const overflow = plants.length - shown.length;
  const priced = typeof guild.priceMin === "number" ? guild.priceMin : guild.price;
  // Never print "$0.00" — it reads as free (GOL-408/GOL-1655).
  const isTbd = guild.saleOk === false || priced <= 0;
  const comingSoon = guild.saleOk === false;

  return (
    <article className="guild-card">
      <h3 className="guild-card__name">{guild.name}</h3>
      {purpose && <p className="guild-card__purpose">{purpose}</p>}

      {shown.length > 0 && (
        <ul className="guild-card__chips" aria-label={`Plants in ${guild.name}`}>
          {shown.map((plant) => (
            <li key={plant} className="guild-chip">
              {plant}
            </li>
          ))}
          {overflow > 0 && (
            <li className="guild-chip guild-chip--more">{`+${overflow} more`}</li>
          )}
        </ul>
      )}

      {departments.length > 0 && (
        <p className="guild-card__from">
          From: <strong>{departments.join(" · ")}</strong>
        </p>
      )}

      <div className="guild-card__foot">
        <span className={`guild-card__price${isTbd ? " guild-card__price--tbd" : ""}`}>
          {isTbd ? "Price TBD" : `$${priced.toFixed(2)}`}
        </span>
        <Link href={`/shop/${guild.id}`} className="guild-card__cta">
          {comingSoon ? "Notify me" : "See the guild"}
        </Link>
      </div>
    </article>
  );
}
