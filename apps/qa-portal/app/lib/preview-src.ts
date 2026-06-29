import type { Brand } from "./brands";

/** Public URL of a component's self-contained preview HTML (relative asset loads resolve here). */
export function previewSrc(brand: Brand, component: string): string {
  return `/bundles/${brand}/components/general/${component}/${component}.html`;
}
