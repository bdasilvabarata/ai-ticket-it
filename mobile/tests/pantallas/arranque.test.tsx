import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { AccessibilityInfo, AppState, type AppStateStatus } from "react-native";

import { ServidorNoDisponibleError } from "../../src/api";
import { porRuta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { CLAVE_RECORDADO, lucia, todos } from "../helpers/usuarios";

const TITULO = "¿Con quién querés operar?";
// Explorar con el catálogo vacío (feature 005; antes era una sección pendiente).
const EXPLORAR = "Todavía no hay eventos próximos.";
const FRANJA = `Servidor no disponible · ${URL_DE_PRUEBA}`;
const AVISO = "El usuario con el que estabas operando ya no existe. Elegí otro.";
const ACTUAL = "/usuarios/actual";

const ok: RespuestaFalsa = { status: 200, json: lucia };
const noIdentificado: RespuestaFalsa = {
  status: 401,
  json: { error: { codigo: "USUARIO_NO_IDENTIFICADO", mensaje: "No se reconoce al usuario." } },
};
const interno: RespuestaFalsa = {
  status: 500,
  json: { error: { codigo: "ERROR_INTERNO", mensaje: "Falló el servidor." } },
};
const lista: RespuestaFalsa = { status: 200, json: todos };

async function avanzar(ms: number) {
  await act(() => jest.advanceTimersByTimeAsync(ms));
}

/** Arranca con `usuario-lucia` recordado; `actual` son las respuestas de `GET /usuarios/actual`. */
function arrancar(actual: RespuestaFalsa[]) {
  return renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({ [ACTUAL]: actual, "/usuarios": [lista] }),
  });
}

let oyentesAppState: Array<(estado: AppStateStatus) => void>;
let anunciar: jest.SpyInstance;

beforeEach(() => {
  oyentesAppState = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_tipo, oyente) => {
    oyentesAppState.push(oyente);
    return {
      remove: () => {
        oyentesAppState = oyentesAppState.filter((otro) => otro !== oyente);
      },
    };
  });
  anunciar = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function volverAPrimerPlano() {
  await act(async () => {
    for (const oyente of [...oyentesAppState]) oyente("active");
  });
}

