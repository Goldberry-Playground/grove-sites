/**
 * GOL-3435: the recipe collection plus everything the /recipes routes derive
 * from it. Pure data, no React, safe to import from server and client code.
 */
import { BOOKS, COURSE_ORDER, STATE_ABBR } from "./books";
import { RECIPES } from "./recipes.data";
import { NUT_KEYS, TAG, TAGS } from "./tags";
import type { BookKey, Course, Recipe, TagKey } from "./types";

export * from "./types";
export { BOOKS, BOOK_KEYS, COURSE_ORDER, STATE_ABBR } from "./books";
export { TAG, TAGS, UPICK } from "./tags";
export { RECIPES };

/**
 * The brand faces (Libre Baskerville, IBM Plex Mono) cover Latin-1's ¼ ½ ¾ but
 * not the Number Forms fractions (⅓ ⅔ ⅛ ⅜ ⅖), which would paint as empty
 * boxes on a client without a fallback font. Display-only: spell them "1/3"
 * ("1⅓" → "1 1/3"). The data module itself stays exactly as transcribed.
 */
const NUMBER_FORMS: Record<string, string> = {
  "\u2150": "1/7",
  "\u2151": "1/9",
  "\u2152": "1/10",
  "\u2153": "1/3",
  "\u2154": "2/3",
  "\u2155": "1/5",
  "\u2156": "2/5",
  "\u2157": "3/5",
  "\u2158": "4/5",
  "\u2159": "1/6",
  "\u215a": "5/6",
  "\u215b": "1/8",
  "\u215c": "3/8",
  "\u215d": "5/8",
  "\u215e": "7/8",
};

export function plainFractions(text: string): string {
  return text.replace(/(\d?)([\u2150-\u215e])/g, (_, d: string, f: string) => `${d ? `${d} ` : ""}${NUMBER_FORMS[f]}`);
}

export interface RecipeFacts {
  /** Nut and fruit tags, in TAGS order. */
  tags: TagKey[];
  /** The tag that names the card face, or null to fall back to the course. */
  lead: TagKey | null;
  /** Tags for trees we grow. */
  grown: TagKey[];
  /** "Beckley, WV", "Ohio", or "" when no hometown was printed. */
  place: string;
  /** Hometown filter key: "City|State", "|State", or "" for none printed. */
  placeKey: string;
  ingredientCount: number;
}

function ingredientText(r: Recipe): string {
  return r.ingredientGroups.flatMap((g) => g.items.map((i) => i.item)).join(" | ");
}

export function recipeFacts(r: Recipe): RecipeFacts {
  const ingText = ingredientText(r);
  const found = new Set<TagKey>();
  for (const t of TAGS) {
    if (t.onlyIfNoNut && [...found].some((k) => NUT_KEYS.has(k))) continue;
    const text = t.stripBlack ? ingText.replace(/black walnuts?/gi, "") : ingText;
    if (t.re.test(text)) found.add(t.k);
  }
  const tags = TAGS.filter((t) => found.has(t.k)).map((t) => t.k);
  return {
    tags,
    lead: tags.find((k) => !TAG[k].minor) ?? tags[0] ?? null,
    grown: tags.filter((k) => TAG[k].grow),
    place: r.city && r.state ? `${r.city}, ${STATE_ABBR[r.state] ?? r.state}` : (r.state ?? ""),
    placeKey: r.city ? `${r.city}|${r.state ?? ""}` : r.state ? `|${r.state}` : "",
    ingredientCount: r.ingredientGroups.reduce((n, g) => n + g.items.length, 0),
  };
}

/** Every recipe, grouped by course in menu order, A to Z within a course. */
export const SORTED_RECIPES: readonly Recipe[] = COURSE_ORDER.flatMap((c) =>
  RECIPES.filter((r) => r.category === c).sort((a, b) => a.title.localeCompare(b.title)),
);

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** Neighbours in SORTED_RECIPES order, for Prev / Next on the detail page. */
export function recipeNeighbours(id: string): { prev: Recipe | null; next: Recipe | null } {
  const i = SORTED_RECIPES.findIndex((r) => r.id === id);
  if (i < 0) return { prev: null, next: null };
  return { prev: SORTED_RECIPES[i - 1] ?? null, next: SORTED_RECIPES[i + 1] ?? null };
}

export function bookCounts(): Record<BookKey, number> {
  const counts = Object.fromEntries(Object.keys(BOOKS).map((k) => [k, 0])) as Record<BookKey, number>;
  for (const r of RECIPES) counts[r.book] += 1;
  return counts;
}

/** "Central Cook Book, 1963" or the bare name when the book printed no year. */
export function bookTitle(book: BookKey): string {
  const b = BOOKS[book];
  return b.year ? `${b.name}, ${b.year}` : b.name;
}

/**
 * The attribution line, worded so a missing name or hometown is stated, never
 * guessed: "From Mrs. C. Edwin Watkins, of Beckley, West Virginia."
 */
export function attribution(r: Recipe): string {
  // Close a sentence without doubling a period the book printed ("Jr.").
  const end = (t: string) => (t.endsWith(".") ? t : `${t}.`);
  const home = [r.city, r.state].filter(Boolean).join(", ");
  if (r.contributor) {
    const who = `From ${r.contributor}${r.contributorRole ? `, ${r.contributorRole}` : ""}`;
    return home ? end(`${who}, of ${home}`) : `${end(who)} The book didn't print a hometown.`;
  }
  return `The cook's name wasn't printed with this one.${home ? ` ${end(home)}` : ""}`;
}

/** Card-sized summary the client index filters over (no method text). */
export interface RecipeSummary {
  id: string;
  title: string;
  category: Course;
  book: BookKey;
  /** Card eyebrow: "Mrs. C. Edwin Watkins · Beckley, WV". */
  vendor: string;
  /** Card face word: the lead nut or fruit, else the course. */
  faceWord: string;
  grown: boolean;
  tip: string | null;
  ingredientCount: number;
  stepCount: number;
  ovenTemp: string | null;
  tags: TagKey[];
  placeKey: string;
  /** Lower-cased search haystack: title, cook, town, course, ingredients, book. */
  hay: string;
}

export function recipeSummary(r: Recipe): RecipeSummary {
  const f = recipeFacts(r);
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    book: r.book,
    vendor: r.contributor ? `${r.contributor}${f.place ? ` · ${f.place}` : ""}` : f.place || "Cook not printed",
    faceWord: f.lead ? TAG[f.lead].label : r.category,
    grown: f.grown.length > 0,
    tip: r.tips[0] ? plainFractions(r.tips[0]) : null,
    ingredientCount: f.ingredientCount,
    stepCount: r.steps.length,
    ovenTemp: r.ovenTemp,
    tags: f.tags,
    placeKey: f.placeKey,
    hay: plainFractions(
      [r.title, r.contributor, r.contributorRole, r.city, r.state, r.category, ingredientText(r), BOOKS[r.book].name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    ),
  };
}

export function isCourse(v: string): v is Course {
  return (COURSE_ORDER as readonly string[]).includes(v);
}
