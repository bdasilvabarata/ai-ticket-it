import { LIMITES_BUSQUEDA } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import {
  CATALOGO_INICIAL,
  catalogo,
  categorias,
  clasicoEnCatalogo,
  errorApi,
  hamletEnCatalogo,
  maratonCompleta,
  maratonEnCatalogo,
  rockEnCatalogo,
} from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { lucia, martin, todos } from "../helpers/usuarios";

const FRANJA = `Servidor no disponible · ${URL_DE_PRUEBA}`;

async function abrirExplorar(
  respuestas: Record<string, ReadonlyArray<RespuestaFalsa | FuncionRespuesta>>,
  usuarioActual: RespuestaFalsa[] = [{ status: 200, json: lucia }],
) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": usuarioActual,
      "/usuarios": [{ status: 200, json: todos }],
      "/categorias": [{ status: 200, json: [] }],
      ...respuestas,
    }),
  });
  await esperarPestanas();
  return resultado;
}

async function avanzar(ms: number) {
  await act(() => jest.advanceTimersByTimeAsync(ms));
}

const tarjetas = () => screen.findAllByRole("button", { name: /, organiza / });

describe("Explorar (US1)", () => {
  it("pide el catálogo por fecha sin X-Usuario-Id y muestra el skeleton mientras carga", async () => {
    const { falso } = await abrirExplorar({ [CATALOGO_INICIAL]: ["colgar"] });

    expect(await screen.findByLabelText("Cargando eventos")).toBeOnTheScreen();
    const [pedido] = falso.pedidosA(CATALOGO_INICIAL);
    expect(pedido.url).toBe(`${URL_DE_PRUEBA}${CATALOGO_INICIAL}`);
    expect(pedido.encabezados["X-Usuario-Id"]).toBeUndefined();
  });

  it("muestra las tarjetas en el orden del servidor, con todos sus textos", async () => {
    await abrirExplorar({
      [CATALOGO_INICIAL]: [
        {
          status: 200,
          json: catalogo([rockEnCatalogo, clasicoEnCatalogo, hamletEnCatalogo, maratonEnCatalogo]),
        },
      ],
    });

    const lista = await tarjetas();
    expect(lista.map((tarjeta) => tarjeta.props.accessibilityLabel)).toEqual([
      "Noche de Rock en el Club, Música, mar 1 dic 2026 · 20:00, desde $ 15.000, organiza Lucía Álvarez, 4,5 · 12 reseñas",
      "Clásico de básquet, Deportes, dom 15 nov 2026 · 19:00, desde $ 8.000, organiza Sofía Castro, sin reseñas",
      "Hamlet, versión contemporánea, Teatro, vie 20 nov 2026 · 20:00, desde $ 18.000, organiza Martín Benítez, sin reseñas, agotado",
      "Maratón Ciudad 10K, Deportes, vie 25 dic 2026 · 08:00, gratis, organiza Lucía Álvarez, sin reseñas",
    ]);
    const [rock, clasico, hamlet, maraton] = lista;
    expect(within(clasico).getByText("Clásico de básquet")).toBeOnTheScreen();
    expect(within(clasico).getByText("Deportes · dom 15 nov 2026 · 19:00")).toBeOnTheScreen();
    expect(within(clasico).getByText("desde $ 8.000")).toBeOnTheScreen();
    expect(within(clasico).getByText("Organiza Sofía Castro · Sin reseñas")).toBeOnTheScreen();
    expect(within(rock).getByText("Organiza Lucía Álvarez · 4,5 · 12 reseñas")).toBeOnTheScreen();
    expect(within(maraton).getByText("Gratis")).toBeOnTheScreen();
    expect(within(hamlet).getByText("Agotado")).toBeOnTheScreen();
    expect(within(clasico).queryByText("Agotado")).toBeNull();
  });

  it("sin eventos próximos muestra el vacío", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([], false) }] });
    expect(await screen.findByText("Todavía no hay eventos próximos.")).toBeOnTheScreen();
  });

  it("ante un error muestra el mensaje y Reintentar vuelve a pedir", async () => {
    const { falso } = await abrirExplorar({
      [CATALOGO_INICIAL]: [
        { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") },
        { status: 200, json: catalogo([clasicoEnCatalogo]) },
      ],
    });
    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();
    expect(falso.pedidosA(CATALOGO_INICIAL)).toHaveLength(2);
  });

  it("sin servidor muestra el error y, cuando vuelve, la lista aparece sola", async () => {
    await abrirExplorar(
      { [CATALOGO_INICIAL]: ["rechazar", { status: 200, json: catalogo([clasicoEnCatalogo]) }] },
      [
        { status: 200, json: lucia },
        { status: 200, json: lucia },
      ],
    );
    expect(await screen.findByText(FRANJA)).toBeOnTheScreen();
    expect(await screen.findByText("Servidor no disponible")).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: "Reintentar" }).length).toBeGreaterThan(0);

    await avanzar(1000);

    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();
    expect(screen.queryByText(FRANJA)).toBeNull();
  });

  it("un evento propio aparece como cualquier otro", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([rockEnCatalogo]) }] });
    const [rock] = await tarjetas();
    expect(rock.props.accessibilityLabel).toMatch(/^Noche de Rock en el Club, /);
  });

  it("cambiar de usuario no cambia el pedido (la clave no lleva usuario)", async () => {
    const { falso } = await abrirExplorar({
      [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([clasicoEnCatalogo]) }],
    });
    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();

    await irAPestana("Perfil");
    await fireEvent.press(await screen.findByRole("button", { name: "Cambiar usuario" }));
    await fireEvent.press(
      await screen.findByRole("button", { name: `Elegir a ${martin.nombre} ${martin.apellido}` }),
    );
    await esperarPestanas();
    await irAPestana("Explorar");

    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();
    for (const pedido of falso.pedidosA(CATALOGO_INICIAL)) {
      expect(pedido.encabezados["X-Usuario-Id"]).toBeUndefined();
    }
  });
});

