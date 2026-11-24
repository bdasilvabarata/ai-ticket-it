import { EstadoCompra, LIMITES_COMPRA } from "@ai-ticket-it/shared";
import { Categoria, type DatosCategoria } from "../domain/categoria";
import { Compra, Entrada, Mensaje } from "../domain/compra";
import { Evento, TipoEntrada, type PropiedadesEvento, type PropiedadesTipoEntrada } from "../domain/evento";
import { horaDeBuenosAires, instanteDesdeHoraDeBuenosAires } from "../domain/hora-buenos-aires";
import { Resenia } from "../domain/resenia";
import { Usuario, type DatosUsuario } from "../domain/usuario";

export interface DatosEjemplo {
  categorias: Categoria[];
  usuarios: Usuario[];
  eventos: Evento[];
  compras: Compra[];
  resenias: Resenia[];
}

const HORA_MS = 60 * 60 * 1000;

/** "Entrada general" → "entrada-general", "Inscripción" → "inscripcion". */
function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Ids legibles y fijos de los datos de ejemplo: `<tipo>-<slug>` (constitución, principio IV).
const categoriaId = (nombre: string) => `categoria-${slug(nombre)}`;

/** Día de `ahora` en Buenos Aires + `dias`, a la `hora` local indicada. */
function fechaLocal(ahora: Date, dias: number, hora: number): Date {
  const [anio = NaN, mes = NaN, dia = NaN] = horaDeBuenosAires(ahora).slice(0, 10).split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
  return instanteDesdeHoraDeBuenosAires(`${fecha}T${String(hora).padStart(2, "0")}:00`);
}

const imagen = (slug: string) => `https://picsum.photos/seed/${slug}/800/450`;

type TipoSinId = Omit<PropiedadesTipoEntrada, "id">;
/** `slug` da el id del evento (`evento-<slug>`) y el de sus tipos (`tipo-<slug>-<tipo>`). */
type EventoSinIds = Omit<PropiedadesEvento, "id" | "tiposEntrada"> & {
  slug: string;
  tiposEntrada: TipoSinId[];
};

/**
 * Datos de ejemplo deterministas (data-model.md, "Datos de ejemplo"). Puro: sin IO.
 * Devuelve entidades de dominio: sus invariantes validan los propios datos de ejemplo.
 */
