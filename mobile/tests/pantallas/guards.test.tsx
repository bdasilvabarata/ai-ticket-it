import { fireEvent, screen } from "expo-router/testing-library";

import { renderConDependencias } from "../helpers/render-con-dependencias";
import { todos } from "../helpers/usuarios";

const PENDIENTE = "Esta sección todavía no está disponible.";

describe("guard sin usuario (FR-011)", () => {
  it.each(["/", "/perfil"])(
    "sin usuario recordado, %s muestra el selector y no las pestañas",
    async (initialUrl) => {
      const resultado = await renderConDependencias({
        respuestas: [{ status: 200, json: todos }],
        initialUrl,
      });

      expect(await screen.findByText("¿Con quién querés operar?")).toBeOnTheScreen();
      expect(screen.queryByText(PENDIENTE)).toBeNull();

      await fireEvent.press(screen.getByRole("button", { name: "Elegir a Lucía Álvarez" }));
      expect(await screen.findByText(PENDIENTE)).toBeOnTheScreen();
      expect(resultado.getPathname()).toBe("/");
    },
  );
});
