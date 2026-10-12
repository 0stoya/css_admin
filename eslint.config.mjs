import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["tests/**/*.mjs"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
  // Compiled worker JS is build output, not lintable source. Keep source lint rules intact.
  globalIgnores([".next/**", ".worker-dist/**", "out/**", "next-env.d.ts"]),
]);
