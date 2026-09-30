import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { siblingSitesForHost } from "@grove/ui";

import { LinksTipJar } from "../../components/links/LinksTipJar";
import { TrackedLink } from "../../components/links/TrackedLink";
import {
  ALLIANCE_CANONICAL,
  SOCIAL_LABELS,
  type SocialKind,
  ALLIANCE_INTRO,
  allianceJsonLd,
  allianceMembers,
  allianceSections,
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

// 24×24 stroke icons (currentColor), matching the card arrow's line weight.
const SOCIAL_ICONS: Record<SocialKind, React.ReactNode> = {
  facebook: <path d="M15 4h-2.5A3.5 3.5 0 0 0 9 7.5V10H7v3h2v7h3v-7h2.5l.5-3H12V8a1 1 0 0 1 1-1h2z" />,
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
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </>
  ),
  etsy: (
    <>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
};

export default async function AlliancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const host = (await headers()).get("host");
  const source = normalizeSource((await searchParams).utm_source);
  const sections = allianceSections(allianceMembers(siblingSitesForHost(host)));
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
        <h1>At the Grove</h1>
        <p>{ALLIANCE_INTRO}</p>
      </header>

      {sections.map((section) => (
      <section
        key={section.key}
        className="hub-links__farms"
        aria-labelledby={section.heading ? `hub-links-${section.key}` : undefined}
        aria-label={section.heading ? undefined : "Gather at the Grove"}
      >
        {section.heading && (
          <h2 id={`hub-links-${section.key}`} className="hub-links__eyebrow">
            {section.heading}
          </h2>
        )}
        {section.members.map((m) => (
          <div key={m.key} className={`hub-links__farm hub-links__farm--${m.key}`}>
          <TrackedLink className="hub-links__farm-main" href={withUtm(m.href, source)} track={m.key} source={source}>
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
          {m.socials.length > 0 && (
            <ul className="hub-links__farm-social" aria-label={`${m.title} elsewhere`}>
              {m.socials.map((s) => (
                <li key={s.kind}>
                  <TrackedLink
                    href={s.href}
                    rel="noopener"
                    aria-label={`${m.title} on ${SOCIAL_LABELS[s.kind]}`}
                    track={`${m.key}_${s.kind}`}
                    source={source}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {SOCIAL_ICONS[s.kind]}
                    </svg>
                  </TrackedLink>
                </li>
              ))}
            </ul>
          )}
          </div>
        ))}
      </section>
      ))}

      {tips && <LinksTipJar options={tips} source={source} />}

      <footer className="hub-links__footer">gatheringatthegrove.com</footer>
    </main>
  );
}
