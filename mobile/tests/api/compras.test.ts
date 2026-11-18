import {
  comprarEntradas,
  crearClienteApi,
  ErrorDeApi,
  obtenerComprasDelEvento,
  obtenerCompra,
  obtenerEntradaDelEvento,
  obtenerMisCompras,
  obtenerMisComprasDelEvento,
  cancelarCompra,
  pagarCompra,
  registrarUsoDeEntrada,
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

describe("obtenerCompra", () => {
  it("pide GET /compras/:id con el usuario actual y codifica el id", async () => {
    const { cliente, falso } = armar({ status: 200, json: { id: "compra a/b" } });
    await expect(obtenerCompra(cliente, "compra a/b")).resolves.toEqual({ id: "compra a/b" });
    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/compras/compra%20a%2Fb`, metodo: "GET" });
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-actual");
  });

  it("pasa el signal", async () => {
    const { cliente } = armar({ status: 200, json: {} });
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();
    await obtenerCompra(cliente, "compra-1", { signal: controlador.signal });
    expect(get).toHaveBeenCalledWith("/compras/compra-1", { signal: controlador.signal });
  });
});

describe("obtenerMisCompras", () => {
  it("pide GET /compras con el usuario actual y devuelve el arreglo tal cual", async () => {
    const lista = [{ id: "compra-1" }, { id: "compra-2" }];
    const { cliente, falso } = armar({ status: 200, json: lista });
    await expect(obtenerMisCompras(cliente)).resolves.toEqual(lista);
    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/compras`, metodo: "GET" });
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-actual");
  });

  it("pasa el signal", async () => {
    const { cliente } = armar({ status: 200, json: [] });
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();
    await obtenerMisCompras(cliente, { signal: controlador.signal });
    expect(get).toHaveBeenCalledWith("/compras", { signal: controlador.signal });
  });
});

describe("obtenerComprasDelEvento (feature 008)", () => {
  it("pide GET /eventos/:id/compras con el usuario actual, sin cuerpo, y devuelve la vista", async () => {
    const vista = { evento: { id: "evento a/b" }, ventanaDeUso: {}, resumenPorTipo: [], compras: [] };
    const { cliente, falso } = armar({ status: 200, json: vista });

    await expect(obtenerComprasDelEvento(cliente, "evento a/b")).resolves.toEqual(vista);
    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/eventos/evento%20a%2Fb/compras`, metodo: "GET" });
    expect(falso.pedidos[0].cuerpo).toBeUndefined();
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-actual");
  });

  it("pasa el signal", async () => {
    const { cliente } = armar({ status: 200, json: {} });
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();
    await obtenerComprasDelEvento(cliente, "evento-festival", { signal: controlador.signal });
    expect(get).toHaveBeenCalledWith("/eventos/evento-festival/compras", { signal: controlador.signal });
  });

  it("un 403 llega como ErrorDeApi con su código", async () => {
    const { cliente } = armar({
      status: 403,
      json: {
        error: { codigo: "SIN_PERMISO", mensaje: "Solo el organizador del evento puede ver sus compras." },
      },
    });
    const error = await obtenerComprasDelEvento(cliente, "evento-festival").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeApi);
    expect(error).toMatchObject({ status: 403, codigo: "SIN_PERMISO" });
  });
});

describe("pagarCompra", () => {
  it("envía POST /compras/:id/pago sin cuerpo, en nombre del usuario dado", async () => {
    const { cliente, falso } = armar({ status: 200, json: { id: "compra-1" } });
    await expect(pagarCompra(cliente, "compra a/b", { usuarioId: "usuario-sofia" })).resolves.toEqual({
      id: "compra-1",
    });
    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/compras/compra%20a%2Fb/pago`, metodo: "POST" });
    expect(falso.pedidos[0].cuerpo).toBeUndefined();
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-sofia");
  });
});

describe("cancelarCompra", () => {
  it("envía POST /compras/:id/cancelacion sin cuerpo, en nombre del usuario dado", async () => {
    const { cliente, falso } = armar({ status: 200, json: { id: "compra-1" } });
    await expect(cancelarCompra(cliente, "compra a/b", { usuarioId: "usuario-sofia" })).resolves.toEqual({
      id: "compra-1",
    });
    expect(falso.pedidos[0]).toMatchObject({
      url: `${URL}/compras/compra%20a%2Fb/cancelacion`,
      metodo: "POST",
    });
    expect(falso.pedidos[0].cuerpo).toBeUndefined();
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-sofia");
  });
});

describe("obtenerEntradaDelEvento (feature 008)", () => {
  it("pide GET /eventos/:id/entradas/:codigo con el usuario actual, el código escapado y sin cuerpo", async () => {
    const vista = { codigo: "7K3MQ9TB" };
    const { cliente, falso } = armar({ status: 200, json: vista });

    await expect(obtenerEntradaDelEvento(cliente, "evento-festival", "7K3M Q9/TB")).resolves.toEqual(vista);
    expect(falso.pedidos[0]).toMatchObject({
      url: `${URL}/eventos/evento-festival/entradas/7K3M%20Q9%2FTB`,
      metodo: "GET",
    });
    expect(falso.pedidos[0].cuerpo).toBeUndefined();
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-actual");
  });

  it("pasa el signal", async () => {
    const { cliente } = armar({ status: 200, json: {} });
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();
    await obtenerEntradaDelEvento(cliente, "evento-festival", "7K3MQ9TB", { signal: controlador.signal });
    expect(get).toHaveBeenCalledWith("/eventos/evento-festival/entradas/7K3MQ9TB", {
      signal: controlador.signal,
    });
  });
});

describe("registrarUsoDeEntrada (feature 008)", () => {
  it("envía POST /eventos/:id/entradas/:codigo/uso sin cuerpo, en nombre del usuario dado", async () => {
    const { cliente, falso } = armar({ status: 200, json: { codigo: "7K3MQ9TB" } });
    await expect(
      registrarUsoDeEntrada(cliente, "evento-festival", "7K3M/Q9TB", { usuarioId: "usuario-lucia" }),
    ).resolves.toEqual({ codigo: "7K3MQ9TB" });
    expect(falso.pedidos[0]).toMatchObject({
      url: `${URL}/eventos/evento-festival/entradas/7K3M%2FQ9TB/uso`,
      metodo: "POST",
    });
    expect(falso.pedidos[0].cuerpo).toBeUndefined();
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-lucia");
  });

  it("un 409 llega como ErrorDeApi con su mensaje", async () => {
    const { cliente } = armar({
      status: 409,
      json: { error: { codigo: "TRANSICION_INVALIDA", mensaje: "Esta entrada ya se utilizó." } },
    });
    const error = await registrarUsoDeEntrada(cliente, "evento-festival", "7K3MQ9TB", {
      usuarioId: "usuario-lucia",
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeApi);
    expect(error).toMatchObject({
      status: 409,
      codigo: "TRANSICION_INVALIDA",
      mensaje: "Esta entrada ya se utilizó.",
    });
  });
});
