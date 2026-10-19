"use client";

import { useEffect } from "react";

/**
 * Put every text row of every `.rc-face` ON a rule. Reset, then read all
 * baselines, then write all shifts (no layout thrash). A rule's top edge sits
 * at k·L − 1 from the card top. Purely cosmetic: without JS the text simply
 * floats between rules.
 */
export function snapRules(root: ParentNode = document) {
  const faces = [...root.querySelectorAll<HTMLElement>(".rc-face")];
  const rows = faces.flatMap((f) => [...f.querySelectorAll<HTMLElement>("[data-rule]")].map((el) => ({ f, el })));
  for (const { el } of rows) el.style.transform = "";
  const shifts = rows.map(({ f, el }) => {
    const fr = f.getBoundingClientRect();
    if (!fr.height) return null;
    const L = parseFloat(getComputedStyle(el).lineHeight);
    const probe = el.querySelector("i.bl");
    if (!probe || !L) return null;
    const baseline = probe.getBoundingClientRect().bottom - fr.top;
    const maxK = Math.floor(fr.height / L);
    const k = Math.min(Math.max(Math.round((baseline + 1) / L), 1), maxK);
    return k * L - 1 - baseline;
  });
  rows.forEach(({ el }, i) => {
    const s = shifts[i];
    if (s != null) el.style.transform = `translateY(${s.toFixed(2)}px)`;
  });
}

/** Snaps on mount, after web fonts load, on resize, and whenever `version` changes. */
export function RuleSnap({ version }: { version?: string | number }) {
  useEffect(() => {
    let raf = 0;
    const soon = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => snapRules());
    };
    soon();
    document.fonts?.ready.then(soon);
    window.addEventListener("resize", soon);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", soon);
    };
  }, [version]);
  return null;
}
