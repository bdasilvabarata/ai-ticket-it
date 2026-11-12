import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it, vi } from "vitest";
import type { Compra } from "../../src/domain/compra";
import { ReglaDeNegocioError } from "../../src/domain/errores";
import type { Evento } from "../../src/domain/evento";
import { NoEncontradoError, ReferenciaInvalidaError, SinPermisoError } from "../../src/errors/index";
import { AHORA, DIA, compra, evento, musica, relojFijo, resenia, teatro, tipo } from "../helpers/eventos";
import { crearServicesDeEventos } from "../helpers/services-de-eventos";

// Sin servidor: el service recibe los repositorios en memoria de producción, construidos con los
// datos de cada caso, un reloj fijo y su cerrojo.
function crearService(eventos: Evento[] = [], compras: Compra[] = []) {
  const { eventoService: service, repositorioEventos } = crearServicesDeEventos({ eventos, compras });
  return { service, repositorioEventos };
}

/** Datos validados de `PUT /eventos/:id`. */
const datosEditados = (cambios: { categoriaId?: string; fechaHora?: Date } = {}) => ({
  nombre: "Nombre nuevo",
  descripcion: "Descripción nueva.",
  categoriaId: cambios.categoriaId ?? teatro.id,
  fechaHora: cambios.fechaHora ?? new Date(AHORA.getTime() + 2 * DIA),
  multimedia: [],
});

describe("EventoService.obtener", () => {
  it("devuelve la vista completa del evento", async () => {
    const { service } = crearService([evento({ id: "evento-a" })]);
    expect(await service.obtener("evento-a")).toMatchObject({
      id: "evento-a",
      descripcion: "Descripción.",
      multimedia: ["https://example.com/a.jpg"],
      tiposEntrada: [
        { id: "tipo-evento-a-general", nombre: "General", descripcion: "", precio: 1000, cupo: 10 },
      ],
    });
  });

  it("suma el organizador sin puntaje cuando no tiene reseñas, sin quitar organizadorId", async () => {
    const { service } = crearService([evento({ id: "evento-a" })]);
    const vista = await service.obtener("evento-a");
    expect(vista.organizadorId).toBe("usuario-lucia");
    expect(vista.organizador).toEqual({
      id: "usuario-lucia",
      nombre: "Lucía",
      apellido: "Álvarez",
      puntaje: null,
      cantidadResenias: 0,
    });
  });

  it("el puntaje del organizador cuenta las reseñas de todos sus eventos, también los realizados", async () => {
    const { eventoService: service } = crearServicesDeEventos({
      eventos: [
        evento({ id: "evento-a" }),
        evento({ id: "evento-pasado", en: -3 * DIA }),
        evento({ id: "evento-de-martin", organizadorId: "usuario-martin" }),
      ],
      resenias: [resenia("evento-a", 5), resenia("evento-pasado", 4), resenia("evento-de-martin", 1)],
    });
    expect((await service.obtener("evento-a")).organizador).toMatchObject({
      puntaje: 4.5,
      cantidadResenias: 2,
    });
  });

  it("lanza 404 EVENTO_NO_ENCONTRADO si no existe", async () => {
    const { service } = crearService();
    await expect(service.obtener("evento-x")).rejects.toMatchObject({
      constructor: NoEncontradoError,
      codigo: "EVENTO_NO_ENCONTRADO",
    });
  });
});

describe("EventoService.actualizar", () => {
  it("reemplaza los datos, no toca los tipos y devuelve la vista", async () => {
    const { service, repositorioEventos } = crearService([evento({ id: "evento-a" })]);
    const vista = await service.actualizar("evento-a", "usuario-lucia", datosEditados());
    expect(vista).toMatchObject({
      nombre: "Nombre nuevo",
      categoria: { id: "categoria-teatro", nombre: "Teatro" },
      multimedia: [],
      tiposEntrada: [{ id: "tipo-evento-a-general" }],
    });
    expect((await repositorioEventos.buscarPorId("evento-a"))?.nombre).toBe("Nombre nuevo");
    expect(vista.organizador).toMatchObject({ id: "usuario-lucia", puntaje: null, cantidadResenias: 0 });
  });

  it("verifica en orden: 404 → 403 → 400 categoría → 409 realizado → 409 fecha, sin guardar nada", async () => {
    const realizadoDeLucia = evento({ id: "evento-pasado", en: 0 });
    const { service, repositorioEventos } = crearService([evento({ id: "evento-a" }), realizadoDeLucia]);
    const original = await repositorioEventos.buscarPorId("evento-a");
    const pasada = new Date(AHORA.getTime() - DIA);
    const inexistente = "categoria-inexistente";

    await expect(service.actualizar("evento-x", "usuario-martin", datosEditados())).rejects.toMatchObject({
      constructor: NoEncontradoError,
      codigo: "EVENTO_NO_ENCONTRADO",
    });
    await expect(
      service.actualizar("evento-a", "usuario-martin", datosEditados({ categoriaId: inexistente })),
    ).rejects.toMatchObject({
      constructor: SinPermisoError,
      mensaje: "Solo el organizador puede modificar este evento.",
    });
    await expect(
      service.actualizar(
        "evento-pasado",
        "usuario-lucia",
        datosEditados({ categoriaId: inexistente, fechaHora: pasada }),
      ),
    ).rejects.toMatchObject({ constructor: ReferenciaInvalidaError });
    await expect(
      service.actualizar("evento-pasado", "usuario-lucia", datosEditados({ fechaHora: pasada })),
    ).rejects.toMatchObject({ codigo: "EVENTO_REALIZADO" });
    await expect(
      service.actualizar("evento-a", "usuario-lucia", datosEditados({ fechaHora: pasada })),
    ).rejects.toMatchObject({ codigo: "FECHA_NO_FUTURA" });
    expect(await repositorioEventos.buscarPorId("evento-a")).toBe(original);
    expect(await repositorioEventos.buscarPorId("evento-pasado")).toBe(realizadoDeLucia);
  });
});

