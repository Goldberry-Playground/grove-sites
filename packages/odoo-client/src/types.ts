export interface TenantConfig {
  tenantId: string;
  odooUrl: string;
  apiKey: string;
  database?: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  categoryId: number | null;
  categoryName: string | null;
  available: boolean;
  variants: ProductVariant[];
}

export interface ProductVariant {
  id: number;
  name: string;
  price: number;
  sku: string;
  available: boolean;
}

export interface CartItem {
  id: number;
  productId: number;
  variantId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Cart {
  id: number;
  items: CartItem[];
  subtotal: number;
  currency: string;
}

export interface Order {
  id: number;
  name: string;
  status: "draft" | "sent" | "sale" | "done" | "cancel";
  items: CartItem[];
  total: number;
  currency: string;
  createdAt: string;
}

export interface OdooClient {
  products: {
    list(params?: { categoryId?: number; limit?: number; offset?: number }): Promise<Product[]>;
    get(id: number): Promise<Product>;
  };
  cart: {
    get(): Promise<Cart>;
    addItem(productId: number, quantity?: number, variantId?: number): Promise<Cart>;
  };
  orders: {
    create(cartId: number): Promise<Order>;
  };
}
