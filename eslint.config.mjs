import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// `npm run lint` ruft die ESLint-CLI auf (`eslint . --max-warnings 0`), nicht `next lint`, das mit
// Next 16 wegfaellt (#138). Die Next-Regeln kommen als Flat-Config aus `eslint-config-next`. `eslint .` sieht anders als `next lint` den ganzen Baum, deshalb die Ignore-Liste:
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
  ...coreWebVitals,
  ...typescript,
  {
    // Die Compiler-Regeln aus eslint-plugin-react-hooks 7 (mit Next 16 in der Standardkonfiguration) gelten dem
    // React Compiler, den dieses Projekt nicht einsetzt. Sie melden Muster, die ohne ihn richtig laufen (setState
    // im Effekt zum Lesen des Browsers, Refs in Handlern); aus, bis ein eigener Auftrag den Code umstellt.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
    },
  },
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
