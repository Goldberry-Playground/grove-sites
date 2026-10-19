import type { Book, BookKey, Course } from "./types";

/** GOL-3435: the five cookbooks, credited as printed (from the approved design). */
export const BOOKS: Record<BookKey, Book> = {
  central: { name: "Central Cook Book", by: "The Woman's Club of Logan, Inc.", where: "Logan, West Virginia", year: "1963", short: "Central Cook Book · 1963" },
  centennial: { name: "West Virginia Centennial Cook Book, Supplement", by: "The Woman's Club of Logan, Inc.", where: "Logan, West Virginia", year: "1964", short: "Centennial · 1964" },
  mountain: { name: "Mountain Measures", by: "Junior League of Charleston", where: "Charleston, West Virginia", year: "1974", short: "Mountain Measures · 1974" },
  woodlands: { name: "Savoring the Taste of Generations", by: "Woodlands Retirement Community", where: "", year: "", short: "Woodlands" },
  willis: { name: "Kitchen Tasted Recipes", by: "Rev. Arnold Willis", where: "", year: "", short: "Rev. Arnold Willis" },
};

export const BOOK_KEYS = Object.keys(BOOKS) as BookKey[];

/** Menu order for course sections and pills. */
export const COURSE_ORDER: readonly Course[] = [
  "Cakes",
  "Cookies & Bars",
  "Pies",
  "Candies",
  "Desserts",
  "Breads",
  "Salads",
  "Preserves & Pickles",
  "Appetizers & Snacks",
  "Vegetables & Sides",
  "Soups",
  "Main Dishes",
  "Sauces & Dressings",
  "Beverages",
  "Frostings & Icings",
];

export const STATE_ABBR: Record<string, string> = {
  "West Virginia": "WV",
  Virginia: "VA",
  California: "CA",
  Alabama: "AL",
  Idaho: "ID",
  Nevada: "NV",
  Washington: "WA",
  Georgia: "GA",
  Texas: "TX",
  Wyoming: "WY",
  Maryland: "MD",
  Utah: "UT",
  Montana: "MT",
  Ohio: "OH",
  Kentucky: "KY",
};

export function isCourse(v: string): v is Course {
  return (COURSE_ORDER as readonly string[]).includes(v);
}
