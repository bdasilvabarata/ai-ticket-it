import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const modulosConIo = [
  "express",
  "node:fs",
  "fs",
  "node:fs/promises",
  "node:http",
  "http",
  "node:net",
  "net",
  "node:child_process",
  "child_process",
  "node:os",
  "os",
];

export default tseslint.config(
  { ignores: ["**/node_modules/", "**/dist/", "mobile/.expo/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["**/*.ts", "**/*.tsx"] })),
  {
    languageOptions: { globals: { ...globals.node } },
    plugins: { "@eslint-community/eslint-comments": eslintComments },
    rules: {
      "@eslint-community/eslint-comments/require-description": "error",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description", "ts-expect-error": "allow-with-description" },
      ],
    },
  },
  {
    files: ["backend/src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: modulosConIo.map((name) => ({
            name,
            message: "domain/ es puro: sin Express ni IO (principio III)",
          })),
          patterns: [
            {
              group: ["**/errors/**", "**/errors/index"],
              message:
                "domain/ no conoce HTTP: lanzá DatosInvalidosError o ReglaDeNegocioError de domain/errores (principio III)",
            },
          ],
        },
      ],
    },
  },
  // App mobile (feature 002)
  { ...reactHooks.configs.flat.recommended, files: ["mobile/**/*.{ts,tsx}"] },
  {
    files: ["mobile/**/*.{ts,tsx,js}"],
    languageOptions: { globals: { ...globals.browser, __DEV__: "readonly" } },
  },
  {
    files: ["mobile/*.config.js", "mobile/jest.setup.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["mobile/*.config.js"],
    languageOptions: { sourceType: "commonjs" },
  },
  {
    files: ["mobile/tests/**", "mobile/jest.setup.ts"],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    files: ["mobile/**/*.{ts,tsx,js}"],
    ignores: ["mobile/src/api/**", "mobile/src/composicion.tsx"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Todo pedido al servidor vive en src/api (principio VII)" },
      ],
    },
  },
);
