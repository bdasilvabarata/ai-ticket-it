import { LIMITES_BUSQUEDA, type EventoCatalogoVista } from "@ai-ticket-it/shared";
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

/** El botón del filtro de categoría, a la derecha del buscador ("Categoría: Todas"). */
const botonCategoria = () => screen.findByRole("button", { name: /^Categoría: / });
async function abrirCategorias() {
  await fireEvent.press(await botonCategoria());
}

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
  const BASQUET = "/eventos?texto=basquet&orden=fecha&sentido=asc";
  const MUSICA = "/eventos?categoriaId=categoria-musica&orden=fecha&sentido=asc";
  const BASQUET_MUSICA = "/eventos?texto=basquet&categoriaId=categoria-musica&orden=fecha&sentido=asc";
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

  it("el filtro de categoría arranca cerrado a la derecha del buscador y se abre y cierra al tocarlo", async () => {
    await abrirExplorar({
      "/categorias": [{ status: 200, json: categorias }],
      [CATALOGO_INICIAL]: [inicial],
    });
    await screen.findByText("Noche de Rock en el Club");

    const boton = await botonCategoria();
    expect(boton).toHaveAccessibleName("Categoría: Todas");
    expect(boton).toBeCollapsed();
    expect(screen.queryByRole("radio", { name: "Todas" })).toBeNull();

    await fireEvent.press(boton);
    expect(await screen.findByRole("radio", { name: "Música" })).toBeOnTheScreen();
    expect(await botonCategoria()).toBeExpanded();

    await fireEvent.press(await botonCategoria());
    expect(screen.queryByRole("radio", { name: "Música" })).toBeNull();
  });

  it("elegir Música pide al instante con la categoría y muestra el skeleton", async () => {
    const { falso } = await abrirExplorar({
      "/categorias": [{ status: 200, json: categorias }],
      [CATALOGO_INICIAL]: [inicial],
      [MUSICA]: ["colgar"],
    });
    await screen.findByText("Noche de Rock en el Club");

    await abrirCategorias();
    expect(await screen.findByRole("radio", { name: "Todas" })).toBeChecked();
    await fireEvent.press(screen.getByRole("radio", { name: "Música" }));

    expect(falso.pedidosA(MUSICA)).toHaveLength(1);
    // Elegir cierra el desplegable y el botón dice qué categoría filtra.
    expect(screen.queryByRole("radio", { name: "Todas" })).toBeNull();
    expect(screen.getByRole("button", { name: "Categoría: Música" })).toBeOnTheScreen();
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
    await abrirCategorias();
    await fireEvent.press(await screen.findByRole("radio", { name: "Música" }));
    await fireEvent.changeText(buscador(), "basquet");
    await avanzar(600);

    expect(await screen.findByText("Ningún evento coincide con tu búsqueda.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Limpiar búsqueda" }));

    expect(buscador().props.value).toBe("");
    expect(screen.getByRole("button", { name: "Categoría: Todas" })).toBeOnTheScreen();
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
      // Las pide el botón al entrar y otra vez el desplegable al abrirse (el error no queda guardado).
      "/categorias": [
        { status: 500, json: errorApi("ERROR_INTERNO", "No hay categorías.") },
        { status: 500, json: errorApi("ERROR_INTERNO", "No hay categorías.") },
        { status: 200, json: categorias },
      ],
      [CATALOGO_INICIAL]: [inicial],
    });

    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();
    await abrirCategorias();
    expect(await screen.findByText("No hay categorías.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("radio", { name: "Música" })).toBeOnTheScreen();
  });

  it("mientras cargan las categorías dice Cargando categorías…", async () => {
    await abrirExplorar({ "/categorias": ["colgar"], [CATALOGO_INICIAL]: [inicial] });
    await abrirCategorias();
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
    await abrirCategorias();
    await fireEvent.press(await screen.findByRole("radio", { name: "Música" }));
    await fireEvent.changeText(buscador(), "basquet");
    await avanzar(600);
    await fireEvent.press(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / }));
    await screen.findByRole("header", { name: "Maratón Ciudad 10K" });

    await act(() => router.back());

    expect(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / })).toBeOnTheScreen();
    expect(buscador().props.value).toBe("basquet");
    expect(screen.getByRole("button", { name: "Categoría: Música" })).toBeOnTheScreen();
  });
});

