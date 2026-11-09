import { fireEvent, render, screen } from "@testing-library/react-native";

import { Boton } from "../../src/componentes/Boton";

describe("Boton (FR-012, contracts/componentes-base.md)", () => {
  it("normal: es un botón con su texto como nombre y al tocarlo llama a alPresionar", async () => {
    const alPresionar = jest.fn();
    await render(<Boton texto="Cambiar usuario" alPresionar={alPresionar} />);

    const boton = screen.getByRole("button", { name: "Cambiar usuario" });
    expect(boton).toBeEnabled();
    await fireEvent.press(boton);
    expect(alPresionar).toHaveBeenCalledTimes(1);
  });

  it("con accessibilityLabel, ese es su nombre para el lector de pantalla", async () => {
    await render(
      <Boton
        texto="Cerrar"
        variante="texto"
        accessibilityLabel="Cerrar sin cambiar de usuario"
        alPresionar={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Cerrar sin cambiar de usuario" })).toBeOnTheScreen();
    expect(screen.getByText("Cerrar")).toBeOnTheScreen();
  });

  it("deshabilitado: el lector lo anuncia deshabilitado y tocarlo no llama", async () => {
    const alPresionar = jest.fn();
    await render(<Boton texto="Reintentar" deshabilitado alPresionar={alPresionar} />);

    const boton = screen.getByRole("button", { name: "Reintentar" });
    expect(boton).toBeDisabled();
    await fireEvent.press(boton);
    expect(alPresionar).not.toHaveBeenCalled();
  });

  it("en curso: muestra textoEnCurso, deshabilitado y ocupado, y tocarlo no llama", async () => {
    const alPresionar = jest.fn();
    await render(
      <Boton
        texto="Reintentar"
        textoEnCurso="Reintentando…"
        enCurso
        variante="aviso"
        alPresionar={alPresionar}
      />,
    );

    expect(screen.queryByText("Reintentar")).toBeNull();
    const boton = screen.getByRole("button", { name: "Reintentando…" });
    expect(boton).toBeDisabled();
    expect(boton).toBeBusy();
    await fireEvent.press(boton);
    expect(alPresionar).not.toHaveBeenCalled();
  });

  it("en curso sin textoEnCurso: sigue mostrando su texto", async () => {
    await render(<Boton texto="Guardar" enCurso alPresionar={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});
