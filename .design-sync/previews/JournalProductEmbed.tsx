import { JournalProductEmbed } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

const walnutBoard = {
  name: "Live-Edge Black Walnut Serving Board",
  priceFormatted: "$148.00",
  imageUrl: "https://images.unsplash.com/photo-1606744888344-493238951221?w=600",
  href: "/marketplace/ggg/live-edge-walnut-board",
  vendorName: "George George George Woodworking",
};

const dahliaTubers = {
  name: "Café au Lait Dahlia Tubers",
  priceFormatted: "$9.00",
  imageUrl: "https://images.unsplash.com/photo-1597848212624-e19a3f6abeb1?w=600",
  href: "/marketplace/goldberry/cafe-au-lait-dahlia",
  vendorName: "Goldberry Grove Farm",
};

export const Inline = () => (
  <JournalProductEmbed product={walnutBoard} position="inline" accentColor="#3A2418" />
);

export const Sidebar = () => (
  <JournalProductEmbed
    product={dahliaTubers}
    position="sidebar"
    accentColor="#5A2A4B"
  />
);

export const Footer = () => (
  <JournalProductEmbed
    product={walnutBoard}
    position="footer"
    accentColor="#3A2418"
    caption="Featured in this story:"
  />
);
