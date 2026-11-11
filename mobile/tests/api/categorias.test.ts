import { crearClienteApi, listarCategorias } from "../../src/api";
import { categorias } from "../helpers/eventos";
import { crearFetchFalso } from "../helpers/fetch-falso";

describe("funciones de categorías", () => {
  it("listarCategorias pide GET /categorias sin X-Usuario-Id y pasa el signal", async () => {
    const falso = crearFetchFalso([{ status: 200, json: categorias }]);
    const cliente = crearClienteApi({
      fetch: falso.fetch,
      urlBase: "http://servidor:3000/api",
      obtenerUsuarioId: () => "usuario-actual",
      alUsuarioNoIdentificado: () => {},
    });
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();

    await expect(listarCategorias(cliente, { signal: controlador.signal })).resolves.toEqual(categorias);
    expect(falso.pedidos[0]).toMatchObject({ url: "http://servidor:3000/api/categorias", metodo: "GET" });
    expect(falso.pedidos[0].encabezados).not.toHaveProperty("X-Usuario-Id");
    expect(get).toHaveBeenCalledWith("/categorias", { signal: controlador.signal, usuarioId: null });
  });
});
