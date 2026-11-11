import { describe, expect, it } from "vitest";
import { Compra } from "../../src/domain/compra";
import { ReglaDeNegocioError } from "../../src/domain/errores";
import type { Evento } from "../../src/domain/evento";
import type { RepositorioCompras, RepositorioEventos } from "../../src/domain/repositorios";
import { CategoriaRepository } from "../../src/repositories/categoria.repository";
import { CompraRepository } from "../../src/repositories/compra.repository";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { CerrojoPorClave } from "../../src/services/cerrojo-por-clave";
import { EventoService } from "../../src/services/evento.service";
import { TipoEntradaService } from "../../src/services/tipo-entrada.service";
import { evento, musica, relojFijo, tipo } from "../helpers/eventos";

// FR-029 / SC-008: pedidos simultáneos sobre un mismo evento dan el mismo resultado que de a uno.
// Los repositorios devuelven promesas y cada `await` cede el turno: sin cerrojo, las operaciones de
// `Promise.all` se intercalarían entre leer y guardar.

const general = tipo({ id: "tipo-a-general", nombre: "General" });
const vip = tipo({ id: "tipo-a-vip", nombre: "VIP" });

function armar(eventos: Evento[] = [evento({ id: "evento-a", tiposEntrada: [general, vip] })]) {
  const repositorioEventos = new EventoRepository(eventos);
  const repositorioCompras = new CompraRepository();
  const cerrojo = new CerrojoPorClave();
  const reloj = relojFijo();
  const eventosService = new EventoService({
    eventos: repositorioEventos,
    categorias: new CategoriaRepository([musica]),
    compras: repositorioCompras,
    cerrojo,
    reloj,
  });
  const tipos = new TipoEntradaService({
    eventos: repositorioEventos,
    compras: repositorioCompras,
    cerrojo,
    reloj,
  });
  return { eventosService, tipos, cerrojo, repositorioEventos, repositorioCompras };
}

const datosTipo = (nombre: string) => ({ nombre, descripcion: "", precio: 100, cupo: 5 });

/** Cuenta cumplidas y rechazadas, y devuelve los códigos de los rechazos. */
function resumir(resultados: PromiseSettledResult<unknown>[]) {
  return {
    cumplidas: resultados.filter((r) => r.status === "fulfilled").length,
    codigos: resultados
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason as ReglaDeNegocioError).codigo),
  };
}

async function nombresDeTipos(repositorio: RepositorioEventos, id = "evento-a"): Promise<string[]> {
  return (await repositorio.buscarPorId(id))?.tiposEntrada.map((t) => t.nombre) ?? [];
}

