import { describe, expect, it, vi } from "vitest";
import { ejecutarSeed, planificarSeed } from "../../src/scripts/seed-opciones";

const URI = "mongodb+srv://usr:clave@cluster0.x.mongodb.net/ticket";

describe("planificarSeed", () => {
  it("aborta sin MONGO_URI", () => {
    const plan = planificarSeed(["--forzar"], undefined);
    expect(plan.accion).toBe("abortar");
    if (plan.accion === "abortar") expect(plan.mensaje).toContain("MONGO_URI");
  });

  it("aborta sin --forzar y explica qué borraría, sin credenciales", () => {
    const plan = planificarSeed([], URI);
    expect(plan.accion).toBe("abortar");
    if (plan.accion !== "abortar") return;
    for (const texto of [
      "cluster0.x.mongodb.net",
      "ticket",
      "categorias",
      "usuarios",
      "eventos",
      "npm run seed -- --forzar",
    ]) {
      expect(plan.mensaje).toContain(texto);
    }
    expect(plan.mensaje).not.toContain("usr");
    expect(plan.mensaje).not.toContain("clave");
  });

  it("carga con --forzar e informa el destino sin credenciales", () => {
    expect(planificarSeed(["--forzar"], URI)).toEqual({
      accion: "cargar",
      destino: "cluster0.x.mongodb.net/ticket",
    });
  });
});

function crearDeps(argv: string[], mongoUri: string | undefined) {
  return {
    argv,
    mongoUri,
    conectar: vi.fn(async (uri: string) => {
      void uri;
    }),
    cargar: vi.fn(async () => ({ categorias: 6, usuarios: 5, eventos: 8 })),
    desconectar: vi.fn(async () => {}),
    escribir: vi.fn((mensaje: string) => {
      void mensaje;
    }),
    escribirError: vi.fn((mensaje: string) => {
      void mensaje;
    }),
  };
}

describe("ejecutarSeed", () => {
  it.each<[string, string[], string | undefined]>([
    ["sin --forzar", [], URI],
    ["sin MONGO_URI", ["--forzar"], undefined],
  ])("%s devuelve 1 y no toca la base", async (_caso, argv, uri) => {
    const deps = crearDeps(argv, uri);
    expect(await ejecutarSeed(deps)).toBe(1);
    expect(deps.conectar).not.toHaveBeenCalled();
    expect(deps.cargar).not.toHaveBeenCalled();
    expect(deps.desconectar).not.toHaveBeenCalled();
    expect(deps.escribirError).toHaveBeenCalledOnce();
  });

  it("con --forzar conecta, carga y desconecta en orden", async () => {
    const deps = crearDeps(["--forzar"], URI);
    expect(await ejecutarSeed(deps)).toBe(0);
    expect(deps.conectar).toHaveBeenCalledWith(URI);
    const [conectar, cargar, desconectar] = [deps.conectar, deps.cargar, deps.desconectar].map(
      (fn) => fn.mock.invocationCallOrder[0] ?? 0,
    );
    expect(conectar).toBeLessThan(cargar ?? 0);
    expect(cargar).toBeLessThan(desconectar ?? 0);
    const salida = deps.escribir.mock.calls.map(([mensaje]) => mensaje).join("\n");
    expect(salida).toMatch(/6 categorías/);
    expect(salida).toMatch(/5 usuarios/);
    expect(salida).toMatch(/8 eventos/);
  });

  it("si la carga falla, desconecta igual, devuelve 1 y avisa", async () => {
    const deps = crearDeps(["--forzar"], URI);
    deps.cargar.mockRejectedValue(new Error("se cortó"));
    expect(await ejecutarSeed(deps)).toBe(1);
    expect(deps.desconectar).toHaveBeenCalledOnce();
    expect(deps.escribirError).toHaveBeenCalled();
  });
});
