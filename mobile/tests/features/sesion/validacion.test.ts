import type { UsuarioVista } from "@ai-ticket-it/shared";

import { ErrorDeApi, ServidorNoDisponibleError } from "../../../src/api";
import { decidirValidacion } from "../../../src/features/sesion/validacion";

const lucia: UsuarioVista = {
  id: "usuario-lucia",
  nombre: "Lucía",
  apellido: "Álvarez",
  cantidadEventosOrganizados: 2,
};

describe("decidirValidacion (FR-013)", () => {
  it("confirmado cuando el servidor devuelve el usuario", () => {
    expect(decidirValidacion({ ok: true, usuario: lucia })).toEqual({ tipo: "confirmado", usuario: lucia });
  });

  it("olvidar ante 401 USUARIO_NO_IDENTIFICADO", () => {
    const error = new ErrorDeApi(401, "USUARIO_NO_IDENTIFICADO", "No existe.");
    expect(decidirValidacion({ ok: false, error })).toEqual({ tipo: "olvidar" });
  });

  it.each([
    ["sin conexión", new ServidorNoDisponibleError("http://x/api/usuarios/actual", "sin-conexion")],
    ["tiempo agotado", new ServidorNoDisponibleError("http://x/api/usuarios/actual", "tiempo-agotado")],
    ["500", new ErrorDeApi(500, "ERROR_INTERNO", "Falló.")],
    ["404", new ErrorDeApi(404, "NO_ENCONTRADO", "No existe.")],
    ["401 con otro código", new ErrorDeApi(401, "OTRO_CODIGO", "Otra cosa.")],
    [
      "respuesta inesperada",
      new ErrorDeApi(502, "RESPUESTA_INESPERADA", "El servidor respondió de forma inesperada."),
    ],
    ["una excepción cualquiera", new TypeError("x is not a function")],
  ])("conservar-sin-servidor ante %s", (_caso, error) => {
    expect(decidirValidacion({ ok: false, error })).toEqual({ tipo: "conservar-sin-servidor" });
  });
});
