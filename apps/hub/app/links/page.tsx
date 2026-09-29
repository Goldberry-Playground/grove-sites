import type { Metadata } from "next";
import { headers } from "next/headers";
import { siblingSitesForHost } from "@grove/ui";

import { LinksTipJar } from "../../components/links/LinksTipJar";
import { TrackedLink } from "../../components/links/TrackedLink";
import { SOCIAL_LINKS, farmLinks, normalizeSource, tipOptions, withUtm } from "../../lib/links";

// Self-hosted link-in-bio (replaces hopp.bio/goldberry). Lives outside the
// (site) route group, so it renders without the hub chrome.
export const metadata: Metadata = {
  title: "Links",
  description:
    "Goldberry Grove — regenerative nut orchard & nursery in the New River Gorge. Our village, our trees, and our U-pick orchard.",
};

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" />
    </>
  ),
  threads: (
    <path d="M17 8.5C16 5.5 13.8 4 11.5 4 7.5 4 5 7.2 5 12s2.5 8 6.8 8c3.2 0 5.7-1.8 5.7-4.6 0-2.5-2-4-5-4-2.3 0-3.8 1.1-3.8 2.7 0 1.4 1.2 2.3 2.8 2.3 2.8 0 4-2.3 4-6.4" />
  ),
  discord: (
    <>
      <path d="M7 7.5c3.3-1.3 6.7-1.3 10 0l1.8 8.5c-1.6 1.3-3.3 2-5 2.3l-.8-1.6M7 7.5L5.2 16c1.6 1.3 3.3 2 5 2.3l.8-1.6" />
      <circle cx="9.5" cy="12.5" r="1" />
      <circle cx="14.5" cy="12.5" r="1" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
};

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const host = (await headers()).get("host");
  const source = normalizeSource((await searchParams).utm_source);
  const farms = farmLinks(siblingSitesForHost(host));
  const tips = tipOptions();

  return (
    <main className="hub-links">
      <div className="hub-links__hero">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
        <img src="/brand/gather/gather-logo-primary-reversed.svg" alt="Gathering at the Grove" width={132} height={144} />
      </div>

      <header className="hub-links__intro">
        <span className="hub-links__eyebrow">New River Gorge · West Virginia</span>
        <h1>Goldberry Grove</h1>
        <p>
          A regenerative nut orchard &amp; nursery, and the village growing up around it —
          rewilding an Appalachian hillside one tree at a time.
        </p>
      </header>

      <nav className="hub-links__social" aria-label="Social">
        {SOCIAL_LINKS.map((s) => (
          <TrackedLink key={s.key} href={s.href} aria-label={s.label} track={s.key} source={source} rel="noopener">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {SOCIAL_ICONS[s.key]}
            </svg>
          </TrackedLink>
        ))}
      </nav>

      <section className="hub-links__farms" aria-labelledby="hub-links-farms-title">
        <span id="hub-links-farms-title" className="hub-links__eyebrow">The three farms</span>
        {farms.map((f) => (
          <TrackedLink
            key={f.key}
            className={`hub-links__farm hub-links__farm--${f.key}`}
            href={withUtm(f.href, source)}
            track={f.key}
            source={source}
          >
            <span className="hub-links__farm-text">
              <strong>{f.title}</strong>
              <span>{f.blurb}</span>
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </TrackedLink>
        ))}
      </section>

      {tips && <LinksTipJar options={tips} source={source} />}

      <footer className="hub-links__footer">gatheringatthegrove.com</footer>
    </main>
  );
}
