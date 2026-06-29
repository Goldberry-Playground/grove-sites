import { notFound } from "next/navigation";
import { BRANDS, isBrand } from "../lib/brands";
import { listComponents } from "../lib/bundle";
import { PreviewFrame } from "../components/PreviewFrame";

export function generateStaticParams() {
  return BRANDS.map((brand) => ({ brand }));
}

export default async function BrandGallery({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (!isBrand(brand)) notFound();
  const components = listComponents(brand);
  return (
    <main className="gallery">
      {components.map((component) => (
        <PreviewFrame key={component} brand={brand} component={component} />
      ))}
    </main>
  );
}
