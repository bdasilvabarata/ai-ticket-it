import type { UsuarioVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";

import {
  CATALOGO_INICIAL,
  catalogo,
  clasicoEnCatalogo,
  errorApi,
  hamletCompleto,
  hamletEnCatalogo,
  maratonCompleta,
  maratonEnCatalogo,
  nocheDeRisasCompleta,
  rockEnCatalogo,
} from "../helpers/eventos";
import { conRestantes } from "../helpers/compras";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, martin, todos } from "../helpers/usuarios";

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

/** Abre Explorar con `usuario` (Lucía) y toca la tarjeta cuyo nombre empieza con `nombre`. */
async function abrirDetalle(
  nombre: string,
  {
    listado,
    detalles,
    usuario = lucia,
  }: { listado: Lista; detalles: Record<string, Lista>; usuario?: UsuarioVista },
) {
  const resultado = await renderConDependencias({
    usuarioRecordado: usuario.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: usuario }],
      "/usuarios": [{ status: 200, json: todos }],
      "/categorias": [{ status: 200, json: [] }],
      [CATALOGO_INICIAL]: listado,
      ...detalles,
    }),
  });
  await esperarPestanas();
  await fireEvent.press(await screen.findByRole("button", { name: new RegExp(`^${nombre}, `) }));
  return resultado;
}

const conMaraton = (detalle: Lista = [{ status: 200, json: maratonCompleta }]) => ({
  listado: [{ status: 200, json: catalogo([rockEnCatalogo, maratonEnCatalogo]) }] as Lista,
  detalles: { "/eventos/evento-maraton-10k": detalle },
});

