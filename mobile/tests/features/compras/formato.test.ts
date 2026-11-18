import { EstadoCompra } from "@ai-ticket-it/shared";

import {
  textoAccionDePago,
  textoAvisoDeMiCompra,
  textoCancelada,
  textoAvisoDeCompraDelEvento,
  textoCantidad,
  textoCompradaEl,
  textoDiasRestantes,
  textoEntradasConfirmadas,
  textoEntradasUsadas,
  textoTotal,
  textoVencimiento,
  textoVentanaDeUso,
} from "../../../src/features/compras/formato";
import {
  compraCancelada,
  compraCanceladaPorElComprador,
  compraConfirmada,
  compraDelEvento,
  compraPendiente,
  miCompra,
} from "../../helpers/compras";

describe("textoTotal", () => {
  it("0 → Gratis", () => {
    expect(textoTotal(0)).toBe("Gratis");
  });

  it("240000 → $ 240.000", () => {
    expect(textoTotal(240000)).toBe("$ 240.000");
  });
});

describe("textoCantidad", () => {
  it("1 → 1 entrada; 2 → 2 entradas", () => {
    expect(textoCantidad(1)).toBe("1 entrada");
    expect(textoCantidad(2)).toBe("2 entradas");
  });
});

describe("textoVencimiento", () => {
  it('"2026-11-12T15:35" → Podés pagar hasta las 15:35 (sin convertir zonas)', () => {
    expect(textoVencimiento("2026-11-12T15:35")).toBe("Podés pagar hasta las 15:35");
  });
});

describe("textoCancelada", () => {
  it("vencida (el sistema) o cancelada por su comprador", () => {
    expect(textoCancelada(compraCancelada)).toBe(
      "Esta compra venció: sus entradas volvieron a estar disponibles.",
    );
    expect(textoCancelada(compraCanceladaPorElComprador)).toBe(
      "Cancelaste esta compra: sus entradas volvieron a estar disponibles.",
    );
  });
});

describe("textoEntradasConfirmadas", () => {
  it("1 → singular; 3 → plural", () => {
    expect(textoEntradasConfirmadas(1)).toBe("Tenés 1 entrada confirmada para este evento");
    expect(textoEntradasConfirmadas(3)).toBe("Tenés 3 entradas confirmadas para este evento");
  });
});

describe("textoDiasRestantes", () => {
  it("0 → la hora del evento de hoy; 1 → Mañana; N → Faltan N días", () => {
    expect(textoDiasRestantes(0, "2026-12-01T21:00")).toBe("Hoy · 21:00");
    expect(textoDiasRestantes(1, "2026-12-02T21:00")).toBe("Mañana");
    expect(textoDiasRestantes(2, "2026-12-03T21:00")).toBe("Faltan 2 días");
    expect(textoDiasRestantes(10, "2026-12-11T21:00")).toBe("Faltan 10 días");
  });
});

describe("textoAvisoDeMiCompra", () => {
  const confirmada = (cambios: Parameters<typeof miCompra>[1]) => miCompra(compraConfirmada, cambios);
  const evento = compraConfirmada.evento;

  it("CONFIRMADA de un evento realizado → Evento realizado", () => {
    expect(
      textoAvisoDeMiCompra(confirmada({ evento: { ...evento, realizado: true }, diasRestantes: null })),
    ).toBe("Evento realizado");
  });

  it("CONFIRMADA de un evento por venir → los días restantes", () => {
    expect(
      textoAvisoDeMiCompra(
        confirmada({ evento: { ...evento, fechaHoraLocal: "2026-12-01T21:00" }, diasRestantes: 0 }),
      ),
    ).toBe("Hoy · 21:00");
    expect(textoAvisoDeMiCompra(confirmada({ diasRestantes: 1 }))).toBe("Mañana");
    expect(textoAvisoDeMiCompra(confirmada({ diasRestantes: 10 }))).toBe("Faltan 10 días");
  });

  it("UTILIZADA y REEMBOLSADA → sin aviso", () => {
    expect(textoAvisoDeMiCompra(confirmada({ estado: EstadoCompra.UTILIZADA }))).toBeNull();
    expect(textoAvisoDeMiCompra(confirmada({ estado: EstadoCompra.REEMBOLSADA }))).toBeNull();
  });
});

describe("textoAccionDePago", () => {
  it("gratis → Confirmar; con precio → Pagar", () => {
    expect(textoAccionDePago(0)).toBe("Confirmar");
    expect(textoAccionDePago(120000)).toBe("Pagar");
  });
});

