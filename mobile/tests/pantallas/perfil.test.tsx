import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import { porRuta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

const ok: RespuestaFalsa = { status: 200, json: lucia };

async function abrirPerfil(actual: RespuestaFalsa[]) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({ "/usuarios/actual": actual, "/usuarios": [{ status: 200, json: todos }] }),
  });
  await esperarPestanas();
  await irAPestana("Perfil");
  return resultado;
}

describe("Perfil (US3)", () => {
  it("con el usuario confirmado muestra su nombre y Cambiar usuario (US3-3)", async () => {
    const resultado = await abrirPerfil([ok]);

    expect(resultado.getPathname()).toBe("/perfil");
    expect(await screen.findByText("Lucía Álvarez")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cambiar usuario" })).toBeOnTheScreen();
  });

  it("conservado sin servidor muestra el id y el aviso; tras un reintento exitoso, el nombre (FR-019)", async () => {
    await abrirPerfil(["rechazar", ok]);

    expect(await screen.findByText("Usuario usuario-lucia")).toBeOnTheScreen();
    expect(screen.getByText("No se pudieron cargar los datos del usuario.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cambiar usuario" })).toBeOnTheScreen();

    await act(() => jest.advanceTimersByTimeAsync(1000));

    expect(await screen.findByText("Lucía Álvarez")).toBeOnTheScreen();
    expect(screen.queryByText("Usuario usuario-lucia")).toBeNull();
    expect(screen.queryByText("No se pudieron cargar los datos del usuario.")).toBeNull();
  });
});

describe("Perfil: Mis favoritos (feature 014, US2)", () => {
  it("tiene Mis favoritos encima de Cambiar usuario", async () => {
    await abrirPerfil([ok]);
    await screen.findByText("Lucía Álvarez");

    const botones = screen.getAllByRole("button");
    const favoritos = botones.indexOf(screen.getByRole("button", { name: "Mis favoritos" }));
    const cambiar = botones.indexOf(screen.getByRole("button", { name: "Cambiar usuario" }));
    expect(favoritos).toBeGreaterThanOrEqual(0);
    expect(favoritos).toBeLessThan(cambiar);
  });

  it("Mis favoritos abre /favoritos, apilada, y la barra inferior no cambia", async () => {
    const resultado = await abrirPerfil([ok]);

    await fireEvent.press(await screen.findByRole("button", { name: "Mis favoritos" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/favoritos"));
    expect(tituloDelHeader()).toBe("Mis favoritos");
    expect(await screen.findByText("Todavía no tenés favoritos")).toBeOnTheScreen();
  });
});
