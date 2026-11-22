import type { PaginaDeReseniasVista, UsuarioVista } from "@ai-ticket-it/shared";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { etiquetaDeResenia } from "../../src/features/eventos/formato";
import {
  CATALOGO_INICIAL,
  catalogo,
  errorApi,
  hamletCompleto,
  hamletEnCatalogo,
  paginaDe,
  reseniaDelOrganizadorDeEjemplo,
  reseniasDelOrganizadorDeEjemplo,
} from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, martin, todos } from "../helpers/usuarios";

// "Ver todas las reseñas" (feature 013, US5, contracts/app.md): se llega desde el detalle de Hamlet
// (de Martín) tocando "Ver todas las reseñas"; un `initialUrl` directo no pasa por los guards.

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

const RUTA_RESUMEN = "/eventos/evento-hamlet/resenias-del-organizador/resumen";
const RUTA = "/eventos/evento-hamlet/resenias-del-organizador";

const martinConOnce = { ...hamletCompleto.organizador, puntaje: 52 / 11, cantidadResenias: 11 };
const PUNTAJE = "4,7 · 11 reseñas";

/** `cantidad` reseñas de Jazz en el Patio, `resenia-<desde + i>`, con autores distintos por fila. */
const varias = (cantidad: number, desde = 1) =>
  Array.from({ length: cantidad }, (_, i) =>
    reseniaDelOrganizadorDeEjemplo({
      id: `resenia-${desde + i}`,
      autor: { nombre: `Autor${desde + i}`, apellido: "Prueba" },
      comentario: i % 2 === 0 ? null : `Comentario ${desde + i}.`,
    }),
  );

const paginaDeResenias = (
  resenias: PaginaDeReseniasVista["resenias"],
  total: number,
  numero = 1,
  organizador: PaginaDeReseniasVista["organizador"] = martinConOnce,
): PaginaDeReseniasVista => ({ organizador, resenias, pagina: paginaDe(total, { numero }) });

const pagina1 = paginaDeResenias(varias(10), 11);
const pagina2 = paginaDeResenias(varias(1, 11), 11, 2);

const filasVisibles = () => screen.queryAllByLabelText(/^Autor\d+ Prueba, Jazz en el Patio, /);
const boton = (nombre: string) => screen.getByRole("button", { name: nombre });

async function abrirTodasLasResenias(
  lista: Lista,
  extra: Record<string, Lista> = {},
  usuario: UsuarioVista = lucia,
) {
  const resultado = await renderConDependencias({
    usuarioRecordado: usuario.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: usuario }],
      "/usuarios": [{ status: 200, json: todos }],
      "/categorias": [{ status: 200, json: [] }],
      [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([hamletEnCatalogo]) }],
      "/eventos/evento-hamlet": [{ status: 200, json: hamletCompleto }],
      [RUTA_RESUMEN]: [
        {
          status: 200,
          json: reseniasDelOrganizadorDeEjemplo({ organizador: martinConOnce, resenias: varias(3) }),
        },
      ],
      [RUTA]: lista,
      ...extra,
    }),
  });
  await esperarPestanas();
  await fireEvent.press(await screen.findByRole("button", { name: /^Hamlet, / }));
  await fireEvent.press(await screen.findByRole("button", { name: "Ver todas las reseñas" }));
  await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-hamlet/resenias"));
  return resultado;
}

const pedidosALaLista = (resultado: Awaited<ReturnType<typeof abrirTodasLasResenias>>) =>
  resultado.falso.pedidos
    .filter((p) => p.metodo === "GET" && p.url.includes(RUTA) && !p.url.includes(RUTA_RESUMEN))
    .map((p) => p.url.slice(p.url.indexOf(RUTA)));