describe("Detalle del evento (US2)", () => {
  it("tocar una tarjeta abre el detalle de ese evento con el header Evento", async () => {
    const resultado = await abrirDetalle("Maratón Ciudad 10K", conMaraton());

    await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k"));
    expect(await screen.findByRole("header", { name: "Maratón Ciudad 10K" })).toBeOnTheScreen();
    expect(tituloDelHeader()).toBe("Evento");
  });

  it("muestra los datos, el organizador y los tipos sin acciones ni botón de compra", async () => {
    await abrirDetalle("Maratón Ciudad 10K", conMaraton());

    expect(await screen.findByText("Carrera de 10 km por las calles de la ciudad.")).toBeOnTheScreen();
    expect(screen.getByText("Deportes")).toBeOnTheScreen();
    expect(screen.getByText("vie 25 dic 2026 · 08:00")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Organiza" })).toBeOnTheScreen();
    expect(screen.getByText("Lucía Álvarez · Sin reseñas")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Tipos de entrada" })).toBeOnTheScreen();
    expect(screen.getByText("Inscripción")).toBeOnTheScreen();
    expect(screen.getByText("$ 30.000 · 1000 disponibles")).toBeOnTheScreen();
    expect(screen.getByText("Gratis · 200 disponibles")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Editar|Quitar|Agregar|Comprar/ })).toBeNull();
    expect(screen.queryByText("Este evento ya se realizó")).toBeNull();
  });

  it("un evento de otro organizador con puntaje y agotado", async () => {
    await abrirDetalle("Hamlet", {
      listado: [{ status: 200, json: catalogo([hamletEnCatalogo]) }],
      detalles: { "/eventos/evento-hamlet": [{ status: 200, json: hamletCompleto }] },
    });

    expect(await screen.findByText("Martín Benítez · 4,5 · 12 reseñas")).toBeOnTheScreen();
    expect(screen.getByText("$ 25.000 · Agotado")).toBeOnTheScreen();
    // Sin multimedia, la fila de imágenes no aparece.
    expect(screen.queryByLabelText(/^Imagen /)).toBeNull();
  });

  it("muestra una imagen por URL y quita sin hueco la que falla; si fallan todas, no queda la fila", async () => {
    await abrirDetalle("Maratón Ciudad 10K", conMaraton());

    const primera = await screen.findByLabelText("Imagen 1 de 2 de Maratón Ciudad 10K");
    expect(screen.getByLabelText("Imagen 2 de 2 de Maratón Ciudad 10K")).toBeOnTheScreen();

    await fireEvent(primera, "error");
    expect(screen.getByLabelText("Imagen 1 de 1 de Maratón Ciudad 10K")).toBeOnTheScreen();
    expect(screen.queryByLabelText(/de 2 de/)).toBeNull();

    await fireEvent(screen.getByLabelText("Imagen 1 de 1 de Maratón Ciudad 10K"), "error");
    expect(screen.queryByLabelText(/^Imagen /)).toBeNull();
    expect(screen.getByText("Carrera de 10 km por las calles de la ciudad.")).toBeOnTheScreen();
  });

  it("un evento realizado lleva la marca y el aviso", async () => {
    await abrirDetalle("Noche de Rock en el Club", {
      listado: [{ status: 200, json: catalogo([rockEnCatalogo]) }],
      detalles: {
        "/eventos/evento-noche-de-rock": [
          { status: 200, json: { ...nocheDeRisasCompleta, nombre: "Noche de Rock en el Club" } },
        ],
      },
    });

    expect(await screen.findByText("Este evento ya se realizó")).toBeOnTheScreen();
    expect(screen.getByText("Realizado")).toBeOnTheScreen();
  });

  it("mientras carga muestra Cargando… y ante un error, Reintentar", async () => {
    await abrirDetalle(
      "Maratón Ciudad 10K",
      conMaraton([
        { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") },
        { status: 200, json: maratonCompleta },
      ]),
    );

    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("header", { name: "Maratón Ciudad 10K" })).toBeOnTheScreen();
  });

  it("cargando muestra Cargando…", async () => {
    await abrirDetalle("Maratón Ciudad 10K", conMaraton(["colgar"]));
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
  });

  it("volver deja Explorar como estaba", async () => {
    const resultado = await abrirDetalle("Maratón Ciudad 10K", conMaraton());
    await screen.findByRole("header", { name: "Maratón Ciudad 10K" });

    await act(() => router.back());

    await waitFor(() => expect(resultado.getPathname()).toBe("/"));
    expect(await screen.findByText("Maratón Ciudad 10K")).toBeOnTheScreen();
  });

  it("404 → No encontramos este evento.; Volver a Explorar vuelve a pedir el catálogo y ya no aparece", async () => {
    const resultado = await abrirDetalle("Maratón Ciudad 10K", {
      listado: [
        { status: 200, json: catalogo([clasicoEnCatalogo, maratonEnCatalogo]) },
        { status: 200, json: catalogo([clasicoEnCatalogo]) },
      ],
      detalles: {
        "/eventos/evento-maraton-10k": [
          { status: 404, json: errorApi("EVENTO_NO_ENCONTRADO", "No existe el evento.") },
        ],
      },
    });

    expect(await screen.findByText("No encontramos este evento.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Volver a Explorar" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/"));
    await waitFor(() => expect(resultado.falso.pedidosA(CATALOGO_INICIAL)).toHaveLength(2));
    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();
    expect(screen.queryByText("Maratón Ciudad 10K")).toBeNull();
  });
});

describe("Detalle del evento: comprar (feature 006, US1)", () => {
  const MIS_COMPRAS = "/eventos/evento-maraton-10k/mis-compras";
  const comoMartin = (misCompras: Lista, detalle: Lista = [{ status: 200, json: maratonCompleta }]) => ({
    ...conMaraton(detalle),
    detalles: { "/eventos/evento-maraton-10k": detalle, [MIS_COMPRAS]: misCompras },
    usuario: martin,
  });
  const ambos = { "tipo-maraton-inscripcion": 4, "tipo-maraton-kids": 1 };

  it("cada tipo con cupo tiene Comprar", async () => {
    await abrirDetalle("Maratón Ciudad 10K", comoMartin([{ status: 200, json: conRestantes(ambos) }]));

    expect(await screen.findByRole("button", { name: "Comprar Inscripción" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Comprar Carrera kids" })).toBeOnTheScreen();
    expect(screen.queryByText("Sos el organizador de este evento")).toBeNull();
  });

  it("un tipo agotado no tiene Comprar y sigue diciendo Agotado", async () => {
    const conKidsAgotado = {
      ...maratonCompleta,
      tiposEntrada: maratonCompleta.tiposEntrada.map((t) =>
        t.id === "tipo-maraton-kids" ? { ...t, cupo: 0 } : t,
      ),
    };
    await abrirDetalle(
      "Maratón Ciudad 10K",
      comoMartin([{ status: 200, json: conRestantes(ambos) }], [{ status: 200, json: conKidsAgotado }]),
    );

    expect(await screen.findByRole("button", { name: "Comprar Inscripción" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Comprar Carrera kids" })).toBeNull();
    expect(screen.getByText("Gratis · Agotado")).toBeOnTheScreen();
  });

  it("un evento realizado no ofrece Comprar en ningún tipo", async () => {
    await abrirDetalle("Noche de Rock en el Club", {
      listado: [{ status: 200, json: catalogo([rockEnCatalogo]) }],
      detalles: {
        "/eventos/evento-noche-de-rock": [
          { status: 200, json: { ...nocheDeRisasCompleta, nombre: "Noche de Rock en el Club" } },
        ],
      },
      usuario: martin,
    });

    expect(await screen.findByText("Este evento ya se realizó")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Comprar/ })).toBeNull();
  });

  it("con restantes 0 en un tipo, ese tipo dice que ya tiene el máximo", async () => {
    await abrirDetalle(
      "Maratón Ciudad 10K",
      comoMartin([
        { status: 200, json: conRestantes({ "tipo-maraton-inscripcion": 0, "tipo-maraton-kids": 1 }) },
      ]),
    );

    expect(await screen.findByText("Ya tenés el máximo de entradas para este evento")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Comprar Inscripción" })).toBeNull();
    expect(screen.getByRole("button", { name: "Comprar Carrera kids" })).toBeOnTheScreen();
  });

  it("mientras mis-compras carga, o si un tipo no tiene restantes, se ve Comprar", async () => {
    await abrirDetalle("Maratón Ciudad 10K", comoMartin(["colgar"]));
    expect(await screen.findByRole("button", { name: "Comprar Inscripción" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Comprar Carrera kids" })).toBeOnTheScreen();
  });

  it("un tipo sin elemento en restantesPorTipo muestra Comprar", async () => {
    await abrirDetalle(
      "Maratón Ciudad 10K",
      comoMartin([{ status: 200, json: conRestantes({ "tipo-maraton-inscripcion": 0 }) }]),
    );
    expect(await screen.findByRole("button", { name: "Comprar Carrera kids" })).toBeOnTheScreen();
  });

  it("el organizador ve Sos el organizador de este evento y ningún Comprar", async () => {
    await abrirDetalle("Maratón Ciudad 10K", conMaraton());

    expect(await screen.findByText("Sos el organizador de este evento")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Comprar/ })).toBeNull();
  });

  it("si mis-compras falla, el detalle se ve igual", async () => {
    await abrirDetalle(
      "Maratón Ciudad 10K",
      comoMartin([{ status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") }]),
    );

    expect(await screen.findByRole("header", { name: "Tipos de entrada" })).toBeOnTheScreen();
    expect(screen.getByText("$ 30.000 · 1000 disponibles")).toBeOnTheScreen();
    expect(screen.queryByText("Falló el servidor.")).toBeNull();
    expect(await screen.findByRole("button", { name: "Comprar Inscripción" })).toBeOnTheScreen();
  });
});
