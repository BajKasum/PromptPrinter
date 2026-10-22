import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

// `npm run lint` ruft die ESLint-CLI auf (`eslint . --max-warnings 0`), nicht mehr `next lint`, das mit
// Next 16 wegfaellt (#138). `eslint .` sieht anders als `next lint` den ganzen Baum, deshalb die Ignore-Liste:
// Build-Ausgaben und erzeugte Dateien gehören nicht dazu (`.next` allein waren über 40 000 Meldungen und
// fünf Minuten).
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".claude/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "screenshots_Docs/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Ein Unterstrich vorn heisst "absichtlich unbenutzt" (Parameter von Attrappen in Tests).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Playwrights `use` in den Fixtures ist kein React-Hook.
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];

export default eslintConfig;
