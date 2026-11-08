import { fireEvent, render, screen } from "@testing-library/react-native";

import { MensajeError } from "../../src/componentes/MensajeError";

describe("MensajeError", () => {
  it("muestra el título, el mensaje y Reintentar, que llama al tocarlo", async () => {
    const alReintentar = jest.fn();
    await render(
      <MensajeError titulo="Servidor no disponible" mensaje="No anda." alReintentar={alReintentar} />,
    );

    expect(screen.getByText("Servidor no disponible")).toBeOnTheScreen();
    expect(screen.getByText("No anda.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(alReintentar).toHaveBeenCalledTimes(1);
  });

  it("sin alReintentar no muestra botón", async () => {
    await render(<MensajeError mensaje="No anda." />);

    expect(screen.getByText("No anda.")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reintentando muestra Reintentando… deshabilitado y no llama", async () => {
    const alReintentar = jest.fn();
    await render(<MensajeError mensaje="No anda." alReintentar={alReintentar} reintentando />);

    const boton = screen.getByRole("button", { name: "Reintentando…" });
    expect(boton).toBeDisabled();
    await fireEvent.press(boton);
    expect(alReintentar).not.toHaveBeenCalled();
  });
});
