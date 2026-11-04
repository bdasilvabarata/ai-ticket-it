import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { conectarBase, desconectarBase } from "../../src/config/db";
import { ErrorArranque } from "../../src/config/fallas-arranque";

afterEach(async () => {
  vi.restoreAllMocks();
  await desconectarBase();
});

describe("conectarBase", () => {
  it("con una MONGO_URI inaccesible falla sin credenciales y sin caer a memoria", async () => {
    const error = await conectarBase("mongodb://usr:clave@127.0.0.1:1/x", { timeoutMs: 500 }).then(
      () => undefined,
      (motivo: unknown) => motivo,
    );
    expect(error).toBeInstanceOf(ErrorArranque);
    const mensaje = error instanceof Error ? error.message : "";
    expect(mensaje).toContain("No se pudo conectar a MONGO_URI");
    expect(mensaje).toContain("127.0.0.1");
    expect(mensaje).not.toContain("clave");
    expect(mensaje).not.toContain("usr");
    expect(mongoose.connection.readyState).toBe(0);
  });

  it("explica que la primera ejecución necesita internet si no puede preparar Mongo en memoria", async () => {
    vi.spyOn(MongoMemoryServer, "create").mockRejectedValue(new Error("download failed"));
    await expect(conectarBase(undefined)).rejects.toThrow(/la primera ejecución necesita internet/);
  });

  it("sin MONGO_URI usa MongoDB en memoria y desconecta limpio", async () => {
    await expect(conectarBase(undefined)).resolves.toEqual({ almacenamiento: "memoria" });
    expect(mongoose.connection.readyState).toBe(1);
    await desconectarBase();
    expect(mongoose.connection.readyState).toBe(0);
  });
});