describe("arranque con usuario recordado (US2)", () => {
  it("mientras la validación no responde: Cargando…, sin selector y sin pedir la lista (US2-6)", async () => {
    const { falso } = await arrancar(["colgar"]);

    await waitFor(() => expect(falso.pedidosA(ACTUAL)).toHaveLength(1));
    expect(screen.getByText("Cargando…")).toBeOnTheScreen();
    expect(screen.getByLabelText("AI Ticket It")).toBeOnTheScreen();
    expect(screen.queryByText(TITULO)).toBeNull();
    expect(falso.pedidosA("/usuarios")).toHaveLength(0);
  });

  it("200 → entra a Explorar sin pasar por el selector y sin franja (US2-1)", async () => {
    const { falso } = await arrancar([ok]);

    expect(await screen.findByText(EXPLORAR)).toBeOnTheScreen();
    expect(screen.queryByText(TITULO)).toBeNull();
    expect(screen.queryByText(FRANJA)).toBeNull();
    expect(falso.pedidosA(ACTUAL)).toHaveLength(1);
    expect(falso.pedidosA(ACTUAL)[0].encabezados).toMatchObject({ "X-Usuario-Id": lucia.id });
    expect(falso.pedidosA("/usuarios")).toHaveLength(0);
  });

  it("sin servidor → entra a Explorar con la franja y conserva al usuario recordado (US2-2)", async () => {
    await arrancar(["rechazar"]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    expect(await screen.findByText(EXPLORAR)).toBeOnTheScreen();
    expect(screen.queryByText(TITULO)).toBeNull();
    expect(await AsyncStorage.getItem(CLAVE_RECORDADO)).not.toBeNull();
  });

  it("con la franja, reintenta a 1, 2 y 4 s; al responder bien la franja se va y no pide más (US2-3)", async () => {
    const { falso } = await arrancar(["rechazar", "rechazar", "rechazar", ok]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    expect(falso.pedidosA(ACTUAL)).toHaveLength(1);

    await avanzar(999);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(1);
    await avanzar(1);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);

    await avanzar(1999);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    await avanzar(1);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(3);
    expect(screen.getByText(FRANJA)).toBeOnTheScreen();

    await avanzar(4000);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(4);
    await waitFor(() => expect(screen.queryByText(FRANJA)).toBeNull());
    expect(await screen.findByText(EXPLORAR)).toBeOnTheScreen();

    await avanzar(120_000);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(4);
  });

  it("Reintentar de la franja pide la validación en el acto (US2-3)", async () => {
    const { falso } = await arrancar(["rechazar", ok]);

    await fireEvent.press(await screen.findByRole("button", { name: "Reintentar" }));
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    await waitFor(() => expect(screen.queryByText(FRANJA)).toBeNull());
  });

  it("401 USUARIO_NO_IDENTIFICADO → selector con el aviso, la clave borrada y el anuncio (US2-4)", async () => {
    await arrancar([noIdentificado]);

    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(screen.getByText(AVISO)).toBeOnTheScreen();
    expect(screen.queryByText(EXPLORAR)).toBeNull();
    expect(await AsyncStorage.getItem(CLAVE_RECORDADO)).toBeNull();
    expect(anunciar).toHaveBeenCalledWith(AVISO);
  });

  it("500 → conserva al usuario y muestra la franja (US2-5)", async () => {
    await arrancar([interno]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    expect(await screen.findByText(EXPLORAR)).toBeOnTheScreen();
    expect(await AsyncStorage.getItem(CLAVE_RECORDADO)).not.toBeNull();
  });

  it("un reintento que vuelve a recibir 500 deja la franja y programa el siguiente a 2 s; un 200 la oculta (I1)", async () => {
    const { falso } = await arrancar([interno, interno, ok]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    await avanzar(1000);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    expect(screen.getByText(FRANJA)).toBeOnTheScreen();

    await avanzar(1999);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    await avanzar(1);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(3);
    await waitFor(() => expect(screen.queryByText(FRANJA)).toBeNull());
  });

  it("un valor dañado en AsyncStorage → selector sin aviso, sin cerrarse (edge case)", async () => {
    await AsyncStorage.setItem(CLAVE_RECORDADO, "{esto no es json");
    const { falso } = await renderConDependencias({
      respuestas: porRuta({ [ACTUAL]: [ok], "/usuarios": [lista] }),
    });

    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(screen.queryByText(AVISO)).toBeNull();
    expect(falso.pedidosA(ACTUAL)).toHaveLength(0);
  });

  it("un reintento automático que recibe 401 → selector con el aviso, y la clave se borra una sola vez (FR-021a, U2)", async () => {
    const borrar = jest.spyOn(AsyncStorage, "removeItem");
    await arrancar(["rechazar", noIdentificado]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    await avanzar(1000);

    expect(await screen.findByText(AVISO)).toBeOnTheScreen();
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(screen.queryByText(FRANJA)).toBeNull();
    expect(await AsyncStorage.getItem(CLAVE_RECORDADO)).toBeNull();
    expect(borrar.mock.calls.filter(([clave]) => clave === CLAVE_RECORDADO)).toHaveLength(1);
  });

  it("con la franja, el fallo de otra query no reinicia la secuencia (FR-021a)", async () => {
    const { falso, deps } = await arrancar(["rechazar", ok]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    await avanzar(700);
    await act(async () => {
      await deps.queryClient
        .fetchQuery({
          queryKey: ["otra"],
          queryFn: () =>
            Promise.reject(new ServidorNoDisponibleError(`${URL_DE_PRUEBA}/otra`, "sin-conexion")),
        })
        .catch(() => undefined);
    });

    await avanzar(300); // 1 s desde el primer fallo, no desde el de la otra query
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    await waitFor(() => expect(screen.queryByText(FRANJA)).toBeNull());
  });

  it("nunca hay dos validaciones a la vez: con una colgada, volver a primer plano no pide otra (FR-021a)", async () => {
    const { falso } = await arrancar(["rechazar", "colgar"]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    await avanzar(1000);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);

    await volverAPrimerPlano();
    await avanzar(100);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Reintentando…" })).toBeDisabled();
  });

  it("con la franja, volver a primer plano pide la validación en el acto (CHK005)", async () => {
    const { falso } = await arrancar(["rechazar", ok]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    expect(falso.pedidosA(ACTUAL)).toHaveLength(1);

    await volverAPrimerPlano();
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    await waitFor(() => expect(screen.queryByText(FRANJA)).toBeNull());
  });
});