describe("Explorar: ordenar (US4)", () => {
  const POR_PRECIO = "/eventos?orden=precio&sentido=asc";
  const BASQUET_MUSICA_PRECIO =
    "/eventos?texto=basquet&categoriaId=categoria-musica&orden=precio&sentido=asc";
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
    await abrirCategorias();
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

  it("el orden elegido muestra su sentido y tocarlo de nuevo lo invierte", async () => {
    const FECHA_DESC = "/eventos?orden=fecha&sentido=desc";
    const { falso } = await abrirExplorar({
      [CATALOGO_INICIAL]: [porFecha],
      [FECHA_DESC]: [{ status: 200, json: catalogo([maratonEnCatalogo, clasicoEnCatalogo, rockEnCatalogo]) }],
    });
    await screen.findByText("Noche de Rock en el Club");
    expect(screen.getByRole("radio", { name: "Fecha" })).toHaveAccessibilityValue({
      text: "Más próximos primero",
    });

    await fireEvent.press(screen.getByRole("radio", { name: "Fecha" }));

    expect(falso.pedidosA(FECHA_DESC)).toHaveLength(1);
    expect(await nombres()).toEqual(["Maratón Ciudad 10K", "Clásico de básquet", "Noche de Rock en el Club"]);
    expect(screen.getByRole("radio", { name: "Fecha" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Fecha" })).toHaveAccessibilityValue({
      text: "Más lejanos primero",
    });
  });

  it("elegir otro criterio arranca en su sentido inicial; Puntaje invertido pide sentido=asc", async () => {
    const POR_PUNTAJE = "/eventos?orden=puntaje&sentido=desc";
    const PUNTAJE_ASC = "/eventos?orden=puntaje&sentido=asc";
    const { falso } = await abrirExplorar({
      [CATALOGO_INICIAL]: [porFecha],
      "/eventos?orden=fecha&sentido=desc": [porFecha],
      [POR_PUNTAJE]: [porFecha],
      [PUNTAJE_ASC]: [porFecha],
    });
    await screen.findByText("Noche de Rock en el Club");
    await fireEvent.press(screen.getByRole("radio", { name: "Fecha" }));
    await screen.findByText("Noche de Rock en el Club");

    await fireEvent.press(screen.getByRole("radio", { name: "Puntaje" }));
    expect(falso.pedidosA(POR_PUNTAJE)).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Puntaje" })).toHaveAccessibilityValue({
      text: "Mejor puntaje primero",
    });
    await screen.findByText("Noche de Rock en el Club");

    await fireEvent.press(screen.getByRole("radio", { name: "Puntaje" }));
    expect(falso.pedidosA(PUNTAJE_ASC)).toHaveLength(1);
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

describe("Explorar: por páginas (feature 013, US1)", () => {
  const PAGINA_2 = `${CATALOGO_INICIAL}&pagina=2`;
  const PAGINA_3 = `${CATALOGO_INICIAL}&pagina=3`;
  const BASQUET = "/eventos?texto=basquet&orden=fecha&sentido=asc";
  const MUSICA = "/eventos?categoriaId=categoria-musica&orden=fecha&sentido=asc";
  const POR_PRECIO = "/eventos?orden=precio&sentido=asc";
  const FECHA_DESC = "/eventos?orden=fecha&sentido=desc";
  const evento = (numero: number): EventoCatalogoVista => ({
    ...clasicoEnCatalogo,
    id: `evento-p${numero}`,
    nombre: `Función ${numero}`,
  });
  const primeros10 = Array.from({ length: 10 }, (_, i) => evento(i + 1));
  /** La página 1 de 12 eventos (10) y la 2 (los 2 restantes). */
  const pagina1 = { status: 200, json: catalogo(primeros10, true, { totalElementos: 12 }) } as const;
  const pagina2 = {
    status: 200,
    json: catalogo([maratonEnCatalogo, hamletEnCatalogo], true, { numero: 2, totalElementos: 12 }),
  } as const;
  const unaSola = { status: 200, json: catalogo([rockEnCatalogo, clasicoEnCatalogo]) } as const;

  const boton = (numero: number) => screen.getByRole("button", { name: `Página ${numero}` });
  const nombres = async () =>
    (await tarjetas()).map((t) => (t.props.accessibilityLabel as string).split(",")[0]);
  const buscador = () => screen.getByLabelText("Buscar eventos");

  async function irALaPagina2(
    respuestas: Record<string, ReadonlyArray<RespuestaFalsa | FuncionRespuesta>> = {},
  ) {
    const resultado = await abrirExplorar({
      [CATALOGO_INICIAL]: [pagina1],
      [PAGINA_2]: [pagina2],
      ...respuestas,
    });
    await screen.findByText("Función 1");
    await fireEvent.press(boton(2));
    expect(await screen.findByText("Maratón Ciudad 10K")).toBeOnTheScreen();
    return resultado;
  }

  it("con 12 eventos se ven las 10 tarjetas de la página 1 y el paginador con la 1 marcada", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [pagina1] });

    expect(await nombres()).toEqual(primeros10.map((e) => e.nombre));
    expect(boton(1)).toBeSelected();
    expect(boton(2)).not.toBeSelected();
    expect(screen.queryByRole("button", { name: "Página 3" })).toBeNull();
  });

  it("tocar Página 2 pide pagina=2, muestra el skeleton y después las 2 tarjetas, con la 2 marcada", async () => {
    const { falso } = await abrirExplorar({ [CATALOGO_INICIAL]: [pagina1], [PAGINA_2]: [pagina2] });
    await screen.findByText("Función 1");

    await fireEvent.press(boton(2));

    expect(falso.pedidosA(PAGINA_2)).toHaveLength(1);
    expect(screen.getByLabelText("Cargando eventos")).toBeOnTheScreen();
    expect(await nombres()).toEqual(["Maratón Ciudad 10K", "Hamlet"]);
    expect(boton(2)).toBeSelected();
    expect(boton(1)).not.toBeSelected();
  });

  it("mientras carga otra página no se ve el paginador: no se puede pedir otra encima (Edge Cases)", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [pagina1], [PAGINA_2]: ["colgar"] });
    await screen.findByText("Función 1");

    await fireEvent.press(boton(2));

    expect(screen.getByLabelText("Cargando eventos")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Página 1" })).toBeNull();
    expect(screen.queryByText("Función 1")).toBeNull();
  });

  it("marca la página que dice la respuesta, no la pedida (FR-005)", async () => {
    await abrirExplorar({
      [CATALOGO_INICIAL]: [{ status: 200, json: catalogo(primeros10, true, { totalElementos: 25 }) }],
      // Pidió la 3, pero la lista se achicó: llega la 2, la última.
      [PAGINA_3]: [pagina2],
    });
    await screen.findByText("Función 1");

    await fireEvent.press(boton(3));

    expect(await screen.findByText("Maratón Ciudad 10K")).toBeOnTheScreen();
    expect(boton(2)).toBeSelected();
    expect(screen.queryByRole("button", { name: "Página 3" })).toBeNull();
  });

  it("estando en la 2, escribir una búsqueda pide la página 1 de ese texto (FR-013)", async () => {
    const { falso } = await irALaPagina2({ [BASQUET]: [unaSola] });

    await fireEvent.changeText(buscador(), "basquet");
    await avanzar(600);

    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();
    expect(falso.pedidosA(BASQUET)).toHaveLength(1);
    expect(falso.pedidos.filter((p) => p.url.includes("texto=") && p.url.includes("pagina="))).toEqual([]);
  });

  it("estando en la 2, elegir una categoría pide la página 1 (FR-013)", async () => {
    const { falso } = await irALaPagina2({
      "/categorias": [{ status: 200, json: categorias }],
      [MUSICA]: [unaSola],
    });

    await abrirCategorias();
    await fireEvent.press(await screen.findByRole("radio", { name: "Música" }));

    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();
    expect(falso.pedidosA(MUSICA)).toHaveLength(1);
  });

  it.each([
    ["cambiar el orden", "Precio", POR_PRECIO],
    ["invertir el sentido", "Fecha", FECHA_DESC],
  ])("estando en la 2, %s pide la página 1 (FR-013)", async (_caso, radio, ruta) => {
    const { falso } = await irALaPagina2({ [ruta]: [unaSola] });

    await fireEvent.press(screen.getByRole("radio", { name: radio }));

    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();
    expect(falso.pedidosA(ruta)).toHaveLength(1);
  });

  it("al volver a la 1 después de un criterio nuevo, el paginador marca la 1", async () => {
    await irALaPagina2({ [BASQUET]: [pagina1] });

    await fireEvent.changeText(buscador(), "basquet");
    await avanzar(600);

    expect(await screen.findByText("Función 1")).toBeOnTheScreen();
    expect(boton(1)).toBeSelected();
  });

  it("con 10 resultados o menos no hay paginador", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [unaSola] });
    await screen.findByText("Noche de Rock en el Club");
    expect(screen.queryByRole("button", { name: /^Página / })).toBeNull();
  });

  it.each([
    [true, "Ningún evento coincide con tu búsqueda."],
    [false, "Todavía no hay eventos próximos."],
  ])("los vacíos no tienen paginador (hayEventosProximos: %s)", async (hay, mensaje) => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([], hay) }] });
    expect(await screen.findByText(mensaje)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Página / })).toBeNull();
  });

  it("el buscador conserva lo escrito al cambiar de página", async () => {
    const BASQUET_2 = `${BASQUET}&pagina=2`;
    await abrirExplorar({ [CATALOGO_INICIAL]: [unaSola], [BASQUET]: [pagina1], [BASQUET_2]: [pagina2] });
    await screen.findByText("Noche de Rock en el Club");
    await fireEvent.changeText(buscador(), "basquet");
    await avanzar(600);
    await screen.findByText("Función 1");

    await fireEvent.press(boton(2));

    expect(await screen.findByText("Maratón Ciudad 10K")).toBeOnTheScreen();
    expect(buscador().props.value).toBe("basquet");
  });

  it("si la página 2 falla por conexión se ve el error y ninguna Página 2 queda marcada (Edge Cases)", async () => {
    await abrirExplorar({ [CATALOGO_INICIAL]: [pagina1], [PAGINA_2]: ["rechazar"] });
    await screen.findByText("Función 1");

    await fireEvent.press(boton(2));

    expect(await screen.findByText("Servidor no disponible")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Página 2", selected: true })).toBeNull();
  });

  it("estando en la 2, abrir un detalle y volver sigue en la 2 (la pestaña no se desmonta)", async () => {
    await irALaPagina2({ "/eventos/evento-maraton-10k": [{ status: 200, json: maratonCompleta }] });

    await fireEvent.press(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / }));
    await screen.findByRole("header", { name: "Maratón Ciudad 10K" });
    await act(() => router.back());

    expect(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / })).toBeOnTheScreen();
    expect(boton(2)).toBeSelected();
  });
});

