import { describe, expect, it, vi } from "vitest";
import { Resenia } from "../../src/domain/resenia";
import { ReseniaRepository } from "../../src/repositories/resenia.repository";
import { ReseniaService } from "../../src/services/resenia.service";
import { AHORA, DIA, evento } from "../helpers/eventos";

function resenia(id: string, eventoId: string, puntuacion: number): Resenia {
  return new Resenia({
    id,
    compradorId: "usuario-diego",
    eventoId,
    puntuacion,
    comentario: null,
    creadaEn: new Date(),
  });
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

describe("ReseniaService.registrar (feature 012)", () => {
  const alta = { eventoId: "evento-lucia", compradorId: "usuario-martin", puntuacion: 4 };

  it("guarda una reseña con el id del repositorio, el comentario recortado y creadaEn = ahora", async () => {
    const { service, repositorio } = crearService([]);
    vi.spyOn(repositorio, "siguienteId").mockReturnValue("resenia-nueva");
    const guardar = vi.spyOn(repositorio, "guardar");
    const creada = await service.registrar({ ...alta, comentario: "  x  " }, AHORA);
    expect(creada).toMatchObject({ ...alta, id: "resenia-nueva", comentario: "x", creadaEn: AHORA });
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith(creada);
    expect(await repositorio.buscarPorEventoYComprador("evento-lucia", "usuario-martin")).toBe(creada);
  });

  it("un comentario vacío queda en null", async () => {
    const { service } = crearService([]);
    expect((await service.registrar({ ...alta, comentario: "" }, AHORA)).comentario).toBeNull();
    expect(
      (await service.registrar({ ...alta, eventoId: "otro", comentario: null }, AHORA)).comentario,
    ).toBeNull();
  });

  it("con una reseña previa del mismo comprador y evento lanza RESENIA_REPETIDA y no guarda", async () => {
    const previa = new Resenia({ ...alta, id: "r1", comentario: null, creadaEn: AHORA });
    const { service, repositorio } = crearService([previa]);
    const guardar = vi.spyOn(repositorio, "guardar");
    await expect(service.registrar({ ...alta, comentario: null }, AHORA)).rejects.toMatchObject({
      codigo: "RESENIA_REPETIDA",
    });
    expect(guardar).not.toHaveBeenCalled();
  });

  it("la reseña de otro evento del mismo comprador no la bloquea", async () => {
    const otra = new Resenia({
      ...alta,
      id: "r1",
      eventoId: "evento-sofia",
      comentario: null,
      creadaEn: AHORA,
    });
    const { service } = crearService([otra]);
    await expect(service.registrar({ ...alta, comentario: null }, AHORA)).resolves.toBeInstanceOf(Resenia);
  });
});

describe("ReseniaService: lecturas de la 012", () => {
  const deMartin = (id: string, eventoId: string, ms = 0) =>
    new Resenia({
      id,
      compradorId: "usuario-martin",
      eventoId,
      puntuacion: 4,
      comentario: null,
      creadaEn: new Date(AHORA.getTime() + ms),
    });

  it("deCompradorEnEvento hace una lectura y da la reseña o null", async () => {
    const r1 = deMartin("r1", "evento-lucia");
    const { service, repositorio } = crearService([r1]);
    const lectura = vi.spyOn(repositorio, "buscarPorEventoYComprador");
    expect(await service.deCompradorEnEvento("usuario-martin", "evento-lucia")).toBe(r1);
    expect(lectura).toHaveBeenCalledTimes(1);
    expect(await service.deCompradorEnEvento("usuario-martin", "evento-sofia")).toBeNull();
  });

  it("deComprador hace una lectura y arma el Map por evento", async () => {
    const r1 = deMartin("r1", "evento-lucia");
    const r2 = deMartin("r2", "evento-sofia");
    const { service, repositorio } = crearService([r1, r2, resenia("r3", "evento-lucia", 2)]);
    const lectura = vi.spyOn(repositorio, "listarPorComprador");
    const porEvento = await service.deComprador("usuario-martin");
    expect(lectura).toHaveBeenCalledTimes(1);
    expect(porEvento).toEqual(
      new Map([
        ["evento-lucia", r1],
        ["evento-sofia", r2],
      ]),
    );
  });

  it("listarDeEventos hace una lectura y ordena con compararResenias", async () => {
    const vieja = deMartin("r1", "evento-lucia", 0);
    const nueva = deMartin("r2", "evento-lucia-pasado", 2 * DIA);
    const ajena = deMartin("r3", "evento-sofia", DIA);
    const { service, repositorio } = crearService([vieja, ajena, nueva]);
    const lectura = vi.spyOn(repositorio, "listarPorEventos");
    expect(await service.listarDeEventos([deLucia, deLuciaRealizado])).toEqual([nueva, vieja]);
    expect(lectura).toHaveBeenCalledTimes(1);
  });
});
