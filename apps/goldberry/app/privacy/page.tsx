import type { Metadata } from "next";
import { PrivacyNotice } from "@grove/ui-kit";
import { tenantConfig } from "../../tenant.config";
import { pageMetadata } from "../../lib/site-metadata";

// Goldberry Grove Farm — /privacy (GOL-3456). The notice itself is the shared
// `PrivacyNotice` from @grove/ui-kit (one notice for every Grove site, Josh
// 2026-10-20 draft); this page only adds the farm chrome and leads the
// opening line with this brand's name. Linked from every capture form's fine
// print and from the footer.
export const metadata: Metadata = pageMetadata({
  path: "/privacy",
  title: "Privacy notice — Goldberry Grove",
  description:
    "What Goldberry Grove Farm collects when you order, sign up for a newsletter, ask us a question or browse, why we collect it, and what you can do about it.",
});

export default function PrivacyPage() {
  return (
    <section className="privacy-page">
      <PrivacyNotice brandName={tenantConfig.name} />
    </section>
  );
}
