import { router } from "expo-router";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import {
  CATALOGO_INICIAL,
  catalogo,
  clasicoEnCatalogo,
  errorApi,
  maratonCompleta,
  maratonEnCatalogo,
  nocheDeRisasEnCatalogo,
} from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { diego, todos } from "../helpers/usuarios";

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

const FAVORITOS = "/usuarios/actual/favoritos";

/** Diego abre Perfil y, encima, "Mis favoritos" (así atrás vuelve a Perfil). */
async function abrirMisFavoritos(favoritos: Lista, extra: Record<string, Lista> = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: diego.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: diego }],
      "/usuarios": [{ status: 200, json: todos }],
      [FAVORITOS]: favoritos,
      ...extra,
    }),
  });
  await esperarPestanas();
  await irAPestana("Perfil");
  await act(() => router.push("/favoritos"));
  return resultado;
}

/** Las tarjetas de la lista, en orden: su etiqueta termina en ", en favoritos". */
const tarjetas = () => screen.findAllByRole("button", { name: /, en favoritos$/ });

const tresFavoritos: Lista = [
  { status: 200, json: [clasicoEnCatalogo, maratonEnCatalogo, nocheDeRisasEnCatalogo] },
];

describe("Mis favoritos (feature 014, US2)", () => {
  it("se abre en /favoritos con el header Mis favoritos y pide la lista con el usuario actual", async () => {
    const resultado = await abrirMisFavoritos(tresFavoritos);

    await tarjetas();
    expect(resultado.getPathname()).toBe("/favoritos");
    expect(tituloDelHeader()).toBe("Mis favoritos");
    const pedidos = resultado.falso.pedidosA(FAVORITOS);
    expect(pedidos.length).toBeGreaterThanOrEqual(1);
    expect(pedidos.at(-1)?.metodo).toBe("GET");
    expect(pedidos.at(-1)?.encabezados["X-Usuario-Id"]).toBe(diego.id);
  });

  it("una tarjeta por favorito, en el orden del servidor, y el realizado con Realizado (US2-1/2)", async () => {
    await abrirMisFavoritos(tresFavoritos);

    const [clasico, maraton, risas] = await tarjetas();
    expect(clasico).toHaveAccessibleName(/^Clásico de básquet, /);
    expect(maraton).toHaveAccessibleName(/^Maratón Ciudad 10K, /);
    expect(risas).toHaveAccessibleName(/^Stand-up: Noche de risas, .*, realizado, en favoritos$/);
    expect(screen.getAllByText("Realizado")).toHaveLength(1);
  });

  it("tocar una tarjeta abre el detalle del evento (US2-4)", async () => {
    const resultado = await abrirMisFavoritos(tresFavoritos, {
      "/eventos/evento-maraton-10k": [{ status: 200, json: maratonCompleta }],
    });

    const [, maraton] = await tarjetas();
    await fireEvent.press(maraton);

    await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k"));
    expect(await screen.findByRole("header", { name: "Maratón Ciudad 10K" })).toBeOnTheScreen();
  });

  it("desmarcar en el detalle y volver: la lista se vuelve a pedir y ya no lo trae (US2-5)", async () => {
    const resultado = await abrirMisFavoritos(
      [
        { status: 200, json: [clasicoEnCatalogo, maratonEnCatalogo] },
        { status: 200, json: [clasicoEnCatalogo] },
      ],
      {
        "/eventos/evento-maraton-10k": [{ status: 200, json: maratonCompleta }],
        [`${FAVORITOS}/evento-maraton-10k`]: [{ status: 204, texto: "" }],
      },
    );

    const [, maraton] = await tarjetas();
    await fireEvent.press(maraton);
    await fireEvent.press(await screen.findByRole("button", { name: "Quitar de favoritos" }));
    expect(await screen.findByRole("button", { name: "Agregar a favoritos" })).toBeOnTheScreen();

    await act(() => router.back());

    await waitFor(() => expect(resultado.getPathname()).toBe("/favoritos"));
    await waitFor(() => expect(screen.queryByText("Maratón Ciudad 10K")).toBeNull());
    expect(await tarjetas()).toHaveLength(1);
  });

  it("atrás vuelve a Perfil", async () => {
    const resultado = await abrirMisFavoritos(tresFavoritos);
    await tarjetas();

    await act(() => router.back());

    await waitFor(() => expect(resultado.getPathname()).toBe("/perfil"));
  });
});

describe("Mis favoritos: los cuatro estados (FR-019)", () => {
  it("muestra cargando mientras espera al servidor", async () => {
    await abrirMisFavoritos(["colgar"]);
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
    expect(screen.queryByText("Todavía no tenés favoritos")).toBeNull();
  });

  it("ante un error muestra el mensaje y Reintentar, nunca un vacío falso (US2-6)", async () => {
    // Falla hasta que se toca Reintentar: Explorar, debajo, también lee los favoritos (las
    // estrellas) y comparte la consulta.
    let falla = true;
    const segunElMomento: FuncionRespuesta = () =>
      falla
        ? { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") }
        : { status: 200, json: [maratonEnCatalogo] };
    const { falso } = await abrirMisFavoritos([segunElMomento]);
    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();
    expect(screen.queryByText("Todavía no tenés favoritos")).toBeNull();
    const antes = falso.pedidosA(FAVORITOS).length;
    falla = false;

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await tarjetas()).toHaveLength(1);
    expect(falso.pedidosA(FAVORITOS).length).toBeGreaterThan(antes);
  });

  it("sin favoritos: Todavía no tenés favoritos e Ir a Explorar, que abre Explorar (US2-3)", async () => {
    const resultado = await abrirMisFavoritos([{ status: 200, json: [] }], {
      [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([]) }],
    });
    expect(await screen.findByText("Todavía no tenés favoritos")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Ir a Explorar" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/"));
    expect(await screen.findByText("Todavía no hay eventos próximos.")).toBeOnTheScreen();
  });
});
