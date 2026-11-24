import type { EventoCatalogoVista, UsuarioVista } from "@ai-ticket-it/shared";

import {
  crearClienteApi,
  desmarcarFavorito,
  listarFavoritos,
  listarUsuarios,
  marcarFavorito,
  obtenerUsuarioActual,
} from "../../src/api";
import { crearFetchFalso, type RespuestaFalsa } from "../helpers/fetch-falso";

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

function armar(json: unknown, respuesta: RespuestaFalsa = { status: 200, json }) {
  const falso = crearFetchFalso([respuesta]);
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

describe("funciones de favoritos (feature 014)", () => {
  const favorito = { id: "evento-noche-de-rock", nombre: "Noche de rock" } as EventoCatalogoVista;
  const sinContenido: RespuestaFalsa = { status: 204, texto: "" };

  it("listarFavoritos pide GET /usuarios/actual/favoritos con X-Usuario-Id y devuelve el arreglo", async () => {
    const { cliente, falso } = armar([favorito]);

    await expect(listarFavoritos(cliente, "usuario-diego")).resolves.toEqual([favorito]);
    expect(falso.pedidos[0].metodo).toBe("GET");
    expect(falso.pedidos[0].url).toBe("http://servidor:3000/api/usuarios/actual/favoritos");
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-diego");
  });

  it("listarFavoritos pasa el signal al cliente", async () => {
    const { cliente } = armar([]);
    const get = jest.spyOn(cliente, "get");
    const controlador = new AbortController();

    await listarFavoritos(cliente, "usuario-diego", { signal: controlador.signal });
    expect(get).toHaveBeenCalledWith("/usuarios/actual/favoritos", {
      signal: controlador.signal,
      usuarioId: "usuario-diego",
    });
  });

  it("marcarFavorito pide PUT /usuarios/actual/favoritos/<eventoId> sin cuerpo y resuelve undefined ante el 204", async () => {
    const { cliente, falso } = armar(undefined, sinContenido);

    await expect(marcarFavorito(cliente, "usuario-diego", "evento-noche-de-rock")).resolves.toBeUndefined();
    expect(falso.pedidos[0].metodo).toBe("PUT");
    expect(falso.pedidos[0].url).toBe(
      "http://servidor:3000/api/usuarios/actual/favoritos/evento-noche-de-rock",
    );
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-diego");
    expect(falso.pedidos[0].cuerpo).toBeUndefined();
  });

  it("desmarcarFavorito pide DELETE /usuarios/actual/favoritos/<eventoId> sin cuerpo y resuelve undefined ante el 204", async () => {
    const { cliente, falso } = armar(undefined, sinContenido);

    await expect(
      desmarcarFavorito(cliente, "usuario-diego", "evento-noche-de-rock"),
    ).resolves.toBeUndefined();
    expect(falso.pedidos[0].metodo).toBe("DELETE");
    expect(falso.pedidos[0].url).toBe(
      "http://servidor:3000/api/usuarios/actual/favoritos/evento-noche-de-rock",
    );
    expect(falso.pedidos[0].encabezados["X-Usuario-Id"]).toBe("usuario-diego");
    expect(falso.pedidos[0].cuerpo).toBeUndefined();
  });
});
