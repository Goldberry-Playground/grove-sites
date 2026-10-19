"use client";

import Link from "next/link";
import { GlyphIcon } from "@grove/ui-kit";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
// Client bundle: import the small modules directly, never the barrel, which
// would pull all 158 recipes' method text into the browser.
import { BOOKS, BOOK_KEYS, COURSE_ORDER, STATE_ABBR, isCourse } from "../../data/recipes/books";
import { TAG, TAGS } from "../../data/recipes/tags";
import type { BookKey, Course, RecipeSummary, TagKey } from "../../data/recipes/types";
import { RecipeFace } from "./recipe-face";
import { RuleSnap } from "./rule-snap";

interface Filters {
  q: string;
  tag: TagKey | "";
  course: Course | "";
  place: string;
  book: BookKey | "";
}
type Facet = "tag" | "course" | "place" | "book";

const EMPTY: Filters = { q: "", tag: "", course: "", place: "", book: "" };

function readUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  const tag = p.get("tag") ?? "";
  const course = p.get("course") ?? "";
  const book = p.get("book") ?? "";
  return {
    q: (p.get("q") ?? "").trim().toLowerCase(),
    tag: TAGS.some((t) => t.k === tag) ? (tag as TagKey) : "",
    course: isCourse(course) ? course : "",
    place: p.get("place") ?? "",
    book: (BOOK_KEYS as string[]).includes(book) ? (book as BookKey) : "",
  };
}

function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  for (const k of ["q", "course", "tag", "place", "book"] as const) if (f[k]) p.set(k, f[k]);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function matches(r: RecipeSummary, f: Filters, skip?: Facet): boolean {
  if (skip !== "tag" && f.tag && !r.tags.includes(f.tag)) return false;
  if (skip !== "course" && f.course && r.category !== f.course) return false;
  if (skip !== "place" && f.place && (f.place === "none" ? r.placeKey !== "" : r.placeKey !== f.place)) return false;
  if (skip !== "book" && f.book && r.book !== f.book) return false;
  if (f.q) for (const w of f.q.split(/\s+/)) if (w && !r.hay.includes(w)) return false;
  return true;
}

function placeLabel(key: string): string {
  const [city, st] = key.split("|");
  return city ? `${city}, ${STATE_ABBR[st] ?? st}` : `${st} (town not printed)`;
}

const courseId = (c: Course) => `course-${c.toLowerCase().replace(/[^a-z]+/g, "-")}`;

type CardStyle = CSSProperties & { "--product-card-accent"?: string };

