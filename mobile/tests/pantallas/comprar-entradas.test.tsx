import type { EventoVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";

import { compraPendiente, conRestantes } from "../helpers/compras";
import { CATALOGO_INICIAL, catalogo, errorApi, maratonCompleta, maratonEnCatalogo } from "../helpers/eventos";
import { porMetodo, porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { martin, todos } from "../helpers/usuarios";

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

const EVENTO = "/eventos/evento-maraton-10k";
const MIS_COMPRAS = `${EVENTO}/mis-compras`;
const COMPRAS = `${EVENTO}/compras`;
const INSCRIPCION = "tipo-maraton-inscripcion";
const KIDS = "tipo-maraton-kids";
const ambos = conRestantes({ [INSCRIPCION]: 4, [KIDS]: 1 });

interface Opciones {
  evento?: Lista;
  misCompras?: Lista;
  compras?: Lista;
}

function respuestas({
  evento = [{ status: 200, json: maratonCompleta }],
  misCompras = [{ status: 200, json: ambos }],
  compras = [{ status: 201, json: compraPendiente }],
}: Opciones) {
  return porRuta({
    "/usuarios/actual": [{ status: 200, json: martin }],
    "/usuarios": [{ status: 200, json: todos }],
    "/categorias": [{ status: 200, json: [] }],
    [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([maratonEnCatalogo]) }],
    [EVENTO]: evento,
    [MIS_COMPRAS]: misCompras,
    [COMPRAS]: [porMetodo({ POST: compras })],
  });
}

/** Martín abre el detalle de la Maratón desde Explorar y toca "Comprar" en `tipo`. */
async function comprarDesdeElDetalle(tipo: string, opciones: Opciones = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: martin.id,
    respuestas: respuestas(opciones),
  });
  await esperarPestanas();
  await fireEvent.press(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / }));
  await fireEvent.press(await screen.findByRole("button", { name: `Comprar ${tipo}` }));
  return resultado;
}

/** Martín va directo a la pantalla de compra de `tipoId` (casos que el detalle no ofrece). */
async function abrirComprar(tipoId: string, opciones: Opciones = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: martin.id,
    respuestas: respuestas(opciones),
  });
  await esperarPestanas();
  await act(() =>
    router.push({
      pathname: "/explorar/[eventoId]/comprar/[tipoEntradaId]",
      params: { eventoId: "evento-maraton-10k", tipoEntradaId: tipoId },
    }),
  );
  return resultado;
}

const conTipo = (cambios: Partial<EventoVista["tiposEntrada"][number]>, id = INSCRIPCION): EventoVista => ({
  ...maratonCompleta,
  tiposEntrada: maratonCompleta.tiposEntrada.map((t) => (t.id === id ? { ...t, ...cambios } : t)),
});

