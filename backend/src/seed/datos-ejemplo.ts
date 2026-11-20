import { EstadoCompra, LIMITES_COMPRA } from "@ai-ticket-it/shared";
import { Categoria, type DatosCategoria } from "../domain/categoria";
import { Compra, Entrada } from "../domain/compra";
import { Evento, TipoEntrada, type PropiedadesEvento, type PropiedadesTipoEntrada } from "../domain/evento";
import { horaDeBuenosAires, instanteDesdeHoraDeBuenosAires } from "../domain/hora-buenos-aires";
import { Usuario, type DatosUsuario } from "../domain/usuario";

export interface DatosEjemplo {
  categorias: Categoria[];
  usuarios: Usuario[];
  eventos: Evento[];
  compras: Compra[];
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

  const datosUsuarios: DatosUsuario[] = [
    { id: "usuario-lucia", nombre: "Lucía", apellido: "Álvarez", favoritos: [] },
    { id: "usuario-martin", nombre: "Martín", apellido: "Benítez", favoritos: [] },
    { id: "usuario-sofia", nombre: "Sofía", apellido: "Castro", favoritos: [] },
    { id: "usuario-diego", nombre: "Diego", apellido: "Fernández", favoritos: [] },
    { id: "usuario-valentina", nombre: "Valentina", apellido: "Gómez", favoritos: [] },
  ];

  const lucia = "usuario-lucia";
  const martin = "usuario-martin";
  const sofia = "usuario-sofia";
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
        { nombre: "General", descripcion: "Acceso al predio.", precio: 45000, cupo: 500 },
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
      tiposEntrada: [{ nombre: "General", descripcion: "Ubicación libre.", precio: 12000, cupo: 80 }],
    },
    {
      slug: "jazz-en-el-patio",
      nombre: "Jazz en el Patio",
      descripcion: "Un cuarteto de jazz al aire libre.",
      categoriaId: categoriaId("Música"),
      fechaHora: fechaLocal(ahora, -10, 21),
      multimedia: [imagen("jazz-patio")],
      organizadorId: martin,
      tiposEntrada: [{ nombre: "General", descripcion: "Ubicación libre.", precio: 10000, cupo: 60 }],
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
  const diego = "usuario-diego";
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
        new Entrada({ codigo: "PRGM3A01", cambios: [usoDeMartin] }),
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
  const valentina = "usuario-valentina";
  const porDiego = { tipo: "usuario", usuarioId: diego } as const;
  const porValentina = { tipo: "usuario", usuarioId: valentina } as const;
  const dias = (cantidad: number) => new Date(ahora.getTime() - cantidad * 24 * HORA_MS);
  const cancelacionDeDiego = { estado: EstadoCompra.CANCELADA, autor: porDiego, fechaHora: dias(1) };
  const cancelacionDeValentina = {
    estado: EstadoCompra.CANCELADA,
    autor: porValentina,
    fechaHora: dias(2),
  };
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
      entradas: [new Entrada({ codigo: "MZDF1C01", cambios: [cancelacionDeDiego] })],
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
        new Entrada({ codigo: "MZVG2R01", cambios: [cancelacionDeValentina] }),
        new Entrada({ codigo: "MZVG2R02", cambios: [cancelacionDeValentina] }),
      ],
    }),
  );

  return {
    categorias: datosCategorias.map((datos) => new Categoria(datos)),
    usuarios: datosUsuarios.map((datos) => new Usuario(datos)),
    eventos,
    compras,
  };
}
