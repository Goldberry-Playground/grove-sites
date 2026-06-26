import type { Preview } from "@storybook/react";
import "@grove/tokens/contract.css";
import "../src/styles.css";
// Each brand theme is loaded; the toolbar global below picks which is active
// by setting data-grove-theme on the story root.
import "@grove/tokens/themes/goldberry.css";
import "@grove/tokens/themes/ggg.css";
import "@grove/tokens/themes/nursery.css";
import "@grove/tokens/themes/hub.css";

const preview: Preview = {
  // Brand-theme switcher — verify a component across all four brands.
  globalTypes: {
    theme: {
      description: "Grove brand theme",
      defaultValue: "goldberry",
      toolbar: {
        title: "Brand",
        icon: "paintbrush",
        items: [
          { value: "goldberry", title: "Goldberry Grove" },
          { value: "ggg", title: "GGG Woodworking" },
          { value: "nursery", title: "At the Grove Nursery" },
          { value: "hub", title: "Gathering at the Grove" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, ctx) => (
      <div
        data-grove-theme={ctx.globals.theme}
        style={{
          background: "var(--grove-color-background)",
          color: "var(--grove-color-foreground)",
          fontFamily: "var(--grove-font-sans)",
          padding: "2rem",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
