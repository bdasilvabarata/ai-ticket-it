import { Categoria, type DatosCategoria } from "../domain/categoria";
import { Evento, TipoEntrada, type DatosEvento, type DatosTipoEntrada } from "../domain/evento";
import { Usuario, type DatosUsuario } from "../domain/usuario";

export interface DatosEjemplo {
  categorias: Categoria[];
  usuarios: Usuario[];
  eventos: Evento[];
}

const HORA_MS = 60 * 60 * 1000;
const ZONA = "America/Argentina/Buenos_Aires";
/** Argentina es UTC−3 todo el año (sin horario de verano). */
const DESFASE_UTC_HORAS = 3;

/** Id fijo de 24 hex: 18 ceros + 4 dígitos de tipo + 2 de número. */
function idFijo(tipo: string, numero: number): string {
  return `${"0".repeat(18)}${tipo}${String(numero).padStart(2, "0")}`;
}

const usuarioId = (n: number) => idFijo("0001", n);
const categoriaId = (n: number) => idFijo("0002", n);
const eventoId = (n: number) => idFijo("0003", n);

function diaEnBuenosAires(ahora: Date): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(ahora);
  const valor = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value);
  return { anio: valor("year"), mes: valor("month"), dia: valor("day") };
}

/** Día de `ahora` en Buenos Aires + `dias`, a la `hora` local indicada. */
function fechaLocal(ahora: Date, dias: number, hora: number): Date {
  const { anio, mes, dia } = diaEnBuenosAires(ahora);
  return new Date(Date.UTC(anio, mes - 1, dia + dias, hora + DESFASE_UTC_HORAS));
}

const imagen = (slug: string) => `https://picsum.photos/seed/${slug}/800/450`;

type TipoSinId = Omit<DatosTipoEntrada, "id">;
type EventoSinIds = Omit<DatosEvento, "id" | "tiposEntrada"> & { tiposEntrada: TipoSinId[] };

/**
 * Datos de ejemplo deterministas (data-model.md, "Datos de ejemplo"). Puro: sin IO.
 * Devuelve entidades de dominio: sus invariantes validan los propios datos de ejemplo.
 */
