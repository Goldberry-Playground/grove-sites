import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlyphIcon } from "@grove/ui-kit";
import {
  BOOKS,
  RECIPES,
  TAG,
  UPICK,
  attribution,
  bookTitle,
  getRecipe,
  plainFractions,
  recipeFacts,
  recipeNeighbours,
  type Recipe,
  type TagKey,
} from "../../../data/recipes";
import { MARSHALL_SRC, WREATH_SRC } from "../credits";
import { LinkButton } from "../link-button";
import { RecipeFace } from "../recipe-face";
import { RuleSnap } from "../rule-snap";
import { CopyLink } from "./copy-link";
import { MethodSteps } from "./method-steps";

export const dynamicParams = false;

export function generateStaticParams() {
  return RECIPES.map((r) => ({ id: r.id }));
}

function describe(r: Recipe): string {
  const b = BOOKS[r.book];
  const from = b.year ? `${b.name} (${b.year})` : b.name;
  const who = r.contributor ? ` from ${r.contributor}` : "";
  return `${r.title}${who}, a ${r.category.toLowerCase()} recipe transcribed from ${from}. Ingredients, method and the cook's own notes, credited as printed.`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = getRecipe(id);
  if (!r) return {};
  const description = describe(r);
  return {
    title: `${r.title} | Nut & Fruit Dishes | Goldberry Grove Farm`,
    description,
    alternates: { canonical: `/recipes/${r.id}` },
    openGraph: { title: r.title, description, type: "article" },
  };
}

/** schema.org Recipe. Only fields the book printed; nothing invented. */
function recipeJsonLd(r: Recipe) {
  const b = BOOKS[r.book];
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: r.title,
    description: describe(r),
    recipeCategory: r.category,
    ...(r.contributor ? { author: { "@type": "Person", name: r.contributor } } : {}),
    ...(r.yield ? { recipeYield: plainFractions(r.yield) } : {}),
    recipeIngredient: r.ingredientGroups.flatMap((g) =>
      g.items.map((i) => plainFractions([i.qty, i.item].filter(Boolean).join(" "))),
    ),
    recipeInstructions: r.steps.map((text) => ({ "@type": "HowToStep", text: plainFractions(text) })),
    isBasedOn: {
      "@type": "Book",
      name: b.name,
      ...(b.year ? { datePublished: b.year } : {}),
      author: { "@type": "Organization", name: b.by },
    },
    publisher: { "@type": "Organization", name: "Goldberry Grove Farm" },
  };
}

function joinList(a: string[]): string {
  return a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}

const treeName = (k: TagKey) => TAG[k].label.toLowerCase().replace(" nut", "");

/**
 * Which trees the sister nursery actually lists. Pecan, hazelnut and elderberry
 * grow on the hill but have no listing, so the copy must not say the nursery
 * sells them (GOL-3486).
 */
function nurseryLine(grown: TagKey[]): string {
  const names = grown.map(treeName);
  const listed = grown.filter((k) => TAG[k].nurserySlug).map(treeName);
  const unlisted = grown.filter((k) => !TAG[k].nurserySlug).map(treeName);
  const growing = `We\u2019re growing ${joinList(names)} at Goldberry Grove`;
  if (!unlisted.length) return `${growing}, and our sister nursery sells the same native stock for planting at home.`;
  if (!listed.length) {
    return `${growing}. Our sister nursery doesn\u2019t list ${unlisted.length > 1 ? "them" : "it"} yet, but it grows plenty of other native trees for planting at home.`;
  }
  const rest = joinList(unlisted);
  return `${growing}. Our sister nursery sells ${joinList(listed)} for planting at home. ${rest[0].toUpperCase()}${rest.slice(1)} ${unlisted.length > 1 ? "aren\u2019t" : "isn\u2019t"} listed there yet.`;
}

/**
 * "The black walnut in this one grows on our hill", linking to the live nursery
 * listing. The card leads with the first tree the nursery lists; when none is
 * listed it points at the nursery shop without naming a product (GOL-3486).
 */
