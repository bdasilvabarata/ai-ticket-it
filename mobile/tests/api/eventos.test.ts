import {
  actualizarEvento,
  agregarTipoEntrada,
  crearClienteApi,
  crearEvento,
  editarTipoEntrada,
  eliminarEvento,
  listarEventos,
  listarMisEventos,
  obtenerEvento,
  quitarTipoEntrada,
  type CuerpoNuevoEvento,
} from "../../src/api";
import { festival, festivalCompleto, nocheDeRock } from "../helpers/eventos";
import { crearFetchFalso, type RespuestaFalsa } from "../helpers/fetch-falso";

const URL = "http://servidor:3000/api";

function armar(respuesta: RespuestaFalsa = { status: 200, json: {} }) {
  const falso = crearFetchFalso([respuesta]);
  const cliente = crearClienteApi({
    fetch: falso.fetch,
    urlBase: URL,
    obtenerUsuarioId: () => "usuario-actual",
    alUsuarioNoIdentificado: () => {},
  });
  return { cliente, falso };
}

const cuerpo: CuerpoNuevoEvento = {
  nombre: "Noche de Tango",
  descripcion: "",
  categoriaId: "categoria-musica",
  fechaHora: "2026-12-01T20:00",
  multimedia: [],
  tiposEntrada: [{ nombre: "General", descripcion: "", precio: 15000, cupo: null }],
};
const datosEvento = { nombre: "Otro", descripcion: "", categoriaId: null, fechaHora: null, multimedia: [] };
const datosTipo = { nombre: "Platea", descripcion: "", precio: 0, cupo: "diez" };

describe("funciones de eventos: lecturas", () => {
  it("listarMisEventos pide GET /eventos/mios con el usuario actual y respeta el orden", async () => {
    const { cliente, falso } = armar({ status: 200, json: [nocheDeRock, festival] });

    await expect(listarMisEventos(cliente)).resolves.toEqual([nocheDeRock, festival]);
    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/eventos/mios`, metodo: "GET" });
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-actual");
  });

  it("listarMisEventos y obtenerEvento pasan el signal", async () => {
    const { cliente } = armar({ status: 200, json: [] });
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();

    await listarMisEventos(cliente, { signal: controlador.signal });
    await obtenerEvento(cliente, "evento-festival", { signal: controlador.signal });
    expect(get).toHaveBeenNthCalledWith(1, "/eventos/mios", { signal: controlador.signal });
    expect(get).toHaveBeenNthCalledWith(2, "/eventos/evento-festival", { signal: controlador.signal });
  });

  it("obtenerEvento pide GET /eventos/:eventoId", async () => {
    const { cliente, falso } = armar({ status: 200, json: festivalCompleto });

    await expect(obtenerEvento(cliente, "evento-festival")).resolves.toEqual(festivalCompleto);
    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/eventos/evento-festival`, metodo: "GET" });
  });
});

