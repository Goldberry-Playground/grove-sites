import { describe, it, expect } from "vitest";
// scripts/mobile-matrix.mjs exports auditPage behind a CLI run-guard, so this
// imports cleanly without launching the matrix. The function normally runs
// inside headless Chromium; here we feed it a synthetic DOM (geometry injected
// per element) and assert the tap-target logic directly — GOL-3823.
// @ts-expect-error — .mjs gate script, intentionally untyped
import { auditPage } from "../scripts/mobile-matrix.mjs";

const CHECKS = {
  overflow: { tolerancePx: 1 },
  tapTargets: { errorPx: 24, warnPx: 44 },
  textSize: { minLegiblePx: 12, minLegibleShare: 0.6 },
  fixedChrome: { maxFraction: 0.35 },
  mobile: true,
  maxItems: 12,
};

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Opts = {
  tag?: string;
  id?: string;
  type?: string;
  classList?: string[];
  text?: string;
  childNodes?: unknown[];
  attrs?: Record<string, string>;
  style?: Record<string, string>;
  rect?: Rect;
  control?: boolean;
};

function rect(left: number, top: number, width: number, height: number): Rect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function makeEl(opts: Opts = {}): any {
  const el: any = {
    tagName: (opts.tag || "a").toUpperCase(),
    id: opts.id || "",
    type: opts.type || "",
    classList: opts.classList || [],
    textContent: opts.text || "",
    childNodes: opts.childNodes || [],
    parentElement: null,
    _attrs: opts.attrs || {},
    _style: {
      display: "block",
      visibility: "visible",
      opacity: "1",
      clip: "auto",
      position: "static",
      fontSize: "16px",
      ...(opts.style || {}),
    },
    _rect: opts.rect || rect(0, 0, 0, 0),
    control: opts.control !== false,
  };
  el.getBoundingClientRect = () => el._rect;
  el.getAttribute = (n: string) => (n in el._attrs ? el._attrs[n] : null);
  const matchSel = (node: any, sel: string) => {
    if (sel === "label") return node.tagName === "LABEL";
    if (sel === '[aria-hidden="true"]') return node._attrs["aria-hidden"] === "true";
    return false;
  };
  el.closest = (sel: string) => {
    let node: any = el;
    while (node) {
      if (matchSel(node, sel)) return node;
      node = node.parentElement;
    }
    return null;
  };
  return el;
}

function installDom(elements: any[], { vw = 375, vh = 812, scrollWidth = 375 } = {}) {
  const all = elements;
  const controls = elements.filter((e) => e.control);
  const body = { querySelectorAll: (sel: string) => (sel === "*" ? all : controls) };
  const g = globalThis as any;
  g.window = { innerWidth: vw, innerHeight: vh };
  g.document = {
    body,
    documentElement: { scrollWidth },
    querySelector: (sel: string) => {
      if (sel === 'meta[name="viewport"]') {
        return { getAttribute: () => "width=device-width, initial-scale=1" };
      }
      const m = sel.match(/^label\[for="(.+)"\]$/);
      if (m) return all.find((e) => e.tagName === "LABEL" && e._attrs.for === m[1]) || null;
      return null;
    },
    querySelectorAll: (sel: string) => (sel === "*" ? all : controls),
    createTreeWalker: () => {
      let i = -1;
      return { nextNode: () => (++i < all.length ? all[i] : null) };
    },
  };
  g.getComputedStyle = (e: any) => e._style;
  g.NodeFilter = { SHOW_ELEMENT: 1 };
  g.CSS = { escape: (s: string) => s };
}

const errorEls = (f: any): string[] => f.tapTargets.errors.map((e: any) => e.el);
const warnEls = (f: any): string[] => f.tapTargets.warns.map((e: any) => e.el);

