export type {
  TenantConfig,
  Product,
  ProductVariant,
  GrowingFacts,
  ProductImage,
  ShippingTier,
  ProductListResult,
  Cart,
  CartItem,
  OdooClient,
  Address,
  Contact,
  OrderItemInput,
  OrderCreateInput,
  OrderSummary,
  OrderLine,
  OrderDetail,
} from "./types";
export { createOdooClient } from "./client";
export { resolveOdooImageUrl } from "./images";
