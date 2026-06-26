import type { StorybookConfig } from "@storybook/react-vite";

// Storybook is the dev surface AND the canonical preview source /design-sync
// (storybook shape) verifies cards against. Stories live next to components.
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(tsx|mdx)"],
  addons: ["@storybook/addon-essentials"],
  framework: { name: "@storybook/react-vite", options: {} },
};

export default config;
