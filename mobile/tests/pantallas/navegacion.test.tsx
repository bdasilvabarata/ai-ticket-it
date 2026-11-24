import { screen, within } from "expo-router/testing-library";

import { porRuta } from "../helpers/fetch-falso";
import { botonesDePestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

function entrarConfirmado() {
  return renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
    }),
  });
}

describe("navegación principal (US3)", () => {
  it("muestra las cuatro pestañas en orden y con texto, y abre Explorar (US3-1, FR-017)", async () => {
    const resultado = await entrarConfirmado();

    // Explorar ya no es una sección pendiente (feature 005): muestra el catálogo, acá vacío.
    expect(await screen.findByText("Todavía no hay eventos próximos.")).toBeOnTheScreen();
    const pestanas = botonesDePestanas();
    expect(pestanas.map((boton) => boton.props.accessibilityLabel)).toEqual([
      "Explorar, tab, 1 of 4",
      "Mis compras, tab, 2 of 4",
      "Mis eventos, tab, 3 of 4",
      "Perfil, tab, 4 of 4",
    ]);
    // Texto visible, no solo ícono (el botón también contiene el glifo del ícono).
    ["Explorar", "Mis compras", "Mis eventos", "Perfil"].forEach((nombre, i) => {
      expect(within(pestanas[i]).getByText(nombre)).toBeOnTheScreen();
    });
    expect(resultado.getPathname()).toBe("/");
  });

  // Ninguna pestaña es ya una sección pendiente: Mis eventos (004), Explorar (005) y Mis compras
  // (007) las prueban tests/pantallas/mis-eventos, explorar y mis-compras.
  it("la pestaña Mis compras abre la lista de compras del usuario", async () => {
    const resultado = await entrarConfirmado();
    await screen.findByText("Todavía no hay eventos próximos.");

    await irAPestana("Mis compras");

    expect(resultado.getPathname()).toBe("/mis-compras");
    expect(await screen.findByText("Todavía no compraste entradas")).toBeOnTheScreen();
  });
});