export function crearDatosEjemplo(ahora: Date): DatosEjemplo {
  const datosCategorias: DatosCategoria[] = [
    { id: categoriaId(1), nombre: "Música", descripcion: "Recitales, conciertos y shows en vivo." },
    { id: categoriaId(2), nombre: "Teatro", descripcion: "Obras de teatro, musicales y danza." },
    { id: categoriaId(3), nombre: "Deportes", descripcion: "Partidos, carreras y competencias." },
    { id: categoriaId(4), nombre: "Conferencias", descripcion: "Charlas, congresos y talleres." },
    { id: categoriaId(5), nombre: "Festivales", descripcion: "Festivales de uno o varios días." },
    { id: categoriaId(6), nombre: "Stand-up", descripcion: "Comedia y monólogos en vivo." },
  ];

  const datosUsuarios: DatosUsuario[] = [
    { id: usuarioId(1), nombre: "Lucía", apellido: "Álvarez", favoritos: [] },
    { id: usuarioId(2), nombre: "Martín", apellido: "Benítez", favoritos: [] },
    { id: usuarioId(3), nombre: "Sofía", apellido: "Castro", favoritos: [] },
    { id: usuarioId(4), nombre: "Diego", apellido: "Fernández", favoritos: [] },
    { id: usuarioId(5), nombre: "Valentina", apellido: "Gómez", favoritos: [] },
  ];

  const lucia = usuarioId(1);
  const martin = usuarioId(2);
  const sofia = usuarioId(3);
  const proximo = new Date(Math.round((ahora.getTime() + 24 * HORA_MS) / HORA_MS) * HORA_MS);

  const eventosSinIds: EventoSinIds[] = [
    {
      nombre: "Noche de Rock en el Club",
      descripcion: "Tres bandas del under porteño en una sola noche.",
      categoriaId: categoriaId(1),
      fechaHora: proximo,
      multimedia: [imagen("noche-de-rock")],
      organizadorId: lucia,
      tiposEntrada: [{ nombre: "General", descripcion: "Acceso al campo.", precio: 15000, cupo: 200 }],
    },
    {
      nombre: "Hamlet, versión contemporánea",
      descripcion: "El clásico de Shakespeare en una puesta actual.",
      categoriaId: categoriaId(2),
      fechaHora: fechaLocal(ahora, 10, 20),
      multimedia: [imagen("hamlet"), imagen("hamlet-escenario")],
      organizadorId: martin,
      tiposEntrada: [
        { nombre: "Platea", descripcion: "Butacas de platea.", precio: 25000, cupo: 120 },
        { nombre: "Pullman", descripcion: "Butacas del primer piso.", precio: 18000, cupo: 80 },
      ],
    },
    {
      nombre: "Festival Sonidos del Sur",
      descripcion: "Un día entero de música con artistas de todo el país.",
      categoriaId: categoriaId(5),
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
      nombre: "Clásico de básquet",
      descripcion: "El partido más esperado de la liga.",
      categoriaId: categoriaId(3),
      fechaHora: fechaLocal(ahora, 5, 19),
      multimedia: [imagen("clasico-basquet")],
      organizadorId: sofia,
      tiposEntrada: [
        { nombre: "Popular", descripcion: "Tribuna popular.", precio: 8000, cupo: 300 },
        { nombre: "Platea", descripcion: "Platea numerada.", precio: 20000, cupo: 100 },
      ],
    },
    {
      nombre: "Charla abierta: IA aplicada",
      descripcion: "Casos reales de inteligencia artificial en la industria.",
      categoriaId: categoriaId(4),
      fechaHora: fechaLocal(ahora, 15, 9),
      multimedia: [imagen("charla-ia")],
      organizadorId: martin,
      tiposEntrada: [
        { nombre: "Entrada general", descripcion: "Acceso a la charla.", precio: 2000, cupo: 150 },
      ],
    },
    {
      nombre: "Stand-up: Noche de risas",
      descripcion: "Cuatro comediantes, una noche.",
      categoriaId: categoriaId(6),
      fechaHora: fechaLocal(ahora, -3, 22),
      multimedia: [imagen("noche-de-risas")],
      organizadorId: sofia,
      tiposEntrada: [{ nombre: "General", descripcion: "Ubicación libre.", precio: 12000, cupo: 80 }],
    },
    {
      nombre: "Jazz en el Patio",
      descripcion: "Un cuarteto de jazz al aire libre.",
      categoriaId: categoriaId(1),
      fechaHora: fechaLocal(ahora, -10, 21),
      multimedia: [imagen("jazz-patio")],
      organizadorId: martin,
      tiposEntrada: [{ nombre: "General", descripcion: "Ubicación libre.", precio: 10000, cupo: 60 }],
    },
    {
      nombre: "Maratón Ciudad 10K",
      descripcion: "Carrera de 10 km por las calles de la ciudad.",
      categoriaId: categoriaId(3),
      fechaHora: fechaLocal(ahora, 45, 8),
      multimedia: [imagen("maraton-10k"), imagen("maraton-10k-llegada")],
      organizadorId: lucia,
      tiposEntrada: [
        { nombre: "Inscripción", descripcion: "Kit del corredor incluido.", precio: 30000, cupo: 1000 },
      ],
    },
  ];

  let numeroTipo = 0;
  const eventos = eventosSinIds.map(
    (evento, indice) =>
      new Evento({
        ...evento,
        id: eventoId(indice + 1),
        tiposEntrada: evento.tiposEntrada.map(
          (tipo) => new TipoEntrada({ id: idFijo("0004", ++numeroTipo), ...tipo }),
        ),
      }),
  );

  return {
    categorias: datosCategorias.map((datos) => new Categoria(datos)),
    usuarios: datosUsuarios.map((datos) => new Usuario(datos)),
    eventos,
  };
}
