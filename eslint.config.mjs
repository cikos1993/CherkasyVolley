import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // The domain is a pure functional core: no framework, no IO, no other layer.
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next", message: "src/domain must stay framework-free." },
            { name: "@prisma/client", message: "src/domain must not touch the database." },
            { name: "react", message: "src/domain is pure functions — no React." },
            { name: "react-dom", message: "src/domain is pure functions — no React." },
          ],
          patterns: [
            {
              group: [
                "next/*",
                "@prisma/client/*",
                "@/generated/prisma",
                "@/generated/prisma/*",
                "@/data",
                "@/data/*",
                "@/actions",
                "@/actions/*",
                "@/auth",
                "@/auth/*",
                "@/app/*",
                "@/components/*",
              ],
              message: "src/domain must not import from any other layer.",
            },
          ],
        },
      ],
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/domain",
              from: "./src",
              except: ["./domain"],
              message: "src/domain must not import from another src/ layer.",
            },
          ],
        },
      ],
    },
  },

  // The Prisma client is imported only inside src/data; elsewhere, call a named src/data function.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/data/**", "src/domain/**", "src/generated/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message: "Import Prisma only inside src/data. Elsewhere, call a named src/data function.",
            },
          ],
          patterns: [
            {
              group: ["@prisma/client/*", "@/generated/prisma", "@/generated/prisma/*"],
              message: "Import the Prisma client only inside src/data.",
            },
          ],
        },
      ],
    },
  },

  // The data layer never reaches up into the shell, auth, or view.
  {
    files: ["src/data/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            { target: "./src/data", from: "./src/actions", message: "data must not depend on actions." },
            { target: "./src/data", from: "./src/auth", message: "data must not depend on auth." },
            { target: "./src/data", from: "./src/app", message: "data must not depend on the view layer." },
            { target: "./src/data", from: "./src/components", message: "data must not depend on the view layer." },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client (git-ignored, regenerated via `pnpm prisma generate`):
    "src/generated/**",
  ]),
]);

export default eslintConfig;