describe("Explorar: buscar y filtrar (US3)", () => {
  const BASQUET = "/eventos?texto=basquet&orden=fecha";
  const MUSICA = "/eventos?categoriaId=categoria-musica&orden=fecha";
  const BASQUET_MUSICA = "/eventos?texto=basquet&categoriaId=categoria-musica&orden=fecha";
  const inicial = { status: 200, json: catalogo([rockEnCatalogo, clasicoEnCatalogo]) } as const;

  const buscador = () => screen.getByLabelText("Buscar eventos");
  async function escribirDeAUna(texto: string) {
    for (let i = 1; i <= texto.length; i += 1) {
      await fireEvent.changeText(buscador(), texto.slice(0, i));
      await avanzar(100);
    }
  }
  const pedidosConTexto = (falso: { pedidos: { url: string }[] }) =>
    falso.pedidos.filter((p) => p.url.includes("/eventos?texto="));

  it("el buscador tiene su placeholder, su etiqueta y el máximo de 100", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [inicial] });

    const campo = await screen.findByLabelText("Buscar eventos");
    expect(campo.props.placeholder).toBe("Buscar por nombre o descripción");
    expect(campo.props.maxLength).toBe(LIMITES_BUSQUEDA.texto);
  });

  it("al escribir muestra el skeleton desde la primera tecla y pide una vez, 500 ms después, con el último texto", async () => {
    const { falso } = await abrirExplorar({
      [CATALOGO_INICIAL]: [inicial],
      [BASQUET]: [{ status: 200, json: catalogo([clasicoEnCatalogo]) }],
    });
    await screen.findByText("Noche de Rock en el Club");

    await fireEvent.changeText(buscador(), "b");
    expect(screen.getByLabelText("Cargando eventos")).toBeOnTheScreen();
    expect(screen.queryByText("Noche de Rock en el Club")).toBeNull();
    await avanzar(100);
    await escribirDeAUna("basquet");
    expect(pedidosConTexto(falso)).toHaveLength(0);

    await avanzar(500);

    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();
    expect(pedidosConTexto(falso).map((p) => p.url)).toEqual([`${URL_DE_PRUEBA}${BASQUET}`]);
    expect(buscador().props.value).toBe("basquet");
  });

  it("manda el texto recortado; solo espacios no agrega texto", async () => {
    const { falso } = await abrirExplorar({ [CATALOGO_INICIAL]: [inicial] });
    await screen.findByText("Noche de Rock en el Club");

    await fireEvent.changeText(buscador(), "   ");
    await avanzar(600);
    expect(pedidosConTexto(falso)).toHaveLength(0);
    expect(screen.getByText("Noche de Rock en el Club")).toBeOnTheScreen();

    await fireEvent.changeText(buscador(), "  basquet  ");
    await avanzar(600);
    await waitFor(() => expect(falso.pedidosA(BASQUET)).toHaveLength(1));
  });

  it("elegir Música pide al instante con la categoría y muestra el skeleton", async () => {
    const { falso } = await abrirExplorar({
      "/categorias": [{ status: 200, json: categorias }],
      [CATALOGO_INICIAL]: [inicial],
      [MUSICA]: ["colgar"],
    });
    await screen.findByText("Noche de Rock en el Club");

    expect(await screen.findByRole("radio", { name: "Todas" })).toBeChecked();
    await fireEvent.press(screen.getByRole("radio", { name: "Música" }));

    expect(falso.pedidosA(MUSICA)).toHaveLength(1);
    expect(screen.getByLabelText("Cargando eventos")).toBeOnTheScreen();
    expect(screen.queryByText("Noche de Rock en el Club")).toBeNull();
  });

  it("sin coincidencias: Ningún evento coincide… y Limpiar búsqueda deja el texto vacío y Todas", async () => {
    await abrirExplorar({
      "/categorias": [{ status: 200, json: categorias }],
      [CATALOGO_INICIAL]: [inicial],
      [BASQUET_MUSICA]: [{ status: 200, json: catalogo([], true) }],
    });
    await screen.findByText("Noche de Rock en el Club");
    await fireEvent.press(await screen.findByRole("radio", { name: "Música" }));
    await fireEvent.changeText(buscador(), "basquet");
    await avanzar(600);

    expect(await screen.findByText("Ningún evento coincide con tu búsqueda.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Limpiar búsqueda" }));

    expect(buscador().props.value).toBe("");
    expect(screen.getByRole("radio", { name: "Todas" })).toBeChecked();
    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();
  });

  it("sin eventos próximos dice Todavía no hay eventos próximos. aunque haya texto", async () => {
    await abrirExplorar({
      [CATALOGO_INICIAL]: [inicial],
      [BASQUET]: [{ status: 200, json: catalogo([], false) }],
    });
    await screen.findByText("Noche de Rock en el Club");
    await fireEvent.changeText(buscador(), "basquet");
    await avanzar(600);

    expect(await screen.findByText("Todavía no hay eventos próximos.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Limpiar búsqueda" })).toBeNull();
  });

  it("las categorías tienen sus propios estados mientras el catálogo funciona con Todas", async () => {
    await abrirExplorar({
      "/categorias": [
        { status: 500, json: errorApi("ERROR_INTERNO", "No hay categorías.") },
        { status: 200, json: categorias },
      ],
      [CATALOGO_INICIAL]: [inicial],
    });

    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();
    expect(await screen.findByText("No hay categorías.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("radio", { name: "Música" })).toBeOnTheScreen();
  });

  it("mientras cargan las categorías dice Cargando categorías…", async () => {
    await abrirExplorar({ "/categorias": ["colgar"], [CATALOGO_INICIAL]: [inicial] });
    expect(await screen.findByText("Cargando categorías…")).toBeOnTheScreen();
    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();
  });

  it("abrir un detalle y volver conserva el texto y la categoría", async () => {
    await abrirExplorar({
      "/categorias": [{ status: 200, json: categorias }],
      [CATALOGO_INICIAL]: [inicial],
      [BASQUET_MUSICA]: [{ status: 200, json: catalogo([maratonEnCatalogo]) }],
      "/eventos/evento-maraton-10k": [{ status: 200, json: maratonCompleta }],
    });
    await screen.findByText("Noche de Rock en el Club");
    await fireEvent.press(await screen.findByRole("radio", { name: "Música" }));
    await fireEvent.changeText(buscador(), "basquet");
    await avanzar(600);
    await fireEvent.press(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / }));
    await screen.findByRole("header", { name: "Maratón Ciudad 10K" });

    await act(() => router.back());

    expect(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / })).toBeOnTheScreen();
    expect(buscador().props.value).toBe("basquet");
    expect(screen.getByRole("radio", { name: "Música" })).toBeChecked();
  });
});

