import type { Brand } from "./brands";

/** Public URL of a component's self-contained preview HTML (relative asset loads resolve here). */
export function previewSrc(brand: Brand, component: string): string {
  // "general" is the single group used in slice 1; parameterize if the
  // bundle spec adds more groups.
  return `/bundles/${brand}/components/general/${component}/${component}.html`;
}
