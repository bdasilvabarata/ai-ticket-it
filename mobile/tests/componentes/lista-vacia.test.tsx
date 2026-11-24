import { fireEvent, render, screen } from "@testing-library/react-native";

import { ListaVacia } from "../../src/componentes";

describe("ListaVacia", () => {
  it("sin acción muestra solo el mensaje", async () => {
    await render(<ListaVacia mensaje="No hay nada." />);

    expect(screen.getByText("No hay nada.")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("con acción muestra un botón con ese texto que llama a alPresionar", async () => {
    const alPresionar = jest.fn();
    await render(<ListaVacia mensaje="Nada coincide." accion={{ texto: "Limpiar búsqueda", alPresionar }} />);

    await fireEvent.press(screen.getByRole("button", { name: "Limpiar búsqueda" }));

    expect(screen.getByText("Nada coincide.")).toBeOnTheScreen();
    expect(alPresionar).toHaveBeenCalledTimes(1);
  });
});