describe("concurrencia sobre un mismo evento (cerrojo compartido)", () => {
  it("dos tipos con el mismo nombre agregados a la vez: uno se crea y el otro da NOMBRE_TIPO_ENTRADA_REPETIDO", async () => {
    const { tipos, repositorioEventos } = armar();
    const resultados = await Promise.allSettled([
      tipos.crear("evento-a", "usuario-lucia", datosTipo("Platea")),
      tipos.crear("evento-a", "usuario-lucia", datosTipo("platea")),
    ]);
    expect(resumir(resultados)).toEqual({ cumplidas: 1, codigos: ["NOMBRE_TIPO_ENTRADA_REPETIDO"] });
    expect(await nombresDeTipos(repositorioEventos)).toHaveLength(3);
  });

  it("dos tipos distintos agregados a la vez quedan los dos (sin actualización perdida)", async () => {
    const { tipos, repositorioEventos } = armar();
    await Promise.all([
      tipos.crear("evento-a", "usuario-lucia", datosTipo("Platea")),
      tipos.crear("evento-a", "usuario-lucia", datosTipo("Pullman")),
    ]);
    expect(await nombresDeTipos(repositorioEventos)).toEqual(["General", "VIP", "Platea", "Pullman"]);
  });

  it("dos tipos renombrados a la vez al mismo nombre: uno se acepta y el otro da NOMBRE_TIPO_ENTRADA_REPETIDO", async () => {
    const { tipos, repositorioEventos } = armar([
      evento({ id: "evento-a", tiposEntrada: [general, vip, tipo({ id: "tipo-a-campo", nombre: "Campo" })] }),
    ]);
    const resultados = await Promise.allSettled([
      tipos.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", datosTipo("Platea")),
      tipos.actualizar("evento-a", "tipo-a-campo", "usuario-lucia", datosTipo("Platea")),
    ]);
    expect(resumir(resultados)).toEqual({ cumplidas: 1, codigos: ["NOMBRE_TIPO_ENTRADA_REPETIDO"] });
    expect((await nombresDeTipos(repositorioEventos)).filter((n) => n === "Platea")).toHaveLength(1);
  });

  it("quitar a la vez los dos tipos de un evento con dos: uno se quita y el otro da ULTIMO_TIPO_ENTRADA", async () => {
    const { tipos, repositorioEventos } = armar();
    const resultados = await Promise.allSettled([
      tipos.eliminar("evento-a", "tipo-a-general", "usuario-lucia"),
      tipos.eliminar("evento-a", "tipo-a-vip", "usuario-lucia"),
    ]);
    expect(resumir(resultados)).toEqual({ cumplidas: 1, codigos: ["ULTIMO_TIPO_ENTRADA"] });
    expect(await nombresDeTipos(repositorioEventos)).toHaveLength(1);
  });

  it("una operación sobre el evento A bloqueada no frena una sobre el evento B (FR-029, SC-008)", async () => {
    const { tipos, cerrojo } = armar([
      evento({ id: "evento-a", tiposEntrada: [general] }),
      evento({ id: "evento-b", tiposEntrada: [tipo({ id: "tipo-b-general" })] }),
    ]);
    let liberar = () => {};
    const bloqueoDeA = cerrojo.ejecutar(
      "evento-a",
      () => new Promise<void>((resolver) => (liberar = resolver)),
    );
    const sobreA = tipos.crear("evento-a", "usuario-lucia", datosTipo("Platea"));
    let terminoA = false;
    void sobreA.then(() => (terminoA = true));

    await tipos.crear("evento-b", "usuario-lucia", datosTipo("Platea"));
    expect(terminoA).toBe(false);

    liberar();
    await Promise.all([bloqueoDeA, sobreA]);
    expect(terminoA).toBe(true);
  });

  describe("eliminar mientras una operación de la 006 registra una compra bajo el mismo cerrojo", () => {
    /** Simula la compra de la 006: bajo el cerrojo del evento, relee el evento y guarda la compra. */
    function comprar(cerrojo: CerrojoPorClave, eventos: RepositorioEventos, compras: RepositorioCompras) {
      return cerrojo.ejecutar("evento-a", async () => {
        const actual = await eventos.buscarPorId("evento-a");
        if (!actual) throw new ReglaDeNegocioError("EVENTO_NO_ENCONTRADO", "No existe el evento.");
        await compras.guardar(
          new Compra({
            id: "compra-simulada",
            compradorId: "usuario-martin",
            eventoId: "evento-a",
            tipoEntradaId: "tipo-a-general",
            cantidad: 1,
            total: 1000,
            estado: "CONFIRMADA",
          }),
        );
      });
    }

    it("si eliminar entra primero, la compra ve el evento inexistente", async () => {
      const { eventosService, cerrojo, repositorioEventos, repositorioCompras } = armar();
      const resultados = await Promise.allSettled([
        eventosService.eliminar("evento-a", "usuario-lucia"),
        comprar(cerrojo, repositorioEventos, repositorioCompras),
      ]);
      expect(resultados[0].status).toBe("fulfilled");
      expect(resumir([resultados[1]]).codigos).toEqual(["EVENTO_NO_ENCONTRADO"]);
      expect(await repositorioCompras.existePorEvento("evento-a")).toBe(false);
    });

    it("si la compra entra primero, eliminar da EVENTO_CON_COMPRAS", async () => {
      const { eventosService, cerrojo, repositorioEventos, repositorioCompras } = armar();
      const resultados = await Promise.allSettled([
        comprar(cerrojo, repositorioEventos, repositorioCompras),
        eventosService.eliminar("evento-a", "usuario-lucia"),
      ]);
      expect(resultados[0].status).toBe("fulfilled");
      expect(resumir([resultados[1]]).codigos).toEqual(["EVENTO_CON_COMPRAS"]);
      expect(await repositorioEventos.buscarPorId("evento-a")).not.toBeNull();
    });
  });
});
