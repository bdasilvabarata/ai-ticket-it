import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // La primera ejecución descarga el binario de MongoDB.
    hookTimeout: 60000,
    testTimeout: 10000,
    // Fijado explícitamente: con NODE_ENV=development en la terminal, los tests leerían
    // backend/.env y el logger no quedaría en silent.
    env: { NODE_ENV: "test" },
  },
});
