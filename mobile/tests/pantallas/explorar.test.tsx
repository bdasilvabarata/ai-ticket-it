import { act, fireEvent, screen, within } from "expo-router/testing-library";

import {
  CATALOGO_INICIAL,
  catalogo,
  clasicoEnCatalogo,
  errorApi,
  hamletEnCatalogo,
  maratonEnCatalogo,
  rockEnCatalogo,
} from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { lucia, martin, todos } from "../helpers/usuarios";

const FRANJA = `Servidor no disponible · ${URL_DE_PRUEBA}`;

async function abrirExplorar(
  respuestas: Record<string, ReadonlyArray<RespuestaFalsa | FuncionRespuesta>>,
  usuarioActual: RespuestaFalsa[] = [{ status: 200, json: lucia }],
) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": usuarioActual,
      "/usuarios": [{ status: 200, json: todos }],
      "/categorias": [{ status: 200, json: [] }],
      ...respuestas,
    }),
  });
  await esperarPestanas();
  return resultado;
}

async function avanzar(ms: number) {
  await act(() => jest.advanceTimersByTimeAsync(ms));
}

const tarjetas = () => screen.findAllByRole("button", { name: /, organiza / });

describe("Explorar (US1)", () => {
  it("pide el catálogo por fecha sin X-Usuario-Id y muestra el skeleton mientras carga", async () => {
    const { falso } = await abrirExplorar({ [CATALOGO_INICIAL]: ["colgar"] });

    expect(await screen.findByLabelText("Cargando eventos")).toBeOnTheScreen();
    const [pedido] = falso.pedidosA(CATALOGO_INICIAL);
    expect(pedido.url).toBe(`${URL_DE_PRUEBA}${CATALOGO_INICIAL}`);
    expect(pedido.encabezados["X-Usuario-Id"]).toBeUndefined();
  });

  it("muestra las tarjetas en el orden del servidor, con todos sus textos", async () => {
    await abrirExplorar({
      [CATALOGO_INICIAL]: [
        {
          status: 200,
          json: catalogo([rockEnCatalogo, clasicoEnCatalogo, hamletEnCatalogo, maratonEnCatalogo]),
        },
      ],
    });

    const lista = await tarjetas();
    expect(lista.map((tarjeta) => tarjeta.props.accessibilityLabel)).toEqual([
      "Noche de Rock en el Club, Música, mar 1 dic 2026 · 20:00, desde $ 15.000, organiza Lucía Álvarez, 4,5 · 12 reseñas",
      "Clásico de básquet, Deportes, dom 15 nov 2026 · 19:00, desde $ 8.000, organiza Sofía Castro, sin reseñas",
      "Hamlet, versión contemporánea, Teatro, vie 20 nov 2026 · 20:00, desde $ 18.000, organiza Martín Benítez, sin reseñas, agotado",
      "Maratón Ciudad 10K, Deportes, vie 25 dic 2026 · 08:00, gratis, organiza Lucía Álvarez, sin reseñas",
    ]);
    const [rock, clasico, hamlet, maraton] = lista;
    expect(within(clasico).getByText("Clásico de básquet")).toBeOnTheScreen();
    expect(within(clasico).getByText("Deportes · dom 15 nov 2026 · 19:00")).toBeOnTheScreen();
    expect(within(clasico).getByText("desde $ 8.000")).toBeOnTheScreen();
    expect(within(clasico).getByText("Organiza Sofía Castro · Sin reseñas")).toBeOnTheScreen();
    expect(within(rock).getByText("Organiza Lucía Álvarez · 4,5 · 12 reseñas")).toBeOnTheScreen();
    expect(within(maraton).getByText("Gratis")).toBeOnTheScreen();
    expect(within(hamlet).getByText("Agotado")).toBeOnTheScreen();
    expect(within(clasico).queryByText("Agotado")).toBeNull();
  });

  it("sin eventos próximos muestra el vacío", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([], false) }] });
    expect(await screen.findByText("Todavía no hay eventos próximos.")).toBeOnTheScreen();
  });

  it("ante un error muestra el mensaje y Reintentar vuelve a pedir", async () => {
    const { falso } = await abrirExplorar({
      [CATALOGO_INICIAL]: [
        { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") },
        { status: 200, json: catalogo([clasicoEnCatalogo]) },
      ],
    });
    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();
    expect(falso.pedidosA(CATALOGO_INICIAL)).toHaveLength(2);
  });

  it("sin servidor muestra el error y, cuando vuelve, la lista aparece sola", async () => {
    await abrirExplorar(
      { [CATALOGO_INICIAL]: ["rechazar", { status: 200, json: catalogo([clasicoEnCatalogo]) }] },
      [
        { status: 200, json: lucia },
        { status: 200, json: lucia },
      ],
    );
    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    expect(await screen.findByText("Servidor no disponible")).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: "Reintentar" }).length).toBeGreaterThan(0);

    await avanzar(1000);

    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();
    expect(screen.queryByText(FRANJA)).toBeNull();
  });

  it("un evento propio aparece como cualquier otro", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([rockEnCatalogo]) }] });
    const [rock] = await tarjetas();
    expect(rock.props.accessibilityLabel).toMatch(/^Noche de Rock en el Club, /);
  });

  it("cambiar de usuario no cambia el pedido (la clave no lleva usuario)", async () => {
    const { falso } = await abrirExplorar({
      [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([clasicoEnCatalogo]) }],
    });
    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();

    await irAPestana("Perfil");
    await fireEvent.press(await screen.findByRole("button", { name: "Cambiar usuario" }));
    await fireEvent.press(
      await screen.findByRole("button", { name: `Elegir a ${martin.nombre} ${martin.apellido}` }),
    );
    await esperarPestanas();
    await irAPestana("Explorar");

    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();
    for (const pedido of falso.pedidosA(CATALOGO_INICIAL)) {
      expect(pedido.encabezados["X-Usuario-Id"]).toBeUndefined();
    }
  });
});
