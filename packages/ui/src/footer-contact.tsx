// Shared footer contact block — phone + optional support email, rendered as
// an accessible <address> with tel:/mailto: links. Phone formatting lives here
// so every site renders the same shape from the raw digits in tenant.config.
// Links use `color: inherit` so the block reads correctly on each brand's
// footer background (dark chestnut, light bone, etc.) without per-app CSS.
// — GOL-2492
import type { CSSProperties } from "react";

export interface FooterContactProps {
  /** Raw digits, e.g. "4457875140". Non-digits are ignored. */
  phone: string;
  /** Support/orders email for this business. Omitted on the aggregator hub. */
  email?: string;
  className?: string;
}

/** "4457875140" -> "(445) 787-5140"; anything not 10 digits is passed through. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length !== 10) return phone;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const linkStyle: CSSProperties = { color: "inherit" };

export function FooterContact({ phone, email, className }: FooterContactProps) {
  const digits = phone.replace(/\D/g, "");
  return (
    <address className={className} style={{ fontStyle: "normal" }}>
      <a href={`tel:+1${digits}`} style={linkStyle}>
        {formatPhone(phone)}
      </a>
      {email ? (
        <>
          {" · "}
          <a href={`mailto:${email}`} style={linkStyle}>
            {email}
          </a>
        </>
      ) : null}
    </address>
  );
}
