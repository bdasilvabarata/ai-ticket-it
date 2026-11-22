import { render, screen } from "@testing-library/react-native";

import { TarjetaEvento } from "../../../src/features/eventos/componentes/TarjetaEvento";
import { maratonEnCatalogo, nocheDeRisasEnCatalogo } from "../../helpers/eventos";

const MARCA = "marca-favorito";

describe("TarjetaEvento con la estrella indicadora (feature 014)", () => {
  it("con esFavorito, la etiqueta termina en ', en favoritos' y la estrella no es accesible aparte", async () => {
    await render(<TarjetaEvento evento={maratonEnCatalogo} esFavorito />);

    const tarjeta = screen.getByRole("button", { name: /, en favoritos$/ });
    expect(tarjeta).toBeOnTheScreen();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    // La marca existe, pero oculta para la accesibilidad: solo la ve quien mira la pantalla.
    expect(screen.queryByTestId(MARCA)).toBeNull();
    expect(screen.getByTestId(MARCA, { includeHiddenElements: true })).toBeTruthy();
  });

  it("sin la prop, ni estrella ni sufijo", async () => {
    await render(<TarjetaEvento evento={maratonEnCatalogo} />);

    expect(screen.queryByRole("button", { name: /en favoritos/ })).toBeNull();
    expect(screen.queryByTestId(MARCA, { includeHiddenElements: true })).toBeNull();
  });

  it("un evento realizado lleva la marca 'Realizado' y ', realizado' en la etiqueta", async () => {
    await render(<TarjetaEvento evento={nocheDeRisasEnCatalogo} esFavorito />);

    expect(screen.getByText("Realizado")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /, realizado, en favoritos$/ })).toBeOnTheScreen();
  });

  it("un evento no realizado no lleva la marca 'Realizado'", async () => {
    await render(<TarjetaEvento evento={maratonEnCatalogo} />);

    expect(screen.queryByText("Realizado")).toBeNull();
    expect(screen.queryByRole("button", { name: /realizado/ })).toBeNull();
  });
});
