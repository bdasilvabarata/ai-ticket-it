import { crearClienteApi, listarMisEventos } from "../../src/api";
import { crearFetchFalso, type RespuestaFalsa } from "../helpers/fetch-falso";
import { festival, nocheDeRock } from "../helpers/eventos";

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

describe("funciones de eventos: lecturas", () => {
  it("listarMisEventos pide GET /eventos/mios con el usuario actual y respeta el orden", async () => {
    const { cliente, falso } = armar({ status: 200, json: [nocheDeRock, festival] });

    await expect(listarMisEventos(cliente)).resolves.toEqual([nocheDeRock, festival]);
    expect(falso.pedidos[0]).toMatchObject({ url: `${URL}/eventos/mios`, metodo: "GET" });
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-actual");
  });

  it("listarMisEventos pasa el signal", async () => {
    const { cliente } = armar({ status: 200, json: [] });
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();

    await listarMisEventos(cliente, { signal: controlador.signal });
    expect(get).toHaveBeenCalledWith("/eventos/mios", { signal: controlador.signal });
  });
});