function RecipeCard({ r }: { r: RecipeSummary }) {
  const style: CardStyle = {
    "--product-card-accent": r.grown ? "var(--grove-color-accent)" : "var(--grove-color-primary)",
  };
  return (
    <div className="product-card-wrap" style={style}>
      <Link href={`/recipes/${r.id}`} className="product-card">
        <div className="product-card__image">
          <RecipeFace stamp={BOOKS[r.book].short} word={r.faceWord} grown={r.grown} />
        </div>
        <div className="product-card__body">
          <div className="product-card__vendor">{r.vendor}</div>
          <h3 className="product-card__name">
            {r.title}
            {r.grown ? <span className="sr">. Grown at the Grove</span> : null}
          </h3>
          {r.tip ? <p className="product-card__editorial">&ldquo;{r.tip}&rdquo;</p> : null}
          <div className="product-card__price">
            <span>
              {r.ingredientCount} ingredients · {r.stepCount} steps
            </span>
            <span>{r.ovenTemp ?? ""}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

/**
 * GOL-3435: the searchable, filterable recipe index. Server-rendered with every
 * recipe showing; filters live in the query string (`?q=&course=&tag=&place=&book=`)
 * so a filtered view can be shared, and every pill and cook-with link is a real
 * href that works before hydration.
 */
export function RecipesIndex({ recipes, head }: { recipes: RecipeSummary[]; head: ReactNode }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [qInput, setQInput] = useState("");
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = readUrl();
      setF(next);
      setQInput(new URLSearchParams(window.location.search).get("q") ?? "");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const apply = (next: Filters) => {
    setF(next);
    window.history.replaceState(null, "", `${window.location.pathname}${toQuery(next)}`);
  };
  const onFacetClick = (e: MouseEvent<HTMLAnchorElement>, next: Filters) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    apply(next);
  };
  const onSearch = (value: string) => {
    setQInput(value);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => apply({ ...f, q: value.trim().toLowerCase() }), 120);
  };

  const list = useMemo(() => recipes.filter((r) => matches(r, f)), [recipes, f]);

  const pills = useMemo(() => {
    const c: Partial<Record<Course, number>> = {};
    let all = 0;
    for (const r of recipes)
      if (matches(r, f, "course")) {
        c[r.category] = (c[r.category] ?? 0) + 1;
        all++;
      }
    return [
      { v: "" as const, label: "All", n: all },
      ...COURSE_ORDER.filter((k) => c[k] || k === f.course).map((k) => ({ v: k, label: k, n: c[k] ?? 0 })),
    ];
  }, [recipes, f]);

  const cookWith = useMemo(() => {
    const counts: Partial<Record<TagKey, number>> = {};
    let all = 0;
    for (const r of recipes)
      if (matches(r, f, "tag")) {
        all++;
        for (const k of r.tags) counts[k] = (counts[k] ?? 0) + 1;
      }
    const keys = TAGS.map((t) => t.k)
      .filter((k) => counts[k] || k === f.tag)
      .sort((a, b) => Number(!!TAG[b].grow) - Number(!!TAG[a].grow) || (counts[b] ?? 0) - (counts[a] ?? 0));
    return { all, items: keys.map((k) => ({ k, n: counts[k] ?? 0 })) };
  }, [recipes, f]);

  const selects = useMemo(() => {
    const p: Record<string, number> = {};
    const b: Partial<Record<BookKey, number>> = {};
    for (const r of recipes) {
      if (matches(r, f, "place")) {
        const k = r.placeKey || "none";
        p[k] = (p[k] ?? 0) + 1;
      }
      if (matches(r, f, "book")) b[r.book] = (b[r.book] ?? 0) + 1;
    }
    const places = Object.keys(p)
      .filter((k) => k !== "none")
      .sort((a, z) => {
        const as = a.split("|")[1];
        const zs = z.split("|")[1];
        return (
          (as === "West Virginia" ? 0 : 1) - (zs === "West Virginia" ? 0 : 1) || p[z] - p[a] || a.localeCompare(z)
        );
      })
      .map((k) => ({ v: k, label: placeLabel(k), n: p[k] }));
    if (p.none) places.push({ v: "none", label: "Hometown not printed", n: p.none });
    if (f.place && !places.some((x) => x.v === f.place))
      places.push({ v: f.place, label: f.place === "none" ? "Hometown not printed" : placeLabel(f.place), n: 0 });
    const books = BOOK_KEYS.filter((k) => b[k] || k === f.book).map((k) => ({
      v: k,
      label: BOOKS[k].name + (BOOKS[k].year ? ` (${BOOKS[k].year})` : ""),
      n: b[k] ?? 0,
    }));
    return { places, books };
  }, [recipes, f]);

  const groups = useMemo(() => {
    const g: Partial<Record<Course, RecipeSummary[]>> = {};
    for (const r of list) (g[r.category] ??= []).push(r);
    return COURSE_ORDER.filter((c) => g[c]).map((c) => ({ course: c, items: g[c] as RecipeSummary[] }));
  }, [list]);

  const filtered = Boolean(f.q || f.tag || f.course || f.place || f.book);

  return (
    <>
      <section className="shop-subheader" aria-label="Nut and fruit dishes">
        <div className="shop-subheader__inner">
          {head}
          <nav className="shop-subheader__nav" aria-label="Courses">
        <ul role="list">
          {pills.map((p) => {
            const on = f.course === p.v;
            return (
              <li key={p.v || "all"}>
                <a
                  href={`/recipes${toQuery({ ...f, course: p.v })}`}
                  className={`shop-subheader__pill${on ? " is-active" : ""}`}
                  aria-current={on ? "true" : undefined}
                  onClick={(e) => onFacetClick(e, { ...f, course: p.v })}
                >
                  {p.label} <span className="n">{p.n}</span>
                </a>
              </li>
            );
          })}
        </ul>
          </nav>
        </div>
      </section>
      <div className="finder">
        <nav className="cat-bar" aria-label="Cook with a nut or fruit">
          <span className="cat-bar__label">Cook with</span>
          <a
            href={`/recipes${toQuery({ ...f, tag: "" })}`}
            className={f.tag === "" ? "is-active" : ""}
            aria-current={f.tag === "" ? "true" : undefined}
            onClick={(e) => onFacetClick(e, { ...f, tag: "" })}
          >
            Everything · {cookWith.all}
          </a>
          {cookWith.items.map(({ k, n }) => {
            const on = f.tag === k;
            const next = { ...f, tag: on ? ("" as const) : k };
            return (
              <a
                key={k}
                href={`/recipes${toQuery(next)}`}
                className={on ? "is-active" : ""}
                aria-current={on ? "true" : undefined}
                onClick={(e) => onFacetClick(e, next)}
              >
                {TAG[k].grow ? <span className="dot" aria-hidden="true" /> : null}
                {TAG[k].label} · {n}
                {TAG[k].grow ? <span className="sr"> (grown at the Grove)</span> : null}
              </a>
            );
          })}
          {/* A plain <a>, not <Link>: this route handler redirects off-site, so it
              needs a full navigation rather than a client-side RSC fetch. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/recipes/trees/nursery">Trees at the nursery <GlyphIcon name="arrow-right" />
          </a>
        </nav>
        <div className="toolbar">
          <div className="page-wrap">
            <label className="search">
              <span className="sr">Search recipes</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 21 21" />
              </svg>
              <input
                type="search"
                placeholder="Search a dish, ingredient, cook, or town"
                autoComplete="off"
                value={qInput}
                onChange={(e) => onSearch(e.target.value)}
              />
            </label>
            <label className="sel">
              <span className="sr">Hometown</span>
              <select value={f.place} onChange={(e) => apply({ ...f, place: e.target.value })}>
                <option value="">Every hometown</option>
                {selects.places.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label} ({o.n})
                  </option>
                ))}
              </select>
            </label>
            <label className="sel">
              <span className="sr">Cookbook</span>
              <select value={f.book} onChange={(e) => apply({ ...f, book: e.target.value as BookKey | "" })}>
                <option value="">Every cookbook</option>
                {selects.books.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label} ({o.n})
                  </option>
                ))}
              </select>
            </label>
            <div className="status" aria-live="polite">
              <span>
                {list.length} of {recipes.length} recipes
              </span>
              {filtered ? (
                <button
                  type="button"
                  onClick={() => {
                    setQInput("");
                    apply(EMPTY);
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <section className="index page-wrap" aria-label="Recipes">
        {groups.length === 0 ? (
          <div className="empty">
            <h2>Nothing matches that yet.</h2>
            <p>Try a different word or clear a filter.</p>
          </div>
        ) : (
          groups.map(({ course, items }) => (
            <section className="course" key={course} aria-labelledby={courseId(course)}>
              <div className="course-head">
                <h2 id={courseId(course)}>{course}</h2>
                <span>
                  {items.length} {items.length === 1 ? "recipe" : "recipes"}
                </span>
              </div>
              <div className="recipe-grid">
                {items.map((r) => (
                  <RecipeCard key={r.id} r={r} />
                ))}
              </div>
            </section>
          ))
        )}
      </section>
      <RuleSnap version={toQuery(f)} />
    </>
  );
}
