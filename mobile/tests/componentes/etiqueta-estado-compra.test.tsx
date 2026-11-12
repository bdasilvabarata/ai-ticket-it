import { EstadoCompra } from "@ai-ticket-it/shared";
import { render, screen } from "@testing-library/react-native";

import { EtiquetaEstadoCompra, tema, textoEtiquetaEstado } from "../../src/componentes";

const casos = [
  [EstadoCompra.PENDIENTE, "Pendiente", tema.colores.advertencia, tema.colores.sobreAdvertencia],
  [EstadoCompra.CONFIRMADA, "Confirmada", tema.colores.exito, tema.colores.sobreExito],
  [EstadoCompra.UTILIZADA, "Utilizada", tema.colores.exito, tema.colores.sobreExito],
  [EstadoCompra.CANCELADA, "Cancelada", tema.colores.peligro, tema.colores.sobrePeligro],
  [EstadoCompra.REEMBOLSADA, "Reembolsada", tema.colores.peligro, tema.colores.sobrePeligro],
] as const;

describe("textoEtiquetaEstado", () => {
  it.each(casos)("%s → %s", (estado, texto) => {
    expect(textoEtiquetaEstado(estado)).toBe(texto);
  });
});

describe("EtiquetaEstadoCompra", () => {
  it.each(casos)(
    "%s: escribe «%s» sobre su color, con su color de texto",
    async (estado, texto, fondo, sobre) => {
      await render(<EtiquetaEstadoCompra estado={estado} />);

      const etiqueta = screen.getByLabelText(`Estado: ${texto}`);
      expect(etiqueta).toHaveStyle({ backgroundColor: fondo });
      expect(screen.getByText(texto)).toHaveStyle({ color: sobre });
    },
  );
});
