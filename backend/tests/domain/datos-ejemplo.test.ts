import { describe, expect, it } from "vitest";
import { crearDatosEjemplo } from "../../src/seed/datos-ejemplo";
import { EstadoCompra } from "@ai-ticket-it/shared";
import { Categoria } from "../../src/domain/categoria";
import { esCodigoValido } from "../../src/domain/codigo-de-entrada";
import { Compra } from "../../src/domain/compra";
import { Evento, TipoEntrada } from "../../src/domain/evento";
import { Usuario } from "../../src/domain/usuario";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const ahora = new Date("2026-11-03T15:30:00.000Z");
const datos = crearDatosEjemplo(ahora);
const { categorias, usuarios, eventos, compras } = datos;
const tipos = eventos.flatMap((evento) => evento.tiposEntrada);

function contarPorOrganizador(): Map<string, number> {
  const cuenta = new Map<string, number>();
  for (const evento of eventos) {
    cuenta.set(evento.organizadorId, (cuenta.get(evento.organizadorId) ?? 0) + 1);
  }
  return cuenta;
}

describe("crearDatosEjemplo", () => {
  it("tiene 6 categorías", () => {
    expect(categorias.length).toBeGreaterThanOrEqual(5);
    expect(categorias).toHaveLength(6);
  });

  it("tiene 5 usuarios: Lucía, Martín y Sofía organizan 4, 3 y 2; Diego y Valentina ninguno", () => {
    expect(usuarios).toHaveLength(5);
    const cuenta = contarPorOrganizador();
    expect(cuenta.get("usuario-lucia")).toBe(4);
    expect(cuenta.get("usuario-martin")).toBe(3);
    expect(cuenta.get("usuario-sofia")).toBe(2);
    expect(cuenta.has("usuario-diego")).toBe(false);
    expect(cuenta.has("usuario-valentina")).toBe(false);
    const organizan = usuarios.filter((usuario) => cuenta.has(usuario.id));
    expect(organizan.length).toBeGreaterThanOrEqual(2);
    expect(usuarios.length - organizan.length).toBeGreaterThanOrEqual(1);
  });

  it("tiene 9 eventos de varios organizadores y categorías, cada uno con al menos un tipo", () => {
    expect(eventos).toHaveLength(9);
    expect(new Set(eventos.map((evento) => evento.organizadorId)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(eventos.map((evento) => evento.categoriaId)).size).toBeGreaterThanOrEqual(2);
    for (const evento of eventos) expect(evento.tiposEntrada.length).toBeGreaterThanOrEqual(1);
  });

  it("tiene al menos 2 eventos ya realizados", () => {
    const pasados = eventos.filter((evento) => evento.fechaHora.getTime() < ahora.getTime());
    expect(pasados.length).toBeGreaterThanOrEqual(2);
  });

  it("tiene al menos un evento en las próximas 48 h", () => {
    const proximos = eventos.filter((evento) => {
      const t = evento.fechaHora.getTime();
      return t > ahora.getTime() && t <= ahora.getTime() + 48 * HORA;
    });
    expect(proximos.length).toBeGreaterThanOrEqual(1);
  });

  it("tiene un evento con varios tipos y un tipo con cupo de 3 o menos", () => {
    expect(eventos.some((evento) => evento.tiposEntrada.length > 1)).toBe(true);
    expect(tipos.some((tipo) => tipo.cupo <= 3)).toBe(true);
  });

  it("tiene precios muy distintos (máximo ≥ 10 × el menor precio pagado)", () => {
    const precios = tipos.map((tipo) => tipo.precio);
    expect(Math.max(...precios) / Math.min(...precios.filter((p) => p > 0))).toBeGreaterThanOrEqual(10);
  });

  it("tiene al menos un evento próximo con un tipo gratis (feature 005)", () => {
    const proximos = eventos.filter((evento) => !evento.estaRealizado(ahora));
    expect(proximos.some((evento) => evento.tiposEntrada.some((tipo) => tipo.precio === 0))).toBe(true);
    expect(
      eventos.find((e) => e.id === "evento-maraton-10k")?.buscarTipoEntrada("tipo-maraton-10k-carrera-kids"),
    ).toMatchObject({ nombre: "Carrera kids", precio: 0, cupo: 200 });
  });

  it("tiene al menos un evento próximo agotado (feature 005)", () => {
    const proximos = eventos.filter((evento) => !evento.estaRealizado(ahora));
    expect(proximos.some((evento) => evento.estaAgotado())).toBe(true);
    expect(eventos.find((e) => e.id === "evento-hamlet")?.estaAgotado()).toBe(true);
  });

  it("tiene 7 eventos próximos y 2 realizados", () => {
    const realizados = eventos.filter((evento) => evento.estaRealizado(ahora));
    expect(realizados).toHaveLength(2);
    expect(eventos.length - realizados.length).toBe(7);
  });

  it("usa precios y cupos enteros no negativos", () => {
    for (const tipo of tipos) {
      expect(Number.isInteger(tipo.precio) && tipo.precio >= 0).toBe(true);
      expect(Number.isInteger(tipo.cupo) && tipo.cupo >= 0).toBe(true);
    }
  });

  it("usa ids legibles, únicos y con el prefijo de cada tipo", () => {
    const grupos: [string[], string][] = [
      [usuarios.map((u) => u.id), "usuario"],
      [categorias.map((c) => c.id), "categoria"],
      [eventos.map((e) => e.id), "evento"],
      [tipos.map((t) => t.id), "tipo"],
    ];
    const todos: string[] = [];
    for (const [ids, prefijo] of grupos) {
      for (const id of ids) expect(id).toMatch(new RegExp(`^${prefijo}(-[a-z0-9]+)+$`));
      todos.push(...ids);
    }
    expect(new Set(todos).size).toBe(todos.length);
    expect(usuarios.map((u) => u.id)).toEqual([
      "usuario-lucia",
      "usuario-martin",
      "usuario-sofia",
      "usuario-diego",
      "usuario-valentina",
    ]);
    expect(eventos.map((e) => e.id)).toContain("evento-noche-de-rock");
    expect(tipos.map((t) => t.id)).toContain("tipo-festival-sonidos-del-sur-backstage");
  });

  it("es determinista para el mismo ahora", () => {
    expect(crearDatosEjemplo(new Date(ahora))).toEqual(datos);
  });

  it("desplaza las fechas junto con ahora", () => {
    const despues = crearDatosEjemplo(new Date(ahora.getTime() + 7 * DIA));
    despues.eventos.forEach((evento, i) => {
      expect(evento.id).toBe(eventos[i]?.id);
      expect(evento.fechaHora.getTime() - (eventos[i]?.fechaHora.getTime() ?? 0)).toBe(7 * DIA);
    });
  });

  it("solo referencia organizadores y categorías existentes", () => {
    const idsUsuarios = new Set(usuarios.map((u) => u.id));
    const idsCategorias = new Set(categorias.map((c) => c.id));
    for (const evento of eventos) {
      expect(idsUsuarios.has(evento.organizadorId)).toBe(true);
      expect(idsCategorias.has(evento.categoriaId)).toBe(true);
    }
  });

  it("tiene dos compras sobre el Festival (de Lucía y próximo): una confirmada y una cancelada", () => {
    const delFestival = compras.filter((c) => c.eventoId === "evento-festival-sonidos-del-sur");
    expect(
      delFestival.map((c) => [c.id, c.compradorId, c.tipoEntradaId, c.cantidad, c.total, c.estado]),
    ).toEqual([
      [
        "compra-martin-festival-vip",
        "usuario-martin",
        "tipo-festival-sonidos-del-sur-vip",
        2,
        240000,
        EstadoCompra.CONFIRMADA,
      ],
      [
        "compra-diego-festival-general",
        "usuario-diego",
        "tipo-festival-sonidos-del-sur-general",
        1,
        45000,
        EstadoCompra.CANCELADA,
      ],
    ]);
    const festival = eventos.find((e) => e.id === "evento-festival-sonidos-del-sur");
    expect(festival?.organizadorId).toBe("usuario-lucia");
    expect(festival?.estaRealizado(ahora)).toBe(false);
    const idsUsuarios = new Set(usuarios.map((u) => u.id));
    for (const compra of compras) {
      const suEvento = eventos.find((e) => e.id === compra.eventoId);
      expect(compra).toBeInstanceOf(Compra);
      expect(compra.id).toMatch(/^compra(-[a-z0-9]+)+$/);
      expect(suEvento?.buscarTipoEntrada(compra.tipoEntradaId)).not.toBeNull();
      expect(idsUsuarios.has(compra.compradorId)).toBe(true);
    }
  });

  describe("la Peña en La Rueda, con la ventana de uso abierta (feature 008, R12)", () => {
    const pena = eventos.find((e) => e.id === "evento-pena-en-la-rueda")!;
    const deLaPena = compras.filter((c) => c.eventoId === pena.id);

    it("es de Lucía, de Música, a la hora en punto más cercana a ahora + 2 h, con sus dos tipos", () => {
      expect(pena).toMatchObject({ nombre: "Peña en La Rueda", organizadorId: "usuario-lucia" });
      expect(pena.categoriaId).toBe("categoria-musica");
      // ahora es 15:30 UTC: + 2 h = 17:30 → 18:00.
      expect(pena.fechaHora).toEqual(new Date("2026-11-03T18:00:00.000Z"));
      expect(pena.tiposEntrada.map((t) => [t.id, t.nombre, t.precio])).toEqual([
        ["tipo-pena-en-la-rueda-general", "General", 6000],
        ["tipo-pena-en-la-rueda-con-cena", "Con cena", 15000],
      ]);
    });

    it.each([0, 29, 30, 31, 59].map((minutos) => minutos * 60 * 1000))(
      "con el arranque desplazado %d ms, su ventana está abierta al arrancar y 12 h después",
      (desfase) => {
        const arranque = new Date(ahora.getTime() + desfase);
        const otra = crearDatosEjemplo(arranque).eventos.find((e) => e.id === pena.id)!;
        const desde = otra.fechaHora.getTime() - 4 * HORA;
        const hasta = otra.fechaHora.getTime() + 12 * HORA;
        expect(desde).toBeLessThanOrEqual(arranque.getTime());
        expect(hasta).toBeGreaterThanOrEqual(arranque.getTime() + 12 * HORA);
        expect(otra.fechaHora.getTime() % HORA).toBe(0);
      },
    );

    it("Martín, 3 General UTILIZADA con 1 usada por Lucía; Sofía, 2 Con cena CONFIRMADA", () => {
      expect(
        deLaPena.map((c) => [c.id, c.compradorId, c.tipoEntradaId, c.cantidad, c.total, c.estado]),
      ).toEqual([
        [
          "compra-martin-pena-general",
          "usuario-martin",
          "tipo-pena-en-la-rueda-general",
          3,
          18000,
          EstadoCompra.UTILIZADA,
        ],
        [
          "compra-sofia-pena-con-cena",
          "usuario-sofia",
          "tipo-pena-en-la-rueda-con-cena",
          2,
          30000,
          EstadoCompra.CONFIRMADA,
        ],
      ]);
      const deMartin = deLaPena[0]!;
      expect(deMartin.entradasUsadas).toBe(1);
      const uso = deMartin.historial[deMartin.historial.length - 1]!;
      expect(uso.autor).toEqual({ tipo: "usuario", usuarioId: "usuario-lucia" });
      // El uso fue dentro de la ventana y antes del arranque.
      expect(uso.fechaHora.getTime()).toBeGreaterThanOrEqual(pena.fechaHora.getTime() - 4 * HORA);
      expect(uso.fechaHora.getTime()).toBeLessThanOrEqual(ahora.getTime());
    });

    it("el cupo descuenta las compras vigentes: General 120 − 3 y Con cena 40 − 2", () => {
      expect(pena.buscarTipoEntrada("tipo-pena-en-la-rueda-general")?.cupo).toBe(117);
      expect(pena.buscarTipoEntrada("tipo-pena-en-la-rueda-con-cena")?.cupo).toBe(38);
    });
  });

  it("las compras tienen historial coherente (R10): una pagada y una vencida por el sistema", () => {
    const porId = new Map(compras.map((c) => [c.id, c]));
    const martin = { tipo: "usuario", usuarioId: "usuario-martin" };
    expect(porId.get("compra-martin-festival-vip")?.historial).toEqual([
      { estado: EstadoCompra.PENDIENTE, autor: martin, fechaHora: new Date(ahora.getTime() - 2 * DIA) },
      {
        estado: EstadoCompra.CONFIRMADA,
        autor: martin,
        fechaHora: new Date(ahora.getTime() - 2 * DIA + 5 * 60 * 1000),
      },
    ]);
    const vencida = porId.get("compra-diego-festival-general");
    expect(vencida?.historial).toEqual([
      {
        estado: EstadoCompra.PENDIENTE,
        autor: { tipo: "usuario", usuarioId: "usuario-diego" },
        fechaHora: new Date(ahora.getTime() - DIA),
      },
      {
        estado: EstadoCompra.CANCELADA,
        autor: { tipo: "sistema" },
        fechaHora: new Date(ahora.getTime() - DIA + 15 * 60 * 1000),
      },
    ]);
    expect(vencida?.fueVencida()).toBe(true);
  });

  it("cada compra tiene una entrada por unidad, con códigos válidos y distintos entre todas (008, R2)", () => {
    for (const compra of compras) expect(compra.entradas).toHaveLength(compra.cantidad);
    const codigos = compras.flatMap((compra) => compra.entradas.map((entrada) => entrada.codigo));
    expect(codigos.every(esCodigoValido)).toBe(true);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("ninguna compra queda PENDIENTE y los cupos del Festival siguen VIP 50 y Backstage 3", () => {
    expect(compras.filter((c) => c.estado === EstadoCompra.PENDIENTE)).toEqual([]);
    const festival = eventos.find((e) => e.id === "evento-festival-sonidos-del-sur");
    expect(festival?.buscarTipoEntrada("tipo-festival-sonidos-del-sur-vip")?.cupo).toBe(50);
    expect(festival?.buscarTipoEntrada("tipo-festival-sonidos-del-sur-backstage")?.cupo).toBe(3);
  });

  describe("compras canceladas sobre el Maratón (feature 009, R11)", () => {
    const delMaraton = compras.filter((c) => c.eventoId === "evento-maraton-10k");
    const porId = new Map(delMaraton.map((c) => [c.id, c]));
    const diego = { tipo: "usuario", usuarioId: "usuario-diego" };
    const valentina = { tipo: "usuario", usuarioId: "usuario-valentina" };
    const lucia = { tipo: "usuario", usuarioId: "usuario-lucia" };
    const haceDias = (dias: number, minutos = 0) =>
      new Date(ahora.getTime() - dias * DIA + minutos * 60 * 1000);

    it("Diego canceló la suya después de pagarla y espera el reembolso", () => {
      const compra = porId.get("compra-diego-maraton-inscripcion");
      expect(compra).toMatchObject({
        compradorId: "usuario-diego",
        tipoEntradaId: "tipo-maraton-10k-inscripcion",
        cantidad: 1,
        total: 30000,
        estado: EstadoCompra.CANCELADA,
        canceladaDesde: "CONFIRMADA",
      });
      expect(compra?.historial).toEqual([
        { estado: EstadoCompra.PENDIENTE, autor: diego, fechaHora: haceDias(3) },
        { estado: EstadoCompra.CONFIRMADA, autor: diego, fechaHora: haceDias(3, 5) },
        { estado: EstadoCompra.CANCELADA, autor: diego, fechaHora: haceDias(1) },
      ]);
      expect(compra?.reembolso).toBe("pendiente");
      expect(compra?.entradas.map((e) => [e.codigo, compra.estadoDe(e)])).toEqual([
        ["MZDF1C01", EstadoCompra.CANCELADA],
      ]);
    });

    it("la de Valentina ya está reembolsada por Lucía", () => {
      const compra = porId.get("compra-valentina-maraton-inscripcion");
      expect(compra).toMatchObject({ compradorId: "usuario-valentina", cantidad: 2, total: 60000 });
      expect(compra?.estado).toBe(EstadoCompra.REEMBOLSADA);
      expect(compra?.historial).toEqual([
        { estado: EstadoCompra.PENDIENTE, autor: valentina, fechaHora: haceDias(4) },
        { estado: EstadoCompra.CONFIRMADA, autor: valentina, fechaHora: haceDias(4, 5) },
        { estado: EstadoCompra.CANCELADA, autor: valentina, fechaHora: haceDias(2) },
        { estado: EstadoCompra.REEMBOLSADA, autor: lucia, fechaHora: haceDias(1) },
      ]);
      expect(compra?.reembolso).toBe("confirmado");
      expect(compra?.entradas.map((e) => e.codigo)).toEqual(["MZVG2R01", "MZVG2R02"]);
    });

    it("el cupo de Inscripción sigue en 1000", () => {
      const maraton = eventos.find((e) => e.id === "evento-maraton-10k");
      expect(maraton?.buscarTipoEntrada("tipo-maraton-10k-inscripcion")?.cupo).toBe(1000);
      expect(delMaraton).toHaveLength(2);
    });
  });

  it("deja los favoritos vacíos", () => {
    for (const usuario of usuarios) expect(usuario.favoritos).toEqual([]);
  });

  it("construye entidades de dominio, así sus invariantes validan los datos de ejemplo", () => {
    const { categorias, usuarios, eventos } = crearDatosEjemplo(new Date("2026-11-06T15:00:00Z"));
    for (const categoria of categorias) expect(categoria).toBeInstanceOf(Categoria);
    for (const usuario of usuarios) expect(usuario).toBeInstanceOf(Usuario);
    for (const evento of eventos) {
      expect(evento).toBeInstanceOf(Evento);
      for (const tipo of evento.tiposEntrada) expect(tipo).toBeInstanceOf(TipoEntrada);
    }
  });
});
