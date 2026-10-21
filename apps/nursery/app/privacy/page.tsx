import type { Metadata } from "next";
import { PrivacyNotice } from "@grove/ui-kit";
import { CategoryBar } from "../category-bar";
import { tenantConfig } from "../../tenant.config";

// At The Grove Nursery — /privacy (GOL-3456). The notice itself is the shared
// `PrivacyNotice` from @grove/ui-kit (one notice for every Grove site, Josh
// 2026-10-20 draft); this page only adds the nursery chrome and leads the
// opening line with this brand's name. Linked from every capture form's fine
// print and from the footer.
export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "What At The Grove Nursery collects when you order, sign up for a newsletter, ask us a question or browse, why we collect it, and what you can do about it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <CategoryBar />
      <section className="section">
        <PrivacyNotice brandName={tenantConfig.name} />
      </section>
    </>
  );
}
