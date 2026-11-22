import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it, vi } from "vitest";
import type { Compra } from "../../src/domain/compra";
import { ReglaDeNegocioError } from "../../src/domain/errores";
import type { Evento } from "../../src/domain/evento";
import { Resenia } from "../../src/domain/resenia";
import { NoEncontradoError, ReferenciaInvalidaError, SinPermisoError } from "../../src/errors/index";
import {
  AHORA,
  DIA,
  HORA,
  compra,
  evento,
  musica,
  relojFijo,
  relojMovible,
  resenia,
  SIN_PAGINAS,
  teatro,
  tipo,
} from "../helpers/eventos";
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

describe("EventoService.obtenerPorIds (feature 007)", () => {
  const eventos = () => [evento({ id: "evento-a" }), evento({ id: "evento-b" }), evento({ id: "evento-c" })];

  it("devuelve un Map por id con todos los pedidos, en una sola lectura", async () => {
    const servicios = crearServicesDeEventos({ eventos: eventos() });
    const listarPorIds = vi.spyOn(servicios.repositorioEventos, "listarPorIds");
    const buscarPorId = vi.spyOn(servicios.repositorioEventos, "buscarPorId");

    const porId = await servicios.eventoService.obtenerPorIds(["evento-a", "evento-c"]);

    expect([...porId.keys()].toSorted()).toEqual(["evento-a", "evento-c"]);
    expect(porId.get("evento-a")?.id).toBe("evento-a");
    expect(porId.get("evento-c")?.id).toBe("evento-c");
    expect(listarPorIds).toHaveBeenCalledTimes(1);
    expect(buscarPorId).not.toHaveBeenCalled();
  });

  it("si falta alguno → 404 EVENTO_NO_ENCONTRADO", async () => {
    const { service } = crearService(eventos());
    const pedido = service.obtenerPorIds(["evento-a", "evento-x"]);
    await expect(pedido).rejects.toBeInstanceOf(NoEncontradoError);
    await expect(pedido).rejects.toMatchObject({ codigo: "EVENTO_NO_ENCONTRADO" });
  });

  it("no toma el cerrojo ni guarda nada", async () => {
    const servicios = crearServicesDeEventos({ eventos: eventos() });
    const cerrojo = vi.spyOn(servicios.cerrojo, "ejecutar");
    const guardarEvento = vi.spyOn(servicios.repositorioEventos, "guardar");
    const guardarCompra = vi.spyOn(servicios.repositorioCompras, "guardar");

    await servicios.eventoService.obtenerPorIds(["evento-a", "evento-b"]);

    expect(cerrojo).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(guardarCompra).not.toHaveBeenCalled();
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
      pagina: SIN_PAGINAS,
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

describe("EventoService.listar: paginado (feature 013, R3)", () => {
  // p01…p10 de Lucía en Música; p11 de Martín y p12 de Sofía, en Teatro: la página 2 tiene otros
  // organizadores y otra categoría que la 1.
  const eventos = [
    ...Array.from({ length: 10 }, (_, i) =>
      evento({ id: `evento-p${String(i + 1).padStart(2, "0")}`, en: (i + 1) * DIA }),
    ),
    evento({ id: "evento-p11", organizadorId: "usuario-martin", categoriaId: teatro.id, en: 11 * DIA }),
    evento({ id: "evento-p12", organizadorId: "usuario-sofia", categoriaId: teatro.id, en: 12 * DIA }),
  ];

  function armar() {
    const servicios = crearServicesDeEventos({ eventos });
    return {
      ...servicios,
      cupo: vi.spyOn(servicios.vencimientoService, "cupoLiberadoPorTipo"),
      categorias: vi.spyOn(servicios.repositorioCategorias, "listarPorIds"),
      usuarios: vi.spyOn(servicios.repositorioUsuarios, "listarPorIds"),
      listar: vi.spyOn(servicios.repositorioEventos, "listar"),
      resenias: vi.spyOn(servicios.repositorioResenias, "listarPorEventos"),
    };
  }

  it("el cupo al día, las categorías y los organizadores se piden solo para los eventos de la página 1", async () => {
    const { eventoService, cupo, categorias, usuarios } = armar();
    const vista = await eventoService.listar({ texto: "", orden: "fecha", pagina: 1 });
    expect(vista.eventos).toHaveLength(10);
    expect(vista.pagina).toEqual({ numero: 1, tamano: 10, totalElementos: 12, totalPaginas: 2 });
    expect(cupo).toHaveBeenCalledTimes(1);
    expect(cupo.mock.calls[0]?.[0]).toEqual(eventos.slice(0, 10).map((e) => e.id));
    expect(categorias).toHaveBeenCalledTimes(1);
    expect(new Set(categorias.mock.calls[0]?.[0])).toEqual(new Set([musica.id]));
    expect(usuarios).toHaveBeenCalledTimes(1);
    expect(usuarios.mock.calls[0]?.[0]).toEqual(["usuario-lucia"]);
  });

  it("en la página 2, solo los de esa página; con un número fijo de lecturas", async () => {
    const { eventoService, cupo, categorias, usuarios, listar, resenias } = armar();
    const vista = await eventoService.listar({ texto: "", orden: "fecha", pagina: 2 });
    expect(vista.eventos.map((e) => e.id)).toEqual(["evento-p11", "evento-p12"]);
    expect(vista.pagina.numero).toBe(2);
    expect(cupo.mock.calls[0]?.[0]).toEqual(["evento-p11", "evento-p12"]);
    expect(new Set(categorias.mock.calls[0]?.[0])).toEqual(new Set([teatro.id]));
    expect(new Set(usuarios.mock.calls[0]?.[0])).toEqual(new Set(["usuario-martin", "usuario-sofia"]));
    for (const espia of [listar, cupo, categorias, usuarios, resenias])
      expect(espia).toHaveBeenCalledTimes(1);
  });

  it("los puntajes se calculan para los organizadores de todos los coincidentes (hacen falta para ordenar)", async () => {
    const { eventoService, resenias } = armar();
    await eventoService.listar({ texto: "", orden: "puntaje", pagina: 1 });
    expect(new Set(resenias.mock.calls[0]?.[0])).toEqual(new Set(eventos.map((e) => e.id)));
  });

  it("sin pagina, la 1", async () => {
    const { eventoService } = armar();
    expect((await eventoService.listar({ texto: "", orden: "fecha" })).pagina.numero).toBe(1);
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
    expect(catalogo).toEqual({ eventos: [], pagina: SIN_PAGINAS, hayEventosProximos: true });
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
      pagina: SIN_PAGINAS,
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
      pagina: SIN_PAGINAS,
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

describe("EventoService: cupo al día con compras vencidas (feature 006, R3)", () => {
  const MINUTO = 60 * 1000;
  const sinFiltros = { texto: "", orden: "fecha" } as const;
  const vip = (cupo: number) => tipo({ id: "tipo-a-vip", nombre: "VIP", cupo });
  const festival = (cupo = 48) => evento({ id: "evento-a", tiposEntrada: [vip(cupo)] });
  /** 2 VIP de Martín, PENDIENTE desde AHORA: vence a los 15 minutos. */
  const pendienteDe2 = () =>
    compra("evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, { id: "compra-pendiente", cantidad: 2 });

  function armar(eventos: Evento[] = [festival()], compras: Compra[] = [pendienteDe2()]) {
    const reloj = relojMovible();
    return { reloj, ...crearServicesDeEventos({ eventos, compras, reloj }) };
  }

  const cupoVip = (vista: { tiposEntrada: { id: string; cupo: number }[] }) =>
    vista.tiposEntrada.find((t) => t.id === "tipo-a-vip")?.cupo;

  describe("lecturas (obtener y listar): muestran el cupo al día sin guardar nada", () => {
    it("a los 15 minutos, obtener muestra el cupo devuelto (48 + 2) sin guardar el evento ni la compra", async () => {
      const { reloj, eventoService, repositorioEventos, repositorioCompras } = armar();
      const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
      const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
      reloj.avanzar(15 * MINUTO);
      expect(cupoVip(await eventoService.obtener("evento-a"))).toBe(50);
      expect(guardarEvento).not.toHaveBeenCalled();
      expect(guardarCompra).not.toHaveBeenCalled();
      expect((await repositorioCompras.buscarPorId("compra-pendiente"))?.estado).toBe(EstadoCompra.PENDIENTE);
      expect((await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(
        48,
      );
    });

    it("a los 14 minutos, todavía 48", async () => {
      const { reloj, eventoService } = armar();
      reloj.avanzar(14 * MINUTO);
      expect(cupoVip(await eventoService.obtener("evento-a"))).toBe(48);
    });

    it("listar recalcula agotado: un evento con todo en 0 más una vencida deja de estar agotado", async () => {
      const { reloj, eventoService, repositorioEventos, repositorioCompras } = armar([festival(0)]);
      const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
      const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
      expect((await eventoService.listar(sinFiltros)).eventos[0]?.agotado).toBe(true);
      reloj.avanzar(15 * MINUTO);
      expect((await eventoService.listar(sinFiltros)).eventos[0]?.agotado).toBe(false);
      expect(guardarEvento).not.toHaveBeenCalled();
      expect(guardarCompra).not.toHaveBeenCalled();
    });

    it("listar con varios eventos hace una sola listarPendientesPorEventos (sin N+1)", async () => {
      const { eventoService, repositorioCompras } = armar([
        festival(),
        evento({ id: "evento-b" }),
        evento({ id: "evento-c", organizadorId: "usuario-martin" }),
      ]);
      const listarPendientes = vi.spyOn(repositorioCompras, "listarPendientesPorEventos");
      await eventoService.listar(sinFiltros);
      expect(listarPendientes).toHaveBeenCalledTimes(1);
    });
  });

  describe("obtenerAlDia (dentro del cerrojo del que llama)", () => {
    it("404 si el evento no existe", async () => {
      const { eventoService } = armar();
      await expect(eventoService.obtenerAlDia("evento-x", AHORA)).rejects.toMatchObject({
        constructor: NoEncontradoError,
        codigo: "EVENTO_NO_ENCONTRADO",
      });
    });

    it("con vencidas, guarda las compras CANCELADA y después el evento con el cupo devuelto", async () => {
      const { eventoService, repositorioEventos, repositorioCompras } = armar();
      const orden: string[] = [];
      const guardarCompra = repositorioCompras.guardar.bind(repositorioCompras);
      const guardarEvento = repositorioEventos.guardar.bind(repositorioEventos);
      vi.spyOn(repositorioCompras, "guardar").mockImplementation(async (c) => {
        orden.push(`compra ${c.estado}`);
        await guardarCompra(c);
      });
      vi.spyOn(repositorioEventos, "guardar").mockImplementation(async (e) => {
        orden.push(`evento ${e.buscarTipoEntrada("tipo-a-vip")?.cupo}`);
        await guardarEvento(e);
      });

      const alDia = await eventoService.obtenerAlDia("evento-a", new Date(AHORA.getTime() + 15 * MINUTO));

      expect(orden).toEqual(["compra CANCELADA", "evento 50"]);
      expect(alDia.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(50);
      expect((await repositorioCompras.buscarPorId("compra-pendiente"))?.fueVencida()).toBe(true);
      expect((await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(
        50,
      );
    });

    it("sin vencidas no guarda el evento y lo devuelve tal cual", async () => {
      const { eventoService, repositorioEventos } = armar();
      const guardado = await repositorioEventos.buscarPorId("evento-a");
      const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
      expect(await eventoService.obtenerAlDia("evento-a", new Date(AHORA.getTime() + 14 * MINUTO))).toBe(
        guardado,
      );
      expect(guardarEvento).not.toHaveBeenCalled();
    });
  });

  it("obtenerDelOrganizador de otro usuario → 403 sin materializar nada", async () => {
    const { eventoService, repositorioCompras } = armar();
    await expect(
      eventoService.obtenerDelOrganizador("evento-a", "usuario-martin", new Date(AHORA.getTime() + DIA)),
    ).rejects.toMatchObject({ constructor: SinPermisoError });
    expect((await repositorioCompras.buscarPorId("compra-pendiente"))?.estado).toBe(EstadoCompra.PENDIENTE);
  });

  describe("las escrituras de la 004 materializan antes de verificar y guardar (con un solo ahora)", () => {
    it("actualizar: el cupo guardado queda igual al mostrado y la próxima lectura no vuelve a sumar", async () => {
      const { reloj, eventoService, repositorioCompras } = armar();
      reloj.avanzar(15 * MINUTO);
      const ahora = vi.spyOn(reloj, "ahora");
      expect(cupoVip(await eventoService.obtener("evento-a"))).toBe(50);
      ahora.mockClear();

      const vista = await eventoService.actualizar("evento-a", "usuario-lucia", datosEditados());

      expect(ahora).toHaveBeenCalledTimes(1);
      expect(cupoVip(vista)).toBe(50);
      expect((await repositorioCompras.buscarPorId("compra-pendiente"))?.fueVencida()).toBe(true);
      reloj.avanzar(DIA);
      expect(cupoVip(await eventoService.obtener("evento-a"))).toBe(50);
    });

    it("eliminar materializa antes de verificar: la vencida queda CANCELADA y sigue impidiendo eliminar", async () => {
      const { reloj, eventoService, repositorioEventos, repositorioCompras } = armar();
      reloj.avanzar(15 * MINUTO);
      const ahora = vi.spyOn(reloj, "ahora");

      await expect(eventoService.eliminar("evento-a", "usuario-lucia")).rejects.toMatchObject({
        codigo: "EVENTO_CON_COMPRAS",
      });

      expect(ahora).toHaveBeenCalledTimes(1);
      expect((await repositorioCompras.buscarPorId("compra-pendiente"))?.fueVencida()).toBe(true);
      expect((await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(
        50,
      );
    });
  });
});

describe("EventoService.leerDelOrganizador (feature 008, R6)", () => {
  const MINUTO = 60 * 1000;
  const vip = (cupo: number) => tipo({ id: "tipo-a-vip", nombre: "VIP", cupo });
  /** 2 VIP de Martín, PENDIENTE desde AHORA: vence a los 15 minutos. */
  const pendienteDe2 = () =>
    compra("evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, { id: "compra-pendiente", cantidad: 2 });

  function armar() {
    return crearServicesDeEventos({
      eventos: [evento({ id: "evento-a", tiposEntrada: [vip(48)] })],
      compras: [pendienteDe2()],
    });
  }

  it("evento inexistente → 404 EVENTO_NO_ENCONTRADO, antes que el permiso", async () => {
    const { eventoService } = armar();
    await expect(eventoService.leerDelOrganizador("evento-x", "usuario-martin", AHORA)).rejects.toMatchObject(
      {
        constructor: NoEncontradoError,
        codigo: "EVENTO_NO_ENCONTRADO",
      },
    );
  });

  it("otro usuario → 403 con el mensaje de las compras", async () => {
    const { eventoService } = armar();
    await expect(eventoService.leerDelOrganizador("evento-a", "usuario-martin", AHORA)).rejects.toMatchObject(
      {
        constructor: SinPermisoError,
        codigo: "SIN_PERMISO",
        mensaje: "Solo el organizador del evento puede ver sus compras.",
      },
    );
  });

  it("el organizador → el evento con el cupo al día (el mismo que obtener)", async () => {
    const { eventoService } = armar();
    const ahora = new Date(AHORA.getTime() + 15 * MINUTO);
    const alDia = await eventoService.leerDelOrganizador("evento-a", "usuario-lucia", ahora);
    expect(alDia.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(50);
    const antes = await eventoService.leerDelOrganizador(
      "evento-a",
      "usuario-lucia",
      new Date(AHORA.getTime() + 14 * MINUTO),
    );
    expect(antes.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(48);
  });

  it("no guarda nada ni toma el cerrojo", async () => {
    const { eventoService, repositorioEventos, repositorioCompras, cerrojo } = armar();
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    await eventoService.leerDelOrganizador(
      "evento-a",
      "usuario-lucia",
      new Date(AHORA.getTime() + 15 * MINUTO),
    );
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(guardarCompra).not.toHaveBeenCalled();
    expect(ejecutar).not.toHaveBeenCalled();
    expect((await repositorioCompras.buscarPorId("compra-pendiente"))?.estado).toBe(EstadoCompra.PENDIENTE);
    expect((await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(
      48,
    );
  });
});

describe("EventoService.reseniasDelOrganizador (feature 012, R7)", () => {
  const conAutor = (
    id: string,
    eventoId: string,
    compradorId: string,
    puntuacion: number,
    haceHoras: number,
  ) =>
    new Resenia({
      id,
      compradorId,
      eventoId,
      puntuacion,
      comentario: puntuacion === 5 ? "Excelente." : null,
      creadaEn: new Date(AHORA.getTime() - haceHoras * HORA),
    });
  const eventosDeLucia = [
    evento({ id: "evento-a", nombre: "Peña" }),
    evento({ id: "evento-pasado", nombre: "Jazz", en: -3 * DIA }),
  ];
  const deMartin = evento({ id: "evento-de-martin", organizadorId: "usuario-martin" });
  const resenias = [
    conAutor("resenia-1", "evento-pasado", "usuario-diego", 4, 10),
    conAutor("resenia-2", "evento-a", "usuario-sofia", 5, 2),
    conAutor("resenia-3", "evento-pasado", "usuario-martin", 3, 10),
    conAutor("resenia-otro", "evento-de-martin", "usuario-diego", 1, 1),
  ];
  const servicios = () => crearServicesDeEventos({ eventos: [...eventosDeLucia, deMartin], resenias });

  it("evento inexistente → 404 EVENTO_NO_ENCONTRADO", async () => {
    const { eventoService } = servicios();
    await expect(eventoService.reseniasDelOrganizador("evento-x")).rejects.toMatchObject({
      codigo: "EVENTO_NO_ENCONTRADO",
    });
    await expect(eventoService.reseniasDelOrganizador("evento-x")).rejects.toBeInstanceOf(NoEncontradoError);
  });

  it("las de todos los eventos del organizador (también el que se mira), ordenadas, sin las de otros", async () => {
    const { eventoService } = servicios();
    const vista = await eventoService.reseniasDelOrganizador("evento-a");
    expect(vista.resenias).toEqual([
      {
        id: "resenia-2",
        puntuacion: 5,
        comentario: "Excelente.",
        autor: { nombre: "Sofía", apellido: "Castro" },
        evento: { id: "evento-a", nombre: "Peña" },
        creadaEn: new Date(AHORA.getTime() - 2 * HORA).toISOString(),
        creadaEnLocal: expect.any(String),
      },
      expect.objectContaining({
        id: "resenia-1",
        autor: { nombre: "Diego", apellido: "Fernández" },
        evento: { id: "evento-pasado", nombre: "Jazz" },
        comentario: null,
      }),
      expect.objectContaining({ id: "resenia-3", autor: { nombre: "Martín", apellido: "Benítez" } }),
    ]);
  });

  it("el organizador con el puntaje sin redondear, igual al del detalle (FR-018)", async () => {
    const { eventoService } = servicios();
    const vista = await eventoService.reseniasDelOrganizador("evento-pasado");
    expect(vista.organizador).toEqual({
      id: "usuario-lucia",
      nombre: "Lucía",
      apellido: "Álvarez",
      puntaje: 4,
      cantidadResenias: 3,
    });
    expect(vista.organizador.cantidadResenias).toBe(vista.resenias.length);
    expect(vista.organizador).toEqual((await eventoService.obtener("evento-pasado")).organizador);
  });

  it("sin reseñas: puntaje null, cantidad 0 y la lista vacía", async () => {
    const { eventoService } = crearServicesDeEventos({ eventos: [evento({ id: "evento-a" })] });
    expect(await eventoService.reseniasDelOrganizador("evento-a")).toEqual({
      organizador: {
        id: "usuario-lucia",
        nombre: "Lucía",
        apellido: "Álvarez",
        puntaje: null,
        cantidadResenias: 0,
      },
      resenias: [],
    });
  });

  it.each([
    ["sin reseñas", []],
    ["con 3 reseñas", resenias],
  ] as const)("%s: cuatro lecturas fijas, sin cerrojo ni guardar", async (_caso, lista) => {
    const s = crearServicesDeEventos({ eventos: [...eventosDeLucia, deMartin], resenias: [...lista] });
    const buscarPorId = vi.spyOn(s.repositorioEventos, "buscarPorId");
    const listarPorOrganizador = vi.spyOn(s.repositorioEventos, "listarPorOrganizador");
    const listarPorEventos = vi.spyOn(s.repositorioResenias, "listarPorEventos");
    const usuariosEnLote = vi.spyOn(s.repositorioUsuarios, "listarPorIds");
    const usuarioPorId = vi.spyOn(s.repositorioUsuarios, "buscarPorId");
    const cerrojo = vi.spyOn(s.cerrojo, "ejecutar");
    const guardarEvento = vi.spyOn(s.repositorioEventos, "guardar");
    const guardarResenia = vi.spyOn(s.repositorioResenias, "guardar");
    await s.eventoService.reseniasDelOrganizador("evento-a");
    expect(buscarPorId).toHaveBeenCalledTimes(1);
    expect(listarPorOrganizador).toHaveBeenCalledTimes(1);
    expect(listarPorOrganizador).toHaveBeenCalledWith("usuario-lucia");
    expect(listarPorEventos).toHaveBeenCalledTimes(1);
    expect(usuariosEnLote).toHaveBeenCalledTimes(1);
    expect(usuariosEnLote.mock.calls[0]?.[0]).toContain("usuario-lucia");
    expect(usuarioPorId).not.toHaveBeenCalled();
    expect(cerrojo).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(guardarResenia).not.toHaveBeenCalled();
  });
});
