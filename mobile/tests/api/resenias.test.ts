import { crearClienteApi, reseniarEvento } from "../../src/api";
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
