import type { UsuarioVista } from "@ai-ticket-it/shared";

import { crearClienteApi, listarUsuarios, obtenerUsuarioActual } from "../../src/api";
import { crearFetchFalso } from "../helpers/fetch-falso";

const lucia: UsuarioVista = {
  id: "usuario-lucia",
  nombre: "Lucía",
  apellido: "Álvarez",
  cantidadEventosOrganizados: 2,
};
const diego: UsuarioVista = {
  id: "usuario-diego",
  nombre: "Diego",
  apellido: "Fernández",
  cantidadEventosOrganizados: 0,
};

function armar(json: unknown) {
  const falso = crearFetchFalso([{ status: 200, json }]);
  const cliente = crearClienteApi({
    fetch: falso.fetch,
    urlBase: "http://servidor:3000/api",
    obtenerUsuarioId: () => "usuario-actual",
    alUsuarioNoIdentificado: () => {},
  });
  return { cliente, falso };
}

describe("funciones de usuarios", () => {
  it("listarUsuarios pide GET /usuarios sin X-Usuario-Id y respeta el orden del servidor", async () => {
    const { cliente, falso } = armar([diego, lucia]);

    await expect(listarUsuarios(cliente)).resolves.toEqual([diego, lucia]);
    expect(falso.pedidos[0].url).toBe("http://servidor:3000/api/usuarios");
    expect(falso.pedidos[0].encabezados).not.toHaveProperty("X-Usuario-Id");
  });

  it("obtenerUsuarioActual pide GET /usuarios/actual con el id recibido", async () => {
    const { cliente, falso } = armar(lucia);

    await expect(obtenerUsuarioActual(cliente, "usuario-lucia")).resolves.toEqual(lucia);
    expect(falso.pedidos[0].url).toBe("http://servidor:3000/api/usuarios/actual");
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-lucia");
  });

  it("ambas pasan el signal al cliente", async () => {
    const { cliente } = armar([]);
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();

    await listarUsuarios(cliente, { signal: controlador.signal });
    await obtenerUsuarioActual(cliente, "usuario-lucia", { signal: controlador.signal });
    expect(get).toHaveBeenNthCalledWith(1, "/usuarios", { signal: controlador.signal, usuarioId: null });
    expect(get).toHaveBeenNthCalledWith(2, "/usuarios/actual", {
      signal: controlador.signal,
      usuarioId: "usuario-lucia",
    });
  });
});
