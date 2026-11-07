import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import globals from "globals";
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
  { ignores: ["**/node_modules/", "**/dist/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["**/*.ts"] })),
  {
    languageOptions: { globals: { ...globals.node } },
    plugins: { "@eslint-community/eslint-comments": eslintComments },
    rules: {
      "@eslint-community/eslint-comments/require-description": "error",
    },
  },
  {
    files: ["**/*.ts"],
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
            message: "domain/ es puro: sin Express, Mongoose ni IO (principio III)",
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
);
