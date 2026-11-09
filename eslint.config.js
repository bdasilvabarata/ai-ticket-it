import fs from "node:fs";
import path from "node:path";

import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const raiz = import.meta.dirname;

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

/** Entradas de `dir` (relativo a la raíz); lista vacía si no existe. */
function entradas(dir) {
  const absoluto = path.join(raiz, dir);
  return fs.existsSync(absoluto) ? fs.readdirSync(absoluto) : [];
}

/**
 * Zonas de `import-x/no-restricted-paths` para mobile (research R4), calculadas a partir de las
 * carpetas: una carpeta nueva de la base o una feature nueva quedan cubiertas sin tocar este archivo.
 */
function zonasDeDependenciaMobile() {
  const src = "mobile/src";
  const features = `${src}/features`;
  const conectores = new Set(["features", "navegacion"]);
  const esComposicion = (nombre) => /^composicion\.tsx?$/.test(nombre);
  const nombresDeFeatures = entradas(features).filter((nombre) =>
    fs.statSync(path.join(raiz, features, nombre)).isDirectory(),
  );
  const indices = nombresDeFeatures.map((nombre) => `./${nombre}/index.ts`);

  // Regla 2: la base no importa features (salvo composicion y navegacion).
  const base = entradas(src)
    .filter((nombre) => !conectores.has(nombre) && !esComposicion(nombre))
    .map((nombre) => ({
      target: `${src}/${nombre}`,
      from: features,
      message: "La base no importa features (salvo composicion y navegacion)",
    }));

  // Regla 3: entre features, solo por el index.ts de la otra.
  const entreFeatures = nombresDeFeatures.map((nombre) => ({
    target: `${features}/${nombre}`,
    from: features,
    except: [`./${nombre}`, ...indices.filter((indice) => indice !== `./${nombre}/index.ts`)],
    message: "Entre features, solo por el index.ts",
  }));

  // Regla 3 desde los conectores (app/, navegacion/, composicion).
  const desdeConectores = {
    target: [
      "mobile/app",
      `${src}/navegacion`,
      ...entradas(src)
        .filter(esComposicion)
        .map((n) => `${src}/${n}`),
    ],
    from: features,
    except: indices,
    message: "Entre features, solo por el index.ts",
  };

  return [...base, ...entreFeatures, desdeConectores];
}

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
    files: ["mobile/scripts/**"],
    languageOptions: { globals: { ...globals.node }, sourceType: "commonjs" },
  },
  {
    files: ["mobile/tests/**", "mobile/jest.setup.ts"],
    languageOptions: { globals: { ...globals.jest } },
  },
  // Reglas de dependencia de mobile (feature 003, research R1 y R4). Los tests quedan afuera de las
  // zonas: prueban archivos internos de las features.
  {
    files: ["mobile/**/*.{ts,tsx}"],
    plugins: { "import-x": importX },
    settings: {
      "import-x/extensions": [".ts", ".tsx", ".js"],
      "import-x/parsers": { "@typescript-eslint/parser": [".ts", ".tsx"] },
      "import-x/resolver-next": [
        createTypeScriptImportResolver({ project: path.join(raiz, "mobile/tsconfig.json") }),
      ],
    },
    rules: {
      "import-x/no-cycle": ["error", { ignoreExternal: true }],
      "import-x/no-restricted-paths": ["error", { basePath: raiz, zones: zonasDeDependenciaMobile() }],
    },
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
