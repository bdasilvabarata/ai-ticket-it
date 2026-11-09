import { MutationObserver } from "@tanstack/react-query";

import { claves } from "../../src/consultas/claves";
import { crearQueryClient } from "../../src/consultas/query-client";

describe("crearQueryClient", () => {
  it("sin reintentos propios y con staleTime de 30 s", () => {
    const queryClient = crearQueryClient({ alFallar: () => {} });
    const opciones = queryClient.getDefaultOptions();

    expect(opciones.queries?.retry).toBe(false);
    expect(opciones.queries?.staleTime).toBe(30_000);
    expect(opciones.mutations?.retry).toBe(false);
    queryClient.clear();
  });

  it("una query que falla llama alFallar una vez con el error original", async () => {
    const alFallar = jest.fn();
    const queryClient = crearQueryClient({ alFallar });
    const error = new Error("falló la query");

    await expect(
      queryClient.fetchQuery({ queryKey: ["x"], queryFn: () => Promise.reject(error) }),
    ).rejects.toBe(error);
    expect(alFallar).toHaveBeenCalledTimes(1);
    expect(alFallar).toHaveBeenCalledWith(error);
    queryClient.clear();
  });

  it("una mutation que falla llama alFallar una vez con el error original", async () => {
    const alFallar = jest.fn();
    const queryClient = crearQueryClient({ alFallar });
    const error = new Error("falló la mutation");
    const observador = new MutationObserver(queryClient, { mutationFn: () => Promise.reject(error) });

    await expect(observador.mutate()).rejects.toBe(error);
    expect(alFallar).toHaveBeenCalledTimes(1);
    expect(alFallar).toHaveBeenCalledWith(error);
    queryClient.clear();
  });
});

describe("claves", () => {
  it("la lista de usuarios no depende del usuario", () => {
    expect(claves.usuarios()).toEqual(["usuarios"]);
  });

  it("las claves que dependen del usuario llevan el usuarioId en la posición 1", () => {
    expect(claves.usuarioActual("u1")).toEqual(["usuario-actual", "u1"]);
  });
});
