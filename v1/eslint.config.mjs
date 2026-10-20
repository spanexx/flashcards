import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// WHY: Keep the prototype honest about React and TypeScript mistakes without
// layering a second, competing style system on top of Next.js defaults.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "coverage/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
