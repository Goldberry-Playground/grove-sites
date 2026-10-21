/**
 * Grove privacy notice (GOL-3456). ONE notice is shared by every Grove site;
 * each app mounts it at `/privacy` with its own brand name leading the opening
 * line. Copy is Josh's 2026-10-20 draft, rendered verbatim: plain language, no
 * em dashes, nothing exaggerated. Not legal advice; a lawyer pass before launch
 * is cheap insurance (analytics line, future state-law thresholds).
 *
 * Server-safe: no hooks, no browser APIs, plain anchors (every link is an
 * in-page anchor or a mailto/tel), so it renders in a Server Component and in
 * Claude Design alike.
 */

/** The four Grove brands, in the order the draft lists them. */
export const GROVE_BRAND_NAMES = [
  "Gathering at the Grove",
  "Goldberry Grove Farm",
  "At The Grove Nursery",
  "George George George Woodworking",
] as const;

/** CAN-SPAM postal address, the same for every brand (Josh 2026-10-20). */
export const GROVE_POSTAL_ADDRESS = {
  name: "Goldberry Grove Farm",
  street: "2291 Armstrong Road",
  locality: "Summersville, WV 26651",
} as const;

export const GROVE_PRIVACY_EMAIL = "sales@goldberrygrove.farm";
export const GROVE_PRIVACY_PHONE = { display: "(445) 787-5140", href: "tel:+14457875140" } as const;

export interface PrivacyNoticeProps {
  /** This site's customer-facing brand name, leading the opening line. */
  brandName: string;
  /**
   * "Last updated" line. Month granularity is deliberate: the notice is
   * approved as a draft and goes live with a release train, so an exact day
   * would be a guess. Bump it when the wording changes.
   */
  lastUpdated?: string;
  className?: string;
}

const joinNames = (names: readonly string[]) =>
  names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export function PrivacyNotice({
  brandName,
  lastUpdated = "October 2026",
  className = "",
}: PrivacyNoticeProps) {
  const others = GROVE_BRAND_NAMES.filter((n) => n !== brandName);
  return (
    <article className={`grove-privacy ${className}`.trim()}>
      <header className="grove-privacy__header">
        <h1 className="grove-privacy__title">Privacy notice</h1>
        <p className="grove-privacy__updated">Last updated: {lastUpdated}</p>
      </header>

      <p className="grove-privacy__lede">
        {brandName} is one of four Grove websites. {joinNames([brandName, ...others])} are run
        by the same family from one farm in Summersville, West Virginia. This page explains what
        we collect when you use any of our websites, why we collect it, and what you can do about
        it.
      </p>

      <nav className="grove-privacy__toc" aria-label="On this page">
        <a href="#what-we-collect">What we collect</a>
        <a href="#why-we-use-it">Why we use it</a>
        <a href="#who-helps-us">Who helps us</a>
        <a href="#your-choices">Your choices</a>
        <a href="#children">Children</a>
        <a href="#changes">Changes</a>
        <a href="#contact-us">Contact us</a>
      </nav>

      <section id="what-we-collect" className="grove-privacy__section">
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>When you order:</strong> your name, email, phone, shipping and billing
            address, and what you bought. Card details go straight to Stripe, our payment
            processor. We never see or store your full card number.
          </li>
          <li>
            <strong>When you sign up for a newsletter:</strong> your email address, which
            newsletters you picked, which page you signed up on, and when.
          </li>
          <li>
            <strong>When you ask us something</strong> (wholesale, a planting consult, a farm
            visit, a ship-to-state waitlist, or a back-in-stock alert): your name, email, and
            whatever you write in the form.
          </li>
          <li>
            <strong>When you browse:</strong> basic visit data such as pages viewed, rough
            location from your IP address, browser type, and page load speed. We use it to see
            what&apos;s working and to fix slow or broken pages. We don&apos;t use advertising
            trackers and we don&apos;t sell this data.
          </li>
        </ul>
      </section>

      <section id="why-we-use-it" className="grove-privacy__section">
        <h2>Why we use it</h2>
        <ul>
          <li>
            To fill and ship your order, send receipts and shipping updates, and handle returns
            or warranty questions.
          </li>
          <li>
            To send the newsletters you chose. Every newsletter has an unsubscribe link at the
            bottom.
          </li>
          <li>To answer the question you asked us.</li>
          <li>To keep the sites working and secure.</li>
        </ul>
        <p>
          We don&apos;t sell or rent your information, and we don&apos;t share it with anyone
          for their own marketing.
        </p>
      </section>

      <section id="who-helps-us" className="grove-privacy__section">
        <h2>Who helps us</h2>
        <p>
          We use a small number of service providers, and they only get what they need to do
          their job:
        </p>
        <ul>
          <li>
            <strong>Stripe</strong> processes payments.
          </li>
          <li>
            <strong>Mailgun</strong> delivers our email.
          </li>
          <li>
            <strong>UPS and USPS</strong> (through Pirate Ship) get your name and address to
            deliver your trees.
          </li>
          <li>
            <strong>Printify</strong> gets your name and address if you order a printed shirt,
            so they can print and ship it.
          </li>
          <li>
            <strong>Cloudflare and DigitalOcean</strong> host and protect our websites.
          </li>
          <li>
            <strong>Google Workspace</strong> carries our everyday email with you.
          </li>
        </ul>
        <p>
          Our customer and subscriber records live in our own system (Odoo), which we run
          ourselves.
        </p>
      </section>

      <section id="your-choices" className="grove-privacy__section">
        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>Unsubscribe</strong> from any newsletter with the link at the bottom of any
            issue, or by replying to ask us.
          </li>
          <li>
            <strong>See, correct or delete</strong> what we hold about you: email{" "}
            <a href={`mailto:${GROVE_PRIVACY_EMAIL}`}>{GROVE_PRIVACY_EMAIL}</a> and we&apos;ll
            take care of it within 30 days. We keep order records as long as tax law requires,
            even after you ask us to delete the rest.
          </li>
          <li>
            <strong>Cookies:</strong> our sites use only the cookies needed to run your cart and
            checkout. You can block cookies in your browser, but checkout won&apos;t work
            without them.
          </li>
        </ul>
      </section>

      <section id="children" className="grove-privacy__section">
        <h2>Children</h2>
        <p>
          Our sites are not meant for children under 13, and we don&apos;t knowingly collect
          their information.
        </p>
      </section>

      <section id="changes" className="grove-privacy__section">
        <h2>Changes</h2>
        <p>
          If we change this notice, we&apos;ll update the date at the top. If a change is
          significant, we&apos;ll say so in our newsletters.
        </p>
      </section>

      <section id="contact-us" className="grove-privacy__section">
        <h2>Contact us</h2>
        <address className="grove-privacy__address">
          {GROVE_POSTAL_ADDRESS.name}
          <br />
          {GROVE_POSTAL_ADDRESS.street}
          <br />
          {GROVE_POSTAL_ADDRESS.locality}
          <br />
          <a href={`mailto:${GROVE_PRIVACY_EMAIL}`}>{GROVE_PRIVACY_EMAIL}</a> ·{" "}
          <a href={GROVE_PRIVACY_PHONE.href}>{GROVE_PRIVACY_PHONE.display}</a>
        </address>
      </section>
    </article>
  );
}
