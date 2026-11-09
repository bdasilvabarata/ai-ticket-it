import { crearClienteApi, ErrorDeApi, ServidorNoDisponibleError } from "../../src/api";
import { crearFetchFalso, type Respuestas } from "../helpers/fetch-falso";

const URL_BASE = "http://servidor:3000/api";

function armar(
  respuestas: Respuestas,
  opciones: { usuarioId?: string | null; tiempoLimiteMs?: number } = {},
) {
  const falso = crearFetchFalso(respuestas);
  const alUsuarioNoIdentificado = jest.fn<void, [string]>();
  const cliente = crearClienteApi({
    fetch: falso.fetch,
    urlBase: URL_BASE,
    obtenerUsuarioId: () => opciones.usuarioId ?? null,
    alUsuarioNoIdentificado,
    tiempoLimiteMs: opciones.tiempoLimiteMs,
  });
  return { cliente, falso, alUsuarioNoIdentificado };
}

async function capturar(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error("se esperaba un rechazo");
}

describe("crearClienteApi", () => {
  it("expone la urlBase y pide {urlBase}{ruta}", async () => {
    const { cliente, falso } = armar([{ status: 200, json: [] }]);

    expect(cliente.urlBase).toBe(URL_BASE);
    await cliente.get("/usuarios");
    expect(falso.pedidos[0].url).toBe(`${URL_BASE}/usuarios`);
    expect(falso.pedidos[0].metodo).toBe("GET");
  });

  it("2xx con JSON resuelve con el cuerpo", async () => {
    const { cliente } = armar([{ status: 200, json: { estado: "ok" } }]);

    await expect(cliente.get<{ estado: string }>("/salud")).resolves.toEqual({ estado: "ok" });
  });

  it("2xx con cuerpo no JSON rechaza RESPUESTA_INESPERADA", async () => {
    const { cliente } = armar([{ status: 200, texto: "<html>hola</html>" }]);

    const error = await capturar(cliente.get("/salud"));
    expect(error).toBeInstanceOf(ErrorDeApi);
    expect(error).toMatchObject({ status: 200, codigo: "RESPUESTA_INESPERADA" });
  });

  it("≥ 400 con ErrorApi rechaza ErrorDeApi con código, mensaje y detalles", async () => {
    const detalles = [{ campo: "body.cantidad", mensaje: "Tiene que ser positiva." }];
    const { cliente } = armar([
      { status: 409, json: { error: { codigo: "CUPO_AGOTADO", mensaje: "No quedan entradas.", detalles } } },
    ]);

    const error = await capturar(cliente.get("/compras"));
    expect(error).toBeInstanceOf(ErrorDeApi);
    expect(error).toMatchObject({
      status: 409,
      codigo: "CUPO_AGOTADO",
      mensaje: "No quedan entradas.",
      detalles,
    });
  });

  it("≥ 400 con ErrorApi sin detalles deja detalles vacíos", async () => {
    const { cliente } = armar([
      { status: 404, json: { error: { codigo: "NO_ENCONTRADO", mensaje: "No existe." } } },
    ]);

    const error = await capturar(cliente.get("/eventos/x"));
    expect(error).toMatchObject({ status: 404, codigo: "NO_ENCONTRADO", detalles: [] });
  });

  it.each([
    ["HTML", { status: 502, texto: "<html>Bad gateway</html>" }],
    ["JSON ajeno", { status: 500, json: { mensaje: "otra cosa" } }],
    ["cuerpo vacío", { status: 500, texto: "" }],
  ] as const)("≥ 400 sin formato (%s) rechaza RESPUESTA_INESPERADA con mensaje en español", async (_c, r) => {
    const { cliente } = armar([r]);

    const error = await capturar(cliente.get("/usuarios"));
    expect(error).toBeInstanceOf(ErrorDeApi);
    expect(error).toMatchObject({
      status: r.status,
      codigo: "RESPUESTA_INESPERADA",
      mensaje: "El servidor respondió de forma inesperada.",
    });
  });

  it("fetch rechazado → ServidorNoDisponibleError sin-conexion con la url", async () => {
    const { cliente } = armar(["rechazar"]);

    const error = await capturar(cliente.get("/usuarios"));
    expect(error).toBeInstanceOf(ServidorNoDisponibleError);
    expect(error).toMatchObject({ url: `${URL_BASE}/usuarios`, motivo: "sin-conexion" });
  });

  describe("tiempo límite", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it("a los 8000 ms rechaza tiempo-agotado; a los 7999 ms todavía no", async () => {
      const { cliente } = armar(["colgar"]);
      let resultado: unknown = "pendiente";
      cliente.get("/usuarios").then(
        () => (resultado = "resuelto"),
        (error: unknown) => (resultado = error),
      );

      await jest.advanceTimersByTimeAsync(7999);
      expect(resultado).toBe("pendiente");

      await jest.advanceTimersByTimeAsync(1);
      expect(resultado).toBeInstanceOf(ServidorNoDisponibleError);
      expect(resultado).toMatchObject({ motivo: "tiempo-agotado", url: `${URL_BASE}/usuarios` });
    });

    it("respeta un tiempoLimiteMs propio", async () => {
      const { cliente } = armar(["colgar"], { tiempoLimiteMs: 100 });
      let resultado: unknown = "pendiente";
      cliente.get("/usuarios").catch((error: unknown) => (resultado = error));

      await jest.advanceTimersByTimeAsync(100);
      expect(resultado).toBeInstanceOf(ServidorNoDisponibleError);
    });
  });

  it("un signal externo abortado rechaza con el AbortError original", async () => {
    const { cliente } = armar(["colgar"]);
    const controlador = new AbortController();

    const promesa = capturar(cliente.get("/usuarios", { signal: controlador.signal }));
    controlador.abort();
    const error = await promesa;

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe("AbortError");
    expect(error).not.toBeInstanceOf(ServidorNoDisponibleError);
  });

  describe("encabezados", () => {
    it("siempre Accept: application/json y X-Usuario-Id con el usuario actual", async () => {
      const { cliente, falso } = armar([{ status: 200, json: {} }], { usuarioId: "usuario-lucia" });

      await cliente.get("/usuarios/actual");
      expect(falso.pedidos[0].encabezados).toEqual({
        Accept: "application/json",
        "X-Usuario-Id": "usuario-lucia",
      });
    });

    it("sin usuario actual no envía X-Usuario-Id", async () => {
      const { cliente, falso } = armar([{ status: 200, json: [] }]);

      await cliente.get("/usuarios");
      expect(falso.pedidos[0].encabezados).toEqual({ Accept: "application/json" });
    });

    it("opciones.usuarioId reemplaza al actual, incluido null", async () => {
      const { cliente, falso } = armar([{ status: 200, json: {} }], { usuarioId: "usuario-lucia" });

      await cliente.get("/usuarios/actual", { usuarioId: "usuario-diego" });
      await cliente.get("/usuarios", { usuarioId: null });
      expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-diego");
      expect(falso.pedidos[1].encabezados).not.toHaveProperty("X-Usuario-Id");
    });
  });

  describe("401 USUARIO_NO_IDENTIFICADO", () => {
    const noIdentificado = {
      status: 401,
      json: { error: { codigo: "USUARIO_NO_IDENTIFICADO", mensaje: "El usuario no existe." } },
    };

    it("en un pedido con usuario avisa una vez con el id del pedido y rechaza el ErrorDeApi", async () => {
      const { cliente, alUsuarioNoIdentificado } = armar([noIdentificado], { usuarioId: "usuario-lucia" });

      const error = await capturar(cliente.get("/usuarios/actual", { usuarioId: "usuario-viejo" }));
      expect(error).toBeInstanceOf(ErrorDeApi);
      expect(error).toMatchObject({ status: 401, codigo: "USUARIO_NO_IDENTIFICADO" });
      expect(alUsuarioNoIdentificado).toHaveBeenCalledTimes(1);
      expect(alUsuarioNoIdentificado).toHaveBeenCalledWith("usuario-viejo");
    });

    it("en un pedido sin usuario no avisa", async () => {
      const { cliente, alUsuarioNoIdentificado } = armar([noIdentificado]);

      await capturar(cliente.get("/usuarios"));
      expect(alUsuarioNoIdentificado).not.toHaveBeenCalled();
    });
  });
});
