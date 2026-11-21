import { EstadoCompra } from "@ai-ticket-it/shared";

import {
  FILTROS_DE_COMPRAS,
  filtrarCompras,
  textoDelFiltro,
  textoSinComprasDelFiltro,
} from "../../../src/features/compras/filtro-de-compras";
import { compraDelEvento } from "../../helpers/compras";

// Filtro por estado de "Compras del evento" (docs/mejoras-organizador.md, grupo 3).

const pendiente = compraDelEvento({ id: "c-pendiente", estado: EstadoCompra.PENDIENTE });
const confirmada = compraDelEvento({ id: "c-confirmada", estado: EstadoCompra.CONFIRMADA });
const utilizada = compraDelEvento({ id: "c-utilizada", estado: EstadoCompra.UTILIZADA });
const cancelada = compraDelEvento({ id: "c-cancelada", estado: EstadoCompra.CANCELADA });
const otraCancelada = compraDelEvento({
  id: "c-cancelada-2",
  estado: EstadoCompra.CANCELADA,
  mensajeSinResponder: true,
});
const compras = [cancelada, pendiente, confirmada, utilizada, otraCancelada];

describe("filtrarCompras", () => {
  it("«todas» deja todas, en el orden en que llegan", () => {
    expect(filtrarCompras(compras, "todas")).toEqual(compras);
  });

  it("un estado deja solo las de ese estado, en el orden en que llegan", () => {
    expect(filtrarCompras(compras, EstadoCompra.CANCELADA).map((c) => c.id)).toEqual([
      "c-cancelada",
      "c-cancelada-2",
    ]);
  });

  it("UTILIZADA es un filtro propio: CONFIRMADA no incluye las utilizadas", () => {
    expect(filtrarCompras(compras, EstadoCompra.CONFIRMADA).map((c) => c.id)).toEqual(["c-confirmada"]);
    expect(filtrarCompras(compras, EstadoCompra.UTILIZADA).map((c) => c.id)).toEqual(["c-utilizada"]);
  });

  it("«sin-responder» deja las que tienen mensajeSinResponder, de cualquier estado (grupo 4)", () => {
    expect(filtrarCompras(compras, "sin-responder").map((c) => c.id)).toEqual(["c-cancelada-2"]);
    expect(filtrarCompras([pendiente, confirmada], "sin-responder")).toEqual([]);
  });

  it("sin compras del estado, vacío", () => {
    expect(filtrarCompras(compras, EstadoCompra.REEMBOLSADA)).toEqual([]);
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
