import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { Entrada, motivoNoUsable } from "../../src/domain/entrada";

const T = new Date("2026-11-20T15:00:00.000Z");

describe("Entrada (feature 010)", () => {
  it("sin uso ni cancelación: los dos en null, ni usada ni cancelada, estado propio CONFIRMADA", () => {
    const entrada = new Entrada({ codigo: "7K3MQ9TB" });

    expect(entrada.codigo).toBe("7K3MQ9TB");
    expect(entrada.uso).toBeNull();
    expect(entrada.cancelacion).toBeNull();
    expect(entrada.usada).toBe(false);
    expect(entrada.cancelada).toBe(false);
    expect(entrada.usadaEn).toBeNull();
    expect(entrada.estadoPropio).toBe(EstadoCompra.CONFIRMADA);
  });

  it("usar devuelve una entrada nueva con su uso (quién y cuándo), sin tocar la original", () => {
    const original = new Entrada({ codigo: "7K3MQ9TB" });

    const usada = original.usar("usuario-lucia", T);

    expect(usada).not.toBe(original);
    expect(usada.codigo).toBe("7K3MQ9TB");
    expect(usada.uso).toEqual({ usuarioId: "usuario-lucia", fechaHora: T });
    expect(usada.cancelacion).toBeNull();
    expect(usada.usada).toBe(true);
    expect(usada.cancelada).toBe(false);
    expect(usada.usadaEn).toEqual(T);
    expect(usada.estadoPropio).toBe(EstadoCompra.UTILIZADA);
    expect(original.uso).toBeNull();
    expect(original.usada).toBe(false);
  });

  it("cancelar devuelve una entrada nueva con su cancelación (quién y cuándo), sin tocar la original", () => {
    const original = new Entrada({ codigo: "7K3MQ9TB" });

    const cancelada = original.cancelar("usuario-martin", T);

    expect(cancelada).not.toBe(original);
    expect(cancelada.cancelacion).toEqual({ usuarioId: "usuario-martin", fechaHora: T });
    expect(cancelada.uso).toBeNull();
    expect(cancelada.cancelada).toBe(true);
    expect(cancelada.usada).toBe(false);
    expect(cancelada.usadaEn).toBeNull();
    expect(cancelada.estadoPropio).toBe(EstadoCompra.CANCELADA);
    expect(original.cancelacion).toBeNull();
    expect(original.cancelada).toBe(false);
  });

  it("recibidos en el constructor, el uso y la cancelación se conservan", () => {
    const entrada = new Entrada({
      codigo: "7K3MQ9TB",
      uso: { usuarioId: "usuario-lucia", fechaHora: T },
    });

    expect(entrada.usada).toBe(true);
    expect(entrada.usadaEn).toEqual(T);
    expect(new Entrada({ codigo: "7K3MQ9TB", cancelacion: null }).cancelada).toBe(false);
  });

  it("el uso y la cancelación están congelados (copias, no los objetos recibidos)", () => {
    const uso = { usuarioId: "usuario-lucia", fechaHora: T };
    const entrada = new Entrada({ codigo: "7K3MQ9TB", uso }).cancelar("usuario-martin", T);

    expect(Object.isFrozen(entrada.uso)).toBe(true);
    expect(Object.isFrozen(entrada.cancelacion)).toBe(true);
    uso.usuarioId = "otro";
    expect(entrada.uso?.usuarioId).toBe("usuario-lucia");
  });
});

describe("motivoNoUsable", () => {
  it.each([
    [EstadoCompra.UTILIZADA, "Esta entrada ya se utilizó."],
    [EstadoCompra.PENDIENTE, "La compra de esta entrada todavía no se pagó."],
    [EstadoCompra.CANCELADA, "La compra de esta entrada está cancelada."],
    [EstadoCompra.REEMBOLSADA, "La compra de esta entrada fue reembolsada."],
    [EstadoCompra.CONFIRMADA, "La entrada no es de esta compra."],
    [null, "La entrada no es de esta compra."],
  ])("%s → %s", (estado, mensaje) => {
    expect(motivoNoUsable(estado)).toBe(mensaje);
  });
});
