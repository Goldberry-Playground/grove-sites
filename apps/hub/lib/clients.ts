import "server-only";

import { createOdooClient, type OdooClient } from "@grove/odoo-client";
import type { Vendor } from "../data/marketplace";

/**
 * Create an OdooClient scoped to a specific vendor (matching the right tenant
 * via the X-Grove-Tenant header). Hub-side only — never imported by client code.
 */
export function clientForVendor(vendor: Vendor): OdooClient {
  return createOdooClient({
    tenantId: vendor.odoo.tenantSlug,
    odooUrl: vendor.odoo.apiUrl,
  });
}
