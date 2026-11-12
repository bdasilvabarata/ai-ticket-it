import { comprarEntradas, crearClienteApi, obtenerMisComprasDelEvento } from "../../src/api";
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

describe("comprarEntradas", () => {
  it("envía POST /eventos/:id/compras con exactamente { tipoEntradaId, cantidad } en nombre del usuario dado", async () => {
    const { cliente, falso } = armar({ status: 201, json: { id: "compra-1" } });

    await expect(
      comprarEntradas(
        cliente,
        "evento-festival",
        { tipoEntradaId: "tipo-festival-vip", cantidad: 2 },
        { usuarioId: "usuario-sofia" },
      ),
    ).resolves.toEqual({ id: "compra-1" });

    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/eventos/evento-festival/compras`, metodo: "POST" });
    expect(JSON.parse(falso.pedidos[0].cuerpo ?? "null")).toEqual({
      tipoEntradaId: "tipo-festival-vip",
      cantidad: 2,
    });
    expect(falso.pedidos[0].encabezados).toMatchObject({
      "X-Usuario-Id": "usuario-sofia",
      "Content-Type": "application/json",
    });
  });

  it("no manda otros campos aunque el objeto los traiga (nunca precio ni total)", async () => {
    const { cliente, falso } = armar({ status: 201, json: {} });
    const datos = { tipoEntradaId: "tipo-a", cantidad: 1, total: 1, precio: 1 };
    await comprarEntradas(cliente, "evento-a", datos, { usuarioId: "usuario-sofia" });
    expect(JSON.parse(falso.pedidos[0].cuerpo ?? "null")).toEqual({ tipoEntradaId: "tipo-a", cantidad: 1 });
  });

  it("codifica el id del evento", async () => {
    const { cliente, falso } = armar({ status: 201, json: {} });
    await comprarEntradas(cliente, "evento a/b", { tipoEntradaId: "t", cantidad: 1 }, { usuarioId: "u" });
    expect(falso.pedidos[0].url).toBe(`${URL}/eventos/evento%20a%2Fb/compras`);
  });
});

describe("obtenerMisComprasDelEvento", () => {
  it("pide GET /eventos/:id/mis-compras con el usuario actual", async () => {
    const respuesta = { pendientes: [], restantesPorTipo: [] };
    const { cliente, falso } = armar({ status: 200, json: respuesta });

    await expect(obtenerMisComprasDelEvento(cliente, "evento a/b")).resolves.toEqual(respuesta);
    expect(falso.pedidos[0]).toMatchObject({
      url: `${URL}/eventos/evento%20a%2Fb/mis-compras`,
      metodo: "GET",
    });
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-actual");
  });

  it("pasa el signal", async () => {
    const { cliente } = armar({ status: 200, json: {} });
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();
    await obtenerMisComprasDelEvento(cliente, "evento-festival", { signal: controlador.signal });
    expect(get).toHaveBeenCalledWith("/eventos/evento-festival/mis-compras", { signal: controlador.signal });
  });
});