describe("Explorar: estrellas de favoritos (feature 014, US3)", () => {
  const FAVORITOS = "/usuarios/actual/favoritos";
  const MARCA = "marca-favorito";
  const conTres = {
    [CATALOGO_INICIAL]: [
      { status: 200, json: catalogo([rockEnCatalogo, clasicoEnCatalogo, maratonEnCatalogo]) },
    ],
  };
  const estrellas = () => screen.queryAllByTestId(MARCA, { includeHiddenElements: true });

  it("solo las tarjetas de los favoritos tienen la estrella y ', en favoritos' (US3-1)", async () => {
    await abrirExplorar({
      ...conTres,
      [FAVORITOS]: [{ status: 200, json: [maratonEnCatalogo, clasicoEnCatalogo] }],
    });

    const conEstrella = await screen.findAllByRole("button", { name: /, en favoritos$/ });
    expect(conEstrella.map((tarjeta) => tarjeta.props.accessibilityLabel)).toEqual([
      expect.stringMatching(/^Clásico de básquet, /),
      expect.stringMatching(/^Maratón Ciudad 10K, /),
    ]);
    const [rock] = await tarjetas();
    expect(rock.props.accessibilityLabel).not.toMatch(/en favoritos/);
    expect(within(rock).queryByTestId(MARCA, { includeHiddenElements: true })).toBeNull();
    expect(estrellas()).toHaveLength(2);
  });

  it("tocar una tarjeta favorita abre el detalle (US3-4)", async () => {
    const resultado = await abrirExplorar({
      ...conTres,
      [FAVORITOS]: [{ status: 200, json: [maratonEnCatalogo] }],
      "/eventos/evento-maraton-10k": [{ status: 200, json: maratonCompleta }],
    });

    await fireEvent.press(
      await screen.findByRole("button", { name: /^Maratón Ciudad 10K, .*, en favoritos$/ }),
    );

    await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k"));
  });

  it("con los favoritos cargando, el catálogo se ve igual y sin estrellas (US3-7)", async () => {
    await abrirExplorar({ ...conTres, [FAVORITOS]: ["colgar"] });

    expect(await tarjetas()).toHaveLength(3);
    expect(estrellas()).toHaveLength(0);
    expect(screen.queryByText("Cargando…")).toBeNull();
  });

  it("con los favoritos fallando, el catálogo se ve igual, sin estrellas ni error propio (US3-7)", async () => {
    await abrirExplorar({
      ...conTres,
      [FAVORITOS]: [{ status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") }],
    });

    expect(await tarjetas()).toHaveLength(3);
    await waitFor(() => expect(screen.queryByLabelText("Cargando eventos")).toBeNull());
    expect(estrellas()).toHaveLength(0);
    expect(screen.queryByText("Falló el servidor.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });

  it("el pedido del catálogo no depende de los favoritos ni del usuario (US3-6, FR-013)", async () => {
    const segunUsuario: FuncionRespuesta = (_url, init) => {
      const usuarioId = (init?.headers as Record<string, string>)["X-Usuario-Id"];
      return { status: 200, json: usuarioId === martin.id ? [rockEnCatalogo] : [maratonEnCatalogo] };
    };
    const { falso } = await abrirExplorar({ ...conTres, [FAVORITOS]: [segunUsuario] });
    expect(
      await screen.findByRole("button", { name: /^Maratón Ciudad 10K, .*, en favoritos$/ }),
    ).toBeOnTheScreen();

    await irAPestana("Perfil");
    await fireEvent.press(await screen.findByRole("button", { name: "Cambiar usuario" }));
    await fireEvent.press(
      await screen.findByRole("button", { name: `Elegir a ${martin.nombre} ${martin.apellido}` }),
    );
    await esperarPestanas();
    await irAPestana("Explorar");

    expect(
      await screen.findByRole("button", { name: /^Noche de Rock en el Club, .*, en favoritos$/ }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Maratón Ciudad 10K, .*, en favoritos$/ })).toBeNull();
    const pedidos = falso.pedidosA(CATALOGO_INICIAL);
    expect(pedidos.length).toBeGreaterThanOrEqual(1);
    for (const pedido of pedidos) {
      expect(pedido.url).toBe(`${URL_DE_PRUEBA}${CATALOGO_INICIAL}`);
      expect(pedido.encabezados["X-Usuario-Id"]).toBeUndefined();
    }
  });

  it("marcar en el detalle y volver muestra la estrella sin volver a pedir el catálogo (FR-018)", async () => {
    const { falso } = await abrirExplorar({
      ...conTres,
      [FAVORITOS]: [
        { status: 200, json: [] },
        { status: 200, json: [maratonEnCatalogo] },
      ],
      [`${FAVORITOS}/evento-maraton-10k`]: [{ status: 204, texto: "" }],
      "/eventos/evento-maraton-10k": [{ status: 200, json: maratonCompleta }],
    });
    await fireEvent.press(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / }));
    await fireEvent.press(await screen.findByRole("button", { name: "Agregar a favoritos" }));
    expect(await screen.findByRole("button", { name: "Quitar de favoritos" })).toBeOnTheScreen();
    const pedidosDelCatalogo = falso.pedidosA(CATALOGO_INICIAL).length;

    await act(() => router.back());

    expect(
      await screen.findByRole("button", { name: /^Maratón Ciudad 10K, .*, en favoritos$/ }),
    ).toBeOnTheScreen();
    expect(falso.pedidosA(CATALOGO_INICIAL)).toHaveLength(pedidosDelCatalogo);
  });
});
