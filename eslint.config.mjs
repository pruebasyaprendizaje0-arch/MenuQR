import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    "**/.next/**",
    "node_modules/**",
    "prisma/generated/**",
    // The repository contains a separate Git submodule with its own toolchain.
    // Lint it from that submodule instead of mixing it into the root app report.
    "MenuQR/**",
  ]),
]);
