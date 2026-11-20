import { EstadoCompra } from "@ai-ticket-it/shared";

import {
  normalizarCodigo,
  textoAccionDePago,
  textoAvisoDeMiCompra,
  textoCancelada,
  textoConfirmarCancelacion,
  textoConfirmarReembolso,
  textoAvisoDeCompraDelEvento,
  textoCantidad,
  textoCodigo,
  textoCodigoAccesible,
  textoCompradaEl,
  textoDiasRestantes,
  textoEntradasConfirmadas,
  textoEntradasUsadas,
  textoMotivoNoUsable,
  textoReembolsada,
  textoResumenDeTipo,
  textoTotal,
  textoVencimiento,
  textoVentanaDeUso,
} from "../../../src/features/compras/formato";
import {
  compraCancelada,
  compraCanceladaDesdeConfirmada,
  compraCanceladaPorElComprador,
  compraConfirmadaGratis,
  compraGratisCanceladaDesdeConfirmada,
  compraConfirmada,
  compraDelEvento,
  compraPendiente,
  compraReembolsada,
  entradaDelEvento,
  miCompra,
  ventanaDelFestival,
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

  it("REEMBOLSADA → cuánto se devolvió (feature 009)", () => {
    expect(textoAvisoDeMiCompra(miCompra(compraReembolsada, { canceladaPor: "usuario" }))).toBe(
      "Te devolvimos $ 60.000",
    );
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

  it("CONFIRMADA → null (REEMBOLSADA, desde la 009, dice «Reembolso confirmado»)", () => {
    expect(textoAvisoDeCompraDelEvento(compraDelEvento())).toBeNull();
  });
});

describe("textoResumenDeTipo (feature 008, US2)", () => {
  const resumen = (disponibles: number, pendientes: number, vendidas: number, usadas: number) => ({
    tipoEntrada: { id: "tipo-general", nombre: "General" },
    disponibles,
    pendientes,
    vendidas,
    usadas,
  });

  it("los cuatro números separados por ·, en plural", () => {
    expect(textoResumenDeTipo(resumen(117, 0, 3, 2))).toBe(
      "117 disponibles · 0 pendientes · 3 vendidas · 2 usadas",
    );
  });

  it("en singular cuando vale 1", () => {
    expect(textoResumenDeTipo(resumen(1, 1, 1, 1))).toBe("1 disponible · 1 pendiente · 1 vendida · 1 usada");
    expect(textoResumenDeTipo(resumen(117, 0, 3, 1))).toBe(
      "117 disponibles · 0 pendientes · 3 vendidas · 1 usada",
    );
  });

  it("todo en 0, en plural", () => {
    expect(textoResumenDeTipo(resumen(0, 0, 0, 0))).toBe(
      "0 disponibles · 0 pendientes · 0 vendidas · 0 usadas",
    );
  });
});

describe("códigos de entrada (feature 008, US3)", () => {
  it("textoCodigo los muestra en dos grupos de 4", () => {
    expect(textoCodigo("7K3MQ9TB")).toBe("7K3M-Q9TB");
  });

  it("textoCodigoAccesible los separa de a un carácter para TalkBack", () => {
    expect(textoCodigoAccesible("7K3MQ9TB")).toBe("7 K 3 M Q 9 T B");
  });

  it("normalizarCodigo: mayúsculas, sin espacios ni guiones", () => {
    expect(normalizarCodigo(" 7k3m-q9tb ")).toBe("7K3MQ9TB");
    expect(normalizarCodigo("7K3M Q9TB")).toBe("7K3MQ9TB");
  });
});

describe("textoMotivoNoUsable (feature 008, US3)", () => {
  it("CONFIRMADA con la ventana abierta → null (se puede usar)", () => {
    expect(textoMotivoNoUsable(entradaDelEvento())).toBeNull();
  });

  it("la ventana no abierta va primero, como en el servidor", () => {
    const esperado = "El ingreso se registra desde el 10/12 10:00 hasta el 11/12 02:00.";
    for (const estado of ["antes", "despues"] as const) {
      expect(textoMotivoNoUsable(entradaDelEvento({ ventanaDeUso: ventanaDelFestival(estado) }))).toBe(
        esperado,
      );
      expect(
        textoMotivoNoUsable(
          entradaDelEvento({ estado: EstadoCompra.PENDIENTE, ventanaDeUso: ventanaDelFestival(estado) }),
        ),
      ).toBe(esperado);
    }
  });

  it("según el estado de la entrada", () => {
    expect(
      textoMotivoNoUsable(
        entradaDelEvento({
          estado: EstadoCompra.UTILIZADA,
          usadaEn: "2026-12-10T23:15:00.000Z",
          usadaEnLocal: "2026-12-10T20:15",
        }),
      ),
    ).toBe("Esta entrada ya se utilizó el 10/12 20:15.");
    expect(textoMotivoNoUsable(entradaDelEvento({ estado: EstadoCompra.PENDIENTE }))).toBe(
      "La compra de esta entrada todavía no se pagó.",
    );
    expect(textoMotivoNoUsable(entradaDelEvento({ estado: EstadoCompra.CANCELADA }))).toBe(
      "La compra de esta entrada está cancelada.",
    );
    expect(textoMotivoNoUsable(entradaDelEvento({ estado: EstadoCompra.REEMBOLSADA }))).toBe(
      "La compra de esta entrada fue reembolsada.",
    );
  });
});

describe("textoAvisoDeMiCompra con UTILIZADA (feature 008)", () => {
  it("→ N de M entradas usadas", () => {
    expect(
      textoAvisoDeMiCompra(miCompra(compraConfirmada, { estado: EstadoCompra.UTILIZADA, entradasUsadas: 1 })),
    ).toBe("1 de 2 entradas usadas");
  });
});

describe("textoConfirmarCancelacion (feature 009)", () => {
  it("paga: cuántas se cancelan y el reembolso que tiene que confirmar el organizador", () => {
    expect(textoConfirmarCancelacion(compraConfirmada)).toBe(
      "Se cancelan tus 2 entradas. El organizador tiene que confirmar el reembolso de $ 60.000. No se puede deshacer.",
    );
    expect(textoConfirmarCancelacion({ ...compraConfirmada, total: 240000 })).toBe(
      "Se cancelan tus 2 entradas. El organizador tiene que confirmar el reembolso de $ 240.000. No se puede deshacer.",
    );
  });

  it("gratis de 1 y de 3: sin monto, vuelven a estar disponibles", () => {
    expect(textoConfirmarCancelacion(compraConfirmadaGratis)).toBe(
      "Se cancela tu entrada y vuelve a estar disponible. No se puede deshacer.",
    );
    expect(textoConfirmarCancelacion({ ...compraConfirmadaGratis, cantidad: 3 })).toBe(
      "Se cancelan tus 3 entradas y vuelven a estar disponibles. No se puede deshacer.",
    );
  });
});

describe("textoCancelada de una confirmada (feature 009)", () => {
  it("con el reembolso pendiente, su monto", () => {
    expect(textoCancelada(compraCanceladaDesdeConfirmada)).toBe(
      "Cancelaste esta compra. El organizador tiene que confirmar el reembolso de $ 60.000",
    );
    expect(
      textoCancelada({
        ...compraCanceladaDesdeConfirmada,
        reembolso: { estado: "pendiente", monto: 240000 },
      }),
    ).toBe("Cancelaste esta compra. El organizador tiene que confirmar el reembolso de $ 240.000");
  });

  it("gratis cancelada desde confirmada: Cancelaste esta compra", () => {
    expect(textoCancelada(compraGratisCanceladaDesdeConfirmada)).toBe("Cancelaste esta compra");
  });

  it("pendiente cancelada y vencida: los textos de la 006", () => {
    expect(textoCancelada(compraCanceladaPorElComprador)).toBe(
      "Cancelaste esta compra: sus entradas volvieron a estar disponibles.",
    );
    expect(textoCancelada(compraCancelada)).toBe(
      "Esta compra venció: sus entradas volvieron a estar disponibles.",
    );
  });
});

describe("reembolso (feature 009, US2)", () => {
  const de240 = { reembolso: { estado: "pendiente" as const, monto: 240000 }, total: 240000 };

  it("textoReembolsada → Te devolvimos $ X", () => {
    expect(
      textoReembolsada({
        ...compraReembolsada,
        total: 240000,
        reembolso: { estado: "confirmado", monto: 240000 },
      }),
    ).toBe("Te devolvimos $ 240.000");
  });

  it("textoConfirmarReembolso → Confirmás que le devolviste $ X. No se puede deshacer.", () => {
    const fila = compraDelEvento({ estado: EstadoCompra.CANCELADA, canceladaDesde: "CONFIRMADA", ...de240 });
    expect(textoConfirmarReembolso(fila)).toBe(
      "Confirmás que le devolviste $ 240.000. No se puede deshacer.",
    );
  });

  it("textoAvisoDeMiCompra: cancelada con reembolso pendiente, gratis desde confirmada y reembolsada", () => {
    const canceladaPor = { canceladaPor: "usuario" as const };
    expect(
      textoAvisoDeMiCompra(miCompra(compraCanceladaDesdeConfirmada, { ...canceladaPor, ...de240 })),
    ).toBe("El organizador tiene que confirmar el reembolso de $ 240.000");
    expect(textoAvisoDeMiCompra(miCompra(compraGratisCanceladaDesdeConfirmada, canceladaPor))).toBe(
      "Cancelaste esta compra",
    );
    expect(
      textoAvisoDeMiCompra(
        miCompra(compraReembolsada, {
          ...canceladaPor,
          total: 240000,
          reembolso: { estado: "confirmado", monto: 240000 },
        }),
      ),
    ).toBe("Te devolvimos $ 240.000");
    // Los de la 007 no cambian.
    expect(textoAvisoDeMiCompra(miCompra(compraCanceladaPorElComprador, canceladaPor))).toBe("La cancelaste");
    expect(textoAvisoDeMiCompra(miCompra(compraCancelada, { canceladaPor: "sistema" }))).toBe(
      "Venció sin pagarse",
    );
  });

  it("textoAvisoDeCompraDelEvento: reembolso pendiente, gratis desde confirmada y reembolsada", () => {
    const cancelada = (cambios: Parameters<typeof compraDelEvento>[0]) =>
      compraDelEvento({
        estado: EstadoCompra.CANCELADA,
        canceladaPor: "usuario",
        canceladaDesde: "CONFIRMADA",
        ...cambios,
      });
    expect(textoAvisoDeCompraDelEvento(cancelada(de240))).toBe(
      "La canceló el comprador · Reembolso pendiente de $ 240.000",
    );
    expect(textoAvisoDeCompraDelEvento(cancelada({ total: 0, reembolso: null }))).toBe(
      "La canceló el comprador",
    );
    expect(
      textoAvisoDeCompraDelEvento(
        compraDelEvento({ estado: EstadoCompra.REEMBOLSADA, canceladaPor: "usuario" }),
      ),
    ).toBe("Reembolso confirmado");
    expect(
      textoAvisoDeCompraDelEvento(
        compraDelEvento({ estado: EstadoCompra.CANCELADA, canceladaPor: "sistema" }),
      ),
    ).toBe("Venció sin pagarse");
  });
});
