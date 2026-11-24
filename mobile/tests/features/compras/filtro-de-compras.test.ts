import { EstadoCompra } from "@ai-ticket-it/shared";

import {
  FILTROS_DE_COMPRAS,
  consultaDelFiltro,
  textoDelFiltro,
  textoSinComprasDelFiltro,
} from "../../../src/features/compras/filtro-de-compras";

// Filtro por estado de "Compras del evento" (docs/mejoras-organizador.md, grupo 3; en el servidor desde la 013).

describe("consultaDelFiltro (feature 013: filtra el servidor)", () => {
  it("«todas» no pide ningún filtro", () => {
    expect(consultaDelFiltro("todas")).toEqual({});
  });

  it("«sin-responder» pide sinResponder: true", () => {
    expect(consultaDelFiltro("sin-responder")).toEqual({ sinResponder: true });
  });

  it.each([
    EstadoCompra.PENDIENTE,
    EstadoCompra.CONFIRMADA,
    EstadoCompra.UTILIZADA,
    EstadoCompra.CANCELADA,
    EstadoCompra.REEMBOLSADA,
  ])("el estado %s pide ese estado", (estado) => {
    expect(consultaDelFiltro(estado)).toEqual({ estado });
  });
});

describe("textos del filtro", () => {
  it("los chips, en orden", () => {
    expect(FILTROS_DE_COMPRAS.map(textoDelFiltro)).toEqual([
      "Todas",
      "Sin responder",
      "Pendiente",
      "Confirmada",
      "Utilizada",
      "Cancelada",
      "Reembolsada",
    ]);
  });

  it("el vacío de cada filtro", () => {
    expect(FILTROS_DE_COMPRAS.map(textoSinComprasDelFiltro)).toEqual([
      "Todavía nadie compró entradas",
      "No hay mensajes sin responder",
      "No hay compras pendientes",
      "No hay compras confirmadas",
      "No hay compras utilizadas",
      "No hay compras canceladas",
      "No hay compras reembolsadas",
    ]);
  });
});
