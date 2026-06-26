import { ProductCard } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

const heirloomTomatoes = {
  name: "Brandywine Heirloom Tomatoes",
  priceFormatted: "$6.50",
  imageUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600",
  href: "/marketplace/goldberry/brandywine-heirloom-tomatoes",
  vendorName: "Goldberry Grove Farm",
};

const walnutBoard = {
  name: "Live-Edge Black Walnut Serving Board",
  priceFormatted: "$148.00",
  imageUrl: "https://images.unsplash.com/photo-1606744888344-493238951221?w=600",
  href: "/marketplace/ggg/live-edge-walnut-board",
  vendorName: "George George George Woodworking",
};

const fernStarter = {
  name: "Lady Fern Starter (4\" pot)",
  priceFormatted: "$12.00",
  imageUrl: null,
  href: "/marketplace/nursery/lady-fern-starter",
  vendorName: "At The Grove Nursery",
};

export const Default = () => <ProductCard product={heirloomTomatoes} />;

export const WithAccent = () => (
  <ProductCard product={walnutBoard} accentColor="#3A2418" />
);

export const WithEditorialNote = () => (
  <ProductCard
    product={heirloomTomatoes}
    accentColor="#5A2A4B"
    editorialNote="The tomato that ruins you for grocery-store ones forever."
  />
);

export const NoImage = () => (
  <ProductCard product={fernStarter} accentColor="#1F3F2B" />
);
