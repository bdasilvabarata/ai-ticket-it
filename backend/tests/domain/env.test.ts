import { describe, expect, it } from "vitest";
import { parsearEnv } from "../../src/config/env-esquema";

describe("parsearEnv", () => {
  it("usa los valores por defecto con una fuente vacía", () => {
    expect(parsearEnv({})).toEqual({
      PORT: 3000,
      HOST: "0.0.0.0",
      MONGO_URI: undefined,
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

  it("trata MONGO_URI vacía como ausente", () => {
    expect(parsearEnv({ MONGO_URI: "" }).MONGO_URI).toBeUndefined();
  });

  it("conserva MONGO_URI cuando viene", () => {
    expect(parsearEnv({ MONGO_URI: "mongodb://localhost:27017/x" }).MONGO_URI).toBe(
      "mongodb://localhost:27017/x",
    );
  });
});
