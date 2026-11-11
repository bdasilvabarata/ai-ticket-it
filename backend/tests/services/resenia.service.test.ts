import { describe, expect, it, vi } from "vitest";
import { Resenia } from "../../src/domain/resenia";
import { ReseniaRepository } from "../../src/repositories/resenia.repository";
import { ReseniaService } from "../../src/services/resenia.service";
import { DIA, evento } from "../helpers/eventos";

function resenia(id: string, eventoId: string, puntuacion: number): Resenia {
  return new Resenia({ id, compradorId: "usuario-diego", eventoId, puntuacion });
}

function crearService(resenias: Resenia[]) {
  const repositorio = new ReseniaRepository(resenias);
  return { service: new ReseniaService({ resenias: repositorio }), repositorio };
}

const deLucia = evento({ id: "evento-lucia", organizadorId: "usuario-lucia" });
const deLuciaRealizado = evento({ id: "evento-lucia-pasado", organizadorId: "usuario-lucia", en: -2 * DIA });
const deSofia = evento({ id: "evento-sofia", organizadorId: "usuario-sofia" });

describe("ReseniaService.puntajesPorOrganizador", () => {
  it("trae todos los organizadores de los eventos; los sin reseñas, sin puntaje", async () => {
    const { service } = crearService([resenia("r1", "evento-lucia", 5)]);
    const puntajes = await service.puntajesPorOrganizador([deLucia, deSofia]);
    expect(puntajes.get("usuario-lucia")).toEqual({ promedio: 5, cantidad: 1 });
    expect(puntajes.get("usuario-sofia")).toEqual({ promedio: null, cantidad: 0 });
  });

  it("cuenta las reseñas de un evento realizado", async () => {
    const { service } = crearService([
      resenia("r1", "evento-lucia", 5),
      resenia("r2", "evento-lucia-pasado", 4),
    ]);
    const puntajes = await service.puntajesPorOrganizador([deLucia, deLuciaRealizado]);
    expect(puntajes.get("usuario-lucia")).toEqual({ promedio: 4.5, cantidad: 2 });
  });

  it("hace una sola lectura con los ids de esos eventos (sin N+1)", async () => {
    const { service, repositorio } = crearService([]);
    const lecturas = vi.spyOn(repositorio, "listarPorEventos");
    await service.puntajesPorOrganizador([deLucia, deLuciaRealizado, deSofia]);
    expect(lecturas).toHaveBeenCalledTimes(1);
    expect(lecturas).toHaveBeenCalledWith(["evento-lucia", "evento-lucia-pasado", "evento-sofia"]);
  });
});

describe("ReseniaService.puntajeDe", () => {
  it("promedia las reseñas de esos eventos", async () => {
    const { service } = crearService([
      resenia("r1", "evento-lucia", 5),
      resenia("r2", "evento-lucia-pasado", 4),
      resenia("r3", "evento-sofia", 1),
    ]);
    expect(await service.puntajeDe([deLucia, deLuciaRealizado])).toEqual({ promedio: 4.5, cantidad: 2 });
  });

  it("sin reseñas no hay puntaje", async () => {
    const { service } = crearService([]);
    expect(await service.puntajeDe([deLucia])).toEqual({ promedio: null, cantidad: 0 });
  });
});
