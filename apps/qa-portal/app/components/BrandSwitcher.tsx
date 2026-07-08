import Link from "next/link";
import { BRANDS, BRAND_LABELS, type Brand } from "../lib/brands";

export function BrandSwitcher({ active }: { active: Brand }) {
  return (
    <nav className="brand-switcher" aria-label="Brand">
      {BRANDS.map((b) => (
        <Link key={b} href={`/${b}`} aria-current={b === active ? "page" : undefined}>
          {BRAND_LABELS[b]}
        </Link>
      ))}
    </nav>
  );
}
