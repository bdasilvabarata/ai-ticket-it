import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import { porRuta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { irAPestana } from "../helpers/pestanas";
import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { CLAVE_RECORDADO, diego, lucia, todos } from "../helpers/usuarios";

const TITULO = "¿Con quién querés operar?";
const FRANJA = `Servidor no disponible · ${URL_DE_PRUEBA}`;
const AVISO = "El usuario con el que estabas operando ya no existe. Elegí otro.";
const CERRAR = "Cerrar sin cambiar de usuario";
const ACTUAL = "/usuarios/actual";

const ok: RespuestaFalsa = { status: 200, json: lucia };
const lista: RespuestaFalsa = { status: 200, json: todos };
const noIdentificado: RespuestaFalsa = {
  status: 401,
  json: { error: { codigo: "USUARIO_NO_IDENTIFICADO", mensaje: "No se reconoce al usuario." } },
};
const interno: RespuestaFalsa = {
  status: 500,
  json: { error: { codigo: "ERROR_INTERNO", mensaje: "Falló el servidor." } },
};

async function avanzar(ms: number) {
  await act(() => jest.advanceTimersByTimeAsync(ms));
}

/** Entra con Lucía recordada y va a Perfil. `actual` y `usuarios` son las respuestas por ruta. */
async function enPerfil(actual: RespuestaFalsa[], usuarios: RespuestaFalsa[] = [lista]) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({ [ACTUAL]: actual, "/usuarios": usuarios }),
  });
  await screen.findByRole("tablist");
  await irAPestana("Perfil");
  await screen.findByRole("button", { name: "Cambiar usuario" });
  return resultado;
}

async function abrirSelector() {
  await fireEvent.press(screen.getByRole("button", { name: "Cambiar usuario" }));
}

describe("cambiar de usuario desde Perfil (US3)", () => {
  it("Cambiar usuario abre el selector con la fila del actual marcada (US3-6, FR-022)", async () => {
    const resultado = await enPerfil([ok]);

    await abrirSelector();

    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(resultado.getPathname()).toBe("/seleccionar-usuario");
    const actual = screen.getByRole("button", { name: "Lucía Álvarez, usuario actual" });
    expect(actual).toHaveTextContent("Actual", { exact: false });
    expect(actual).toBeSelected();
    expect(screen.getByRole("button", { name: "Elegir a Diego Fernández" })).not.toBeSelected();
    expect(screen.getByRole("button", { name: CERRAR })).toBeOnTheScreen();
  });

  it("Cerrar vuelve a Perfil sin cambiar de usuario (US3-5)", async () => {
    const resultado = await enPerfil([ok]);
    await abrirSelector();
    await screen.findByText(TITULO);

    await fireEvent.press(screen.getByRole("button", { name: CERRAR }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/perfil"));
    expect(screen.getByText("Lucía Álvarez")).toBeOnTheScreen();
    expect(await AsyncStorage.getItem(CLAVE_RECORDADO)).toContain(lucia.id);
  });

  it("elegir a Diego: Perfil lo muestra, queda recordado y no queda nada de Lucía en caché (US3-4, FR-016, SC-004)", async () => {
    const resultado = await enPerfil([ok]);
    resultado.deps.queryClient.setQueryData(["prueba", lucia.id], { valor: "de Lucía" });

    await abrirSelector(); // toque 1
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Diego Fernández" })); // toque 2

    await waitFor(() => expect(resultado.getPathname()).toBe("/perfil"));
    expect(await screen.findByText("Diego Fernández")).toBeOnTheScreen();
    expect(screen.queryByText("Lucía Álvarez")).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(CLAVE_RECORDADO)) ?? "null")).toMatchObject({
      usuarioId: diego.id,
    });
    const claves = resultado.deps.queryClient
      .getQueryCache()
      .getAll()
      .map((consulta) => consulta.queryKey);
    expect(claves).not.toContainEqual(["prueba", lucia.id]);
  });

  it("con la franja visible, el modal la oculta y al cerrarlo vuelve; la secuencia sigue (FR-021, FR-021a)", async () => {
    const { falso } = await enPerfil(["rechazar", "rechazar", "rechazar"]);
    expect(screen.getByText(FRANJA)).toBeOnTheScreen();

    await abrirSelector();
    await screen.findByText(TITULO);
    expect(screen.queryByText(FRANJA)).toBeNull();

    await avanzar(1000);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);

    await fireEvent.press(screen.getByRole("button", { name: CERRAR }));
    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    expect(screen.getByText("Usuario usuario-lucia")).toBeOnTheScreen();
  });

  it("un 401 de la validación con el modal abierto → selector a pantalla completa, sin Cerrar y con el aviso (FR-014, CHK020)", async () => {
    await enPerfil(["rechazar", noIdentificado]);
    await abrirSelector();
    await screen.findByText(TITULO);

    await avanzar(1000);

    expect(await screen.findByText(AVISO)).toBeOnTheScreen();
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: CERRAR })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(await AsyncStorage.getItem(CLAVE_RECORDADO)).toBeNull();
  });

  it("sin servidor en la lista del modal: error y secuencia; el reintento valida al actual y vuelve a pedir la lista (FR-021a, SC-005, C1)", async () => {
    const { falso } = await enPerfil([ok, ok], ["rechazar", lista]);

    await abrirSelector();
    expect(await screen.findByText("Servidor no disponible")).toBeOnTheScreen();
    expect(screen.getByText(`No se pudo conectar con ${URL_DE_PRUEBA}.`)).toBeOnTheScreen();
    expect(falso.pedidosA(ACTUAL)).toHaveLength(1);

    await avanzar(1000);

    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(falso.pedidosA("/usuarios")).toHaveLength(2);
  });

  it("con la secuencia corriendo por 500, elegir a Diego la detiene: sin franja y sin más validaciones (A1, FR-021a)", async () => {
    const { falso } = await enPerfil([interno]);
    expect(screen.getByText(FRANJA)).toBeOnTheScreen();

    await abrirSelector();
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Diego Fernández" }));

    expect(await screen.findByText("Diego Fernández")).toBeOnTheScreen();
    expect(screen.queryByText(FRANJA)).toBeNull();
    const validaciones = falso.pedidosA(ACTUAL).length;
    await avanzar(60_000);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(validaciones);
    expect(screen.queryByText(FRANJA)).toBeNull();
  });
});
