import type { CompraVista, EventoCatalogoVista } from "@ai-ticket-it/shared";
import { act, screen } from "expo-router/testing-library";
import { router } from "expo-router";

import { compraConfirmada, compraUtilizada, conRestantes } from "../helpers/compras";
import { CATALOGO_INICIAL, catalogo, maratonEnCatalogo } from "../helpers/eventos";
import { porRuta } from "../helpers/fetch-falso";
import { esperarPestanas } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { martin, todos } from "../helpers/usuarios";

// "Ver mis entradas" (feature 008, FR-012b, R14): los códigos de cada compra confirmada o utilizada.
// Los casos de cómo se llega desde el detalle están en detalle-evento.test.tsx.

const MIS_COMPRAS = "/eventos/evento-maraton-10k/mis-compras";

/** `favoritos` (feature 014) reemplaza el catálogo de Explorar, montado debajo, por uno vacío. */
async function abrirMisEntradas(confirmadas: CompraVista[], favoritos: EventoCatalogoVista[] = []) {
  await renderConDependencias({
    usuarioRecordado: martin.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: martin }],
      "/usuarios": [{ status: 200, json: todos }],
      "/categorias": [{ status: 200, json: [] }],
      [CATALOGO_INICIAL]: [{ status: 200, json: catalogo(favoritos.length > 0 ? [] : [maratonEnCatalogo]) }],
      "/usuarios/actual/favoritos": [{ status: 200, json: favoritos }],
      [MIS_COMPRAS]: [
        {
          status: 200,
          json: { ...conRestantes({ "tipo-maraton-inscripcion": 2 }), confirmadas },
        },
      ],
    }),
  });
  await esperarPestanas();
  await act(() =>
    router.push({
      pathname: "/explorar/[eventoId]/mis-entradas",
      params: { eventoId: "evento-maraton-10k" },
    }),
  );
}

describe("Mis entradas: códigos de las entradas (feature 008)", () => {
  it("debajo de cada compra, sus entradas con código y estado", async () => {
    await abrirMisEntradas([compraConfirmada]);
    expect(await screen.findByText("7K3M-Q9TB")).toBeOnTheScreen();
    expect(screen.getByLabelText("Entrada 1, código 7 K 3 M Q 9 T B, Confirmada")).toBeOnTheScreen();
    expect(screen.getByLabelText("Entrada 2, código 4 H X P 2 R V A, Confirmada")).toBeOnTheScreen();
  });

  it("también una UTILIZADA, con cuántas entradas se usaron", async () => {
    await abrirMisEntradas([{ ...compraUtilizada, id: "compra-usada" }]);
    expect(await screen.findByText("1 de 2 entradas usadas")).toBeOnTheScreen();
    expect(screen.getByLabelText("Estado: Utilizada")).toBeOnTheScreen();
    expect(screen.getByLabelText("Entrada 1, código 7 K 3 M Q 9 T B, Utilizada")).toBeOnTheScreen();
  });
});

describe("Mis entradas: sin estrellas de favoritos (feature 014, FR-015)", () => {
  it("con el evento entre los favoritos, las compras no llevan estrella", async () => {
    await abrirMisEntradas([compraConfirmada], [maratonEnCatalogo]);
    expect(await screen.findByText("7K3M-Q9TB")).toBeOnTheScreen();
    expect(screen.queryAllByTestId("marca-favorito", { includeHiddenElements: true })).toHaveLength(0);
  });
});