describe("textoAvisoDeMiCompra: pendientes y canceladas (US3)", () => {
  it("PENDIENTE → hasta qué hora se puede pagar", () => {
    expect(
      textoAvisoDeMiCompra(
        miCompra(compraPendiente, { estado: EstadoCompra.PENDIENTE, venceEnLocal: "2026-12-01T15:35" }),
      ),
    ).toBe("Podés pagar hasta las 15:35");
  });

  it("CANCELADA por el sistema → Venció sin pagarse; por su comprador → La cancelaste", () => {
    const cancelada = (canceladaPor: "sistema" | "usuario") =>
      miCompra(compraPendiente, {
        estado: EstadoCompra.CANCELADA,
        venceEn: null,
        venceEnLocal: null,
        canceladaPor,
      });
    expect(textoAvisoDeMiCompra(cancelada("sistema"))).toBe("Venció sin pagarse");
    expect(textoAvisoDeMiCompra(cancelada("usuario"))).toBe("La cancelaste");
  });
});

describe("textoCompradaEl (feature 008)", () => {
  it('"2026-11-18T15:20" → Comprada el 18/11 15:20 (sin convertir zonas)', () => {
    expect(textoCompradaEl("2026-11-18T15:20")).toBe("Comprada el 18/11 15:20");
  });
});

describe("textoVentanaDeUso (feature 008)", () => {
  const ventana = (estado: "antes" | "abierta" | "despues") => ({
    desde: "2026-11-18T20:00:00.000Z",
    hasta: "2026-11-19T12:00:00.000Z",
    desdeLocal: "2026-11-18T17:00",
    hastaLocal: "2026-11-19T09:00",
    estado,
  });

  it("abierta → Ingresos habilitados hasta el 19/11 09:00", () => {
    expect(textoVentanaDeUso(ventana("abierta"))).toBe("Ingresos habilitados hasta el 19/11 09:00");
  });

  it("antes → Podés registrar ingresos desde el 18/11 17:00", () => {
    expect(textoVentanaDeUso(ventana("antes"))).toBe("Podés registrar ingresos desde el 18/11 17:00");
  });

  it("despues → Los ingresos se registraron hasta el 19/11 09:00", () => {
    expect(textoVentanaDeUso(ventana("despues"))).toBe("Los ingresos se registraron hasta el 19/11 09:00");
  });
});

describe("textoEntradasUsadas (feature 008)", () => {
  it("(1, 3) → 1 de 3 entradas usadas; (1, 1) → 1 de 1 entrada usada", () => {
    expect(textoEntradasUsadas(1, 3)).toBe("1 de 3 entradas usadas");
    expect(textoEntradasUsadas(1, 1)).toBe("1 de 1 entrada usada");
    expect(textoEntradasUsadas(2, 4)).toBe("2 de 4 entradas usadas");
  });
});

describe("textoAvisoDeCompraDelEvento (feature 008)", () => {
  it("PENDIENTE → Puede pagarla hasta las 15:35", () => {
    const pendiente = compraDelEvento({
      estado: EstadoCompra.PENDIENTE,
      venceEn: "2026-11-18T18:35:00.000Z",
      venceEnLocal: "2026-11-18T15:35",
    });
    expect(textoAvisoDeCompraDelEvento(pendiente)).toBe("Puede pagarla hasta las 15:35");
  });

  it("CANCELADA por el sistema → Venció sin pagarse; por el comprador → La canceló el comprador", () => {
    expect(
      textoAvisoDeCompraDelEvento(
        compraDelEvento({ estado: EstadoCompra.CANCELADA, canceladaPor: "sistema" }),
      ),
    ).toBe("Venció sin pagarse");
    expect(
      textoAvisoDeCompraDelEvento(
        compraDelEvento({ estado: EstadoCompra.CANCELADA, canceladaPor: "usuario" }),
      ),
    ).toBe("La canceló el comprador");
  });

  it("UTILIZADA → N de M entradas usadas", () => {
    expect(
      textoAvisoDeCompraDelEvento(compraDelEvento({ estado: EstadoCompra.UTILIZADA, entradasUsadas: 1 })),
    ).toBe("1 de 3 entradas usadas");
  });

  it("CONFIRMADA y REEMBOLSADA → null", () => {
    expect(textoAvisoDeCompraDelEvento(compraDelEvento())).toBeNull();
    expect(textoAvisoDeCompraDelEvento(compraDelEvento({ estado: EstadoCompra.REEMBOLSADA }))).toBeNull();
  });
});
