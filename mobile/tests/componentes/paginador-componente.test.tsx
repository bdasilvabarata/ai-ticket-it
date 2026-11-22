import type { PaginaVista } from "@ai-ticket-it/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { Paginador } from "../../src/componentes/Paginador";

function pagina(numero: number, totalPaginas: number): PaginaVista {
  return { numero, tamano: 10, totalElementos: totalPaginas * 10, totalPaginas };
}

function etiquetasDeLosBotones() {
  return screen.queryAllByRole("button").map((boton) => boton.props.accessibilityLabel as string);
}

describe("Paginador", () => {
  it.each([0, 1])("con %i páginas no dibuja nada (FR-010)", async (totalPaginas) => {
    await render(
      <Paginador
        pagina={{ numero: 1, tamano: 10, totalElementos: totalPaginas * 3, totalPaginas }}
        alCambiar={jest.fn()}
      />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.toJSON()).toBeNull();
  });

  it("con 3 páginas muestra un botón por página, cada uno «Página N»", async () => {
    await render(<Paginador pagina={pagina(1, 3)} alCambiar={jest.fn()} />);

    expect(etiquetasDeLosBotones()).toEqual(["Página 1", "Página 2", "Página 3"]);
    expect(screen.getByRole("button", { name: "Página 2" })).toHaveTextContent("2");
  });

  it("con 10 páginas y la 6 actual muestra 1 5 6 7 10, la actual seleccionada y no deshabilitada", async () => {
    await render(<Paginador pagina={pagina(6, 10)} alCambiar={jest.fn()} />);

    expect(etiquetasDeLosBotones()).toEqual(["Página 1", "Página 5", "Página 6", "Página 7", "Página 10"]);
    const actual = screen.getByRole("button", { name: "Página 6" });
    expect(actual).toBeSelected();
    expect(actual).toBeEnabled();
    for (const otra of ["Página 1", "Página 5", "Página 7", "Página 10"]) {
      expect(screen.getByRole("button", { name: otra })).not.toBeSelected();
    }
  });

  it("tocar otra página llama a «alCambiar» con su número, una vez", async () => {
    const alCambiar = jest.fn();
    await render(<Paginador pagina={pagina(6, 10)} alCambiar={alCambiar} />);

    await fireEvent.press(screen.getByRole("button", { name: "Página 10" }));

    expect(alCambiar).toHaveBeenCalledTimes(1);
    expect(alCambiar).toHaveBeenCalledWith(10);
  });

  it("tocar la actual no llama a «alCambiar» (FR-011)", async () => {
    const alCambiar = jest.fn();
    await render(<Paginador pagina={pagina(2, 3)} alCambiar={alCambiar} />);

    await fireEvent.press(screen.getByRole("button", { name: "Página 2" }));

    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("la actual sale de «pagina.numero» de la respuesta (FR-005)", async () => {
    const { rerender } = await render(<Paginador pagina={pagina(1, 2)} alCambiar={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Página 1" })).toBeSelected();

    // Se pidió la 9 y el servidor entregó la última, la 2.
    await rerender(<Paginador pagina={pagina(2, 2)} alCambiar={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Página 2" })).toBeSelected();
    expect(screen.getByRole("button", { name: "Página 1" })).not.toBeSelected();
  });
});
