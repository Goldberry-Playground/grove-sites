import type { TenantConfig, Product, Cart, Order, OdooClient } from "./types";

/**
 * Call the Odoo 19 JSON-RPC /json2 endpoint.
 */
async function rpc(
  config: TenantConfig,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {}
): Promise<unknown> {
  const url = `${config.odooUrl}/json2`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "call",
      params: {
        model,
        method,
        args,
        kwargs,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Odoo RPC error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    result?: unknown;
    error?: { message: string; data?: { message: string } };
  };

  if (data.error) {
    throw new Error(
      `Odoo error: ${data.error.data?.message ?? data.error.message}`
    );
  }

  return data.result;
}

/**
 * Create a typed Odoo client for a specific tenant.
 */
export function createOdooClient(config: TenantConfig): OdooClient {
  return {
    products: {
      async list(params) {
        const result = await rpc(
          config,
          "product.template",
          "search_read",
          [],
          {
            domain: params?.categoryId
              ? [["categ_id", "=", params.categoryId]]
              : [],
            fields: [
              "id",
              "name",
              "website_slug",
              "description_sale",
              "list_price",
              "currency_id",
              "image_1920",
              "categ_id",
              "qty_available",
            ],
            limit: params?.limit ?? 40,
            offset: params?.offset ?? 0,
          }
        );
        return result as Product[];
      },

      async get(id) {
        const result = await rpc(
          config,
          "product.template",
          "search_read",
          [],
          {
            domain: [["id", "=", id]],
            fields: [
              "id",
              "name",
              "website_slug",
              "description_sale",
              "list_price",
              "currency_id",
              "image_1920",
              "categ_id",
              "qty_available",
              "product_variant_ids",
            ],
            limit: 1,
          }
        );
        const records = result as Product[];
        if (!records.length) {
          throw new Error(`Product ${id} not found`);
        }
        return records[0];
      },
    },

    cart: {
      async get() {
        const result = await rpc(
          config,
          "sale.order",
          "get_current_cart",
          [],
          {}
        );
        return result as Cart;
      },

      async addItem(productId, quantity = 1, variantId) {
        const result = await rpc(
          config,
          "sale.order",
          "add_to_cart",
          [],
          {
            product_id: productId,
            quantity,
            variant_id: variantId ?? null,
          }
        );
        return result as Cart;
      },
    },

    orders: {
      async create(cartId) {
        const result = await rpc(
          config,
          "sale.order",
          "action_confirm",
          [cartId],
          {}
        );
        return result as Order;
      },
    },
  };
}
