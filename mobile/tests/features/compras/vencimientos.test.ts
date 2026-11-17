import { EstadoCompra, type MiCompraVista } from "@ai-ticket-it/shared";

import { esperaHastaElProximoVencimiento } from "../../../src/features/compras/vencimientos";
import { compraCancelada, compraConfirmada, compraPendiente, miCompra } from "../../helpers/compras";

const AHORA = Date.parse("2026-11-12T18:20:00.000Z");
const MINUTO = 60_000;

/** Una pendiente que vence a `ms` de `AHORA`. */
const pendienteQueVenceEn = (id: string, ms: number): MiCompraVista =>
  miCompra(compraPendiente, { id, venceEn: new Date(AHORA + ms).toISOString() });

describe("esperaHastaElProximoVencimiento (R9)", () => {
  it("sin compras no programa nada", () => {
    expect(esperaHastaElProximoVencimiento([], AHORA)).toBeNull();
  });

  it("sin pendientes (solo confirmadas y canceladas) no programa nada", () => {
    const compras = [
      miCompra(compraConfirmada, { id: "confirmada" }),
      miCompra(compraCancelada, { id: "cancelada", canceladaPor: "sistema" }),
      miCompra(compraPendiente, { id: "utilizada", estado: EstadoCompra.UTILIZADA, venceEn: null }),
    ];
    expect(esperaHastaElProximoVencimiento(compras, AHORA)).toBeNull();
  });

  it("una pendiente que vence en 2 minutos: 2 min + 1 s", () => {
    expect(esperaHastaElProximoVencimiento([pendienteQueVenceEn("p", 2 * MINUTO)], AHORA)).toBe(121_000);
  });

  it("con varias pendientes, la más próxima + 1 s", () => {
    const compras = [
      pendienteQueVenceEn("lejana", 10 * MINUTO),
      miCompra(compraConfirmada, { id: "confirmada" }),
      pendienteQueVenceEn("proxima", 3 * MINUTO),
      pendienteQueVenceEn("media", 7 * MINUTO),
    ];
    expect(esperaHastaElProximoVencimiento(compras, AHORA)).toBe(3 * MINUTO + 1000);
  });

  it("una ya pasada o que vence en menos de 4 s espera el mínimo de 5 s", () => {
    expect(esperaHastaElProximoVencimiento([pendienteQueVenceEn("pasada", -MINUTO)], AHORA)).toBe(5000);
    expect(esperaHastaElProximoVencimiento([pendienteQueVenceEn("ya", 3999)], AHORA)).toBe(5000);
    expect(esperaHastaElProximoVencimiento([pendienteQueVenceEn("justo", 4000)], AHORA)).toBe(5000);
    expect(esperaHastaElProximoVencimiento([pendienteQueVenceEn("apenas", 4001)], AHORA)).toBe(5001);
  });
});
