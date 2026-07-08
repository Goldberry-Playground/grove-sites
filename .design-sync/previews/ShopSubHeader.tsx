import { ShopSubHeader, type ShopCategory } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

const CATEGORIES: ShopCategory[] = [
  { id: "all", label: "All", href: "/shop" },
  { id: "flour", label: "Chestnut Flour", href: "/shop?cat=flour" },
  { id: "freeze-dried", label: "Freeze-Dried", href: "/shop?cat=freeze-dried" },
  { id: "jams", label: "Jams", href: "/shop?cat=jams" },
  { id: "kits", label: "Inoculation Kits", href: "/shop?cat=kits" },
];

const TITLE = (
  <>
    Small-batch goods <em>from the hillside</em>
  </>
);

const LEDE =
  "Chestnut flour, freeze-dried Appalachian fruit, jams, and inoculation kits — " +
  "rendered from what the grove grew this season.";

export const Default = () => (
  <ShopSubHeader
    eyebrow="The Goldberry Shop"
    title={TITLE}
    lede={LEDE}
    categories={CATEGORIES}
    activeHref="/shop"
  />
);

export const CategoryActive = () => (
  <ShopSubHeader
    eyebrow="The Goldberry Shop"
    title={TITLE}
    lede={LEDE}
    categories={CATEGORIES}
    activeHref="/shop?cat=jams"
  />
);

export const NoActive = () => (
  <ShopSubHeader
    eyebrow="The Goldberry Shop"
    title={TITLE}
    lede={LEDE}
    categories={CATEGORIES}
  />
);
