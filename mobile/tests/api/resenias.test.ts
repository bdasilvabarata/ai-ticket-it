import {
  crearClienteApi,
  obtenerReseniasDelOrganizador,
  obtenerResumenDeResenias,
  reseniarEvento,
} from "../../src/api";
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

describe("reseniarEvento (feature 012)", () => {
  it("envía POST /eventos/:id/resenias con { puntuacion, comentario } sin recortar, en nombre del usuario dado", async () => {
    const vista = { id: "resenia-1", puntuacion: 4 };
    const { cliente, falso } = armar({ status: 201, json: vista });

    await expect(
      reseniarEvento(
        cliente,
        "evento-pena",
        { puntuacion: 4, comentario: "  Muy buena  " },
        { usuarioId: "usuario-martin" },
      ),
    ).resolves.toEqual(vista);

    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/eventos/evento-pena/resenias`, metodo: "POST" });
    expect(JSON.parse(falso.pedidos[0].cuerpo ?? "null")).toEqual({
      puntuacion: 4,
      comentario: "  Muy buena  ",
    });
    expect(falso.pedidos[0].encabezados).toMatchObject({
      "X-Usuario-Id": "usuario-martin",
      "Content-Type": "application/json",
    });
  });

  it("solo manda puntuacion y comentario, aunque los datos traigan otras claves", async () => {
    const { cliente, falso } = armar({ status: 201, json: {} });
    const datos = { puntuacion: 5, comentario: "", compradorId: "usuario-lucia" };

    await reseniarEvento(cliente, "evento-pena", datos, { usuarioId: "usuario-martin" });

    expect(JSON.parse(falso.pedidos[0].cuerpo ?? "null")).toEqual({ puntuacion: 5, comentario: "" });
  });
});

describe("obtenerResumenDeResenias (feature 013, US4)", () => {
  it("pide GET /eventos/:id/resenias-del-organizador/resumen, sin usuario, y pasa el signal", async () => {
    const vista = {
      organizador: {
        id: "usuario-martin",
        nombre: "Martín",
        apellido: "Benítez",
        puntaje: 5,
        cantidadResenias: 1,
      },
      resenias: [],
    };
    const { cliente, falso } = armar({ status: 200, json: vista });
    const controlador = new AbortController();
    const get = jest.spyOn(cliente, "get");

    await expect(
      obtenerResumenDeResenias(cliente, "evento-hamlet", { signal: controlador.signal }),
    ).resolves.toEqual(vista);

    expect(falso.pedidos[0]).toMatchObject({
      url: `${URL}/eventos/evento-hamlet/resenias-del-organizador/resumen`,
      metodo: "GET",
    });
    expect(get).toHaveBeenCalledWith("/eventos/evento-hamlet/resenias-del-organizador/resumen", {
      signal: controlador.signal,
    });
  });
});

describe("obtenerReseniasDelOrganizador (feature 013, US5)", () => {
  const vista = {
    organizador: {
      id: "usuario-martin",
      nombre: "Martín",
      apellido: "Benítez",
      puntaje: 5,
      cantidadResenias: 11,
    },
    resenias: [],
    pagina: { numero: 2, tamano: 10, totalElementos: 11, totalPaginas: 2 },
  };

  it("en la página 1 pide GET /eventos/:id/resenias-del-organizador sin ?pagina, sin usuario, con el signal", async () => {
    const { cliente, falso } = armar({ status: 200, json: vista });
    const controlador = new AbortController();
    const get = jest.spyOn(cliente, "get");

    await expect(
      obtenerReseniasDelOrganizador(cliente, "evento-jazz", 1, { signal: controlador.signal }),
    ).resolves.toEqual(vista);

    expect(falso.pedidos[0]).toMatchObject({
      url: `${URL}/eventos/evento-jazz/resenias-del-organizador`,
      metodo: "GET",
    });
    expect(get).toHaveBeenCalledWith("/eventos/evento-jazz/resenias-del-organizador", {
      signal: controlador.signal,
    });
  });

  it("en otra página agrega ?pagina=N", async () => {
    const { cliente, falso } = armar({ status: 200, json: vista });

    await obtenerReseniasDelOrganizador(cliente, "evento-jazz", 2);

    expect(falso.pedidos[0].url).toBe(`${URL}/eventos/evento-jazz/resenias-del-organizador?pagina=2`);
  });
});
