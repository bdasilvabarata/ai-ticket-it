import { fireEvent, screen, within } from "expo-router/testing-library";

/**
 * Botones de la barra de pestañas, en orden. Jest corre con plataforma iOS, donde cada pestaña es
 * un `button` con la etiqueta "{nombre}, tab, {i} of {n}" dentro del `tablist`.
 */
export function botonesDePestanas() {
  return within(screen.getByRole("tablist")).getAllByRole("button");
}

export async function irAPestana(nombre: string) {
  await fireEvent.press(
    within(screen.getByRole("tablist")).getByRole("button", { name: new RegExp(`^${nombre},`) }),
  );
}
