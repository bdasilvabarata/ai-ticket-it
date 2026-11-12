import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { AHORA, DIA, compra, evento, relojMovible, tipo } from "../helpers/eventos";
import { crearServicesDeEventos } from "../helpers/services-de-eventos";

// Mismo enfoque que concurrencia.test.ts (004): `Promise.allSettled` sobre los services reales; los
// repositorios devuelven promesas y cada `await` cede el turno, así que sin cerrojo las operaciones
// se intercalarían (research R11).

const MINUTO = 60 * 1000;

/** Un evento de Lucía con VIP guardado en 48 y una compra PENDIENTE de 2 VIP ya vencida. */
function armar() {
  const reloj = relojMovible();
  const servicios = crearServicesDeEventos({
    eventos: [
      evento({ id: "evento-a", tiposEntrada: [tipo({ id: "tipo-a-vip", nombre: "VIP", cupo: 48 })] }),
    ],
    compras: [
      compra("evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, { id: "compra-vencida", cantidad: 2 }),
    ],
    reloj,
  });
  reloj.avanzar(15 * MINUTO);
  return servicios;
}

const datosEvento = {
  nombre: "Nombre nuevo",
  descripcion: "Descripción nueva.",
  categoriaId: "categoria-musica",
  fechaHora: new Date(AHORA.getTime() + 2 * DIA),
  multimedia: [],
};

describe("Concurrencia: vencimiento y escrituras del mismo evento (feature 006)", () => {
  it("una edición del evento y el alta de un tipo simultáneas devuelven el cupo una sola vez", async () => {
    const { eventoService, tipoEntradaService, repositorioEventos, repositorioCompras } = armar();

    const resultados = await Promise.allSettled([
      eventoService.actualizar("evento-a", "usuario-lucia", datosEvento),
      tipoEntradaService.crear("evento-a", "usuario-lucia", {
        nombre: "Platea",
        descripcion: "",
        precio: 0,
        cupo: 10,
      }),
    ]);

    expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    const guardado = await repositorioEventos.buscarPorId("evento-a");
    expect(guardado?.nombre).toBe("Nombre nuevo");
    expect(guardado?.tiposEntrada.map((t) => t.nombre)).toEqual(["VIP", "Platea"]);
    expect(guardado?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(50);
    expect((await repositorioCompras.buscarPorId("compra-vencida"))?.fueVencida()).toBe(true);
    expect((await eventoService.obtener("evento-a")).tiposEntrada[0]?.cupo).toBe(50);
  });

  it("dos ediciones del tipo simultáneas: el cupo guardado es el último pedido, sin sumar la vencida dos veces", async () => {
    const { eventoService, tipoEntradaService, repositorioEventos } = armar();
    const datosVip = (cupo: number) => ({ nombre: "VIP", descripcion: "", precio: 1000, cupo });

    const resultados = await Promise.allSettled([
      eventoService.actualizar("evento-a", "usuario-lucia", datosEvento),
      tipoEntradaService.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", datosVip(50)),
      tipoEntradaService.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", datosVip(30)),
    ]);

    expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
    expect((await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(
      30,
    );
    expect((await eventoService.obtener("evento-a")).tiposEntrada[0]?.cupo).toBe(30);
  });
});
