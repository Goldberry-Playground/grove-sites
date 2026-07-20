import { CheckoutCancelPage } from "@grove/checkout";
import { tenantConfig } from "../../../tenant.config";

export const metadata = { title: `Payment Canceled — ${tenantConfig.name}` };

export default function Page() {
  return <CheckoutCancelPage />;
}
