import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { AccessibilityInfo } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FranjaServidorNoDisponible } from "../../src/componentes/FranjaServidorNoDisponible";

const URL_BASE = "http://192.168.0.10:3000/api";

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

function renderConSafeArea(elemento: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={metricas}>{elemento}</SafeAreaProvider>);
}

describe("FranjaServidorNoDisponible", () => {
  it("muestra el aviso con la dirección y Reintentar, que llama al tocarlo", async () => {
    const alReintentar = jest.fn();
    await renderConSafeArea(
      <FranjaServidorNoDisponible urlBase={URL_BASE} reintentando={false} alReintentar={alReintentar} />,
    );

    expect(screen.getByText(`Servidor no disponible · ${URL_BASE}`)).toBeOnTheScreen();
    const boton = screen.getByRole("button", { name: "Reintentar" });
    expect(boton).toBeEnabled();
    await fireEvent.press(boton);
    expect(alReintentar).toHaveBeenCalledTimes(1);
  });

  it("reintentando muestra Reintentando… deshabilitado y no llama", async () => {
    const alReintentar = jest.fn();
    await renderConSafeArea(
      <FranjaServidorNoDisponible urlBase={URL_BASE} reintentando alReintentar={alReintentar} />,
    );

    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    const boton = screen.getByRole("button", { name: "Reintentando…" });
    expect(boton).toBeDisabled();
    await fireEvent.press(boton);
    expect(alReintentar).not.toHaveBeenCalled();
  });

  it("es una alerta con región viva polite", async () => {
    await renderConSafeArea(
      <FranjaServidorNoDisponible urlBase={URL_BASE} reintentando={false} alReintentar={jest.fn()} />,
    );

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveProp("accessibilityLiveRegion", "polite");
    expect(alerta).toHaveTextContent(`Servidor no disponible · ${URL_BASE}`, { exact: false });
  });

  it("al montarse anuncia «Servidor no disponible» una sola vez, aunque se re-renderice", async () => {
    const anunciar = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
    try {
      const alReintentar = jest.fn();
      const vista = await renderConSafeArea(
        <FranjaServidorNoDisponible urlBase={URL_BASE} reintentando={false} alReintentar={alReintentar} />,
      );
      await vista.rerender(
        <SafeAreaProvider initialMetrics={metricas}>
          <FranjaServidorNoDisponible urlBase={URL_BASE} reintentando alReintentar={alReintentar} />
        </SafeAreaProvider>,
      );

      expect(anunciar).toHaveBeenCalledTimes(1);
      expect(anunciar).toHaveBeenCalledWith("Servidor no disponible");
    } finally {
      anunciar.mockRestore();
    }
  });
});
