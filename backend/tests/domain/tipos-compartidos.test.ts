import {
  EstadoCompra,
  LIMITES_BUSQUEDA,
  LIMITES_COMPRA,
  LIMITES_EVENTO,
  LIMITES_TIPO_ENTRADA,
  ORDENES_CATALOGO,
  type OrdenCatalogo,
  type CategoriaVista,
  type CompraVista,
  type DatosCompra,
  type MisComprasDelEventoVista,
  type DatosEvento,
  type DatosNuevoEvento,
  type DatosTipoEntrada,
  type ErrorApi,
  type EventoResumenVista,
  type EventoVista,
  type TipoEntradaVista,
  type UsuarioVista,
} from "@ai-ticket-it/shared";
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

  it("los límites de evento y de tipo de entrada son los del contrato", () => {
    expect(LIMITES_EVENTO).toEqual({ nombre: 100, descripcion: 2000, multimedia: 5 });
    expect(LIMITES_TIPO_ENTRADA).toEqual({ nombre: 50, descripcion: 300 });
  });

  it("los órdenes y el límite de búsqueda del catálogo son los del contrato", () => {
    expect(ORDENES_CATALOGO).toEqual(["fecha", "precio", "puntaje"]);
    expectTypeOf<OrdenCatalogo>().toEqualTypeOf<"fecha" | "precio" | "puntaje">();
    expect(LIMITES_BUSQUEDA.texto).toBe(100);
  });

  it("EventoVista amplía EventoResumenVista con descripción, multimedia y tipos", () => {
    expectTypeOf<EventoVista>().toExtend<EventoResumenVista>();
    expectTypeOf<EventoVista["tiposEntrada"]>().toEqualTypeOf<TipoEntradaVista[]>();
    expectTypeOf<DatosNuevoEvento["tiposEntrada"]>().toEqualTypeOf<DatosTipoEntrada[]>();
    expectTypeOf<DatosNuevoEvento>().toExtend<DatosEvento>();
    expectTypeOf<CategoriaVista>().toEqualTypeOf<{ id: string; nombre: string; descripcion: string }>();
  });

  it("los límites de una compra son los de la constitución", () => {
    expect(LIMITES_COMPRA).toEqual({
      entradasPorEvento: 4,
      entradasPorTipoGratis: 1,
      minutosParaPagar: 15,
    });
  });

  it("DatosCompra no lleva precio ni total, y CompraVista trae el estado y el historial", () => {
    expectTypeOf<DatosCompra>().toEqualTypeOf<{ tipoEntradaId: string; cantidad: number }>();
    expectTypeOf<CompraVista["estado"]>().toEqualTypeOf<EstadoCompra>();
    expectTypeOf<CompraVista["venceEn"]>().toEqualTypeOf<string | null>();
    expectTypeOf<MisComprasDelEventoVista["pendientes"]>().toEqualTypeOf<CompraVista[]>();
  });
});
