import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import { act, screen, waitFor } from "expo-router/testing-library";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Text } from "react-native";

import type { ClienteApi } from "../../src/api";
import { useClienteApi } from "../../src/consultas/cliente-api";
import { useSesion } from "../../src/features/sesion";
import { porRuta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { CLAVE_RECORDADO, lucia, martin, todos } from "../helpers/usuarios";

const TITULO = "¿Con quién querés operar?";
const FRANJA = `Servidor no disponible · ${URL_DE_PRUEBA}`;
const AVISO = "El usuario con el que estabas operando ya no existe. Elegí otro.";
const ACTUAL = "/usuarios/actual";
const PRUEBA = "/prueba";
const DATOS = "Datos de prueba";
const CON_ERROR = "La prueba falló";

const ok: RespuestaFalsa = { status: 200, json: lucia };
const datos: RespuestaFalsa = { status: 200, json: { valor: DATOS } };
const noIdentificado: RespuestaFalsa = {
  status: 401,
  json: { error: { codigo: "USUARIO_NO_IDENTIFICADO", mensaje: "No se reconoce al usuario." } },
};
const interno: RespuestaFalsa = {
  status: 500,
  json: { error: { codigo: "ERROR_INTERNO", mensaje: "Falló el servidor." } },
};

/** El cliente de la sesión, capturado por la pantalla de prueba. */
let clienteDeLaSesion: ClienteApi | null = null;

/** Pantalla de las features 003+: una query propia que depende del usuario actual. */
function PantallaDePrueba() {
  const cliente = useClienteApi();
  const { estado } = useSesion();
  const usuarioId = estado.fase === "con-usuario" ? estado.usuarioId : null;

  useEffect(() => {
    clienteDeLaSesion = cliente;
  }, [cliente]);

  const consulta = useQuery({
    queryKey: ["prueba", usuarioId],
    queryFn: ({ signal }) => cliente.get<{ valor: string }>(PRUEBA, { signal }),
  });

  if (consulta.isError) return <Text>{CON_ERROR}</Text>;
  if (consulta.isPending) return <Text>Cargando la prueba</Text>;
  return <Text>{consulta.data.valor}</Text>;
}

async function avanzar(ms: number) {
  await act(() => jest.advanceTimersByTimeAsync(ms));
}

/** Arranca con Lucía recordada y confirmada, en la pantalla de prueba. */
async function abrirPrueba(prueba: RespuestaFalsa[], actual: RespuestaFalsa[] = [ok]) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({ [ACTUAL]: actual, [PRUEBA]: prueba, "/usuarios": [{ status: 200, json: todos }] }),
    // Reemplaza a Explorar: es una ruta de `(tabs)` y se ve apenas se confirma al usuario.
    rutasExtra: { "(tabs)/index": PantallaDePrueba },
  });
  await waitFor(() => expect(resultado.falso.pedidosA(PRUEBA)).toHaveLength(1));
  return resultado;
}

