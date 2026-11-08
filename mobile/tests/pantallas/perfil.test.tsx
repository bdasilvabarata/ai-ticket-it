import { act, screen } from "expo-router/testing-library";

import { porRuta, type RespuestaFalsa } from "../helpers/fetch-falso";
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
