import { act, fireEvent, screen } from "expo-router/testing-library";
import { Alert, type AlertButton } from "react-native";

/**
 * Elige fecha y hora con el selector nativo simulado (jest.setup.ts). Jest corre con plataforma
 * iOS: "Elegir fecha" y "Elegir hora" muestran el componente, que se cierra con "Listo".
 */
export async function elegirFechaYHora(fecha: Date) {
  for (const boton of ["Elegir fecha", "Elegir hora"]) {
    await fireEvent.press(screen.getByRole("button", { name: boton }));
    const selector = screen.getByTestId("selector-nativo-de-fecha");
    await act(() => selector.props.onValueChange({ nativeEvent: { timestamp: fecha.getTime() } }, fecha));
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
  }
}

/** Espía de `Alert.alert` para un test. */
export function espiarAlertas() {
  return jest.spyOn(Alert, "alert").mockImplementation(() => {});
}

/** Las llamadas a `Alert.alert` con ese título. */
export function alertasCon(espia: jest.SpyInstance, titulo: string) {
  return espia.mock.calls.filter(([t]) => t === titulo);
}

/** Toca el botón `texto` del último `Alert.alert` con ese título. */
export async function tocarEnAlerta(espia: jest.SpyInstance, titulo: string, texto: string) {
  const llamadas = alertasCon(espia, titulo);
  if (llamadas.length === 0) throw new Error(`No se mostró la alerta "${titulo}"`);
  const botones = (llamadas.at(-1)?.[2] ?? []) as AlertButton[];
  const boton = botones.find((b) => b.text === texto);
  if (!boton) throw new Error(`La alerta "${titulo}" no tiene el botón "${texto}"`);
  await act(async () => boton.onPress?.());
}

/** Escribe en el campo con esa etiqueta de accesibilidad. */
export async function escribir(etiqueta: string, texto: string) {
  await fireEvent.changeText(screen.getByLabelText(etiqueta), texto);
}

/**
 * Título del header de la pantalla de arriba del Stack. El header del Stack es nativo: en jest su
 * título no es un texto, sino la prop `title` de su configuración.
 */
export function tituloDelHeader(): string | undefined {
  const titulos: string[] = [];
  const recorrer = (nodo: unknown) => {
    if (Array.isArray(nodo)) return nodo.forEach(recorrer);
    if (typeof nodo !== "object" || nodo === null) return;
    const { type, props, children } = nodo as {
      type?: string;
      props?: { title?: unknown };
      children?: unknown;
    };
    if (type === "RNSScreenStackHeaderConfig" && typeof props?.title === "string") titulos.push(props.title);
    recorrer(children);
  };
  recorrer(screen.toJSON());
  return titulos.at(-1);
}