beforeEach(() => {
  clienteDeLaSesion = null;
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("errores durante el uso (US2, FR-014)", () => {
  it("sin servidor en otra query → franja y secuencia; al recuperarse, la query se vuelve a pedir (R7)", async () => {
    const { falso } = await abrirPrueba(["rechazar", datos], [ok, ok]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    expect(screen.getByText(CON_ERROR)).toBeOnTheScreen();
    expect(falso.pedidosA(ACTUAL)).toHaveLength(1);

    await avanzar(1000);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    expect(await screen.findByText(DATOS)).toBeOnTheScreen();
    expect(screen.queryByText(FRANJA)).toBeNull();
    expect(falso.pedidosA(PRUEBA)).toHaveLength(2);
  });

  it("500 en otra query → sin franja ni pedidos extra (CHK013)", async () => {
    const { falso } = await abrirPrueba([interno]);

    expect(await screen.findByText(CON_ERROR)).toBeOnTheScreen();
    await avanzar(70_000);
    expect(screen.queryByText(FRANJA)).toBeNull();
    expect(falso.pedidosA(PRUEBA)).toHaveLength(1);
    expect(falso.pedidosA(ACTUAL)).toHaveLength(1);
  });

  it("401 USUARIO_NO_IDENTIFICADO en otra query → selector con el aviso (FR-014)", async () => {
    await abrirPrueba([noIdentificado]);

    expect(await screen.findByText(AVISO)).toBeOnTheScreen();
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(await AsyncStorage.getItem(CLAVE_RECORDADO)).toBeNull();
  });

  it("un 401 que llega con el id de un usuario anterior se ignora", async () => {
    await abrirPrueba([datos, noIdentificado]);
    expect(await screen.findByText(DATOS)).toBeOnTheScreen();
    expect(clienteDeLaSesion).not.toBeNull();

    await act(async () => {
      await clienteDeLaSesion?.get(PRUEBA, { usuarioId: martin.id }).catch(() => undefined);
    });

    expect(screen.getByText(DATOS)).toBeOnTheScreen();
    expect(screen.queryByText(AVISO)).toBeNull();
    expect(screen.queryByText(TITULO)).toBeNull();
    expect(await AsyncStorage.getItem(CLAVE_RECORDADO)).not.toBeNull();
  });
});

const ESCRITURA = "/prueba-escritura";
const ESCRITURA_ENVIADA = "Escritura enviada";
const ESCRITURA_FALLIDA = "La escritura falló";

/** Pantalla de las features 004+: una escritura (mutation POST) que sale apenas se monta. */
function PantallaDeEscritura() {
  const cliente = useClienteApi();
  const mutation = useMutation({ mutationFn: () => cliente.post(ESCRITURA, { x: 1 }) });
  const { mutate } = mutation;
  const enviada = useRef(false);

  useEffect(() => {
    if (enviada.current) return;
    enviada.current = true;
    mutate();
  }, [mutate]);

  if (mutation.isError) return <Text>{ESCRITURA_FALLIDA}</Text>;
  return <Text>{ESCRITURA_ENVIADA}</Text>;
}

async function abrirEscritura(escritura: RespuestaFalsa[]) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      [ACTUAL]: [ok],
      [ESCRITURA]: escritura,
      "/usuarios": [{ status: 200, json: todos }],
    }),
    // Como en `abrirPrueba`: reemplaza a Explorar, que es lo que se ve apenas se confirma al usuario
    // (con el guard, un `initialUrl` a otra pestaña no se respeta).
    rutasExtra: { "(tabs)/index": PantallaDeEscritura },
  });
  await waitFor(() => expect(resultado.falso.pedidosA(ESCRITURA)).toHaveLength(1));
  return resultado;
}

describe("escrituras durante el uso (US3, FR-020)", () => {
  it("un POST que cae sin servidor no se repite cuando la secuencia se recupera", async () => {
    // Todo POST falla: si algo lo repitiera (un reintento de la mutation o de la secuencia), el
    // conteo final lo muestra.
    const { falso } = await abrirEscritura(["rechazar"]);

    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    expect(await screen.findByText(ESCRITURA_FALLIDA)).toBeOnTheScreen();

    await avanzar(1000);
    await waitFor(() => expect(screen.queryByText(FRANJA)).toBeNull());
    expect(falso.pedidosA(ACTUAL)).toHaveLength(2);
    await avanzar(70_000);

    const escrituras = falso.pedidosA(ESCRITURA);
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0]).toMatchObject({ metodo: "POST", cuerpo: '{"x":1}' });
  });

  it("401 USUARIO_NO_IDENTIFICADO en una escritura → olvida al usuario como en una lectura", async () => {
    await abrirEscritura([noIdentificado]);

    expect(await screen.findByText(AVISO)).toBeOnTheScreen();
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Cerrar sin cambiar de usuario" })).toBeNull();
    expect(await AsyncStorage.getItem(CLAVE_RECORDADO)).toBeNull();
  });
});
