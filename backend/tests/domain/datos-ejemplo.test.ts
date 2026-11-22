import { describe, expect, it } from "vitest";
import { crearDatosEjemplo } from "../../src/seed/datos-ejemplo";
import { EstadoCompra } from "@ai-ticket-it/shared";
import { Categoria } from "../../src/domain/categoria";
import { esCodigoValido } from "../../src/domain/codigo-de-entrada";
import { Compra } from "../../src/domain/compra";
import { Evento, TipoEntrada } from "../../src/domain/evento";
import { exigirQuePuedeReseniar, Resenia } from "../../src/domain/resenia";
import { Usuario } from "../../src/domain/usuario";

const HORA = 60 * 60 * 1000;
/** Las diez compras del Festival que suma la 013 (R11): `compra-<comprador>-festival-<n>`. */
const DE_LA_013 = /-festival-\d+$/;
const DIA = 24 * HORA;
const ahora = new Date("2026-11-03T15:30:00.000Z");
const datos = crearDatosEjemplo(ahora);
const { categorias, usuarios, eventos, compras } = datos;
const tipos = eventos.flatMap((evento) => evento.tiposEntrada);
/** Los próximos que suma la feature 013 (R11) para que el catálogo tenga 2 páginas. */
const NUEVOS_DE_LA_013 = [
  "evento-feria-del-libro-independiente",
  "evento-match-de-impro",
  "evento-torneo-de-futbol-5",
  "evento-microfono-abierto",
  "evento-feria-de-cerveza-artesanal",
];

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

  it("tiene 5 usuarios: Lucía, Martín y Sofía organizan 5, 7 y 4; Diego y Valentina ninguno", () => {
    expect(usuarios).toHaveLength(5);
    const cuenta = contarPorOrganizador();
    expect(cuenta.get("usuario-lucia")).toBe(5);
    expect(cuenta.get("usuario-martin")).toBe(7);
    expect(cuenta.get("usuario-sofia")).toBe(4);
    expect(cuenta.has("usuario-diego")).toBe(false);
    expect(cuenta.has("usuario-valentina")).toBe(false);
    const organizan = usuarios.filter((usuario) => cuenta.has(usuario.id));
    expect(organizan.length).toBeGreaterThanOrEqual(2);
    expect(usuarios.length - organizan.length).toBeGreaterThanOrEqual(1);
  });

  it("tiene 16 eventos de varios organizadores y categorías, cada uno con al menos un tipo", () => {
    expect(eventos).toHaveLength(16);
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

  it("tiene 12 eventos próximos (2 páginas del catálogo: 10 + 2, feature 013) y 4 realizados", () => {
    const realizados = eventos.filter((evento) => evento.estaRealizado(ahora));
    expect(realizados).toHaveLength(4);
    expect(eventos.length - realizados.length).toBe(12);
  });

  it("los 5 próximos de la 013 no tienen compras y son de varios organizadores y categorías (R11)", () => {
    const nuevos = eventos.filter((evento) => NUEVOS_DE_LA_013.includes(evento.id));
    expect(nuevos).toHaveLength(5);
    for (const evento of nuevos) {
      expect(evento.estaRealizado(ahora)).toBe(false);
      expect(compras.some((compra) => compra.eventoId === evento.id)).toBe(false);
    }
    expect(new Set(nuevos.map((evento) => evento.organizadorId)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(nuevos.map((evento) => evento.categoriaId)).size).toBe(5);
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
    const delFestival = compras.filter(
      (c) => c.eventoId === "evento-festival-sonidos-del-sur" && !DE_LA_013.test(c.id),
    );
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

  describe("las diez compras nuevas del Festival (feature 013, R11)", () => {
    const delFestival = compras.filter((c) => c.eventoId === "evento-festival-sonidos-del-sur");
    const nuevas = delFestival.filter((c) => DE_LA_013.test(c.id));
    const festival = eventos.find((e) => e.id === "evento-festival-sonidos-del-sur")!;

    it("el Festival tiene 12 compras (2 páginas: 10 + 2), ninguna PENDIENTE", () => {
      expect(delFestival).toHaveLength(12);
      expect(delFestival.filter((c) => c.estado === EstadoCompra.PENDIENTE)).toEqual([]);
    });

    it("son de una General, de Diego, Sofía, Valentina y Martín, confirmadas o canceladas", () => {
      expect(nuevas).toHaveLength(10);
      for (const compra of nuevas) {
        expect(compra.id).toMatch(/^compra-(diego|sofia|valentina|martin)-festival-\d+$/);
        expect(compra.id).toContain(compra.compradorId.replace("usuario-", ""));
        expect([compra.tipoEntradaId, compra.cantidad, compra.total]).toEqual([
          "tipo-festival-sonidos-del-sur-general",
          1,
          45000,
        ]);
      }
      expect(new Set(nuevas.map((c) => c.compradorId))).toEqual(
        new Set(["usuario-diego", "usuario-sofia", "usuario-valentina", "usuario-martin"]),
      );
      expect(new Set(nuevas.map((c) => c.estado))).toEqual(
        new Set([EstadoCompra.CONFIRMADA, EstadoCompra.CANCELADA]),
      );
    });

    it("hay canceladas vencidas por el sistema y canceladas después de pagar, con el reembolso pendiente", () => {
      const canceladas = nuevas.filter((c) => c.estado === EstadoCompra.CANCELADA);
      expect(
        canceladas.some((c) => c.historial.at(-1)?.autor.tipo === "sistema" && c.reembolso === null),
      ).toBe(true);
      expect(canceladas.some((c) => c.reembolso === "pendiente")).toBe(true);
    });

    it("nadie pasa el tope de 4 entradas pagas vigentes en el Festival", () => {
      const vigentes = new Map<string, number>();
      for (const compra of delFestival.filter((c) => c.esVigente(ahora))) {
        vigentes.set(compra.compradorId, (vigentes.get(compra.compradorId) ?? 0) + compra.cantidad);
      }
      for (const cantidad of vigentes.values()) expect(cantidad).toBeLessThanOrEqual(4);
    });

    it("General descuenta las confirmadas: 500 − 4", () => {
      const confirmadas = nuevas.filter((c) => c.estado === EstadoCompra.CONFIRMADA);
      expect(confirmadas).toHaveLength(4);
      expect(festival.buscarTipoEntrada("tipo-festival-sonidos-del-sur-general")?.cupo).toBe(500 - 4);
    });

    it("una de las que quedan fuera de la página 1 termina en un mensaje del comprador, posterior al alta y anterior al arranque", () => {
      const porCreacion = delFestival.toSorted((a, b) => b.creadaEn.getTime() - a.creadaEn.getTime());
      const conMensaje = nuevas.filter((c) => c.mensajes.length > 0);
      expect(conMensaje.map((c) => c.id)).toEqual(["compra-valentina-festival-10"]);
      expect(porCreacion.slice(10).map((c) => c.id)).toContain("compra-valentina-festival-10");
      const [compra] = conMensaje;
      expect(compra!.mensajeSinResponder).toBe(true);
      expect(compra!.mensajes[0]!.enviadoEn.getTime()).toBeGreaterThan(compra!.creadaEn.getTime());
      expect(compra!.mensajes[0]!.enviadoEn.getTime()).toBeLessThan(ahora.getTime());
    });
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

  describe("la conversación de Martín y Lucía en su compra VIP del Festival (feature 011, R8)", () => {
    const vip = compras.find((c) => c.id === "compra-martin-festival-vip")!;
    const MINUTO = 60 * 1000;

    it("tiene tres mensajes de las dos partes, en orden, con los textos del seed", () => {
      expect(vip.mensajes.map((m) => [m.autorId, m.texto])).toEqual([
        ["usuario-martin", "Hola, ¿la entrada VIP incluye estacionamiento?"],
        [
          "usuario-lucia",
          "¡Hola, Martín! Sí: con la entrada VIP tenés lugar en el estacionamiento del predio. Mostrá tu código en la barrera.",
        ],
        ["usuario-martin", "¡Genial, gracias!"],
      ]);
    });

    it("a 10 min, 2 h y 3 h del alta: después de la confirmación y antes del arranque", () => {
      const alta = vip.creadaEn.getTime();
      expect(vip.mensajes.map((m) => m.enviadoEn.getTime() - alta)).toEqual([
        10 * MINUTO,
        2 * HORA,
        3 * HORA,
      ]);
      const confirmacion = vip.historial.find((c) => c.estado === EstadoCompra.CONFIRMADA)!.fechaHora;
      for (const mensaje of vip.mensajes) {
        expect(mensaje.enviadoEn.getTime()).toBeGreaterThan(confirmacion.getTime());
        expect(mensaje.enviadoEn.getTime()).toBeLessThan(ahora.getTime());
      }
    });

    it("la compra sigue CONFIRMADA y ninguna otra compra del seed tiene mensajes", () => {
      expect(vip.estado).toBe(EstadoCompra.CONFIRMADA);
      // Salvo la de Valentina que suma la 013 (R11), con el mensaje sin responder de la página 2.
      for (const otra of compras.filter((c) => c !== vip && c.id !== "compra-valentina-festival-10")) {
        expect(otra.mensajes).toEqual([]);
      }
    });
  });

  describe("reseñas de Jazz en el Patio y de la Noche de risas (feature 012, R10)", () => {
    const { resenias } = datos;
    const porId = new Map(compras.map((c) => [c.id, c]));
    const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
    const jazz = eventoPorId.get("evento-jazz-en-el-patio")!;
    const risas = eventoPorId.get("evento-noche-de-risas")!;

    it.each([
      ["jazz-en-el-patio", "lucia"],
      ["jazz-en-el-patio", "diego"],
      ["jazz-en-el-patio", "valentina"],
      ["noche-de-risas", "diego"],
      ["noche-de-risas", "valentina"],
      ...["taller-de-escritura", "tango-en-la-terraza"].flatMap((evento) =>
        ["lucia", "sofia", "diego", "valentina"].map((autor) => [evento, autor]),
      ),
    ])("%s: %s tiene una compra UTILIZADA de una entrada, usada dentro de la ventana", (evento, autor) => {
      const compra = porId.get(`compra-${autor}-${evento}-general`)!;
      const suEvento = eventoPorId.get(`evento-${evento}`)!;
      expect(compra).toMatchObject({
        compradorId: `usuario-${autor}`,
        eventoId: suEvento.id,
        tipoEntradaId: `tipo-${evento}-general`,
        cantidad: 1,
        total: suEvento.tiposEntrada[0]!.precio,
        estado: EstadoCompra.UTILIZADA,
      });
      expect(compra.entradasUsadas).toBe(1);
      const uso = compra.historial[compra.historial.length - 1]!;
      expect(uso.autor).toEqual({ tipo: "usuario", usuarioId: suEvento.organizadorId });
      const inicio = suEvento.fechaHora.getTime();
      expect(uso.fechaHora.getTime()).toBeGreaterThanOrEqual(inicio - 4 * HORA);
      expect(uso.fechaHora.getTime()).toBeLessThanOrEqual(inicio + 12 * HORA);
      expect(compra.creadaEn.getTime()).toBeLessThan(inicio);
    });

    it("Jazz (Martín) tiene reseñas 5, 4 y 5; la Noche de risas (Sofía), 3 con comentario y 2 sin", () => {
      expect(jazz.organizadorId).toBe("usuario-martin");
      expect(risas.organizadorId).toBe("usuario-sofia");
      expect(resenias.map((r) => [r.id, r.compradorId, r.eventoId, r.puntuacion])).toEqual([
        ["resenia-lucia-jazz-en-el-patio", "usuario-lucia", jazz.id, 5],
        ["resenia-diego-jazz-en-el-patio", "usuario-diego", jazz.id, 4],
        ["resenia-valentina-jazz-en-el-patio", "usuario-valentina", jazz.id, 5],
        ["resenia-diego-noche-de-risas", "usuario-diego", risas.id, 3],
        ["resenia-valentina-noche-de-risas", "usuario-valentina", risas.id, 2],
        ...resenias.slice(5).map((r) => [r.id, r.compradorId, r.eventoId, r.puntuacion]),
      ]);
      expect(resenias.find((r) => r.id === "resenia-diego-noche-de-risas")?.comentario).not.toBeNull();
      expect(resenias.find((r) => r.id === "resenia-valentina-noche-de-risas")?.comentario).toBeNull();
      for (const resenia of resenias) expect(resenia).toBeInstanceOf(Resenia);
    });

    it("cada reseña cumple las reglas: compra UTILIZADA del autor, no organiza y una por autor y evento", () => {
      const pares = resenias.map((r) => `${r.compradorId}|${r.eventoId}`);
      expect(new Set(pares).size).toBe(pares.length);
      for (const resenia of resenias) {
        const evento = eventoPorId.get(resenia.eventoId)!;
        const suyas = compras.filter(
          (c) => c.eventoId === evento.id && c.compradorId === resenia.compradorId,
        );
        expect(() =>
          exigirQuePuedeReseniar({ usuarioId: resenia.compradorId, evento, compras: suyas }),
        ).not.toThrow();
      }
    });

    it("cada reseña es posterior al uso y anterior al arranque, con fechas distintas", () => {
      for (const resenia of resenias) {
        // resenia-<autor>-<evento> ↔ compra-<autor>-<evento>-general
        const compra = porId.get(`compra-${resenia.id.slice("resenia-".length)}-general`)!;
        const uso = compra.historial[compra.historial.length - 1]!.fechaHora;
        expect(resenia.creadaEn.getTime()).toBeGreaterThan(uso.getTime());
        expect(resenia.creadaEn.getTime()).toBeLessThan(ahora.getTime());
      }
      const fechas = resenias.map((r) => r.creadaEn.getTime());
      expect(new Set(fechas).size).toBe(fechas.length);
    });

    it("Lucía no tiene reseñas y la compra de Martín en la Peña sigue UTILIZADA, 1 de 3, sin reseña", () => {
      const deLucia = new Set(eventos.filter((e) => e.organizadorId === "usuario-lucia").map((e) => e.id));
      expect(resenias.filter((r) => deLucia.has(r.eventoId))).toEqual([]);
      const pena = porId.get("compra-martin-pena-general")!;
      expect(pena.estado).toBe(EstadoCompra.UTILIZADA);
      expect(pena.entradasUsadas).toBe(1);
      expect(resenias.some((r) => r.compradorId === "usuario-martin")).toBe(false);
    });

    describe("los dos realizados de Martín de la 013 (R11)", () => {
      const NUEVOS = ["evento-taller-de-escritura", "evento-tango-en-la-terraza"];
      const deMartin = new Set(eventos.filter((e) => e.organizadorId === "usuario-martin").map((e) => e.id));
      const suyas = resenias.filter((r) => deMartin.has(r.eventoId));

      it("son de Martín, realizados y fuera del catálogo, con 4 compras UTILIZADA cada uno", () => {
        for (const id of NUEVOS) {
          const evento = eventoPorId.get(id)!;
          expect(evento.organizadorId).toBe("usuario-martin");
          expect(evento.estaRealizado(ahora)).toBe(true);
          const delEvento = compras.filter((c) => c.eventoId === id);
          expect(delEvento).toHaveLength(4);
          for (const compra of delEvento) expect(compra.estado).toBe(EstadoCompra.UTILIZADA);
          expect(evento.tiposEntrada[0]!.cupo).toBe(id === NUEVOS[0] ? 30 - 4 : 100 - 4);
        }
      });

      it("Martín tiene 11 reseñas que suman 52 (≈ 4,7), algunas sin comentario", () => {
        expect(suyas).toHaveLength(11);
        expect(suyas.reduce((suma, r) => suma + r.puntuacion, 0)).toBe(52);
        const nuevas = suyas.filter((r) => NUEVOS.includes(r.eventoId));
        expect(nuevas.map((r) => r.puntuacion)).toEqual([5, 5, 5, 4, 5, 5, 4, 5]);
        expect(nuevas.some((r) => r.comentario === null)).toBe(true);
        expect(nuevas.some((r) => r.comentario !== null)).toBe(true);
      });

      it("las 8 nuevas son posteriores a las de Jazz (las 3 más recientes de Martín son de la 013)", () => {
        const deJazz = suyas.filter((r) => r.eventoId === jazz.id).map((r) => r.creadaEn.getTime());
        for (const resenia of suyas.filter((r) => NUEVOS.includes(r.eventoId))) {
          expect(resenia.creadaEn.getTime()).toBeGreaterThan(Math.max(...deJazz));
        }
      });
    });

    it("los cupos descuentan las entradas nuevas: Jazz 60 − 3 y Noche de risas 80 − 2", () => {
      expect(jazz.buscarTipoEntrada("tipo-jazz-en-el-patio-general")?.cupo).toBe(57);
      expect(risas.buscarTipoEntrada("tipo-noche-de-risas-general")?.cupo).toBe(78);
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
