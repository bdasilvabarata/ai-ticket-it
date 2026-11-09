/**
 * Genera `.expo/types/router.d.ts` (rutas tipadas de Expo Router) sin levantar el servidor de
 * desarrollo, para que `tsc` las verifique también en el CI (FR-009, research R5). Hace lo mismo
 * que Expo CLI al arrancar: usa un módulo interno de Expo, así que si cambia de lugar, falla acá.
 */
const fs = require("node:fs");
const path = require("node:path");

const mobile = path.resolve(__dirname, "..");
const salida = path.join(mobile, ".expo", "types");

process.env.EXPO_ROUTER_APP_ROOT = path.join(mobile, "app");
fs.mkdirSync(salida, { recursive: true });

let rutasTipadas;
try {
  const cli = require.resolve("@expo/cli/package.json", { paths: [mobile] });
  rutasTipadas = require(require.resolve("@expo/router-server/build/typed-routes", { paths: [cli] }));
} catch (error) {
  console.error("No se encontró el generador de rutas tipadas de Expo (@expo/router-server).", error);
  process.exit(1);
}
if (typeof rutasTipadas.regenerateDeclarations !== "function" || !(rutasTipadas.version >= 52)) {
  console.error(`Generador de rutas tipadas incompatible (versión ${rutasTipadas.version}); revisar R5.`);
  process.exit(1);
}
rutasTipadas.regenerateDeclarations(salida);
