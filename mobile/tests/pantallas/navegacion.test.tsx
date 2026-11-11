import { screen, within } from "expo-router/testing-library";

import { porRuta } from "../helpers/fetch-falso";
import { botonesDePestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

const PENDIENTE = "Esta sección todavía no está disponible.";

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

  // Mis eventos (feature 004) y Explorar (feature 005) ya no son secciones pendientes: las prueban
  // tests/pantallas/mis-eventos y tests/pantallas/explorar.
  it.each([["Mis compras", "/mis-compras"]])(
    "la pestaña %s muestra su nombre y que todavía no está disponible (US3-2)",
    async (nombre, ruta) => {
      const resultado = await entrarConfirmado();
      await screen.findByText("Todavía no hay eventos próximos.");

      await irAPestana(nombre);

      expect(resultado.getPathname()).toBe(ruta);
      expect(screen.getByRole("header", { name: nombre })).toBeOnTheScreen();
      expect(screen.getByText(PENDIENTE)).toBeOnTheScreen();
    },
  );
});
