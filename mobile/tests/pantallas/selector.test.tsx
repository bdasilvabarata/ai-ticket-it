import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { CLAVE_RECORDADO, lucia, todos } from "../helpers/usuarios";

const TITULO = "¿Con quién querés operar?";
const PENDIENTE = "Esta sección todavía no está disponible.";

async function avanzar(ms: number) {
  await act(() => jest.advanceTimersByTimeAsync(ms));
}

describe("selector de usuario (sin usuario recordado)", () => {
  it("muestra Cargando… mientras la lista no llega", async () => {
    const { falso } = await renderConDependencias({ respuestas: ["colgar"] });

    await waitFor(() => expect(falso.pedidosA("/usuarios")).toHaveLength(1));
    expect(screen.getByText("Cargando…")).toBeOnTheScreen();
    expect(screen.queryByText(TITULO)).toBeNull();
  });

  it("muestra los usuarios en el orden del servidor, con su cantidad de eventos", async () => {
    const { falso } = await renderConDependencias({ respuestas: [{ status: 200, json: todos }] });

    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    const filas = screen.getAllByRole("button").map((fila) => fila.props.accessibilityLabel);
    expect(filas).toEqual(["Elegir a Lucía Álvarez", "Elegir a Martín Benítez", "Elegir a Diego Fernández"]);
    expect(screen.getByText("Lucía Álvarez")).toBeOnTheScreen();
    expect(screen.getByText("Organiza 2 eventos")).toBeOnTheScreen();
    expect(screen.getByText("Organiza 1 evento")).toBeOnTheScreen();
    expect(screen.getByText("No organiza eventos")).toBeOnTheScreen();
    expect(falso.pedidosA("/usuarios")[0].encabezados).not.toHaveProperty("X-Usuario-Id");
  });

  it("muestra el logo arriba del selector", async () => {
    await renderConDependencias({ respuestas: [{ status: 200, json: todos }] });

    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(screen.getByLabelText("AI Ticket It")).toBeOnTheScreen();
  });

  it("con la lista vacía muestra el mensaje de lista vacía", async () => {
    await renderConDependencias({ respuestas: [{ status: 200, json: [] }] });

    expect(await screen.findByText("No hay usuarios disponibles.")).toBeOnTheScreen();
  });

  it("sin servidor muestra el aviso con la dirección, y la lista aparece sola al primer reintento", async () => {
    const { falso } = await renderConDependencias({
      respuestas: ["rechazar", { status: 200, json: todos }],
    });

    expect(await screen.findByText("Servidor no disponible")).toBeOnTheScreen();
    expect(screen.getByText(`No se pudo conectar con ${URL_DE_PRUEBA}.`)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeOnTheScreen();
    expect(falso.pedidosA("/usuarios")).toHaveLength(1);

    await avanzar(1000);
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(falso.pedidosA("/usuarios")).toHaveLength(2);
  });

  it("sin servidor, Reintentar pide la lista en el acto", async () => {
    const { falso } = await renderConDependencias({
      respuestas: ["rechazar", { status: 200, json: todos }],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Reintentar" }));
    expect(falso.pedidosA("/usuarios")).toHaveLength(2);
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
  });

  it("un error respondido por el servidor muestra su mensaje y Reintentar, sin reintentos automáticos", async () => {
    const { falso } = await renderConDependencias({
      respuestas: [
        { status: 500, json: { error: { codigo: "ERROR_INTERNO", mensaje: "Falló el servidor." } } },
        { status: 200, json: todos },
      ],
    });

    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();
    await avanzar(60_000);
    expect(falso.pedidosA("/usuarios")).toHaveLength(1);

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
  });

  it("elegir a Lucía entra a Explorar y la recuerda", async () => {
    const resultado = await renderConDependencias({ respuestas: [{ status: 200, json: todos }] });

    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Lucía Álvarez" }));

    expect(await screen.findByText(PENDIENTE)).toBeOnTheScreen();
    expect(resultado.getPathname()).toBe("/");
    expect(JSON.parse((await AsyncStorage.getItem(CLAVE_RECORDADO)) ?? "null")).toEqual({
      version: 1,
      usuarioId: lucia.id,
    });
  });

  it("un doble toque registra la elección una sola vez", async () => {
    // El guardado tarda: el segundo toque llega mientras se procesa el primero.
    // El mock de AsyncStorage es un jest.fn compartido: se limpia y se cambia solo la primera llamada.
    const setItem = jest.mocked(AsyncStorage.setItem);
    setItem.mockClear();
    setItem.mockImplementationOnce(() => new Promise<void>((resolver) => setTimeout(resolver, 100)));
    const resultado = await renderConDependencias({ respuestas: [{ status: 200, json: todos }] });

    const fila = await screen.findByRole("button", { name: "Elegir a Lucía Álvarez" });
    await fireEvent.press(fila);
    await fireEvent.press(fila);
    await avanzar(100);

    expect(await screen.findByText(PENDIENTE)).toBeOnTheScreen();
    expect(resultado.getPathname()).toBe("/");
    expect(setItem.mock.calls.filter(([clave]) => clave === CLAVE_RECORDADO)).toHaveLength(1);
  });

  it("si no se puede guardar la elección, entra igual sin recordarla y avisa por consola (CHK004)", async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("disco lleno"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await renderConDependencias({ respuestas: [{ status: 200, json: todos }] });

    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Lucía Álvarez" }));

    expect(await screen.findByText(PENDIENTE)).toBeOnTheScreen();
    await expect(AsyncStorage.getItem(CLAVE_RECORDADO)).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
