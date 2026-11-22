import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { CategoriaRepository } from "../../src/repositories/categoria.repository";
import { CompraRepository } from "../../src/repositories/compra.repository";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { ReseniaRepository } from "../../src/repositories/resenia.repository";
import { UsuarioRepository } from "../../src/repositories/usuario.repository";
import { DIA, diego, evento, lucia, martin, musica, relojFijo, sofia, teatro } from "../helpers/eventos";

const LUCIA = "usuario-lucia";
const DIEGO = "usuario-diego";
const RUTA = "/api/usuarios/actual/favoritos";

/** Una app con repositorios propios (feature 014): los tests leen los favoritos del repositorio. */
function crearAppDeFavoritos() {
  const eventos = new EventoRepository([
    evento({ id: "evento-a", organizadorId: "usuario-martin" }),
    evento({ id: "evento-propio", organizadorId: LUCIA }),
    evento({ id: "evento-pasado", organizadorId: "usuario-martin", en: -DIA }),
  ]);
  const usuarios = new UsuarioRepository([lucia, martin, sofia, diego]);
  const app = crearApp({
    reloj: relojFijo(),
    repositorios: {
      eventos,
      usuarios,
      categorias: new CategoriaRepository([musica, teatro]),
      compras: new CompraRepository([]),
      resenias: new ReseniaRepository([]),
    },
  });
  const favoritosDe = async (usuarioId: string) => (await usuarios.buscarPorId(usuarioId))?.favoritos;
  return { app, eventos, favoritosDe };
}

function esperarError(respuesta: request.Response, status: number, codigo: string): void {
  expect(respuesta.status).toBe(status);
  expect(respuesta.body).toMatchObject({ error: { codigo, mensaje: expect.any(String) } });
}

describe.each([
  ["PUT", "put"],
  ["DELETE", "delete"],
] as const)("%s /api/usuarios/actual/favoritos/:eventoId: rechazos (feature 014)", (_, metodo) => {
  it("sin X-Usuario-Id o con uno inexistente → 401, también con un eventoId inválido", async () => {
    const { app } = crearAppDeFavoritos();
    esperarError(await request(app)[metodo](`${RUTA}/evento-a`), 401, "USUARIO_NO_IDENTIFICADO");
    esperarError(
      await request(app)[metodo](`${RUTA}/evento-a`).set("X-Usuario-Id", "usuario-nadie"),
      401,
      "USUARIO_NO_IDENTIFICADO",
    );
    esperarError(await request(app)[metodo](`${RUTA}/Evento%20A!`), 401, "USUARIO_NO_IDENTIFICADO");
  });

  it("un eventoId con formato inválido → 400 ENTRADA_INVALIDA sobre params.eventoId", async () => {
    const { app } = crearAppDeFavoritos();
    const respuesta = await request(app)[metodo](`${RUTA}/Evento%20A!`).set("X-Usuario-Id", DIEGO);
    esperarError(respuesta, 400, "ENTRADA_INVALIDA");
    expect(respuesta.body.error.detalles).toEqual([expect.objectContaining({ campo: "params.eventoId" })]);
  });

  it("un evento inexistente → 404 EVENTO_NO_ENCONTRADO y los favoritos no cambian", async () => {
    const { app, favoritosDe } = crearAppDeFavoritos();
    await request(app).put(`${RUTA}/evento-a`).set("X-Usuario-Id", DIEGO);
    esperarError(
      await request(app)[metodo](`${RUTA}/evento-inexistente`).set("X-Usuario-Id", DIEGO),
      404,
      "EVENTO_NO_ENCONTRADO",
    );
    expect(await favoritosDe(DIEGO)).toEqual(["evento-a"]);
  });
});

describe("PUT y DELETE /api/usuarios/actual/favoritos/:eventoId (feature 014, US1)", () => {
  it("PUT dos veces → 204 y 204 sin cuerpo, y el evento una sola vez", async () => {
    const { app, favoritosDe } = crearAppDeFavoritos();
    for (let vez = 0; vez < 2; vez += 1) {
      const respuesta = await request(app).put(`${RUTA}/evento-a`).set("X-Usuario-Id", DIEGO);
      expect(respuesta.status).toBe(204);
      expect(respuesta.text).toBe("");
    }
    expect(await favoritosDe(DIEGO)).toEqual(["evento-a"]);
  });

  it("DELETE dos veces → 204 y 204, y el evento sale", async () => {
    const { app, favoritosDe } = crearAppDeFavoritos();
    await request(app).put(`${RUTA}/evento-a`).set("X-Usuario-Id", DIEGO);
    for (let vez = 0; vez < 2; vez += 1) {
      const respuesta = await request(app).delete(`${RUTA}/evento-a`).set("X-Usuario-Id", DIEGO);
      expect(respuesta.status).toBe(204);
      expect(respuesta.text).toBe("");
    }
    expect(await favoritosDe(DIEGO)).toEqual([]);
  });

  it("marca un evento propio y uno realizado (FR-001)", async () => {
    const { app, favoritosDe } = crearAppDeFavoritos();
    expect((await request(app).put(`${RUTA}/evento-propio`).set("X-Usuario-Id", LUCIA)).status).toBe(204);
    expect((await request(app).put(`${RUTA}/evento-pasado`).set("X-Usuario-Id", LUCIA)).status).toBe(204);
    expect(await favoritosDe(LUCIA)).toEqual(["evento-propio", "evento-pasado"]);
  });

  it("lo que marca Diego no aparece en Lucía (FR-006)", async () => {
    const { app, favoritosDe } = crearAppDeFavoritos();
    await request(app).put(`${RUTA}/evento-a`).set("X-Usuario-Id", DIEGO);
    expect(await favoritosDe(DIEGO)).toEqual(["evento-a"]);
    expect(await favoritosDe(LUCIA)).toEqual([]);
  });

  it("el evento (cupo y tipos) queda igual tras marcar y desmarcar (FR-007)", async () => {
    const { app, eventos } = crearAppDeFavoritos();
    const antes = await eventos.buscarPorId("evento-a");
    await request(app).put(`${RUTA}/evento-a`).set("X-Usuario-Id", DIEGO);
    await request(app).delete(`${RUTA}/evento-a`).set("X-Usuario-Id", DIEGO);
    expect(await eventos.buscarPorId("evento-a")).toBe(antes);
  });
});