describe("mobile-matrix auditPage tap targets (GOL-3823)", () => {
  it("excludes the honeypot (off-canvas, aria-hidden, tabindex=-1); real crowded footer links still error", () => {
    const hpWrapper = makeEl({ tag: "div", control: false, attrs: { "aria-hidden": "true" }, rect: rect(-9999, 0, 1, 1) });
    const honeypot = makeEl({
      tag: "input",
      type: "text",
      id: "grove-capture-company",
      attrs: { tabindex: "-1" },
      rect: rect(-9999, 0, 1, 1),
    });
    honeypot.parentElement = hpWrapper;

    // Two real footer links stacked 20px apart — crowded, so not spacing-exempt.
    const footerA = makeEl({ tag: "a", text: "Terms", attrs: { href: "/terms" }, rect: rect(0, 100, 343, 19) });
    const footerB = makeEl({ tag: "a", text: "Privacy", attrs: { href: "/privacy" }, rect: rect(0, 120, 343, 19) });

    installDom([hpWrapper, honeypot, footerA, footerB]);
    const f = auditPage(CHECKS);

    expect(errorEls(f).some((e) => e.includes("grove-capture-company"))).toBe(false);
    expect(warnEls(f).some((e) => e.includes("grove-capture-company"))).toBe(false);
    expect(f.tapTargets.errorTotal).toBe(2);
    expect(errorEls(f).some((e) => e.includes("Terms"))).toBe(true);
    expect(errorEls(f).some((e) => e.includes("Privacy"))).toBe(true);
  });

  it("WCAG 2.5.8 spacing exemption: an isolated sub-24px target is a warning, not an error", () => {
    const icon = makeEl({ tag: "button", text: "menu", rect: rect(0, 0, 20, 20) });
    const farBig = makeEl({ tag: "button", text: "Shop", rect: rect(200, 200, 48, 48) });

    installDom([icon, farBig]);
    const f = auditPage(CHECKS);

    expect(f.tapTargets.errorTotal).toBe(0);
    expect(f.tapTargets.warnTotal).toBe(1);
    expect(warnEls(f)[0]).toContain("menu");
  });

  it("no spacing exemption when a small target is crowded by a full-size one", () => {
    // icon's 24px circle (centre 10,10) overlaps the neighbour's box at x=18.
    const icon = makeEl({ tag: "button", text: "menu", rect: rect(0, 0, 20, 20) });
    const neighbor = makeEl({ tag: "button", text: "Shop", rect: rect(18, 0, 48, 48) });

    installDom([icon, neighbor]);
    const f = auditPage(CHECKS);

    expect(f.tapTargets.errorTotal).toBe(1);
    expect(errorEls(f)[0]).toContain("menu");
  });

  it("sr-only (1×1), tabindex=-1 and aria-hidden controls are excluded even on-canvas", () => {
    const srOnly = makeEl({ tag: "a", text: "Skip to content", attrs: { href: "#main" }, rect: rect(0, 0, 1, 1) });
    const notTabbable = makeEl({ tag: "button", text: "ghost", attrs: { tabindex: "-1" }, rect: rect(0, 50, 20, 20) });
    const hidden = makeEl({ tag: "button", text: "decorative", attrs: { "aria-hidden": "true" }, rect: rect(0, 100, 20, 20) });

    installDom([srOnly, notTabbable, hidden]);
    const f = auditPage(CHECKS);

    expect(f.tapTargets.errorTotal).toBe(0);
    expect(f.tapTargets.warnTotal).toBe(0);
  });

  it("a checkbox is measured by its wrapping label, not the 18px box", () => {
    const label = makeEl({ tag: "label", control: false, text: "I agree", rect: rect(0, 0, 200, 44) });
    const box = makeEl({ tag: "input", type: "checkbox", rect: rect(4, 13, 18, 18) });
    box.parentElement = label;

    installDom([box]);
    const f = auditPage(CHECKS);

    expect(f.tapTargets.errorTotal).toBe(0);
    expect(f.tapTargets.warnTotal).toBe(0);
  });
});