describe("EventoService.eliminar", () => {
  it("elimina un evento propio, próximo y sin compras", async () => {
    const { service, repositorioEventos } = crearService([evento({ id: "evento-a" })]);
    await service.eliminar("evento-a", "usuario-lucia");
    expect(await repositorioEventos.buscarPorId("evento-a")).toBeNull();
  });

  it("verifica en orden: 404 → 403 → 409, y no elimina nada si falla", async () => {
    const conCompra = evento({ id: "evento-a" });
    const realizado = evento({ id: "evento-pasado", en: -DIA });
    const { service, repositorioEventos } = crearService(
      [conCompra, realizado],
      [compra("evento-a", "tipo-evento-a-general", EstadoCompra.CANCELADA)],
    );

    await expect(service.eliminar("evento-x", "usuario-lucia")).rejects.toMatchObject({
      codigo: "EVENTO_NO_ENCONTRADO",
    });
    await expect(service.eliminar("evento-a", "usuario-martin")).rejects.toMatchObject({
      constructor: SinPermisoError,
    });
    await expect(service.eliminar("evento-pasado", "usuario-lucia")).rejects.toMatchObject({
      codigo: "EVENTO_REALIZADO",
    });
    // Una compra cancelada también cuenta.
    await expect(service.eliminar("evento-a", "usuario-lucia")).rejects.toMatchObject({
      constructor: ReglaDeNegocioError,
      codigo: "EVENTO_CON_COMPRAS",
    });
    expect((await repositorioEventos.listar()).map((e) => e.id)).toEqual(["evento-a", "evento-pasado"]);
  });
});

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
    expect(vista.organizador).toEqual({
      id: "usuario-lucia",
      nombre: "Lucía",
      apellido: "Álvarez",
      puntaje: null,
      cantidadResenias: 0,
    });
  });

  it("con una categoría inexistente lanza una referencia inválida a categoriaId, sin guardar", async () => {
    const { service, repositorioEventos } = crearService();
    await expect(
      service.crear("usuario-lucia", datos({ categoriaId: "categoria-inexistente" })),
    ).rejects.toMatchObject({
      constructor: ReferenciaInvalidaError,
      campo: "categoriaId",
      mensaje: "No existe la categoría.",
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

describe("EventoService.listar (catálogo)", () => {
  const sinFiltros = { texto: "", orden: "fecha" } as const;
  const ids = (vista: { eventos: { id: string }[] }) => vista.eventos.map((e) => e.id);

  it("solo los no realizados, de cualquier organizador y agotados incluidos, por fecha", async () => {
    const { eventoService: service } = crearServicesDeEventos({
      eventos: [
        evento({ id: "evento-lejano", en: 9 * DIA }),
        evento({ id: "evento-ahora", en: 0 }),
        evento({ id: "evento-pasado", en: -DIA }),
        evento({ id: "evento-recien", en: 1 }),
        evento({
          id: "evento-agotado",
          organizadorId: "usuario-martin",
          en: 2 * DIA,
          tiposEntrada: [tipo({ id: "tipo-agotado", cupo: 0 })],
        }),
      ],
    });
    const catalogo = await service.listar(sinFiltros);
    expect(ids(catalogo)).toEqual(["evento-recien", "evento-agotado", "evento-lejano"]);
    expect(catalogo.hayEventosProximos).toBe(true);
  });

  it("cada evento trae precioDesde, agotado y el organizador con su puntaje (con reseñas de uno realizado)", async () => {
    const { eventoService: service } = crearServicesDeEventos({
      eventos: [
        evento({
          id: "evento-a",
          tiposEntrada: [
            tipo({ id: "tipo-a-general", precio: 8000, cupo: 0 }),
            tipo({ id: "tipo-a-kids", nombre: "Kids", precio: 0, cupo: 0 }),
          ],
        }),
        evento({ id: "evento-pasado", en: -DIA }),
      ],
      resenias: [resenia("evento-pasado", 4), resenia("evento-pasado", 5)],
    });
    const { eventos } = await service.listar(sinFiltros);
    expect(eventos).toEqual([
      {
        id: "evento-a",
        nombre: "Evento evento-a",
        categoria: { id: "categoria-musica", nombre: "Música" },
        fechaHora: "2026-11-15T15:00:00.000Z",
        fechaHoraLocal: "2026-11-15T12:00",
        organizadorId: "usuario-lucia",
        realizado: false,
        cantidadTiposEntrada: 2,
        precioDesde: 0,
        agotado: true,
        organizador: {
          id: "usuario-lucia",
          nombre: "Lucía",
          apellido: "Álvarez",
          puntaje: 4.5,
          cantidadResenias: 2,
        },
      },
    ]);
  });

  it("sin próximos responde vacío con hayEventosProximos: false, sin pedir lotes", async () => {
    const servicios = crearServicesDeEventos({ eventos: [evento({ id: "evento-pasado", en: -DIA })] });
    const categorias = vi.spyOn(servicios.repositorioCategorias, "listarPorIds");
    const usuarios = vi.spyOn(servicios.repositorioUsuarios, "listarPorIds");
    const resenias = vi.spyOn(servicios.repositorioResenias, "listarPorEventos");
    expect(await servicios.eventoService.listar(sinFiltros)).toEqual({
      eventos: [],
      hayEventosProximos: false,
    });
    expect(categorias).not.toHaveBeenCalled();
    expect(usuarios).not.toHaveBeenCalled();
    expect(resenias).not.toHaveBeenCalled();
  });

  it("lee el reloj una vez, sin cerrojo, y pide cada lote una sola vez (sin N+1)", async () => {
    const reloj = relojFijo();
    const ahora = vi.spyOn(reloj, "ahora");
    const servicios = crearServicesDeEventos({
      reloj,
      eventos: [
        evento({ id: "evento-a" }),
        evento({ id: "evento-b", organizadorId: "usuario-martin", categoriaId: teatro.id }),
        evento({ id: "evento-c", organizadorId: "usuario-sofia" }),
        evento({ id: "evento-d", organizadorId: "usuario-martin", en: -DIA }),
      ],
    });
    const cerrojo = vi.spyOn(servicios.cerrojo, "ejecutar");
    const categorias = vi.spyOn(servicios.repositorioCategorias, "listarPorIds");
    const usuarios = vi.spyOn(servicios.repositorioUsuarios, "listarPorIds");
    const resenias = vi.spyOn(servicios.repositorioResenias, "listarPorEventos");
    const listarPorOrganizador = vi.spyOn(servicios.repositorioEventos, "listarPorOrganizador");

    const catalogo = await servicios.eventoService.listar(sinFiltros);

    expect(ids(catalogo)).toEqual(["evento-a", "evento-b", "evento-c"]);
    expect(ahora).toHaveBeenCalledTimes(1);
    expect(cerrojo).not.toHaveBeenCalled();
    expect(categorias).toHaveBeenCalledTimes(1);
    expect(usuarios).toHaveBeenCalledTimes(1);
    expect(resenias).toHaveBeenCalledTimes(1);
    // El puntaje usa todos los eventos de esos organizadores, también el realizado.
    expect(resenias.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(["evento-d"]));
    expect(listarPorOrganizador).not.toHaveBeenCalled();
  });
});

describe("EventoService.listar: texto y categoría (US3)", () => {
  const ids = (vista: { eventos: { id: string }[] }) => vista.eventos.map((e) => e.id);
  const eventos = [
    evento({ id: "evento-rock", nombre: "Noche de Rock", categoriaId: musica.id, en: DIA }),
    evento({ id: "evento-hamlet", nombre: "Hamlet", categoriaId: teatro.id, en: 2 * DIA }),
    evento({ id: "evento-jazz", nombre: "Jazz en el Club", categoriaId: musica.id, en: 3 * DIA }),
    evento({ id: "evento-viejo", nombre: "Rock viejo", categoriaId: musica.id, en: -DIA }),
  ];

  it("filtra por categoría (igualdad exacta) y por texto (palabras ya normalizadas)", async () => {
    const { eventoService: service } = crearServicesDeEventos({ eventos });
    expect(ids(await service.listar({ texto: "", categoriaId: teatro.id, orden: "fecha" }))).toEqual([
      "evento-hamlet",
    ]);
    expect(ids(await service.listar({ texto: "ROCK", orden: "fecha" }))).toEqual(["evento-rock"]);
    expect(ids(await service.listar({ texto: "club   jazz", orden: "fecha" }))).toEqual(["evento-jazz"]);
  });

  it("texto y categoría se combinan", async () => {
    const { eventoService: service } = crearServicesDeEventos({ eventos });
    const catalogo = await service.listar({ texto: "rock", categoriaId: teatro.id, orden: "fecha" });
    expect(catalogo).toEqual({ eventos: [], hayEventosProximos: true });
  });

  it("una categoría que no existe rechaza sobre la consulta, sin leer eventos ni el reloj", async () => {
    const reloj = relojFijo();
    const ahora = vi.spyOn(reloj, "ahora");
    const servicios = crearServicesDeEventos({ eventos, reloj });
    const listar = vi.spyOn(servicios.repositorioEventos, "listar");
    await expect(
      servicios.eventoService.listar({ texto: "", categoriaId: "categoria-nada", orden: "fecha" }),
    ).rejects.toMatchObject({
      constructor: ReferenciaInvalidaError,
      campo: "categoriaId",
      origen: "consulta",
      mensaje: "No existe la categoría.",
    });
    expect(listar).not.toHaveBeenCalled();
    expect(ahora).not.toHaveBeenCalled();
  });

  it("una categoría que existe pero sin eventos próximos da vacío con hayEventosProximos: true, sin lotes", async () => {
    const servicios = crearServicesDeEventos({
      eventos: [evento({ id: "evento-rock", categoriaId: musica.id })],
    });
    const usuarios = vi.spyOn(servicios.repositorioUsuarios, "listarPorIds");
    const resenias = vi.spyOn(servicios.repositorioResenias, "listarPorEventos");
    expect(
      await servicios.eventoService.listar({ texto: "", categoriaId: teatro.id, orden: "fecha" }),
    ).toEqual({
      eventos: [],
      hayEventosProximos: true,
    });
    expect(usuarios).not.toHaveBeenCalled();
    expect(resenias).not.toHaveBeenCalled();
  });

  it("sin próximos, hayEventosProximos: false aunque haya texto o categoría", async () => {
    const { eventoService: service } = crearServicesDeEventos({
      eventos: [evento({ id: "evento-viejo", nombre: "Rock viejo", en: -DIA })],
    });
    expect(await service.listar({ texto: "rock", categoriaId: musica.id, orden: "fecha" })).toEqual({
      eventos: [],
      hayEventosProximos: false,
    });
  });
});

describe("EventoService.listar: orden (US4)", () => {
  const ids = (vista: { eventos: { id: string }[] }) => vista.eventos.map((e) => e.id);
  const conPrecio = (
    id: string,
    precio: number,
    cambios: { organizadorId?: string; en?: number; nombre?: string } = {},
  ) => evento({ id, ...cambios, tiposEntrada: [tipo({ id: `tipo-${id}`, precio })] });

  it("por precio, sobre lo filtrado por texto", async () => {
    const { eventoService: service } = crearServicesDeEventos({
      eventos: [
        conPrecio("evento-caro", 9000, { nombre: "Rock caro", en: DIA }),
        conPrecio("evento-gratis", 0, { nombre: "Rock gratis", en: 2 * DIA }),
        conPrecio("evento-medio", 3000, { nombre: "Jazz", en: 3 * DIA }),
      ],
    });
    expect(ids(await service.listar({ texto: "", orden: "precio" }))).toEqual([
      "evento-gratis",
      "evento-medio",
      "evento-caro",
    ]);
    expect(ids(await service.listar({ texto: "rock", orden: "precio" }))).toEqual([
      "evento-gratis",
      "evento-caro",
    ]);
  });

  it("por puntaje del organizador, contando las reseñas de un evento realizado; sin reseñas al final", async () => {
    const { eventoService: service } = crearServicesDeEventos({
      eventos: [
        evento({ id: "evento-sin", organizadorId: "usuario-diego", en: DIA }),
        evento({ id: "evento-lucia", organizadorId: "usuario-lucia", en: 2 * DIA }),
        evento({ id: "evento-martin", organizadorId: "usuario-martin", en: 3 * DIA }),
        evento({ id: "evento-martin-pasado", organizadorId: "usuario-martin", en: -DIA }),
      ],
      resenias: [resenia("evento-lucia", 3), resenia("evento-martin-pasado", 5)],
    });
    expect(ids(await service.listar({ texto: "", orden: "puntaje" }))).toEqual([
      "evento-martin",
      "evento-lucia",
      "evento-sin",
    ]);
  });
});
