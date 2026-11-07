import { describe, expect, it } from "vitest";
import { parsearEnv } from "../../src/config/env-esquema";

describe("parsearEnv", () => {
  it("usa los valores por defecto con una fuente vacía", () => {
    expect(parsearEnv({})).toEqual({
      PORT: 3000,
      HOST: "0.0.0.0",
      LOG_LEVEL: "info",
    });
  });

  it("en test el nivel de log es silent por defecto", () => {
    expect(parsearEnv({ NODE_ENV: "test" }).LOG_LEVEL).toBe("silent");
  });

  it("en test el nivel de log es siempre silent", () => {
    expect(parsearEnv({ NODE_ENV: "test", LOG_LEVEL: "info" }).LOG_LEVEL).toBe("silent");
  });

  it("convierte PORT a número", () => {
    expect(parsearEnv({ PORT: "4000" }).PORT).toBe(4000);
  });

  it("rechaza un PORT inválido nombrando la variable", () => {
    expect(() => parsearEnv({ PORT: "abc" })).toThrow(/PORT/);
  });

  it("rechaza un LOG_LEVEL inválido nombrando la variable", () => {
    expect(() => parsearEnv({ LOG_LEVEL: "debug" })).toThrow(/LOG_LEVEL/);
  });
});