describe("Comprar entradas (US1)", () => {
  it("Comprar abre la pantalla con el evento, la fecha, el tipo y su precio", async () => {
    const resultado = await comprarDesdeElDetalle("Inscripción");

    await waitFor(() =>
      expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k/comprar/tipo-maraton-inscripcion"),
    );
    expect(await screen.findByRole("header", { name: "Maratón Ciudad 10K" })).toBeOnTheScreen();
    expect(tituloDelHeader()).toBe("Comprar entradas");
    expect(screen.getByText("vie 25 dic 2026 · 08:00")).toBeOnTheScreen();
    expect(screen.getByText("Inscripción")).toBeOnTheScreen();
    expect(screen.getByText("$ 30.000 c/u")).toBeOnTheScreen();
  });

  it("un tipo gratis dice Gratis y su total es Total: Gratis", async () => {
    await comprarDesdeElDetalle("Carrera kids");

    expect(await screen.findByText("Carrera kids")).toBeOnTheScreen();
    expect(screen.getAllByText("Gratis").length).toBeGreaterThan(0);
    expect(screen.getByText("Total: Gratis")).toBeOnTheScreen();
  });

  it("el selector arranca en 1, no baja de 1 y no sube del máximo; el total se actualiza", async () => {
    await comprarDesdeElDetalle("Inscripción", {
      misCompras: [{ status: 200, json: conRestantes({ [INSCRIPCION]: 2, [KIDS]: 1 }) }],
    });

    expect(await screen.findByText("1 entrada")).toBeOnTheScreen();
    expect(screen.getByText("Total: $ 30.000")).toBeOnTheScreen();
    expect(screen.getByText("Podés comprar hasta 2 entradas de este evento")).toBeOnTheScreen();
    const menos = screen.getByRole("button", { name: "Una entrada menos" });
    const mas = screen.getByRole("button", { name: "Una entrada más" });
    expect(menos).toBeDisabled();
    expect(mas).toBeEnabled();

    await fireEvent.press(mas);
    expect(screen.getByText("2 entradas")).toBeOnTheScreen();
    expect(screen.getByText("Total: $ 60.000")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Una entrada más" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Una entrada menos" })).toBeEnabled();

    await fireEvent.press(screen.getByRole("button", { name: "Una entrada menos" }));
    expect(screen.getByText("1 entrada")).toBeOnTheScreen();
  });

  it("el máximo es el cupo si es menor que lo que le queda (sin aviso del máximo)", async () => {
    await abrirComprar(INSCRIPCION, { evento: [{ status: 200, json: conTipo({ cupo: 1 }) }] });

    expect(await screen.findByText("1 entrada")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Una entrada más" })).toBeDisabled();
    expect(screen.queryByText(/Podés comprar hasta/)).toBeNull();
  });

  it("Confirmar compra manda el tipo y la cantidad en nombre de Martín y abre Tu compra", async () => {
    const resultado = await comprarDesdeElDetalle("Inscripción");

    await fireEvent.press(await screen.findByRole("button", { name: "Una entrada más" }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar compra" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/compras/compra-nueva"));
    const [pedido] = resultado.falso.pedidosA(COMPRAS);
    expect(pedido?.metodo).toBe("POST");
    expect(JSON.parse(pedido?.cuerpo ?? "null")).toEqual({ tipoEntradaId: INSCRIPCION, cantidad: 2 });
    expect(pedido?.encabezados["X-Usuario-Id"]).toBe(martin.id);
    expect(tituloDelHeader()).toBe("Tu compra");
  });

  it("al volver al detalle se ve el cupo nuevo", async () => {
    const resultado = await comprarDesdeElDetalle("Inscripción", {
      evento: [
        { status: 200, json: maratonCompleta },
        { status: 200, json: conTipo({ cupo: 999 }) },
      ],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Confirmar compra" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/compras/compra-nueva"));
    await act(() => router.back());

    await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k"));
    expect(await screen.findByText("$ 30.000 · 999 disponibles")).toBeOnTheScreen();
    expect(resultado.falso.pedidosA(EVENTO).length).toBeGreaterThanOrEqual(2);
  });

  it("mientras compra dice Comprando… deshabilitado y un doble toque manda un solo pedido", async () => {
    const resultado = await comprarDesdeElDetalle("Inscripción", { compras: ["colgar"] });

    const confirmar = await screen.findByRole("button", { name: "Confirmar compra" });
    await fireEvent.press(confirmar);
    await fireEvent.press(confirmar);

    const comprando = await screen.findByRole("button", { name: "Comprando…" });
    expect(comprando).toBeDisabled();
    await fireEvent.press(comprando);
    expect(resultado.falso.pedidosA(COMPRAS)).toHaveLength(1);
  });

  it("con el evento realizado: Este evento ya se realizó y Volver al evento, sin selector", async () => {
    await abrirComprar(INSCRIPCION, {
      evento: [{ status: 200, json: { ...maratonCompleta, realizado: true } }],
    });

    expect(await screen.findByText("Este evento ya se realizó")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Una entrada más" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar compra" })).toBeNull();
  });

  it("un tipo agotado: No quedan entradas de este tipo.", async () => {
    await abrirComprar(INSCRIPCION, { evento: [{ status: 200, json: conTipo({ cupo: 0 }) }] });

    expect(await screen.findByText("No quedan entradas de este tipo.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Confirmar compra" })).toBeNull();
  });

  it("sin entradas restantes: Ya tenés el máximo de entradas para este evento", async () => {
    await abrirComprar(INSCRIPCION, {
      misCompras: [{ status: 200, json: conRestantes({ [INSCRIPCION]: 0, [KIDS]: 1 }) }],
    });

    expect(await screen.findByText("Ya tenés el máximo de entradas para este evento")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Confirmar compra" })).toBeNull();
  });

  it("un tipo que no está en el evento: Este tipo de entrada ya no está disponible.", async () => {
    await abrirComprar("tipo-inexistente");

    expect(await screen.findByText("Este tipo de entrada ya no está disponible.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Volver al evento" }));
  });

  it("mientras carga muestra Cargando…", async () => {
    await abrirComprar(INSCRIPCION, { misCompras: ["colgar"] });
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
  });

  it("ante un error de cualquiera de las dos consultas, el mensaje y Reintentar", async () => {
    await abrirComprar(INSCRIPCION, {
      misCompras: [
        { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") },
        { status: 200, json: ambos },
      ],
    });

    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "Confirmar compra" })).toBeOnTheScreen();
  });
});

