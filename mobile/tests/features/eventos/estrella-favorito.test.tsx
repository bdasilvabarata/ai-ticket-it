import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import { EstrellaFavorito } from "../../../src/features/eventos/componentes/EstrellaFavorito";
import { porMetodo, porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../../helpers/fetch-falso";
import { clasicoEnCatalogo, errorApi, maratonEnCatalogo } from "../../helpers/eventos";
import { renderConDependencias } from "../../helpers/render-con-dependencias";
import { diego, todos } from "../../helpers/usuarios";

const FAVORITOS = "/usuarios/actual/favoritos";
const EVENTO = maratonEnCatalogo.id;
const DEL_EVENTO = `${FAVORITOS}/${EVENTO}`;

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

function PantallaDePrueba() {
  return <EstrellaFavorito eventoId={EVENTO} />;
}

async function abrir(favoritos: Lista, cambio: Lista = [{ status: 204, texto: "" }]) {
  return renderConDependencias({
    usuarioRecordado: diego.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: diego }],
      "/usuarios": [{ status: 200, json: todos }],
      [FAVORITOS]: favoritos,
      [DEL_EVENTO]: cambio,
    }),
    rutasExtra: { "(tabs)/index": PantallaDePrueba },
  });
}

const sinFavorito = { status: 200, json: [clasicoEnCatalogo] } as const;
const conFavorito = { status: 200, json: [clasicoEnCatalogo, maratonEnCatalogo] } as const;

describe("EstrellaFavorito (feature 014)", () => {
  it("sin datos de favoritos no se dibuja", async () => {
    const { falso } = await abrir(["colgar"]);

    await waitFor(() => expect(falso.pedidosA(FAVORITOS)).toHaveLength(1));
    expect(screen.queryByRole("button", { name: /favoritos/ })).toBeNull();
  });

  it("con la consulta de favoritos en error no se dibuja", async () => {
    const { falso } = await abrir([{ status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") }]);

    await waitFor(() => expect(falso.pedidosA(FAVORITOS)).toHaveLength(1));
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(screen.queryByRole("button", { name: /favoritos/ })).toBeNull();
  });

  it("no favorito: 'Agregar a favoritos', contorno y sin seleccionar", async () => {
    await abrir([sinFavorito]);

    const estrella = await screen.findByRole("button", { name: "Agregar a favoritos" });
    expect(estrella).not.toBeSelected();
  });

  it("favorito: 'Quitar de favoritos', llena y seleccionada", async () => {
    await abrir([conFavorito]);

    const estrella = await screen.findByRole("button", { name: "Quitar de favoritos" });
    expect(estrella).toBeSelected();
  });

  it("al tocar sale un PUT y, hasta releer los favoritos, queda ocupada con el estado anterior", async () => {
    const { falso } = await abrir([sinFavorito, "colgar"]);

    await fireEvent.press(await screen.findByRole("button", { name: "Agregar a favoritos" }));

    await waitFor(() => expect(falso.pedidosA(DEL_EVENTO)).toHaveLength(1));
    const pedido = falso.pedidosA(DEL_EVENTO)[0];
    expect(pedido.metodo).toBe("PUT");
    expect(pedido.encabezados["X-Usuario-Id"]).toBe(diego.id);
    // El PUT respondió pero la relectura cuelga: sigue en curso (sin optimismo, R8).
    await waitFor(() => expect(falso.pedidosA(FAVORITOS)).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregar a favoritos" })).toBeBusy());
    const estrella = screen.getByRole("button", { name: "Agregar a favoritos" });
    expect(estrella).toBeDisabled();
    expect(estrella).not.toBeSelected();
  });

  it("con los favoritos releídos queda 'Quitar de favoritos' y solo se vuelven a pedir los favoritos", async () => {
    const { falso } = await abrir([sinFavorito, conFavorito]);

    await fireEvent.press(await screen.findByRole("button", { name: "Agregar a favoritos" }));

    const estrella = await screen.findByRole("button", { name: "Quitar de favoritos" });
    expect(estrella).toBeSelected();
    expect(estrella).not.toBeBusy();
    // Ningún pedido al catálogo ni al evento después del cambio (FR-018).
    const indiceDelCambio = falso.pedidos.findIndex((p) => p.url.endsWith(DEL_EVENTO));
    expect(falso.pedidos.slice(indiceDelCambio + 1).every((p) => p.url.endsWith(FAVORITOS))).toBe(true);
  });

  it("siendo favorito, al tocar sale un DELETE", async () => {
    const { falso } = await abrir([conFavorito, sinFavorito]);

    await fireEvent.press(await screen.findByRole("button", { name: "Quitar de favoritos" }));

    expect(await screen.findByRole("button", { name: "Agregar a favoritos" })).not.toBeSelected();
    expect(falso.pedidosA(DEL_EVENTO).map((p) => p.metodo)).toEqual(["DELETE"]);
  });

  it("dos toques seguidos mandan un solo pedido (FR-016)", async () => {
    const { falso } = await abrir([sinFavorito], ["colgar"]);

    const estrella = await screen.findByRole("button", { name: "Agregar a favoritos" });
    await fireEvent.press(estrella);
    await fireEvent.press(estrella);

    await waitFor(() => expect(falso.pedidosA(DEL_EVENTO)).toHaveLength(1));
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(falso.pedidosA(DEL_EVENTO)).toHaveLength(1);
  });

  it("con el pedido fallando, vuelve al estado releído y no se reintenta (FR-017)", async () => {
    const { falso } = await abrir(
      [sinFavorito],
      [porMetodo({ PUT: [{ status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") }] })],
    );

    await fireEvent.press(await screen.findByRole("button", { name: "Agregar a favoritos" }));

    await waitFor(() => expect(falso.pedidosA(FAVORITOS)).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregar a favoritos" })).not.toBeBusy());
    expect(screen.getByRole("button", { name: "Agregar a favoritos" })).not.toBeSelected();
    await act(() => jest.advanceTimersByTimeAsync(60_000));
    expect(falso.pedidosA(DEL_EVENTO)).toHaveLength(1);
  });
});
