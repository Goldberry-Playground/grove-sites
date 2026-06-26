import { CategoryBar, type CategoryBarItem } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

const ALL: CategoryBarItem = { slug: "all", label: "All Catalog", href: "/shop", count: 86 };

const ITEMS: CategoryBarItem[] = [
  { slug: "apple", label: "Apple", href: "/shop?cat=apple", count: 18 },
  { slug: "pear", label: "Pear", href: "/shop?cat=pear", count: 9 },
  { slug: "stone-fruit", label: "Stone Fruit", href: "/shop?cat=stone-fruit", count: 14 },
  { slug: "berries", label: "Berries", href: "/shop?cat=berries", count: 11 },
  { slug: "nuts", label: "Nuts", href: "/shop?cat=nuts", count: 7 },
  { slug: "rootstock", label: "Rootstock", href: "/shop?cat=rootstock", count: 12 },
  { slug: "bare-root", label: "Bare-Root", href: "/shop?cat=bare-root", count: 15 },
];

const WHOLESALE = { label: "Wholesale", href: "/wholesale" };

export const Default = () => (
  <CategoryBar items={ITEMS} allItem={ALL} trailing={WHOLESALE} activeHref="/shop" />
);

export const CategoryActive = () => (
  <CategoryBar
    items={ITEMS}
    allItem={ALL}
    trailing={WHOLESALE}
    activeHref="/shop?cat=berries"
  />
);

export const WithoutTrailing = () => (
  <CategoryBar items={ITEMS} allItem={ALL} activeHref="/shop?cat=apple" />
);
