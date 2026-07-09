"use client";

import {
  CategoryBar as UiCategoryBar,
  type CategoryBarItem,
} from "@grove/ui-kit";
import { GroveNextLink } from "./grove-adapters";

type Props = {
  items: CategoryBarItem[];
  allItem: CategoryBarItem;
  trailing?: { label: string; href: string };
  activeHref?: string;
};

/**
 * Client boundary for the ui-kit CategoryBar (GOL-139). The parent server
 * component fetches the live counts and builds the items; this wrapper supplies
 * the Next Link context the pills navigate through.
 */
export function CategoryBarView(props: Props) {
  return (
    <GroveNextLink>
      <UiCategoryBar {...props} />
    </GroveNextLink>
  );
}
