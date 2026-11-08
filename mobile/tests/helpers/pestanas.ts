import { fireEvent, screen } from "expo-router/testing-library";

/**
 * Jest corre con plataforma iOS: cada pestaña es un `button` con la etiqueta
 * "{nombre}, tab, {i} of {n}". El contenedor `tablist` no es accesible por sí mismo, así que no
 * sirve para buscarlas.
 */
const ETIQUETA_DE_PESTANA = /, tab, \d+ of \d+$/;

export function botonesDePestanas() {
  return screen.queryAllByRole("button", { name: ETIQUETA_DE_PESTANA });
}

export function esperarPestanas() {
  return screen.findAllByRole("button", { name: ETIQUETA_DE_PESTANA });
}

export async function irAPestana(nombre: string) {
  await fireEvent.press(screen.getByRole("button", { name: new RegExp(`^${nombre}, tab, `) }));
}
