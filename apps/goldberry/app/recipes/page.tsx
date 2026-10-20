import type { Metadata } from "next";
import { RECIPES, SORTED_RECIPES, recipeSummary } from "../../data/recipes";
import { Credits } from "./credits";
import { LearnBand } from "./learn-band";
import { LinkButton } from "./link-button";
import { RecipesIndex } from "./recipes-index";

const DESCRIPTION = `${RECIPES.length} recipes from five West Virginia community cookbooks, typed up to cook from: black walnut cake, persimmon bread, wild plum marmalade and more, each credited to its cook and hometown as printed.`;

export const metadata: Metadata = {
  title: "Nut & Fruit Dishes | Goldberry Grove Farm",
  description: DESCRIPTION,
  alternates: { canonical: "/recipes" },
  openGraph: { title: "Nut & Fruit Dishes from West Virginia community cookbooks", description: DESCRIPTION, type: "website" },
};

/** GOL-3435: /recipes, the community-cookbook index. Fully static. */
export default function RecipesPage() {
  const summaries = SORTED_RECIPES.map(recipeSummary);
  return (
    <>
      <RecipesIndex
        recipes={summaries}
        head={
          <div key="head" className="shop-subheader__head">
            <span className="about-eyebrow">Nut &amp; Fruit Dishes</span>
            <h1 className="shop-subheader__title">
              Black walnut cake, persimmon bread, <em>wild plum marmalade.</em>
            </h1>
            <div className="subhead-side">
              <p className="shop-subheader__lede">
                We&rsquo;ve been working through a stack of West Virginia community cookbooks, the oldest put together
                by the Woman&rsquo;s Club of Logan in 1963, and typing every recipe up so it&rsquo;s easy to cook from.
                A lot of them lean on the trees we&rsquo;re growing on the hill: black walnut, hickory, pecan, persimmon,
                plum, apple. Every cook&rsquo;s name and hometown is kept as printed.
              </p>
              <p className="sig">Josh and Abigail</p>
              <div className="cta-row">
                <LinkButton href="/visit/seminars" size="lg">
                  Sign up for a workshop
                </LinkButton>
                <LinkButton href="/visit/upick" variant="ghost" size="lg">
                  U-pick, in season
                </LinkButton>
              </div>
            </div>
          </div>
        }
      />
      <LearnBand />
      <Credits />
    </>
  );
}
