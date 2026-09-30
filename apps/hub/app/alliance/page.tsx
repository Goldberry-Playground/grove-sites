import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { siblingSitesForHost } from "@grove/ui";

import { LinksTipJar } from "../../components/links/LinksTipJar";
import { TrackedLink } from "../../components/links/TrackedLink";
import {
  ALLIANCE_CANONICAL,
  ALLIANCE_INTRO,
  allianceJsonLd,
  allianceMembers,
  normalizeSource,
  tipOptions,
  withUtm,
} from "../../lib/alliance";

// The alliance directory + link-in-bio. Lives outside the (site) route group,
// so it renders without the hub chrome. /links redirects here (next.config.ts).
export const metadata: Metadata = {
  title: "The Alliance",
  description: ALLIANCE_INTRO,
  // Bio links arrive as /links?utm_source=… → one canonical, indexable URL.
  alternates: { canonical: ALLIANCE_CANONICAL },
  openGraph: {
    type: "website",
    url: ALLIANCE_CANONICAL,
    siteName: "Gather at the Grove",
    title: "The Alliance — Gather at the Grove",
    description: ALLIANCE_INTRO,
    images: [{ url: "https://gatheringatthegrove.com/photos/grove-walk.jpg", width: 1400, height: 1050 }],
  },
};

export default async function AlliancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const host = (await headers()).get("host");
  const source = normalizeSource((await searchParams).utm_source);
  const members = allianceMembers(siblingSitesForHost(host));
  const jsonLd = allianceJsonLd(allianceMembers(siblingSitesForHost(null)));
  const tips = tipOptions();

  return (
    <main className="hub-links">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="hub-links__hero">
        <Image
          src="/photos/grove-walk.jpg"
          alt="Friends and a white dog walking a gravel lane past the pond and young tree rows at the grove"
          fill
          priority
          sizes="(max-width: 440px) 100vw, 440px"
          className="hub-links__hero-photo"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
        <img
          className="hub-links__hero-logo"
          src="/brand/gather/gather-logo-primary-reversed.svg"
          alt="Gathering at the Grove"
          width={104}
          height={114}
        />
      </div>

      <header className="hub-links__intro">
        <span className="hub-links__eyebrow">New River Gorge · West Virginia</span>
        <h1>At the Grove</h1>
        <p>{ALLIANCE_INTRO}</p>
      </header>

      <section className="hub-links__farms" aria-labelledby="hub-links-farms-title">
        <h2 id="hub-links-farms-title" className="hub-links__eyebrow">
          The Alliance Members
        </h2>
        {members.map((m) => (
          <TrackedLink
            key={m.key}
            className={`hub-links__farm hub-links__farm--${m.key}`}
            href={withUtm(m.href, source)}
            track={m.key}
            source={source}
          >
            {m.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- 56px static logo tile
              <img className="hub-links__farm-logo" src={m.logo} alt={`${m.title} logo`} width={56} height={56} />
            ) : (
              <span className="hub-links__farm-logo hub-links__farm-logo--mono" aria-hidden="true">
                {m.monogram}
              </span>
            )}
            <span className="hub-links__farm-text">
              <strong>{m.title}</strong>
              <span>{m.blurb}</span>
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