describe("listarEventos (catálogo, R13)", () => {
  const catalogo = { eventos: [], hayEventosProximos: true };

  it("sin parámetros pide GET /eventos?orden=fecha&sentido=asc, sin X-Usuario-Id", async () => {
    const { cliente, falso } = armar({ status: 200, json: catalogo });

    await expect(listarEventos(cliente, {})).resolves.toEqual(catalogo);
    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/eventos?orden=fecha&sentido=asc`, metodo: "GET" });
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBeUndefined();
  });

  it("solo agrega los parámetros con valor, en el orden texto, categoriaId, orden, sentido", async () => {
    const { cliente, falso } = armar({ status: 200, json: catalogo });

    await listarEventos(cliente, { orden: "precio", categoriaId: "categoria-musica", texto: "  rock  " });
    expect(falso.pedidos[0].url).toBe(
      `${URL}/eventos?texto=rock&categoriaId=categoria-musica&orden=precio&sentido=asc`,
    );
  });

  it("manda el sentido pedido", async () => {
    const { cliente, falso } = armar({ status: 200, json: catalogo });

    await listarEventos(cliente, { orden: "fecha", sentido: "desc" });
    expect(falso.pedidos[0].url).toBe(`${URL}/eventos?orden=fecha&sentido=desc`);
  });

  it("un texto vacío o de solo espacios no se manda", async () => {
    const { cliente, falso } = armar({ status: 200, json: catalogo });

    await listarEventos(cliente, { texto: "   ", orden: "puntaje" });
    expect(falso.pedidos[0].url).toBe(`${URL}/eventos?orden=puntaje&sentido=desc`);
  });

  it("codifica acentos, espacios, & y + literales", async () => {
    const { cliente, falso } = armar({ status: 200, json: catalogo });

    await listarEventos(cliente, { texto: "café con leche & rock+pop" });
    expect(falso.pedidos[0].url).toBe(
      `${URL}/eventos?texto=caf%C3%A9+con+leche+%26+rock%2Bpop&orden=fecha&sentido=asc`,
    );
  });

  it("pasa el signal y usuarioId: null", async () => {
    const { cliente } = armar({ status: 200, json: catalogo });
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();

    await listarEventos(cliente, {}, { signal: controlador.signal });
    expect(get).toHaveBeenCalledWith("/eventos?orden=fecha&sentido=asc", {
      signal: controlador.signal,
      usuarioId: null,
    });
  });
});

describe("funciones de eventos: escrituras (en nombre del usuario del formulario)", () => {
  it.each([
    [
      "crearEvento",
      (c: ReturnType<typeof armar>["cliente"]) => crearEvento(c, cuerpo, { usuarioId: "usuario-lucia" }),
      "POST",
      "/eventos",
      cuerpo,
    ],
    [
      "actualizarEvento",
      (c: ReturnType<typeof armar>["cliente"]) =>
        actualizarEvento(c, "evento-a", datosEvento, { usuarioId: "usuario-lucia" }),
      "PUT",
      "/eventos/evento-a",
      datosEvento,
    ],
    [
      "agregarTipoEntrada",
      (c: ReturnType<typeof armar>["cliente"]) =>
        agregarTipoEntrada(c, "evento-a", datosTipo, { usuarioId: "usuario-lucia" }),
      "POST",
      "/eventos/evento-a/tipos-entrada",
      datosTipo,
    ],
    [
      "editarTipoEntrada",
      (c: ReturnType<typeof armar>["cliente"]) =>
        editarTipoEntrada(c, "evento-a", "tipo-a-vip", datosTipo, { usuarioId: "usuario-lucia" }),
      "PUT",
      "/eventos/evento-a/tipos-entrada/tipo-a-vip",
      datosTipo,
    ],
  ])(
    "%s envía método, ruta, cuerpo JSON y el usuarioId recibido",
    async (_nombre, llamar, metodo, ruta, enviado) => {
      const { cliente, falso } = armar({ status: 200, json: { id: "x" } });

      await expect(llamar(cliente)).resolves.toEqual({ id: "x" });
      expect(falso.pedidos[0]).toMatchObject({ url: `${URL}${ruta}`, metodo });
      expect(JSON.parse(falso.pedidos[0].cuerpo ?? "null")).toEqual(enviado);
      expect(falso.pedidos[0].encabezados).toMatchObject({
        "X-Usuario-Id": "usuario-lucia",
        "Content-Type": "application/json",
      });
    },
  );

  it.each([
    [
      "eliminarEvento",
      (c: ReturnType<typeof armar>["cliente"]) =>
        eliminarEvento(c, "evento-a", { usuarioId: "usuario-lucia" }),
      "/eventos/evento-a",
    ],
    [
      "quitarTipoEntrada",
      (c: ReturnType<typeof armar>["cliente"]) =>
        quitarTipoEntrada(c, "evento-a", "tipo-a-vip", { usuarioId: "usuario-lucia" }),
      "/eventos/evento-a/tipos-entrada/tipo-a-vip",
    ],
  ])("%s pide DELETE sin cuerpo y resuelve undefined ante el 204", async (_nombre, llamar, ruta) => {
    const { cliente, falso } = armar({ status: 204, texto: "" });

    await expect(llamar(cliente)).resolves.toBeUndefined();
    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}${ruta}`, metodo: "DELETE", cuerpo: undefined });
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-lucia");
  });
});
