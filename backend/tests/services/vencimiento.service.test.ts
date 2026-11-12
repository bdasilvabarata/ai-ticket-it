import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it, vi } from "vitest";
import type { Compra } from "../../src/domain/compra";
import { CompraRepository } from "../../src/repositories/compra.repository";
import { VencimientoService } from "../../src/services/vencimiento.service";
import { AHORA, compra } from "../helpers/eventos";

const MINUTO = 60 * 1000;
const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * MINUTO);

/** Una compra PENDIENTE de `cantidad` entradas creada hace `minutos` (a AHORA). */
function pendiente(
  id: string,
  eventoId: string,
  tipoEntradaId: string,
  minutos: number,
  cantidad = 1,
): Compra {
  return compra(eventoId, tipoEntradaId, EstadoCompra.PENDIENTE, { id, cantidad, creadaEn: hace(minutos) });
}

function crear(compras: Compra[]) {
  const repositorio = new CompraRepository(compras);
  return { service: new VencimientoService({ compras: repositorio }), repositorio };
}

describe("VencimientoService", () => {
  describe("cupoLiberadoPorTipo (lectura)", () => {
    it("cuenta solo las pendientes vencidas de esos eventos, por evento y por tipo", async () => {
      const { service } = crear([
        pendiente("a-vip-1", "evento-a", "tipo-a-vip", 15, 2),
        pendiente("a-vip-2", "evento-a", "tipo-a-vip", 30, 1),
        pendiente("a-general", "evento-a", "tipo-a-general", 20, 3),
        pendiente("a-no-vencida", "evento-a", "tipo-a-general", 14),
        compra("evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { id: "a-pagada", creadaEn: hace(60) }),
        pendiente("b-vip", "evento-b", "tipo-b-vip", 16, 4),
        pendiente("c-fuera", "evento-c", "tipo-c-vip", 60),
      ]);
      expect(await service.cupoLiberadoPorTipo(["evento-a", "evento-b"], AHORA)).toEqual(
        new Map([
          [
            "evento-a",
            new Map([
              ["tipo-a-vip", 3],
              ["tipo-a-general", 3],
            ]),
          ],
          ["evento-b", new Map([["tipo-b-vip", 4]])],
        ]),
      );
    });

    it("no guarda nada: la compra sigue PENDIENTE en el repositorio", async () => {
      const { service, repositorio } = crear([pendiente("a-vip", "evento-a", "tipo-a-vip", 15)]);
      const guardar = vi.spyOn(repositorio, "guardar");
      await service.cupoLiberadoPorTipo(["evento-a"], AHORA);
      expect(guardar).not.toHaveBeenCalled();
      expect((await repositorio.buscarPorId("a-vip"))?.estado).toBe(EstadoCompra.PENDIENTE);
    });

    it("hace una sola lectura para todos los eventos (sin N+1)", async () => {
      const { service, repositorio } = crear([]);
      const listar = vi.spyOn(repositorio, "listarPendientesPorEventos");
      await service.cupoLiberadoPorTipo(["evento-a", "evento-b", "evento-c"], AHORA);
      expect(listar).toHaveBeenCalledTimes(1);
    });

    it("sin vencidas, un Map vacío", async () => {
      const { service } = crear([pendiente("a-vip", "evento-a", "tipo-a-vip", 1)]);
      expect(await service.cupoLiberadoPorTipo(["evento-a"], AHORA)).toEqual(new Map());
    });
  });

  describe("vencerPendientes (escritura, bajo el cerrojo del que llama)", () => {
    it("guarda cada vencida como CANCELADA del sistema fechada en venceEn y devuelve el cupo liberado por tipo", async () => {
      const { service, repositorio } = crear([
        pendiente("a-vip", "evento-a", "tipo-a-vip", 20, 2),
        pendiente("a-general", "evento-a", "tipo-a-general", 15, 1),
      ]);
      expect(await service.vencerPendientes("evento-a", AHORA)).toEqual(
        new Map([
          ["tipo-a-vip", 2],
          ["tipo-a-general", 1],
        ]),
      );
      const vencida = await repositorio.buscarPorId("a-vip");
      expect(vencida?.estado).toBe(EstadoCompra.CANCELADA);
      expect(vencida?.fueVencida()).toBe(true);
      expect(vencida?.historial.at(-1)?.fechaHora).toEqual(hace(5));
      expect((await repositorio.buscarPorId("a-general"))?.fueVencida()).toBe(true);
    });

    it("no toca las no vencidas ni las de otros eventos", async () => {
      const noVencida = pendiente("a-no-vencida", "evento-a", "tipo-a-vip", 14);
      const deOtro = pendiente("b-vip", "evento-b", "tipo-b-vip", 60);
      const { service, repositorio } = crear([noVencida, deOtro]);
      expect(await service.vencerPendientes("evento-a", AHORA)).toEqual(new Map());
      expect(await repositorio.buscarPorId("a-no-vencida")).toBe(noVencida);
      expect(await repositorio.buscarPorId("b-vip")).toBe(deOtro);
    });

    it("llamado dos veces con el mismo ahora, la segunda devuelve un Map vacío (el cupo vuelve una sola vez)", async () => {
      const { service } = crear([pendiente("a-vip", "evento-a", "tipo-a-vip", 15, 2)]);
      expect(await service.vencerPendientes("evento-a", AHORA)).toEqual(new Map([["tipo-a-vip", 2]]));
      expect(await service.vencerPendientes("evento-a", AHORA)).toEqual(new Map());
    });
  });
});
