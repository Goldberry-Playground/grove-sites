import { CheckoutCancelPage } from "@grove/checkout";
import { tenantConfig } from "../../../tenant.config";

// Title is the LEFT side only — `app/layout.tsx` appends " | At The Grove
// Nursery" via `title.template` (GOL-2878). Repeating the brand here renders it
// twice.
export const metadata = { title: "Payment Canceled" };

export default function Page() {
  return <CheckoutCancelPage />;
}