function GrowEmbed({ grown }: { grown: TagKey[] }) {
  if (!grown.length) return null;
  const names = grown.map(treeName);
  const lead = grown.find((k) => TAG[k].nurserySlug) ?? grown[0];
  const leadLabel = TAG[lead].label;
  const listed = Boolean(TAG[lead].nurserySlug);
  const pick = grown.some((k) => UPICK.has(k));
  return (
    <aside className="journal-product-embed journal-product-embed--inline" aria-label="Grown at the Grove">
      <div className="journal-product-embed__caption">Grown at the Grove</div>
      <div className="product-card-wrap" style={{ "--product-card-accent": "var(--grove-color-accent)" } as CSSProperties}>
        <a href={`/recipes/trees/${lead}`} className="product-card">
          <div className="product-card__image">
            <RecipeFace stamp="Native stock" word={leadLabel} grown />
          </div>
          <div className="product-card__body">
            <div className="product-card__vendor">At The Grove Nursery</div>
            <h3 className="product-card__name">{listed ? `${leadLabel} trees` : "Native trees"}</h3>
            <div className="product-card__price">
              <span>{listed ? "See what\u2019s in stock" : "Browse the nursery"}</span>
              <GlyphIcon name="arrow-right" />
            </div>
          </div>
        </a>
      </div>
      <div className="embed-copy">
        <h3>
          The {joinList(names)} in this one {names.length > 1 ? "grow" : "grows"} on our hill.
        </h3>
        <p>{nurseryLine(grown)}</p>
        <div className="cta-row">
          <LinkButton href="/visit/seminars">Learn it at a workshop</LinkButton>
          {pick ? (
            <LinkButton href="/visit/upick" variant="ghost">
              Pick it in season
            </LinkButton>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/** GOL-3435: /recipes/[id], one recipe, statically generated for all 158. */
export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = getRecipe(id);
  if (!r) notFound();
  const facts = recipeFacts(r);
  const b = BOOKS[r.book];
  const { prev, next } = recipeNeighbours(r.id);
  const factRows: [string, string][] = [];
  for (const [k, v] of [
    ["Course", r.category],
    ["Oven", r.ovenTemp],
    ["Time", r.cookTime],
    ["Makes", r.yield],
    ["Ingredients", String(facts.ingredientCount)],
    ["Steps", String(r.steps.length)],
  ] as const) {
    if (v) factRows.push([k, plainFractions(v)]);
  }

  return (
    <article className="recipe" aria-labelledby="recipe-title">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(recipeJsonLd(r)).replace(/</g, "\\u003c") }}
      />
      <nav className="r-bar" aria-label="Recipe">
        <div className="page-wrap">
          <Link href="/recipes">
            <GlyphIcon name="arrow-left" /> All dishes
          </Link>
          <div className="r-nav">
            <CopyLink />
            {prev ? (
              <Link href={`/recipes/${prev.id}`} aria-label={`Previous: ${prev.title}`}>
                ‹ Prev
              </Link>
            ) : null}
            {next ? (
              <Link href={`/recipes/${next.id}`} aria-label={`Next: ${next.title}`}>
                Next ›
              </Link>
            ) : null}
          </div>
        </div>
      </nav>
      <section className="shop-subheader" aria-label="Recipe">
        <div className="shop-subheader__inner">
          <div className="shop-subheader__head">
            <span className="about-eyebrow">{[b.name, b.year].filter(Boolean).join(" · ")}</span>
            <h1 className="shop-subheader__title" id="recipe-title">
              {r.title}
            </h1>
            <p className="shop-subheader__lede">{attribution(r)}</p>
          </div>
          <ul className="facts" role="list">
            {factRows.map(([k, v]) => (
              <li key={k}>
                <b>{k}</b>
                {v}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div className="page-wrap">
        <div className="r-body">
          <section className="ingredients" aria-labelledby="ing-head">
            <h2 id="ing-head">
              Ingredients <small>Tick as you go</small>
            </h2>
            {r.ingredientGroups.map((g, gi) => (
              <div key={gi}>
                {g.name ? <p className="ig-name">{g.name}</p> : null}
                <ul className="ing">
                  {g.items.map((it, ii) => (
                    <li key={ii}>
                      <label>
                        <input type="checkbox" />
                        <span className="q">{it.qty ? plainFractions(it.qty) : <span aria-hidden="true">&ndash;</span>}</span>
                        <span>{plainFractions(it.item)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
          <section aria-labelledby="method-head">
            <h2 id="method-head">Method</h2>
            <p className="hint">Tap a step to mark it done.</p>
            <MethodSteps steps={r.steps.map(plainFractions)} />
            {r.tips.length ? (
              <div className="tips">
                <span className="about-eyebrow">From the cook</span>
                {r.tips.map((t, i) => (
                  <p key={i}>{plainFractions(t)}</p>
                ))}
              </div>
            ) : null}
            <GrowEmbed grown={facts.grown} />
            {r.editorNotes.length ? (
              <details className="notes">
                <summary>What we changed or couldn&rsquo;t read ({r.editorNotes.length})</summary>
                <ul>
                  {r.editorNotes.map((n, i) => (
                    <li key={i}>{plainFractions(n)}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        </div>
        <footer className="r-foot">
          <span>
            {bookTitle(r.book)}. Compiled by {b.by}
            {b.where ? `, ${b.where}` : ""}.
          </span>
          <span className="mini">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WREATH_SRC} alt="" width={40} height={38} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARSHALL_SRC} alt="" width={52} height={35} />
            <span>Transcribed by Goldberry Grove, with thanks to Marshall University.</span>
          </span>
        </footer>
      </div>
      <RuleSnap />
    </article>
  );
}
