/**
 * Guarda de las rutas tipadas (FR-009, research R5). No es un test de Jest: lo compila `tsc` en
 * `npm run typecheck`. Si las rutas tipadas se desactivan o sus tipos no se generan, la directiva
 * de abajo queda sin uso y el typecheck falla.
 */
import type { Href } from "expo-router";

export const valida: Href = "/seleccionar-usuario";

// @ts-expect-error la ruta no existe: las rutas tipadas deben rechazarla (FR-009)
export const invalida: Href = "/seleccionar-usuarios";

// La primera ruta dinámica (feature 004): con su parámetro compila, sin él no.
export const conParametro: Href = {
  pathname: "/eventos/[eventoId]",
  params: { eventoId: "evento-festival" },
};

// @ts-expect-error la ruta dinámica necesita su parámetro eventoId (R16)
export const sinParametro: Href = { pathname: "/eventos/[eventoId]" };

// El detalle público de Explorar (feature 005): con su parámetro compila, sin él no.
export const detallePublico: Href = {
  pathname: "/explorar/[eventoId]",
  params: { eventoId: "evento-maraton-10k" },
};

// @ts-expect-error el detalle público necesita su parámetro eventoId
export const detalleSinParametro: Href = { pathname: "/explorar/[eventoId]" };

// Comprar entradas de un tipo (feature 006): necesita el evento y el tipo.
export const comprar: Href = {
  pathname: "/explorar/[eventoId]/comprar/[tipoEntradaId]",
  params: { eventoId: "evento-maraton-10k", tipoEntradaId: "tipo-maraton-inscripcion" },
};

const soloElEvento = { eventoId: "evento-maraton-10k" };
export const comprarSinTipo: Href = {
  pathname: "/explorar/[eventoId]/comprar/[tipoEntradaId]",
  // @ts-expect-error comprar necesita también el parámetro tipoEntradaId
  params: soloElEvento,
};

// Tu compra (feature 006): con su parámetro compila, sin él no.
export const tuCompra: Href = { pathname: "/compras/[compraId]", params: { compraId: "compra-1" } };

// @ts-expect-error Tu compra necesita su parámetro compraId
export const tuCompraSinParametro: Href = { pathname: "/compras/[compraId]" };

// El chat de la compra (feature 011): necesita el parámetro compraId.
export const chatDeLaCompra: Href = {
  pathname: "/compras/[compraId]/chat",
  params: { compraId: "compra-martin-festival-vip" },
};

// @ts-expect-error el chat de la compra necesita su parámetro compraId
export const chatSinCompra: Href = { pathname: "/compras/[compraId]/chat" };

// Reseñar evento (feature 012): necesita el parámetro compraId.
export const reseniarEvento: Href = {
  pathname: "/compras/[compraId]/resenia",
  params: { compraId: "compra-martin-pena-general" },
};

// @ts-expect-error reseñar el evento necesita el parámetro compraId de la compra
export const reseniarSinCompra: Href = { pathname: "/compras/[compraId]/resenia" };
