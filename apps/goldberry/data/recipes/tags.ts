import type { Tag, TagKey } from "./types";

/**
 * GOL-3435: which nuts and fruits a recipe cooks with, matched against its
 * ingredient text. Order matters: specific before generic ("black walnut"
 * before "walnut", any named nut before "nuts").
 *
 * `nurserySlug` maps the trees we grow to the At The Grove Nursery listing's
 * `grove_slug` (prod catalog, 2026-10-19). Hazelnut and elderberry have no
 * listing yet, so their link-out falls back to the nursery shop.
 */
export const TAGS: readonly Tag[] = [
  { k: "black-walnut", label: "Black walnut", re: /black walnut/i, grow: true, nurserySlug: "black-walnut" },
  { k: "hickory", label: "Hickory nut", re: /hickory/i, grow: true, nurserySlug: "shagbark-hickory" },
  { k: "chestnut", label: "Chestnut", re: /chestnut/i, grow: true, nurserySlug: "american-chestnut" },
  { k: "hazelnut", label: "Hazelnut", re: /hazelnut|filbert/i, grow: true },
  { k: "persimmon", label: "Persimmon", re: /persimmon/i, grow: true, nurserySlug: "american-persimmon" },
  { k: "pawpaw", label: "Pawpaw", re: /paw ?paw/i, grow: true, nurserySlug: "pawpaw" },
  { k: "plum", label: "Plum", re: /\bplums?\b/i, grow: true, nurserySlug: "american-plum" },
  { k: "apple", label: "Apple", re: /\bapple(s|sauce| butter|butter)?\b/i, grow: true, nurserySlug: "apple" },
  { k: "mulberry", label: "Mulberry", re: /mulberr/i, grow: true, nurserySlug: "mulberry" },
  { k: "serviceberry", label: "Serviceberry", re: /serviceberr|juneberr/i, grow: true, nurserySlug: "serviceberry" },
  { k: "elderberry", label: "Elderberry", re: /elderberr/i, grow: true },
  { k: "fig", label: "Fig", re: /\bfigs?\b/i, grow: true, nurserySlug: "fig" },
  { k: "walnut", label: "English walnut", re: /walnut/i, stripBlack: true },
  { k: "pecan", label: "Pecan", re: /pecan/i },
  { k: "almond", label: "Almond", re: /almond/i },
  { k: "peanut", label: "Peanut", re: /peanut/i },
  { k: "coconut", label: "Coconut", re: /coconut/i },
  { k: "nuts", label: "Nuts", re: /\bnuts?\b|nut ?meats?|nutmeats/i, onlyIfNoNut: true },
  { k: "cherry", label: "Cherry", re: /cherr(y|ies)/i },
  { k: "cranberry", label: "Cranberry", re: /cranberr/i },
  { k: "date", label: "Date", re: /\bdates?\b/i },
  { k: "raisin", label: "Raisin", re: /raisin|currant/i },
  { k: "grape", label: "Grape", re: /\bgrapes?\b|grape juice|grape jelly/i },
  { k: "pineapple", label: "Pineapple", re: /pineapple/i },
  { k: "banana", label: "Banana", re: /banana/i },
  { k: "peach", label: "Peach", re: /peach/i },
  { k: "pear", label: "Pear", re: /\bpears?\b/i },
  { k: "apricot", label: "Apricot", re: /apricot/i },
  { k: "prune", label: "Prune", re: /prune/i },
  { k: "berry", label: "Berries", re: /strawberr|blueberr|blackberr|raspberr|huckleberr/i },
  { k: "pumpkin", label: "Pumpkin", re: /pumpkin/i },
  { k: "citrus", label: "Orange & lemon", re: /\borange|lemon|\blime/i, minor: true },
];

export const TAG = Object.fromEntries(TAGS.map((t) => [t.k, t])) as Record<TagKey, Tag>;

export const NUT_KEYS: ReadonlySet<TagKey> = new Set<TagKey>([
  "black-walnut",
  "hickory",
  "chestnut",
  "hazelnut",
  "walnut",
  "pecan",
  "almond",
  "peanut",
  "coconut",
]);

/** Trees on the hill that visitors can pick in season. */
export const UPICK: ReadonlySet<TagKey> = new Set<TagKey>([
  "persimmon",
  "pawpaw",
  "plum",
  "apple",
  "mulberry",
  "serviceberry",
  "elderberry",
  "black-walnut",
  "chestnut",
  "hazelnut",
]);
