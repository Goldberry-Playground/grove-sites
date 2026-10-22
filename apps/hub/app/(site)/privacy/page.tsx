import type { Metadata } from "next";
import { PrivacyNotice } from "@grove/ui-kit";
import { pageMetadata } from "../../../lib/site-metadata";

// Gather at the Grove — /privacy (GOL-3456). The notice itself is the shared
// `PrivacyNotice` from @grove/ui-kit (one notice for every Grove site, Josh
// 2026-10-20 draft); this page only adds the hub chrome and leads the opening
// line with the hub's name as the draft spells it. Linked from the footer
// signup form's fine print and from the footer.
export const metadata: Metadata = pageMetadata({
  path: "/privacy",
  title: "Privacy notice",
  description:
    "What Gathering at the Grove collects when you sign up for the Grove Digest, ask us a question or browse, why we collect it, and what you can do about it.",
});

export default function PrivacyPage() {
  return (
    <main className="hub-privacy">
      <PrivacyNotice brandName="Gathering at the Grove" />
    </main>
  );
}
