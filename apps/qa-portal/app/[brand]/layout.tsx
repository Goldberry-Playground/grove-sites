import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isBrand } from "../lib/brands";
import { BrandSwitcher } from "../components/BrandSwitcher";

export default async function BrandLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  if (!isBrand(brand)) notFound();
  return (
    <div className="portal">
      <header className="portal-header">
        <h1>Grove Component QA</h1>
        <BrandSwitcher active={brand} />
      </header>
      {children}
    </div>
  );
}
