import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { crearClienteApi } from "../../../src/api";
import { ClienteApiProvider } from "../../../src/consultas/cliente-api";
import { SelectorCategoria } from "../../../src/features/eventos/componentes/SelectorCategoria";
import { categorias } from "../../helpers/eventos";
import { crearFetchFalso } from "../../helpers/fetch-falso";

let queryClient: QueryClient | null = null;

afterEach(() => {
  queryClient?.clear();
  queryClient = null;
});

async function renderSelector(valor: string | null, alCambiar: (id: string | null) => void) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const cliente = crearClienteApi({
    fetch: crearFetchFalso([{ status: 200, json: categorias }]).fetch,
    urlBase: "http://servidor-de-prueba:3000/api",
    obtenerUsuarioId: () => null,
    alUsuarioNoIdentificado: () => undefined,
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <ClienteApiProvider cliente={cliente}>
        <SelectorCategoria conTodas valor={valor} alCambiar={alCambiar} />
      </ClienteApiProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole("radio", { name: "Música" });
}

describe("SelectorCategoria con Todas (Explorar)", () => {
  it("Todas va primera y queda elegida con null, en un radiogroup Categoría", async () => {
    await renderSelector(null, jest.fn());

    // El grupo no es un elemento accesible por sí mismo (si no, taparía a sus opciones): se busca por
    // su etiqueta y se verifica su rol.
    expect(screen.getByLabelText("Categoría").props.accessibilityRole).toBe("radiogroup");
    const opciones = screen.getAllByRole("radio");
    expect(opciones.map((o) => o.props.accessibilityLabel)).toEqual([
      "Todas",
      "Conferencias",
      "Música",
      "Teatro",
    ]);
    expect(screen.getByRole("radio", { name: "Todas" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Música" })).not.toBeChecked();
  });

  it("elegir una categoría llama alCambiar(id) y elegir Todas, alCambiar(null)", async () => {
    const alCambiar = jest.fn();
    await renderSelector("categoria-musica", alCambiar);
    expect(screen.getByRole("radio", { name: "Música" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Todas" })).not.toBeChecked();

    await fireEvent.press(screen.getByRole("radio", { name: "Teatro" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Todas" }));

    expect(alCambiar).toHaveBeenNthCalledWith(1, "categoria-teatro");
    expect(alCambiar).toHaveBeenNthCalledWith(2, null);
  });
});
