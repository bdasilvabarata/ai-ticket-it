import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PantallaDesplazable } from "../../src/componentes/PantallaDesplazable";
import { tema } from "../../src/componentes/tema";

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

describe("PantallaDesplazable", () => {
  it("termina por encima de la barra de navegación del sistema", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <PantallaDesplazable>
          <Text>Contenido</Text>
        </PantallaDesplazable>
      </SafeAreaProvider>,
    );

    const texto = screen.getByText("Contenido");
    expect(texto).toBeOnTheScreen();
    let scroll = texto.parent;
    while (scroll && scroll.type !== "RCTScrollView") scroll = scroll.parent;
    expect(StyleSheet.flatten(scroll?.props.contentContainerStyle).paddingBottom).toBe(
      tema.espacio.normal + 48,
    );
    // Tocar un botón con el teclado abierto lo presiona en el primer toque.
    expect(scroll?.props.keyboardShouldPersistTaps).toBe("handled");
  });
});
