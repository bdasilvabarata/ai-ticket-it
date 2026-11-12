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
