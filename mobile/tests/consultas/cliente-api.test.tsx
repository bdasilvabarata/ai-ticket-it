import { renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { crearClienteApi } from "../../src/api";
import { ClienteApiProvider, useClienteApi } from "../../src/consultas/cliente-api";
import { crearFetchFalso } from "../helpers/fetch-falso";

const cliente = crearClienteApi({
  fetch: crearFetchFalso([{ status: 200, json: [] }]).fetch,
  urlBase: "http://servidor-de-prueba:3000/api",
  obtenerUsuarioId: () => null,
  alUsuarioNoIdentificado: () => undefined,
});

describe("contrato del cliente en React (R2)", () => {
  it("dentro de ClienteApiProvider, useClienteApi devuelve el cliente provisto", async () => {
    const envoltorio = ({ children }: { children: ReactNode }) => (
      <ClienteApiProvider cliente={cliente}>{children}</ClienteApiProvider>
    );

    const { result } = await renderHook(() => useClienteApi(), { wrapper: envoltorio });

    expect(result.current).toBe(cliente);
  });

  it("fuera de ClienteApiProvider, useClienteApi lanza un error que lo dice", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(renderHook(() => useClienteApi())).rejects.toThrow(/dentro de ClienteApiProvider/);

    jest.restoreAllMocks();
  });
});
