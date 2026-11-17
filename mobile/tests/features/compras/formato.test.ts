import { EstadoCompra } from "@ai-ticket-it/shared";

import {
  textoAvisoDeMiCompra,
  textoCancelada,
  textoCantidad,
  textoDiasRestantes,
  textoEntradasConfirmadas,
  textoTotal,
  textoVencimiento,
} from "../../../src/features/compras/formato";
import {
  compraCancelada,
  compraCanceladaPorElComprador,
  compraConfirmada,
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
