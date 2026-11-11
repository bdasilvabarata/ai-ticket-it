import { describe, expect, it } from "vitest";
import { CerrojoPorClave } from "../../src/services/cerrojo-por-clave";

/** Una promesa que se resuelve desde afuera. */
function pendiente(): { promesa: Promise<void>; liberar: () => void } {
  let liberar = () => {};
  const promesa = new Promise<void>((resolver) => {
    liberar = resolver;
  });
  return { promesa, liberar };
}

const tick = () => new Promise<void>((resolver) => setImmediate(resolver));

describe("CerrojoPorClave", () => {
  it("dos operaciones sobre la misma clave no se intercalan", async () => {
    const cerrojo = new CerrojoPorClave();
    const pasos: string[] = [];
    const bloqueo = pendiente();
    const primera = cerrojo.ejecutar("evento-1", async () => {
      pasos.push("empieza 1");
      await bloqueo.promesa;
      pasos.push("termina 1");
    });
    const segunda = cerrojo.ejecutar("evento-1", async () => {
      pasos.push("empieza 2");
    });
    await tick();
    expect(pasos).toEqual(["empieza 1"]);
    bloqueo.liberar();
    await Promise.all([primera, segunda]);
    expect(pasos).toEqual(["empieza 1", "termina 1", "empieza 2"]);
  });

  it("claves distintas corren en paralelo: una bloqueada no frena a la otra", async () => {
    const cerrojo = new CerrojoPorClave();
    const bloqueo = pendiente();
    const bloqueada = cerrojo.ejecutar("evento-a", () => bloqueo.promesa);
    await expect(cerrojo.ejecutar("evento-b", async () => "listo")).resolves.toBe("listo");
    bloqueo.liberar();
    await bloqueada;
  });

  it("se libera ante un error y el error llega al que llamó", async () => {
    const cerrojo = new CerrojoPorClave();
    await expect(
      cerrojo.ejecutar("evento-1", async () => {
        throw new Error("falló");
      }),
    ).rejects.toThrow("falló");
    await expect(cerrojo.ejecutar("evento-1", async () => 2)).resolves.toBe(2);
  });

  it("devuelve el valor de la operación", async () => {
    await expect(new CerrojoPorClave().ejecutar("x", async () => ({ ok: true }))).resolves.toEqual({
      ok: true,
    });
  });

  it("borra la cola de una clave al vaciarse", async () => {
    const cerrojo = new CerrojoPorClave();
    const bloqueo = pendiente();
    const primera = cerrojo.ejecutar("evento-1", () => bloqueo.promesa);
    const segunda = cerrojo.ejecutar("evento-1", async () => {});
    expect(cerrojo.clavesActivas).toBe(1);
    bloqueo.liberar();
    await Promise.all([primera, segunda]);
    expect(cerrojo.clavesActivas).toBe(0);
  });
});