describe("Explorar: ordenar (US4)", () => {
  const POR_PRECIO = "/eventos?orden=precio";
  const BASQUET_MUSICA_PRECIO = "/eventos?texto=basquet&categoriaId=categoria-musica&orden=precio";
  const porFecha = {
    status: 200,
    json: catalogo([rockEnCatalogo, clasicoEnCatalogo, maratonEnCatalogo]),
  } as const;
  const porPrecio = {
    status: 200,
    json: catalogo([maratonEnCatalogo, clasicoEnCatalogo, rockEnCatalogo]),
  } as const;
  const nombres = async () =>
    (await tarjetas()).map((t) => (t.props.accessibilityLabel as string).split(",")[0]);

  it("un radiogroup Ordenar por con Fecha, Precio y Puntaje, y Fecha elegido al abrir", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [porFecha] });

    expect((await screen.findByLabelText("Ordenar por")).props.accessibilityRole).toBe("radiogroup");
    expect(screen.getByRole("radio", { name: "Fecha" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Precio" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Puntaje" })).not.toBeChecked();
  });

  it("elegir Precio pide al instante, muestra el skeleton y después la lista en el orden del servidor", async () => {
    const { falso } = await abrirExplorar({ [CATALOGO_INICIAL]: [porFecha], [POR_PRECIO]: [porPrecio] });
    expect(await nombres()).toEqual(["Noche de Rock en el Club", "Clásico de básquet", "Maratón Ciudad 10K"]);

    await fireEvent.press(screen.getByRole("radio", { name: "Precio" }));

    expect(falso.pedidosA(POR_PRECIO)).toHaveLength(1);
    expect(screen.getByLabelText("Cargando eventos")).toBeOnTheScreen();
    expect(await nombres()).toEqual(["Maratón Ciudad 10K", "Clásico de básquet", "Noche de Rock en el Club"]);
    expect(screen.getByRole("radio", { name: "Precio" })).toBeChecked();
  });

  it("se combina con el texto y la categoría; Limpiar búsqueda deja el orden", async () => {
    const { falso } = await abrirExplorar({
      "/categorias": [{ status: 200, json: categorias }],
      [CATALOGO_INICIAL]: [porFecha],
      [BASQUET_MUSICA_PRECIO]: [{ status: 200, json: catalogo([], true) }],
      [POR_PRECIO]: [porPrecio],
    });
    await screen.findByText("Noche de Rock en el Club");
    await fireEvent.press(await screen.findByRole("radio", { name: "Música" }));
    await fireEvent.changeText(screen.getByLabelText("Buscar eventos"), "basquet");
    await avanzar(600);
    await fireEvent.press(screen.getByRole("radio", { name: "Precio" }));

    expect(await screen.findByText("Ningún evento coincide con tu búsqueda.")).toBeOnTheScreen();
    expect(falso.pedidosA(BASQUET_MUSICA_PRECIO)).toHaveLength(1);
    await fireEvent.press(screen.getByRole("button", { name: "Limpiar búsqueda" }));

    expect(screen.getByRole("radio", { name: "Precio" })).toBeChecked();
    expect(await nombres()).toEqual(["Maratón Ciudad 10K", "Clásico de básquet", "Noche de Rock en el Club"]);
  });

  it("Fecha → Precio → Fecha muestra la respuesta cacheada de esa consulta", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [porFecha], [POR_PRECIO]: [porPrecio] });
    await screen.findByText("Noche de Rock en el Club");

    await fireEvent.press(screen.getByRole("radio", { name: "Precio" }));
    expect(await nombres()).toEqual(["Maratón Ciudad 10K", "Clásico de básquet", "Noche de Rock en el Club"]);
    await fireEvent.press(screen.getByRole("radio", { name: "Fecha" }));

    expect(await nombres()).toEqual(["Noche de Rock en el Club", "Clásico de básquet", "Maratón Ciudad 10K"]);
  });

  it("volver del detalle conserva el orden", async () => {
    await abrirExplorar({
      [CATALOGO_INICIAL]: [porFecha],
      [POR_PRECIO]: [porPrecio],
      "/eventos/evento-maraton-10k": [{ status: 200, json: maratonCompleta }],
    });
    await screen.findByText("Noche de Rock en el Club");
    await fireEvent.press(screen.getByRole("radio", { name: "Precio" }));
    await fireEvent.press(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / }));
    await screen.findByRole("header", { name: "Maratón Ciudad 10K" });

    await act(() => router.back());

    expect(await screen.findByRole("radio", { name: "Precio" })).toBeChecked();
  });
});