/**
 * Respuestas que cambian después del alta rechazada: `antes` hasta que llega el `POST` y `despues`
 * desde entonces (el servidor ya sabe lo que la app todavía no).
 */
function trasElRechazo(
  rechazo: RespuestaFalsa,
  cambios: { evento?: [EventoVista, EventoVista]; restantes?: [number, number] },
) {
  let rechazado = false;
  const elegir = <T,>([antes, despues]: [T, T]) => (rechazado ? despues : antes);
  const opciones: Opciones = {
    compras: [
      () => {
        rechazado = true;
        return rechazo;
      },
    ],
  };
  if (cambios.evento) {
    const evento = cambios.evento;
    opciones.evento = [() => ({ status: 200, json: elegir(evento) })];
  }
  if (cambios.restantes) {
    const restantes = cambios.restantes;
    opciones.misCompras = [
      () => ({ status: 200, json: conRestantes({ [INSCRIPCION]: elegir(restantes), [KIDS]: 1 }) }),
    ];
  }
  return opciones;
}

async function elegirYConfirmar(cantidad: number) {
  for (let i = 1; i < cantidad; i++) {
    await fireEvent.press(await screen.findByRole("button", { name: "Una entrada más" }));
  }
  expect(await screen.findByText(cantidad === 1 ? "1 entrada" : `${cantidad} entradas`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Confirmar compra" }));
}

describe("Comprar entradas: errores del alta (US3)", () => {
  it("409 CUPO_INSUFICIENTE: el mensaje del servidor, el evento se vuelve a pedir y la cantidad se recorta", async () => {
    const mensaje = "Queda 1 entrada de «Inscripción».";
    const resultado = await abrirComprar(
      INSCRIPCION,
      trasElRechazo(
        { status: 409, json: errorApi("CUPO_INSUFICIENTE", mensaje) },
        { evento: [conTipo({ cupo: 10 }), conTipo({ cupo: 1 })] },
      ),
    );
    const eventoAntes = resultado.falso.pedidosA(EVENTO).length;
    const misComprasAntes = resultado.falso.pedidosA(MIS_COMPRAS).length;
    await elegirYConfirmar(3);

    expect(await screen.findByText(mensaje)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText("1 entrada")).toBeOnTheScreen());
    expect(resultado.falso.pedidosA(EVENTO).length).toBeGreaterThan(eventoAntes);
    expect(resultado.falso.pedidosA(MIS_COMPRAS).length).toBeGreaterThan(misComprasAntes);
    expect(screen.getByText("Inscripción")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
  });

  it("409 TOPE_POR_PERSONA: el mensaje, mis-compras se vuelve a pedir y la cantidad se recorta", async () => {
    const mensaje = "Podés comprar 1 entrada más de tipos pagos de este evento.";
    await abrirComprar(
      INSCRIPCION,
      trasElRechazo({ status: 409, json: errorApi("TOPE_POR_PERSONA", mensaje) }, { restantes: [4, 1] }),
    );
    await elegirYConfirmar(3);

    expect(await screen.findByText(mensaje)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText("1 entrada")).toBeOnTheScreen());
    expect(screen.getByRole("button", { name: "Una entrada más" })).toBeDisabled();
  });

  it("409 EVENTO_REALIZADO: el mensaje y, con el evento vuelto a pedir, Este evento ya se realizó", async () => {
    const mensaje = "El evento ya se realizó: no se pueden comprar entradas.";
    await abrirComprar(
      INSCRIPCION,
      trasElRechazo(
        { status: 409, json: errorApi("EVENTO_REALIZADO", mensaje) },
        { evento: [maratonCompleta, { ...maratonCompleta, realizado: true }] },
      ),
    );
    await elegirYConfirmar(1);

    expect(await screen.findByText("Este evento ya se realizó")).toBeOnTheScreen();
    expect(screen.getByText(mensaje)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Confirmar compra" })).toBeNull();
  });

  it("409 COMPRA_PROPIO_EVENTO: el mensaje del servidor", async () => {
    const mensaje = "No podés comprar entradas de un evento que organizás.";
    await abrirComprar(INSCRIPCION, {
      compras: [{ status: 409, json: errorApi("COMPRA_PROPIO_EVENTO", mensaje) }],
    });
    await elegirYConfirmar(1);

    expect(await screen.findByText(mensaje)).toBeOnTheScreen();
  });

  it("400 en body.tipoEntradaId: Este tipo de entrada ya no está disponible. y Volver al evento", async () => {
    const resultado = await comprarDesdeElDetalle("Inscripción", {
      compras: [
        {
          status: 400,
          json: errorApi("ENTRADA_INVALIDA", "Los datos enviados no son válidos.", [
            { campo: "body.tipoEntradaId", mensaje: "No existe el tipo de entrada en este evento." },
          ]),
        },
      ],
    });
    await elegirYConfirmar(1);

    expect(await screen.findByText("Este tipo de entrada ya no está disponible.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Confirmar compra" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Volver al evento" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k"));
  });

  it("404 EVENTO_NO_ENCONTRADO: No encontramos este evento., Volver a Explorar y el catálogo se vuelve a pedir", async () => {
    const resultado = await abrirComprar(INSCRIPCION, {
      compras: [{ status: 404, json: errorApi("EVENTO_NO_ENCONTRADO", "No existe el evento.") }],
    });
    const catalogoAntes = resultado.falso.pedidosA(CATALOGO_INICIAL).length;
    await elegirYConfirmar(1);

    expect(await screen.findByText("No encontramos este evento.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Confirmar compra" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Volver a Explorar" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/"));
    await waitFor(() =>
      expect(resultado.falso.pedidosA(CATALOGO_INICIAL).length).toBeGreaterThan(catalogoAntes),
    );
  });

  it("al volver al detalle tras un CUPO_INSUFICIENTE se ve el cupo real", async () => {
    const resultado = await comprarDesdeElDetalle(
      "Inscripción",
      trasElRechazo(
        { status: 409, json: errorApi("CUPO_INSUFICIENTE", "Quedan 3 entradas de «Inscripción».") },
        { evento: [maratonCompleta, conTipo({ cupo: 3 })] },
      ),
    );
    await elegirYConfirmar(4);
    expect(await screen.findByText("Quedan 3 entradas de «Inscripción».")).toBeOnTheScreen();

    await act(() => router.back());
    await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k"));
    expect(await screen.findByText("$ 30.000 · 3 disponibles")).toBeOnTheScreen();
  });
});

const SIN_SERVIDOR = "No se pudo registrar la compra. Probá de nuevo.";

describe("Comprar entradas con conexión inestable (US4)", () => {
  it("sin servidor: el aviso, un solo POST (también tras la secuencia), tipo y cantidad conservados; reintentar a mano registra", async () => {
    const resultado = await abrirComprar(INSCRIPCION, {
      compras: ["rechazar", { status: 201, json: compraPendiente }],
    });
    await elegirYConfirmar(2);

    expect(await screen.findByText(SIN_SERVIDOR)).toBeOnTheScreen();
    // La secuencia de reintentos vuelve a pedir las queries, nunca la escritura.
    await act(() => jest.advanceTimersByTimeAsync(70_000));
    expect(resultado.falso.pedidosA(COMPRAS)).toHaveLength(1);
    expect(screen.getByText("Inscripción")).toBeOnTheScreen();
    expect(screen.getByText("2 entradas")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();

    await fireEvent.press(screen.getByRole("button", { name: "Confirmar compra" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/compras/compra-nueva"));
    const pedidos = resultado.falso.pedidosA(COMPRAS);
    expect(pedidos).toHaveLength(2);
    expect(JSON.parse(pedidos[1]?.cuerpo ?? "null")).toEqual({ tipoEntradaId: INSCRIPCION, cantidad: 2 });
  });

  it("compra registrada con la respuesta perdida: al volver al detalle figura en Tus compras pendientes con Pagar", async () => {
    let enviada = false;
    const resultado = await comprarDesdeElDetalle("Inscripción", {
      compras: [
        () => {
          enviada = true;
          return "rechazar";
        },
      ],
      misCompras: [
        () => ({
          status: 200,
          json: enviada ? { ...ambos, pendientes: [compraPendiente] } : ambos,
        }),
      ],
    });
    await elegirYConfirmar(2);
    expect(await screen.findByText(SIN_SERVIDOR)).toBeOnTheScreen();

    await act(() => router.back());

    await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k"));
    expect(await screen.findByText("Tus compras pendientes")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Pagar la compra de 2 entradas Inscripción" }),
    ).toBeOnTheScreen();
  });
});
