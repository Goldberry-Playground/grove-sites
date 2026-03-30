/**
 * Shared ESLint flat config for Next.js + TypeScript projects.
 *
 * Usage in app eslint.config.ts:
 *   import { groveEslintConfig } from "@grove/config/eslint";
 *   export default groveEslintConfig;
 */
export const groveEslintConfig = [
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-unused-vars": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: ["node_modules/", ".next/", "dist/"],
  },
];
