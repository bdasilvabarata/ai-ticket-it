import type { CatalogoVista, EventoCatalogoVista } from "@ai-ticket-it/shared";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import {
  CATALOGO_INICIAL,
  catalogo,
  clasicoEnCatalogo,
  festival,
  festivalCompleto,
  luciaOrganizadora,
  nocheDeRock,
} from "../helpers/eventos";
import { porMetodo, porRuta, type FuncionRespuesta } from "../helpers/fetch-falso";
import { escribir, espiarAlertas, tocarEnAlerta } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

// Las escrituras de la 004 invalidan el catálogo (R15): al volver a Explorar se ve lo nuevo.

// Cada caso recorre dos pestañas y un formulario: con la suite en paralelo supera los 5 s de Jest.
jest.setTimeout(15_000);

const RUTA = "/eventos/evento-festival";
const FILA = "Abrir Festival Sonidos del Sur, jue 10 dic 2026 · 14:00";

const festivalEnCatalogo: EventoCatalogoVista = {
  ...festival,
  precioDesde: 0,
  agotado: false,
  organizador: luciaOrganizadora,
};

/** Explorar con el catálogo que diga `actual()`, Mis eventos y el Festival editable. */
async function abrir(actual: () => CatalogoVista, put: FuncionRespuesta, del: FuncionRespuesta) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/categorias": [{ status: 200, json: [{ id: "categoria-musica", nombre: "Música", descripcion: "" }] }],
      [CATALOGO_INICIAL]: [() => ({ status: 200, json: actual() })],
      "/eventos/mios": [{ status: 200, json: [nocheDeRock, festival] }],
      [RUTA]: [porMetodo({ GET: [{ status: 200, json: festivalCompleto }], PUT: [put], DELETE: [del] })],
    }),
  });
  await esperarPestanas();
  expect(await screen.findByText("Festival Sonidos del Sur")).toBeOnTheScreen();
  await irAPestana("Mis eventos");
  await fireEvent.press(await screen.findByRole("button", { name: FILA }));
  await fireEvent.press(await screen.findByRole("button", { name: "Editar evento" }));
  await screen.findByLabelText("Nombre del evento");
  return resultado;
}

describe("el catálogo se actualiza después de una escritura (R15)", () => {
  it("editar un evento: al volver a Explorar se ve el nombre nuevo", async () => {
    let lista = catalogo([clasicoEnCatalogo, festivalEnCatalogo]);
    const resultado = await abrir(
      () => lista,
      () => {
        lista = catalogo([clasicoEnCatalogo, { ...festivalEnCatalogo, nombre: "Festival del Sur" }]);
        return { status: 200, json: { ...festivalCompleto, nombre: "Festival del Sur" } };
      },
      () => ({ status: 204, texto: "" }),
    );
    await escribir("Nombre del evento", "Festival del Sur");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));

    await irAPestana("Explorar");

    await waitFor(() => expect(resultado.falso.pedidosA(CATALOGO_INICIAL)).toHaveLength(2));
    expect(await screen.findByText("Festival del Sur")).toBeOnTheScreen();
  });

  it("eliminar un evento: al volver a Explorar ya no aparece", async () => {
    const alertas = espiarAlertas();
    let lista = catalogo([clasicoEnCatalogo, festivalEnCatalogo]);
    const resultado = await abrir(
      () => lista,
      () => ({ status: 200, json: festivalCompleto }),
      () => {
        lista = catalogo([clasicoEnCatalogo]);
        return { status: 204, texto: "" };
      },
    );
    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar evento" }));
    await tocarEnAlerta(alertas, '¿Eliminar "Festival Sonidos del Sur"?', "Eliminar");
    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));

    await irAPestana("Explorar");

    await waitFor(() => expect(resultado.falso.pedidosA(CATALOGO_INICIAL)).toHaveLength(2));
    expect(await screen.findByText("Clásico de básquet")).toBeOnTheScreen();
    expect(screen.queryByText("Festival Sonidos del Sur")).toBeNull();
  });
});