export function crearDatosEjemplo(ahora: Date): DatosEjemplo {
  const datosCategorias: DatosCategoria[] = [
    { id: categoriaId("Música"), nombre: "Música", descripcion: "Recitales, conciertos y shows en vivo." },
    { id: categoriaId("Teatro"), nombre: "Teatro", descripcion: "Obras de teatro, musicales y danza." },
    { id: categoriaId("Deportes"), nombre: "Deportes", descripcion: "Partidos, carreras y competencias." },
    {
      id: categoriaId("Conferencias"),
      nombre: "Conferencias",
      descripcion: "Charlas, congresos y talleres.",
    },
    { id: categoriaId("Festivales"), nombre: "Festivales", descripcion: "Festivales de uno o varios días." },
    { id: categoriaId("Stand-up"), nombre: "Stand-up", descripcion: "Comedia y monólogos en vivo." },
  ];

  // Favoritos de la feature 014 (R10): Diego cubre los dos grupos de la lista (dos próximos y la
  // Noche de risas, realizada), Sofía tiene uno propio (estrella en "Mis eventos") y Lucía y Martín,
  // ninguno (el vacío). Los ids son `evento-<slug>`, como los de `eventosSinIds`.
  const eventoId = (slugEvento: string) => `evento-${slugEvento}`;
  const datosUsuarios: DatosUsuario[] = [
    { id: "usuario-lucia", nombre: "Lucía", apellido: "Álvarez", favoritos: [] },
    { id: "usuario-martin", nombre: "Martín", apellido: "Benítez", favoritos: [] },
    {
      id: "usuario-sofia",
      nombre: "Sofía",
      apellido: "Castro",
      favoritos: [eventoId("clasico-de-basquet"), eventoId("maraton-10k")],
    },
    {
      id: "usuario-diego",
      nombre: "Diego",
      apellido: "Fernández",
      favoritos: [
        eventoId("festival-sonidos-del-sur"),
        eventoId("clasico-de-basquet"),
        eventoId("noche-de-risas"),
      ],
    },
    {
      id: "usuario-valentina",
      nombre: "Valentina",
      apellido: "Gómez",
      favoritos: [eventoId("noche-de-rock"), eventoId("jazz-en-el-patio")],
    },
  ];

  const lucia = "usuario-lucia";
  const martin = "usuario-martin";
  const sofia = "usuario-sofia";
  const diego = "usuario-diego";
  const valentina = "usuario-valentina";
  const proximo = new Date(Math.round((ahora.getTime() + 24 * HORA_MS) / HORA_MS) * HORA_MS);
  // La hora en punto más cercana a `ahora + 2 h` (feature 008, R12): su ventana de uso (4 h antes,
  // 12 h después) está abierta desde el arranque y durante al menos 12 horas, para la demo del ingreso.
  const enUnRato = new Date(Math.round((ahora.getTime() + 2 * HORA_MS) / HORA_MS) * HORA_MS);

  const eventosSinIds: EventoSinIds[] = [
    {
      slug: "noche-de-rock",
      nombre: "Noche de Rock en el Club",
      descripcion: "Tres bandas del under porteño en una sola noche.",
      categoriaId: categoriaId("Música"),
      fechaHora: proximo,
      multimedia: [imagen("noche-de-rock")],
      organizadorId: lucia,
      tiposEntrada: [{ nombre: "General", descripcion: "Acceso al campo.", precio: 15000, cupo: 200 }],
    },
    {
      slug: "hamlet",
      nombre: "Hamlet, versión contemporánea",
      descripcion: "El clásico de Shakespeare en una puesta actual.",
      categoriaId: categoriaId("Teatro"),
      fechaHora: fechaLocal(ahora, 10, 20),
      multimedia: [imagen("hamlet"), imagen("hamlet-escenario")],
      organizadorId: martin,
      tiposEntrada: [
        // Agotado (feature 005): muestra la marca "Agotado" en Explorar y en el detalle.
        { nombre: "Platea", descripcion: "Butacas de platea.", precio: 25000, cupo: 0 },
        { nombre: "Pullman", descripcion: "Butacas del primer piso.", precio: 18000, cupo: 0 },
      ],
    },
    {
      slug: "festival-sonidos-del-sur",
      nombre: "Festival Sonidos del Sur",
      descripcion: "Un día entero de música con artistas de todo el país.",
      categoriaId: categoriaId("Festivales"),
      fechaHora: fechaLocal(ahora, 30, 14),
      multimedia: [imagen("sonidos-del-sur"), imagen("sonidos-del-sur-escenario")],
      organizadorId: lucia,
      tiposEntrada: [
        // 500 − las 4 General confirmadas de la 013 (R11).
        { nombre: "General", descripcion: "Acceso al predio.", precio: 45000, cupo: 496 },
        { nombre: "VIP", descripcion: "Sector preferencial con barra.", precio: 120000, cupo: 50 },
        {
          nombre: "Backstage",
          descripcion: "Encuentro con los artistas.",
          precio: 250000,
          cupo: 3,
        },
      ],
    },
    {
      slug: "clasico-de-basquet",
      nombre: "Clásico de básquet",
      descripcion: "El partido más esperado de la liga.",
      categoriaId: categoriaId("Deportes"),
      fechaHora: fechaLocal(ahora, 5, 19),
      multimedia: [imagen("clasico-basquet")],
      organizadorId: sofia,
      tiposEntrada: [
        { nombre: "Popular", descripcion: "Tribuna popular.", precio: 8000, cupo: 300 },
        { nombre: "Platea", descripcion: "Platea numerada.", precio: 20000, cupo: 100 },
      ],
    },
    {
      slug: "charla-ia-aplicada",
      nombre: "Charla abierta: IA aplicada",
      descripcion: "Casos reales de inteligencia artificial en la industria.",
      categoriaId: categoriaId("Conferencias"),
      fechaHora: fechaLocal(ahora, 15, 9),
      multimedia: [imagen("charla-ia")],
      organizadorId: martin,
      tiposEntrada: [
        { nombre: "Entrada general", descripcion: "Acceso a la charla.", precio: 2000, cupo: 150 },
      ],
    },
    {
      slug: "noche-de-risas",
      nombre: "Stand-up: Noche de risas",
      descripcion: "Cuatro comediantes, una noche.",
      categoriaId: categoriaId("Stand-up"),
      fechaHora: fechaLocal(ahora, -3, 22),
      multimedia: [imagen("noche-de-risas")],
      organizadorId: sofia,
      // El cupo ya descuenta las 2 compras utilizadas de abajo (feature 012): 80 − 2.
      tiposEntrada: [{ nombre: "General", descripcion: "Ubicación libre.", precio: 12000, cupo: 78 }],
    },
    {
      slug: "jazz-en-el-patio",
      nombre: "Jazz en el Patio",
      descripcion: "Un cuarteto de jazz al aire libre.",
      categoriaId: categoriaId("Música"),
      fechaHora: fechaLocal(ahora, -10, 21),
      multimedia: [imagen("jazz-patio")],
      organizadorId: martin,
      // El cupo ya descuenta las 3 compras utilizadas de abajo (feature 012): 60 − 3.
      tiposEntrada: [{ nombre: "General", descripcion: "Ubicación libre.", precio: 10000, cupo: 57 }],
    },
    // Feature 013 (R11): dos realizados más de Martín, cada uno con 4 compras utilizadas y su reseña
    // (abajo), para que "Ver todas las reseñas" tenga 2 páginas (11 reseñas: 10 + 1).
    {
      slug: "taller-de-escritura",
      nombre: "Taller de escritura creativa",
      descripcion: "Una tarde de consignas, lecturas y devoluciones.",
      categoriaId: categoriaId("Conferencias"),
      fechaHora: fechaLocal(ahora, -5, 18),
      multimedia: [imagen("taller-escritura")],
      organizadorId: martin,
      // El cupo ya descuenta las 4 compras utilizadas de abajo: 30 − 4.
      tiposEntrada: [{ nombre: "General", descripcion: "Materiales incluidos.", precio: 7000, cupo: 26 }],
    },
    {
      slug: "tango-en-la-terraza",
      nombre: "Tango en la terraza",
      descripcion: "Orquesta típica y milonga al atardecer.",
      categoriaId: categoriaId("Música"),
      fechaHora: fechaLocal(ahora, -2, 19),
      multimedia: [imagen("tango-terraza")],
      organizadorId: martin,
      // El cupo ya descuenta las 4 compras utilizadas de abajo: 100 − 4.
      tiposEntrada: [{ nombre: "General", descripcion: "Ubicación libre.", precio: 9000, cupo: 96 }],
    },
    {
      slug: "maraton-10k",
      nombre: "Maratón Ciudad 10K",
      descripcion: "Carrera de 10 km por las calles de la ciudad.",
      categoriaId: categoriaId("Deportes"),
      fechaHora: fechaLocal(ahora, 45, 8),
      multimedia: [imagen("maraton-10k"), imagen("maraton-10k-llegada")],
      organizadorId: lucia,
      tiposEntrada: [
        { nombre: "Inscripción", descripcion: "Kit del corredor incluido.", precio: 30000, cupo: 1000 },
        // Gratis (feature 005): su precio "desde" es "Gratis" y va primero al ordenar por precio.
        { nombre: "Carrera kids", descripcion: "Circuito de 2 km para menores de 12.", precio: 0, cupo: 200 },
      ],
    },
    {
      slug: "pena-en-la-rueda",
      nombre: "Peña en La Rueda",
      descripcion: "Folklore en vivo, con baile y cena criolla.",
      categoriaId: categoriaId("Música"),
      fechaHora: enUnRato,
      multimedia: [imagen("pena-la-rueda")],
      organizadorId: lucia,
      // Los cupos ya descuentan las compras vigentes de abajo: General 120 − 3, Con cena 40 − 2.
      tiposEntrada: [
        { nombre: "General", descripcion: "Acceso al salón.", precio: 6000, cupo: 117 },
        { nombre: "Con cena", descripcion: "Mesa con cena criolla incluida.", precio: 15000, cupo: 38 },
      ],
    },
    // Feature 013 (R11): cinco próximos más, de organizadores y categorías variados y sin compras,
    // para que Explorar tenga 12 próximos sin filtros (2 páginas: 10 + 2).
    {
      slug: "feria-del-libro-independiente",
      nombre: "Feria del libro independiente",
      descripcion: "Editoriales chicas, lecturas y firmas de autores.",
      categoriaId: categoriaId("Conferencias"),
      fechaHora: fechaLocal(ahora, 3, 17),
      multimedia: [imagen("feria-del-libro")],
      organizadorId: martin,
      tiposEntrada: [{ nombre: "General", descripcion: "Acceso a la feria.", precio: 3000, cupo: 400 }],
    },
    {
      slug: "match-de-impro",
      nombre: "Match de improvisación teatral",
      descripcion: "Dos equipos improvisan escenas con las propuestas del público.",
      categoriaId: categoriaId("Teatro"),
      fechaHora: fechaLocal(ahora, 8, 21),
      multimedia: [imagen("match-de-impro")],
      organizadorId: sofia,
      tiposEntrada: [{ nombre: "General", descripcion: "Ubicación libre.", precio: 9000, cupo: 120 }],
    },
    {
      slug: "torneo-de-futbol-5",
      nombre: "Torneo de fútbol 5",
      descripcion: "Un día de partidos entre equipos del barrio.",
      categoriaId: categoriaId("Deportes"),
      fechaHora: fechaLocal(ahora, 12, 10),
      multimedia: [imagen("torneo-futbol-5")],
      organizadorId: sofia,
      tiposEntrada: [
        { nombre: "Equipo", descripcion: "Inscripción de un equipo de 5.", precio: 40000, cupo: 16 },
      ],
    },
    {
      slug: "microfono-abierto",
      nombre: "Stand-up: Micrófono abierto",
      descripcion: "Comediantes nuevos prueban su material.",
      categoriaId: categoriaId("Stand-up"),
      fechaHora: fechaLocal(ahora, 20, 22),
      multimedia: [imagen("microfono-abierto")],
      organizadorId: martin,
      tiposEntrada: [{ nombre: "General", descripcion: "Ubicación libre.", precio: 5000, cupo: 60 }],
    },
    {
      slug: "feria-de-cerveza-artesanal",
      nombre: "Feria de cerveza artesanal",
      descripcion: "Cervecerías de todo el país, música y comida.",
      categoriaId: categoriaId("Festivales"),
      fechaHora: fechaLocal(ahora, 25, 16),
      multimedia: [imagen("cerveza-artesanal")],
      organizadorId: lucia,
      tiposEntrada: [
        { nombre: "General", descripcion: "Acceso al predio.", precio: 10000, cupo: 800 },
        { nombre: "Degustación", descripcion: "Vaso y cinco degustaciones.", precio: 22000, cupo: 150 },
      ],
    },
  ];

  const eventos = eventosSinIds.map(
    ({ slug: slugEvento, ...evento }) =>
      new Evento({
        ...evento,
        id: `evento-${slugEvento}`,
        tiposEntrada: evento.tiposEntrada.map(
          (tipo) => new TipoEntrada({ id: `tipo-${slugEvento}-${slug(tipo.nombre)}`, ...tipo }),
        ),
      }),
  );

  // Compras sobre el Festival (de Lucía y próximo) para mostrar las reglas de la 004 (R17): el
  // evento no se elimina y VIP y General no se quitan (la cancelada también cuenta); Backstage, sí.
  // Con historial coherente (006, R10): una pagada por Martín (le quedan 2 entradas pagas) y una que
  // venció sin pagarse (CANCELADA por el sistema; no devuelve cupo de nuevo). Ninguna PENDIENTE: la
  // demo no depende de la hora de arranque.
  const festival = "festival-sonidos-del-sur";
  const porMartin = { tipo: "usuario", usuarioId: martin } as const;
  const masMinutos = (fecha: Date, minutos: number) => new Date(fecha.getTime() + minutos * 60 * 1000);
  const haceMartin = new Date(ahora.getTime() - 2 * 24 * HORA_MS);
  const haceDiego = new Date(ahora.getTime() - 24 * HORA_MS);
  const compras = [
    new Compra({
      id: "compra-martin-festival-vip",
      compradorId: martin,
      eventoId: `evento-${festival}`,
      tipoEntradaId: `tipo-${festival}-vip`,
      cantidad: 2,
      total: 240000,
      historial: [
        { estado: EstadoCompra.PENDIENTE, autor: porMartin, fechaHora: haceMartin },
        { estado: EstadoCompra.CONFIRMADA, autor: porMartin, fechaHora: masMinutos(haceMartin, 5) },
      ],
      entradas: [new Entrada({ codigo: "FSVP7M01" }), new Entrada({ codigo: "FSVP7M02" })],
      // El chat de la compra (feature 011, R8): Martín pregunta y Lucía responde, todo antes del
      // arranque, así la conversación es la misma en cada arranque.
      mensajes: [
        new Mensaje({
          autorId: martin,
          texto: "Hola, ¿la entrada VIP incluye estacionamiento?",
          enviadoEn: masMinutos(haceMartin, 10),
        }),
        new Mensaje({
          autorId: lucia,
          texto:
            "¡Hola, Martín! Sí: con la entrada VIP tenés lugar en el estacionamiento del predio. Mostrá tu código en la barrera.",
          enviadoEn: masMinutos(haceMartin, 2 * 60),
        }),
        new Mensaje({
          autorId: martin,
          texto: "¡Genial, gracias!",
          enviadoEn: masMinutos(haceMartin, 3 * 60),
        }),
      ],
    }),
    new Compra({
      id: "compra-diego-festival-general",
      compradorId: diego,
      eventoId: `evento-${festival}`,
      tipoEntradaId: `tipo-${festival}-general`,
      cantidad: 1,
      total: 45000,
      historial: [
        {
          estado: EstadoCompra.PENDIENTE,
          autor: { tipo: "usuario", usuarioId: diego },
          fechaHora: haceDiego,
        },
        {
          estado: EstadoCompra.CANCELADA,
          autor: { tipo: "sistema" },
          fechaHora: masMinutos(haceDiego, LIMITES_COMPRA.minutosParaPagar),
        },
      ],
      entradas: [new Entrada({ codigo: "FSGD1E60" })],
    }),
  ];

  // Feature 013 (R11): diez compras más de una General en el Festival, para que "Compras del evento"
  // tenga 12 (2 páginas: 10 + 2). Confirmadas y canceladas (vencidas por el sistema o canceladas
  // después de pagar, con el reembolso pendiente), ninguna PENDIENTE. Las confirmadas son de
  // Valentina (3) y Diego (1): nadie pasa el tope y Sofía y Martín, que compran en las demos y en los
  // tests, conservan sus entradas disponibles. La de Valentina más vieja (en la página 2) termina en
  // un mensaje suyo sin responder. General descuenta las 4 confirmadas (500 − 4).
  type FinalDeLaCompra = "confirmada" | "vencida" | "cancelada-despues-de-pagar";
  const masDelFestival: [compradorId: string, horasAtras: number, final: FinalDeLaCompra][] = [
    [valentina, 3, "confirmada"],
    [diego, 6, "confirmada"],
    [sofia, 10, "vencida"],
    [valentina, 20, "confirmada"],
    [martin, 30, "vencida"],
    [diego, 36, "cancelada-despues-de-pagar"],
    [valentina, 40, "confirmada"],
    [sofia, 44, "cancelada-despues-de-pagar"],
    [martin, 60, "cancelada-despues-de-pagar"],
    [valentina, 120, "cancelada-despues-de-pagar"],
  ];
  masDelFestival.forEach(([compradorId, horasAtras, final], indice) => {
    const numero = indice + 1;
    const alta = new Date(ahora.getTime() - horasAtras * HORA_MS);
    const porComprador = { tipo: "usuario", usuarioId: compradorId } as const;
    const pendiente = { estado: EstadoCompra.PENDIENTE, autor: porComprador, fechaHora: alta };
    const confirmacion = {
      estado: EstadoCompra.CONFIRMADA,
      autor: porComprador,
      fechaHora: masMinutos(alta, 5),
    };
    const cancelacion = { usuarioId: compradorId, fechaHora: masMinutos(alta, 2 * 60) };
    const historial =
      final === "confirmada"
        ? [pendiente, confirmacion]
        : final === "vencida"
          ? [
              pendiente,
              {
                estado: EstadoCompra.CANCELADA,
                autor: { tipo: "sistema" } as const,
                fechaHora: masMinutos(alta, LIMITES_COMPRA.minutosParaPagar),
              },
            ]
          : [
              pendiente,
              confirmacion,
              { estado: EstadoCompra.CANCELADA, autor: porComprador, fechaHora: cancelacion.fechaHora },
            ];
    const codigo = `FSGN${String(numero).padStart(4, "0")}`;
    compras.push(
      new Compra({
        id: `compra-${compradorId.replace("usuario-", "")}-festival-${numero}`,
        compradorId,
        eventoId: `evento-${festival}`,
        tipoEntradaId: `tipo-${festival}-general`,
        cantidad: 1,
        total: 45000,
        historial,
        entradas: [
          new Entrada({
            codigo,
            cancelacion: final === "cancelada-despues-de-pagar" ? cancelacion : null,
          }),
        ],
        mensajes:
          numero === masDelFestival.length
            ? [
                new Mensaje({
                  autorId: compradorId,
                  texto: "Hola, cancelé mi entrada. ¿Cuándo me devuelven el dinero?",
                  enviadoEn: masMinutos(alta, 24 * 60),
                }),
              ]
            : [],
      }),
    );
  });

  // Compras sobre la Peña (feature 008, R12), con la ventana de uso abierta: Martín, 3 General
  // pagadas con 1 entrada ya usada (la compra UTILIZADA, "1 de 3"); Sofía, 2 Con cena pagadas sin
  // usar (sus códigos son los de la demo y de Postman).
  const pena = "pena-en-la-rueda";
  const porLucia = { tipo: "usuario", usuarioId: lucia } as const;
  const porSofia = { tipo: "usuario", usuarioId: sofia } as const;
  const usoDeMartin = {
    estado: EstadoCompra.UTILIZADA,
    autor: porLucia,
    fechaHora: new Date(ahora.getTime() - HORA_MS / 2),
  };
  const usoPorLucia = { usuarioId: lucia, fechaHora: usoDeMartin.fechaHora };
  const haceSofia = new Date(ahora.getTime() - 3 * HORA_MS);
  compras.push(
    new Compra({
      id: "compra-martin-pena-general",
      compradorId: martin,
      eventoId: `evento-${pena}`,
      tipoEntradaId: `tipo-${pena}-general`,
      cantidad: 3,
      total: 18000,
      historial: [
        { estado: EstadoCompra.PENDIENTE, autor: porMartin, fechaHora: haceMartin },
        { estado: EstadoCompra.CONFIRMADA, autor: porMartin, fechaHora: masMinutos(haceMartin, 5) },
        usoDeMartin,
      ],
      entradas: [
        new Entrada({ codigo: "PRGM3A01", uso: usoPorLucia }),
        new Entrada({ codigo: "PRGM3A02" }),
        new Entrada({ codigo: "PRGM3A03" }),
      ],
    }),
    new Compra({
      id: "compra-sofia-pena-con-cena",
      compradorId: sofia,
      eventoId: `evento-${pena}`,
      tipoEntradaId: `tipo-${pena}-con-cena`,
      cantidad: 2,
      total: 30000,
      historial: [
        { estado: EstadoCompra.PENDIENTE, autor: porSofia, fechaHora: haceSofia },
        { estado: EstadoCompra.CONFIRMADA, autor: porSofia, fechaHora: masMinutos(haceSofia, 5) },
      ],
      entradas: [new Entrada({ codigo: "PRCS2B01" }), new Entrada({ codigo: "PRCS2B02" })],
    }),
  );

  // Compras canceladas sobre el Maratón (feature 009, R11), de Lucía y lejano: Diego canceló la suya
  // después de pagarla y espera el reembolso; la de Valentina ya está reembolsada. Las dos liberaron
  // su cupo al cancelarse, así que Inscripción sigue en 1000.
  const maraton = "maraton-10k";
  const porDiego = { tipo: "usuario", usuarioId: diego } as const;
  const porValentina = { tipo: "usuario", usuarioId: valentina } as const;
  const dias = (cantidad: number) => new Date(ahora.getTime() - cantidad * 24 * HORA_MS);
  const cancelacionDeDiego = { estado: EstadoCompra.CANCELADA, autor: porDiego, fechaHora: dias(1) };
  const cancelacionDeValentina = {
    estado: EstadoCompra.CANCELADA,
    autor: porValentina,
    fechaHora: dias(2),
  };
  const porValentinaHaceDosDias = { usuarioId: valentina, fechaHora: dias(2) };
  compras.push(
    new Compra({
      id: "compra-diego-maraton-inscripcion",
      compradorId: diego,
      eventoId: `evento-${maraton}`,
      tipoEntradaId: `tipo-${maraton}-inscripcion`,
      cantidad: 1,
      total: 30000,
      historial: [
        { estado: EstadoCompra.PENDIENTE, autor: porDiego, fechaHora: dias(3) },
        { estado: EstadoCompra.CONFIRMADA, autor: porDiego, fechaHora: masMinutos(dias(3), 5) },
        cancelacionDeDiego,
      ],
      entradas: [new Entrada({ codigo: "MZDF1C01", cancelacion: { usuarioId: diego, fechaHora: dias(1) } })],
    }),
    new Compra({
      id: "compra-valentina-maraton-inscripcion",
      compradorId: valentina,
      eventoId: `evento-${maraton}`,
      tipoEntradaId: `tipo-${maraton}-inscripcion`,
      cantidad: 2,
      total: 60000,
      historial: [
        { estado: EstadoCompra.PENDIENTE, autor: porValentina, fechaHora: dias(4) },
        { estado: EstadoCompra.CONFIRMADA, autor: porValentina, fechaHora: masMinutos(dias(4), 5) },
        cancelacionDeValentina,
        { estado: EstadoCompra.REEMBOLSADA, autor: porLucia, fechaHora: dias(1) },
      ],
      entradas: [
        new Entrada({ codigo: "MZVG2R01", cancelacion: porValentinaHaceDosDias }),
        new Entrada({ codigo: "MZVG2R02", cancelacion: porValentinaHaceDosDias }),
      ],
    }),
  );

  // Reseñas (feature 012, R10): compras UTILIZADA de una entrada en dos eventos ya realizados, cada
  // una con su reseña posterior al uso. Sofía (Noche de risas) queda en 2,5 con 2; Lucía, sin
  // reseñas. La de Martín en la Peña sigue sin reseña (la demo). Desde la 013 (R11), Martín suma al
  // Taller de escritura y al Tango (posteriores a las de Jazz): 11 reseñas, 52 / 11 ≈ 4,7.
  const eventoPorId = new Map(eventos.map((evento) => [evento.id, evento]));
  const resenias: Resenia[] = [];
  const asistencias: {
    slugEvento: string;
    autor: string;
    codigo: string;
    /** Minutos desde el inicio del evento hasta el uso (dentro de la ventana). */
    usoMinutos: number;
    /** Horas desde el inicio del evento hasta la reseña. */
    reseniaHoras: number;
    puntuacion: number;
    comentario: string | null;
  }[] = [
    {
      slugEvento: "jazz-en-el-patio",
      autor: "lucia",
      codigo: "JZPT1A01",
      usoMinutos: -30,
      reseniaHoras: 14,
      puntuacion: 5,
      comentario: "Una noche hermosa: el cuarteto sonó impecable y el patio estaba lindísimo.",
    },
    {
      slugEvento: "jazz-en-el-patio",
      autor: "diego",
      codigo: "JZPT1D01",
      usoMinutos: -20,
      reseniaHoras: 2 * 24,
      puntuacion: 4,
      comentario: "Muy buena música. Hizo un poco de frío, pero valió la pena.",
    },
    {
      slugEvento: "jazz-en-el-patio",
      autor: "valentina",
      codigo: "JZPT1V01",
      usoMinutos: -10,
      reseniaHoras: 5 * 24,
      puntuacion: 5,
      comentario: "Excelente organización, entramos rapidísimo.",
    },
    {
      slugEvento: "noche-de-risas",
      autor: "diego",
      codigo: "NDRS1D01",
      usoMinutos: -25,
      reseniaHoras: 20,
      puntuacion: 3,
      comentario: "Algunos comediantes muy buenos, otros no tanto. Arrancó tarde.",
    },
    {
      slugEvento: "noche-de-risas",
      autor: "valentina",
      codigo: "NDRS1V01",
      usoMinutos: -15,
      reseniaHoras: 2 * 24,
      puntuacion: 2,
      comentario: null,
    },
    {
      slugEvento: "taller-de-escritura",
      autor: "lucia",
      codigo: "TXSC1A01",
      usoMinutos: -30,
      reseniaHoras: 6,
      puntuacion: 5,
      comentario: "Consignas muy disparadoras y un grupo hermoso.",
    },
    {
      slugEvento: "taller-de-escritura",
      autor: "sofia",
      codigo: "TXSC1S01",
      usoMinutos: -25,
      reseniaHoras: 20,
      puntuacion: 5,
      comentario: null,
    },
    {
      slugEvento: "taller-de-escritura",
      autor: "diego",
      codigo: "TXSC1D01",
      usoMinutos: -20,
      reseniaHoras: 30,
      puntuacion: 5,
      comentario: "Salí con tres cuentos empezados.",
    },
    {
      slugEvento: "taller-de-escritura",
      autor: "valentina",
      codigo: "TXSC1V01",
      usoMinutos: -10,
      reseniaHoras: 48,
      puntuacion: 4,
      comentario: "Muy bueno, aunque se hizo corto.",
    },
    {
      slugEvento: "tango-en-la-terraza",
      autor: "lucia",
      codigo: "TNGT1A01",
      usoMinutos: -40,
      reseniaHoras: 3,
      puntuacion: 5,
      comentario: "La orquesta, la terraza y el atardecer: todo perfecto.",
    },
    {
      slugEvento: "tango-en-la-terraza",
      autor: "sofia",
      codigo: "TNGT1S01",
      usoMinutos: -30,
      reseniaHoras: 8,
      puntuacion: 5,
      comentario: null,
    },
    {
      slugEvento: "tango-en-la-terraza",
      autor: "diego",
      codigo: "TNGT1D01",
      usoMinutos: -20,
      reseniaHoras: 14,
      puntuacion: 4,
      comentario: null,
    },
    {
      slugEvento: "tango-en-la-terraza",
      autor: "valentina",
      codigo: "TNGT1V01",
      usoMinutos: -15,
      reseniaHoras: 22,
      puntuacion: 5,
      comentario: "Ya quiero que repitan la milonga.",
    },
  ];
  for (const asistencia of asistencias) {
    const evento = eventoPorId.get(`evento-${asistencia.slugEvento}`);
    const tipo = evento?.tiposEntrada[0];
    if (evento === undefined || tipo === undefined) {
      throw new Error(`Seed inconsistente: falta el evento ${asistencia.slugEvento} o su tipo`);
    }
    const comprador = `usuario-${asistencia.autor}`;
    const porComprador = { tipo: "usuario", usuarioId: comprador } as const;
    const alta = new Date(evento.fechaHora.getTime() - 5 * 24 * HORA_MS);
    const uso = masMinutos(evento.fechaHora, asistencia.usoMinutos);
    compras.push(
      new Compra({
        id: `compra-${asistencia.autor}-${asistencia.slugEvento}-general`,
        compradorId: comprador,
        eventoId: evento.id,
        tipoEntradaId: tipo.id,
        cantidad: 1,
        total: tipo.precio,
        historial: [
          { estado: EstadoCompra.PENDIENTE, autor: porComprador, fechaHora: alta },
          { estado: EstadoCompra.CONFIRMADA, autor: porComprador, fechaHora: masMinutos(alta, 5) },
          {
            estado: EstadoCompra.UTILIZADA,
            autor: { tipo: "usuario", usuarioId: evento.organizadorId },
            fechaHora: uso,
          },
        ],
        entradas: [
          new Entrada({
            codigo: asistencia.codigo,
            uso: { usuarioId: evento.organizadorId, fechaHora: uso },
          }),
        ],
      }),
    );
    resenias.push(
      new Resenia({
        id: `resenia-${asistencia.autor}-${asistencia.slugEvento}`,
        compradorId: comprador,
        eventoId: evento.id,
        puntuacion: asistencia.puntuacion,
        comentario: asistencia.comentario,
        creadaEn: new Date(evento.fechaHora.getTime() + asistencia.reseniaHoras * HORA_MS),
      }),
    );
  }

  return {
    categorias: datosCategorias.map((datos) => new Categoria(datos)),
    usuarios: datosUsuarios.map((datos) => new Usuario(datos)),
    eventos,
    compras,
    resenias,
  };
}
