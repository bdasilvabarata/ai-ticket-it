import { fireEvent, render, screen } from "@testing-library/react-native";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PantallaDesplazable } from "../../src/componentes/PantallaDesplazable";
import { tema } from "../../src/componentes/tema";

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

function scrollDe(texto: string) {
  let scroll = screen.getByText(texto).parent;
  while (scroll && scroll.type !== "RCTScrollView") scroll = scroll.parent;
  if (!scroll) throw new Error("No se encontró el ScrollView");
  return scroll;
}

describe("PantallaDesplazable", () => {
  const scrollToEnd = jest.spyOn(ScrollView.prototype, "scrollToEnd");
  beforeEach(() => scrollToEnd.mockClear());

  it("termina por encima de la barra de navegación del sistema", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <PantallaDesplazable>
          <Text>Contenido</Text>
        </PantallaDesplazable>
      </SafeAreaProvider>,
    );

    expect(screen.getByText("Contenido")).toBeOnTheScreen();
    const scroll = scrollDe("Contenido");
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(
      tema.espacio.normal + 48,
    );
    // Tocar un botón con el teclado abierto lo presiona en el primer toque.
    expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  });

  it("con «empezarAlFinal», al cambiar el tamaño del contenido desplaza hasta el final sin animación", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <PantallaDesplazable empezarAlFinal>
          <Text>Conversación</Text>
        </PantallaDesplazable>
      </SafeAreaProvider>,
    );

    await fireEvent(scrollDe("Conversación"), "contentSizeChange", 360, 1200);

    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    // El margen inferior y el teclado no cambian con la prop.
    const scroll = scrollDe("Conversación");
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(
      tema.espacio.normal + 48,
    );
    expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  });

  it("sin «empezarAlFinal», un cambio de tamaño del contenido no desplaza", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <PantallaDesplazable>
          <Text>Formulario</Text>
        </PantallaDesplazable>
      </SafeAreaProvider>,
    );

    await fireEvent(scrollDe("Formulario"), "contentSizeChange", 360, 1200);

    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  describe("«volverArribaCon» (feature 013)", () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    beforeEach(() => scrollTo.mockClear());

    function Pantalla({ valor }: { valor: unknown }) {
      return (
        <SafeAreaProvider initialMetrics={metricas}>
          <PantallaDesplazable volverArribaCon={valor}>
            <Text>Lista</Text>
          </PantallaDesplazable>
        </SafeAreaProvider>
      );
    }

    it("al montar no desplaza", async () => {
      await render(<Pantalla valor={1} />);

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("cuando cambia el valor vuelve arriba sin animación", async () => {
      const { rerender } = await render(<Pantalla valor={1} />);

      await rerender(<Pantalla valor={2} />);

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    });

    it("con el mismo valor no vuelve a desplazar", async () => {
      const { rerender } = await render(<Pantalla valor={2} />);

      await rerender(<Pantalla valor={2} />);

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("sin la prop, volver a dibujar no desplaza", async () => {
      const contenido = (texto: string) => (
        <SafeAreaProvider initialMetrics={metricas}>
          <PantallaDesplazable>
            <Text>{texto}</Text>
          </PantallaDesplazable>
        </SafeAreaProvider>
      );
      const { rerender } = await render(contenido("Uno"));

      await rerender(contenido("Dos"));

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
