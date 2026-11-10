import { describe, expect, it } from "vitest";
import { ReglaDeNegocioError } from "../../src/domain/errores";
import type { Evento } from "../../src/domain/evento";
import { EntradaInvalidaError } from "../../src/errors/index";
import { CategoriaRepository } from "../../src/repositories/categoria.repository";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { EventoService } from "../../src/services/evento.service";
import { AHORA, DIA, evento, musica, relojFijo, teatro, tipo } from "../helpers/eventos";

// Sin servidor: el service recibe los repositorios en memoria de producción, construidos con los
// datos de cada caso, y un reloj fijo.
function crearService(eventos: Evento[] = []) {
  const repositorioEventos = new EventoRepository(eventos);
  const service = new EventoService({
    eventos: repositorioEventos,
    categorias: new CategoriaRepository([musica, teatro]),
    reloj: relojFijo(),
  });
  return { service, repositorioEventos };
}

describe("EventoService.listarMios", () => {
  it("devuelve solo los eventos que organiza el usuario (FR-002)", async () => {
    const { service } = crearService([
      evento({ id: "evento-a", organizadorId: "usuario-lucia" }),
      evento({ id: "evento-b", organizadorId: "usuario-martin" }),
    ]);
    expect((await service.listarMios("usuario-lucia")).map((e) => e.id)).toEqual(["evento-a"]);
  });

  it("ordena primero los próximos (ascendente) y después los realizados (descendente) (FR-004)", async () => {
    const { service } = crearService([
      evento({ id: "evento-pasado-viejo", en: -10 * DIA }),
      evento({ id: "evento-lejano", en: 30 * DIA }),
      evento({ id: "evento-pasado-reciente", en: -1 * DIA }),
      evento({ id: "evento-cercano", en: 1 * DIA }),
    ]);
    const vistas = await service.listarMios("usuario-lucia");
    expect(vistas.map((e) => [e.id, e.realizado])).toEqual([
      ["evento-cercano", false],
      ["evento-lejano", false],
      ["evento-pasado-reciente", true],
      ["evento-pasado-viejo", true],
    ]);
  });

  it("un evento en el instante exacto del reloj ya está realizado", async () => {
    const { service } = crearService([
      evento({ id: "evento-ahora", en: 0 }),
      evento({ id: "evento-b", en: 1 }),
    ]);
    const vistas = await service.listarMios("usuario-lucia");
    expect(vistas.map((e) => [e.id, e.realizado])).toEqual([
      ["evento-b", false],
      ["evento-ahora", true],
    ]);
  });

  it("arma la vista resumida con categoría, fechas y cantidad de tipos", async () => {
    const { service } = crearService([
      evento({
        id: "evento-a",
        nombre: "Hamlet",
        categoriaId: teatro.id,
        en: 0.25 * DIA,
        tiposEntrada: [
          tipo({ id: "tipo-a-platea", nombre: "Platea" }),
          tipo({ id: "tipo-a-pullman", nombre: "Pullman" }),
        ],
      }),
    ]);
    expect(await service.listarMios("usuario-lucia")).toEqual([
      {
        id: "evento-a",
        nombre: "Hamlet",
        categoria: { id: "categoria-teatro", nombre: "Teatro" },
        fechaHora: new Date(AHORA.getTime() + 0.25 * DIA).toISOString(),
        fechaHoraLocal: "2026-11-10T18:00",
        organizadorId: "usuario-lucia",
        realizado: false,
        cantidadTiposEntrada: 2,
      },
    ]);
  });

  it("sin eventos devuelve []", async () => {
    const { service } = crearService([evento({ organizadorId: "usuario-martin" })]);
    expect(await service.listarMios("usuario-diego")).toEqual([]);
  });
});

describe("EventoService.crear", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const datos = (cambios: { categoriaId?: string; fechaHora?: Date } = {}) => ({
    nombre: "Noche de Tango",
    descripcion: "Milonga.",
    categoriaId: cambios.categoriaId ?? musica.id,
    fechaHora: cambios.fechaHora ?? new Date(AHORA.getTime() + DIA),
    multimedia: ["https://example.com/tango.jpg"],
    tiposEntrada: [
      { nombre: "General", descripcion: "", precio: 15000, cupo: 200 },
      { nombre: "VIP", descripcion: "Mesa.", precio: 60000, cupo: 30 },
    ],
  });

  it("crea el evento con el usuario actual como organizador, ids nuevos y los tipos en orden", async () => {
    const { service, repositorioEventos } = crearService();
    const vista = await service.crear("usuario-lucia", datos());

    expect(vista.id).toMatch(UUID);
    expect(vista.tiposEntrada.map((t) => t.id)).toEqual([
      expect.stringMatching(UUID),
      expect.stringMatching(UUID),
    ]);
    expect(new Set([vista.id, ...vista.tiposEntrada.map((t) => t.id)]).size).toBe(3);
    expect(vista).toMatchObject({
      nombre: "Noche de Tango",
      descripcion: "Milonga.",
      categoria: { id: "categoria-musica", nombre: "Música" },
      fechaHora: "2026-11-11T15:00:00.000Z",
      fechaHoraLocal: "2026-11-11T12:00",
      multimedia: ["https://example.com/tango.jpg"],
      organizadorId: "usuario-lucia",
      realizado: false,
      cantidadTiposEntrada: 2,
      tiposEntrada: [
        { nombre: "General", descripcion: "", precio: 15000, cupo: 200 },
        { nombre: "VIP", descripcion: "Mesa.", precio: 60000, cupo: 30 },
      ],
    });
    expect((await repositorioEventos.buscarPorId(vista.id))?.organizadorId).toBe("usuario-lucia");
  });

  it("con una categoría inexistente responde 400 con detalle en body.categoriaId, sin guardar", async () => {
    const { service, repositorioEventos } = crearService();
    await expect(
      service.crear("usuario-lucia", datos({ categoriaId: "categoria-inexistente" })),
    ).rejects.toMatchObject({
      constructor: EntradaInvalidaError,
      detalles: [{ campo: "body.categoriaId", mensaje: "No existe la categoría." }],
    });
    expect(await repositorioEventos.listar()).toEqual([]);
  });

  it("con una fecha que no es futura según el reloj responde FECHA_NO_FUTURA, sin guardar", async () => {
    const { service, repositorioEventos } = crearService();
    await expect(service.crear("usuario-lucia", datos({ fechaHora: new Date(AHORA) }))).rejects.toMatchObject(
      {
        constructor: ReglaDeNegocioError,
        codigo: "FECHA_NO_FUTURA",
      },
    );
    expect(await repositorioEventos.listar()).toEqual([]);
  });
});
