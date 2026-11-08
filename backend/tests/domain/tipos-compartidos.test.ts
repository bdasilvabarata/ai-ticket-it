import { EstadoCompra, type ErrorApi, type UsuarioVista } from "@ai-ticket-it/shared";
import { describe, expect, expectTypeOf, it } from "vitest";

// Este archivo entra en el typecheck del backend: un cambio de forma en shared lo rompe.
describe("tipos compartidos", () => {
  it("EstadoCompra tiene los cinco estados de la constitución", () => {
    expect(Object.values(EstadoCompra)).toEqual([
      "PENDIENTE",
      "CONFIRMADA",
      "UTILIZADA",
      "CANCELADA",
      "REEMBOLSADA",
    ]);
    expectTypeOf<EstadoCompra>().toEqualTypeOf<
      "PENDIENTE" | "CONFIRMADA" | "UTILIZADA" | "CANCELADA" | "REEMBOLSADA"
    >();
  });

  it("UsuarioVista y ErrorApi mantienen su forma", () => {
    const usuario: UsuarioVista = {
      id: "000000000000000000000101",
      nombre: "Lucía",
      apellido: "Álvarez",
      cantidadEventosOrganizados: 3,
    };
    const error: ErrorApi = {
      error: {
        codigo: "ENTRADA_INVALIDA",
        mensaje: "Los datos enviados no son válidos.",
        detalles: [{ campo: "params.id", mensaje: "Debe ser un identificador válido." }],
      },
    };
    expect(usuario.cantidadEventosOrganizados).toBe(3);
    expect(error.error.detalles).toHaveLength(1);
  });
});
