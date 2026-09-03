import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Match the file set eslint-config-next lints, so a non-TS module cannot slip past a boundary rule.
const SRC = "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}";

// The Prisma client under the Prisma 7 custom generator is `@/generated/prisma`; `@prisma/client` is
// the re-export. Cover alias and relative forms so the rule does not depend on the import resolver.
const prismaClientPatterns = [
  "@prisma/client/**",
  "@/generated/prisma",
  "@/generated/prisma/**",
  "**/generated/prisma",
  "**/generated/prisma/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // src/domain is a pure functional core: no framework, no IO, no other layer.
  {
    files: [`src/domain/${SRC}`],
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
                "next/**",
                ...prismaClientPatterns,
                "@/data", "@/data/**",
                "@/actions", "@/actions/**",
                "@/auth", "@/auth/**",
                "@/app", "@/app/**",
                "@/components", "@/components/**",
                "@/lib", "@/lib/**",
                "**/data", "**/data/**",
                "**/actions", "**/actions/**",
                "**/auth", "**/auth/**",
              ],
              message: "src/domain must not import the database or another src/ layer.",
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
    files: [`src/${SRC}`],
    ignores: ["src/data/**", "src/domain/**", "src/auth/**", "src/generated/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message: "Import the Prisma client only inside src/data. Elsewhere, call a named src/data function.",
            },
          ],
          patterns: [
            {
              group: prismaClientPatterns,
              message: "Import the Prisma client only inside src/data. Elsewhere, call a named src/data function.",
            },
          ],
        },
      ],
    },
  },

  // src/data owns persistence: Prisma + schema types only, and never reaches up into shell, auth, or view.
  {
    files: [`src/data/${SRC}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next", message: "src/data depends only on Prisma and schema types." },
            { name: "react", message: "src/data depends only on Prisma and schema types." },
            { name: "react-dom", message: "src/data depends only on Prisma and schema types." },
          ],
          patterns: [
            {
              group: [
                "next/**",
                "@/actions", "@/actions/**",
                "@/auth", "@/auth/**",
                "@/app", "@/app/**",
                "@/components", "@/components/**",
                "**/actions", "**/actions/**",
                "**/auth", "**/auth/**",
              ],
              message: "src/data must not import from the shell, auth, or view layer.",
            },
          ],
        },
      ],
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

  // src/auth holds Better Auth config + requireAdmin(); it may import only src/data (for the shared
  // PrismaClient instance and user queries) — never domain, actions, or the view layer.
  {
    files: [`src/auth/${SRC}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message: "src/auth imports the shared PrismaClient from src/data, not @prisma/client directly.",
            },
          ],
          patterns: [
            {
              group: [
                ...prismaClientPatterns,
                "@/domain", "@/domain/**",
                "@/actions", "@/actions/**",
                "@/app", "@/app/**",
                "@/components", "@/components/**",
                "**/domain", "**/domain/**",
                "**/actions", "**/actions/**",
              ],
              message: "src/auth may import only src/data.",
            },
          ],
        },
      ],
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            { target: "./src/auth", from: "./src/domain", message: "auth must not depend on domain." },
            { target: "./src/auth", from: "./src/actions", message: "auth must not depend on actions." },
            { target: "./src/auth", from: "./src/app", message: "auth must not depend on the view layer." },
            { target: "./src/auth", from: "./src/components", message: "auth must not depend on the view layer." },
          ],
        },
      ],
    },
  },

  // Components are pure view — they reach auth only through the browser client
  // (`@/lib/auth-client`), never the server instance. The `/api/auth/[...all]`
  // route handler is the one sanctioned view→auth import (transport, not a view).
  {
    files: [`src/components/${SRC}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/auth", "@/auth/**", "**/auth/auth", "**/auth/auth.*"],
              message: "Components use @/lib/auth-client, not src/auth.",
            },
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
