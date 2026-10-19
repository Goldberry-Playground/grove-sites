/** GOL-3435: shapes for the community-cookbook recipe collection. */

export type BookKey = "central" | "centennial" | "mountain" | "woodlands" | "willis";

export type Course =
  | "Cakes"
  | "Cookies & Bars"
  | "Pies"
  | "Candies"
  | "Desserts"
  | "Breads"
  | "Salads"
  | "Preserves & Pickles"
  | "Appetizers & Snacks"
  | "Vegetables & Sides"
  | "Soups"
  | "Main Dishes"
  | "Sauces & Dressings"
  | "Beverages"
  | "Frostings & Icings";

export interface Ingredient {
  /** Quantity as printed ("2 pkg.", "1 (3½ cups) can"). Empty when the book gave none. */
  qty: string | null;
  item: string;
}

export interface IngredientGroup {
  /** Sub-heading as printed ("Frosting"), or null for the main list. */
  name: string | null;
  items: Ingredient[];
}

export interface Recipe {
  /** URL slug: `/recipes/<id>`. */
  id: string;
  title: string;
  category: Course;
  book: BookKey;
  /** Cook's name exactly as printed; null when the book printed none. */
  contributor: string | null;
  contributorRole: string | null;
  /** Hometown exactly as printed; null when the book printed none. */
  city: string | null;
  state: string | null;
  ingredientGroups: IngredientGroup[];
  steps: string[];
  tips: string[];
  ovenTemp: string | null;
  cookTime: string | null;
  yield: string | null;
  /** What we changed, guessed, or couldn't read. Never drop these. */
  editorNotes: string[];
}

export interface Book {
  name: string;
  by: string;
  where: string;
  year: string;
  /** Short stamp for the recipe-card face. */
  short: string;
}

export type TagKey =
  | "black-walnut"
  | "hickory"
  | "chestnut"
  | "hazelnut"
  | "persimmon"
  | "pawpaw"
  | "plum"
  | "apple"
  | "mulberry"
  | "serviceberry"
  | "elderberry"
  | "fig"
  | "walnut"
  | "pecan"
  | "almond"
  | "peanut"
  | "coconut"
  | "nuts"
  | "cherry"
  | "cranberry"
  | "date"
  | "raisin"
  | "grape"
  | "pineapple"
  | "banana"
  | "peach"
  | "pear"
  | "apricot"
  | "prune"
  | "berry"
  | "pumpkin"
  | "citrus";

export interface Tag {
  k: TagKey;
  label: string;
  re: RegExp;
  /** Grown at Goldberry Grove and sold by the sister nursery. */
  grow?: boolean;
  /** Match "walnut" only after removing "black walnut". */
  stripBlack?: boolean;
  /** Generic "nuts": only when no specific nut matched. */
  onlyIfNoNut?: boolean;
  /** Citrus: never headlines a dish on its own. */
  minor?: boolean;
  /**
   * The nursery listing's `grove_slug`, resolved to a live PDP at request time
   * by `/recipes/trees/[tree]`. Omit when the nursery has no listing yet; the
   * link-out then lands on the nursery shop instead of a 404.
   */
  nurserySlug?: string;
}
