import { renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ConexionProvider, useConexion, type EstadoConexion } from "../../src/conexion";

const valor: EstadoConexion = {
  servidor: "no-disponible",
  enCurso: true,
  automaticosRestantes: 3,
  reintentarAhora: async () => undefined,
  urlBase: "http://servidor-de-prueba:3000/api",
};

describe("contrato de conexión (clarificación 3)", () => {
  it("dentro de ConexionProvider, useConexion devuelve el valor provisto", async () => {
    const envoltorio = ({ children }: { children: ReactNode }) => (
      <ConexionProvider valor={valor}>{children}</ConexionProvider>
    );

    const { result } = await renderHook(() => useConexion(), { wrapper: envoltorio });

    expect(result.current).toBe(valor);
  });

  it("fuera de ConexionProvider, useConexion lanza un error que lo dice", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(renderHook(() => useConexion())).rejects.toThrow(/dentro de ConexionProvider/);

    jest.restoreAllMocks();
  });
});
