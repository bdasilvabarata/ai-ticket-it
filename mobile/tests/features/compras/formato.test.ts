import { textoCantidad, textoTotal, textoVencimiento } from "../../../src/features/compras/formato";

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