describe("Ver todas las reseñas (feature 013, US5)", () => {
  it("el título del header es «Reseñas del organizador» y mientras carga, «Cargando reseñas…»", async () => {
    await abrirTodasLasResenias(["colgar"]);
    expect(tituloDelHeader()).toBe("Reseñas del organizador");
    expect(await screen.findByText("Cargando reseñas…")).toBeOnTheScreen();
  });

  it("con 11: el organizador como encabezado, el puntaje, 10 filas en el orden del servidor y el paginador 1 2", async () => {
    await abrirTodasLasResenias([{ status: 200, json: pagina1 }]);

    expect(await screen.findByRole("header", { name: "Martín Benítez" })).toBeOnTheScreen();
    expect(screen.getAllByText(PUNTAJE).length).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));
    expect(filasVisibles().map((fila) => fila.props.accessibilityLabel)).toEqual(
      pagina1.resenias.map(etiquetaDeResenia),
    );
    expect(boton("Página 1")).toBeSelected();
    expect(boton("Página 2")).not.toBeSelected();
    expect(screen.queryByRole("button", { name: "Página 3" })).toBeNull();
  });

  it("«Página 2» pide ?pagina=2 y muestra la que queda, con el mismo puntaje y la 2 marcada", async () => {
    const resultado = await abrirTodasLasResenias([{ status: 200, json: pagina1 }], {
      [`${RUTA}?pagina=2`]: [{ status: 200, json: pagina2 }],
    });
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));

    await fireEvent.press(boton("Página 2"));

    await waitFor(() => expect(filasVisibles()).toHaveLength(1));
    expect(screen.getByLabelText(etiquetaDeResenia(pagina2.resenias[0]!))).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Martín Benítez" })).toBeOnTheScreen();
    expect(screen.getAllByText(PUNTAJE).length).toBeGreaterThanOrEqual(1);
    expect(boton("Página 2")).toBeSelected();
    expect(pedidosALaLista(resultado)).toEqual([RUTA, `${RUTA}?pagina=2`]);
  });

  it("con 4 a 10 reseñas, sin paginador", async () => {
    const organizador = { ...martinConOnce, puntaje: 5, cantidadResenias: 4 };
    await abrirTodasLasResenias([{ status: 200, json: paginaDeResenias(varias(4), 4, 1, organizador) }]);
    await waitFor(() => expect(filasVisibles()).toHaveLength(4));
    expect(screen.queryByRole("button", { name: /^Página/ })).toBeNull();
  });

  it("sin reseñas: «Todavía no tiene reseñas», sin filas ni paginador", async () => {
    const organizador = { ...martinConOnce, puntaje: null, cantidadResenias: 0 };
    await abrirTodasLasResenias([{ status: 200, json: paginaDeResenias([], 0, 1, organizador) }]);
    expect(await screen.findByText("Todavía no tiene reseñas")).toBeOnTheScreen();
    expect(filasVisibles()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Página/ })).toBeNull();
  });

  it("un 404 muestra «No existe el evento.» (US5-5)", async () => {
    await abrirTodasLasResenias([
      { status: 404, json: errorApi("EVENTO_NO_ENCONTRADO", "No existe el evento.") },
    ]);
    expect(await screen.findByText("No existe el evento.")).toBeOnTheScreen();
    expect(filasVisibles()).toHaveLength(0);
  });

  it("un error muestra el MensajeError y Reintentar vuelve a pedir la misma página", async () => {
    const resultado = await abrirTodasLasResenias([{ status: 200, json: pagina1 }], {
      [`${RUTA}?pagina=2`]: [
        { status: 500, json: errorApi("ERROR_INTERNO", "No pudimos traer las reseñas.") },
        { status: 200, json: pagina2 },
      ],
    });
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));
    await fireEvent.press(boton("Página 2"));

    expect(await screen.findByText("No pudimos traer las reseñas.")).toBeOnTheScreen();
    await fireEvent.press(boton("Reintentar"));

    await waitFor(() => expect(filasVisibles()).toHaveLength(1));
    expect(pedidosALaLista(resultado)).toEqual([RUTA, `${RUTA}?pagina=2`, `${RUTA}?pagina=2`]);
  });

  it("es pública: el organizador (Martín) la ve igual", async () => {
    await abrirTodasLasResenias([{ status: 200, json: pagina1 }], {}, martin);
    expect(await screen.findByRole("header", { name: "Martín Benítez" })).toBeOnTheScreen();
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));
    expect(boton("Página 2")).toBeOnTheScreen();
  });
});
